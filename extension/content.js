/* 简历速填 content script
 * 职责：扫描当前页面表单字段、按索引回填、触发完整事件链。
 * 注意：content script 不能使用 ES Module，保持自包含。
 */
(() => {
  const VERSION = 2; // 每次大改版本号 +1，让旧 content 自动失效
  if (window.__rqfVersion === VERSION) return;
  window.__rqfVersion = VERSION;
  // 清除旧监听器（重新注册）
  if (window.__rqfListener) chrome.runtime.onMessage.removeListener(window.__rqfListener);

  const SKIP_TYPES = new Set([
    'hidden', 'submit', 'button', 'reset', 'file', 'image', 'password',
    'radio', 'checkbox', 'range', 'color'
  ]);

  /**
   * 提取表单字段的可读标签
   * 按优先级依次尝试：for= 关联的 label → 包在 <label> 里 → aria-label
   * → 父容器内第一个 <label> 子节点 → placeholder → name
   * → 父容器内以"label"等类名结尾的子节点文本 → 父容器的直接子文本节点
   */
  function labelOf(el) {
    // 1. for= 关联的 label
    if (el.id && window.CSS && CSS.escape) {
      try {
        const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (label && label.textContent.trim()) return label.textContent.trim();
      } catch { /* id 里有特殊字符时 CSS.escape 可能失败 */ }
    }

    // 2. 直接包在 <label> 里
    const wrap = el.closest('label');
    if (wrap && wrap.textContent.trim()) {
      // 去掉 input 自身的 value 干扰
      const clone = wrap.cloneNode(true);
      clone.querySelectorAll('input,textarea,select').forEach((n) => n.remove());
      const text = clone.textContent.trim();
      if (text) return text;
    }

    // 3. aria-label
    const aria = el.getAttribute('aria-label');
    if (aria && aria.trim()) return aria.trim();

    // 4. 父容器内的 <label> 子节点
    const parent = el.closest('[class*="form-item"],[class*="formItem"],[class*="field"],[class*="row"],[class*="item"],div,li');
    if (parent && parent !== document.body) {
      const childLabel = parent.querySelector(':scope > label');
      if (childLabel && childLabel.textContent.trim()) return childLabel.textContent.trim();

      // 5. 父容器内以 "label/title/name/head" 结尾的类名子节点
      const labelLike = parent.querySelector(
        ':scope > [class*="label"],:scope > [class*="Label"],:scope > [class*="title"],:scope > [class*="Title"],' +
        ':scope > [class*="name"],:scope > [class*="Name"],:scope > [class*="head"],:scope > [class*="Head"]'
      );
      if (labelLike && labelLike.textContent.trim()) return labelLike.textContent.trim();
    }

    // 6. placeholder（兜底）
    const ph = el.getAttribute('placeholder');
    if (ph && ph.trim()) return ph.trim();

    // 7. name 属性
    const name = el.getAttribute('name');
    if (name && name.trim()) return name.trim();

    return '';
  }

  function scan() {
    const nodes = Array.from(
      document.querySelectorAll('input, textarea, select, [contenteditable="true"]')
    ).filter((el) => {
      if (el.disabled) return false;
      if (el.tagName === 'INPUT' && SKIP_TYPES.has((el.type || 'text').toLowerCase())) return false;
      if (el.closest('[data-rqf-skip]')) return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });

    console.log('[简历速填 content] 🔎 扫描到', nodes.length, '个可见表单元素：');

    return nodes.map((el, idx) => {
      el.setAttribute('data-rqf-idx', String(idx));
      const type = el.isContentEditable
        ? 'richtext'
        : el.tagName === 'SELECT'
          ? 'select'
          : el.tagName === 'TEXTAREA'
            ? 'textarea'
            : (el.type || 'text');
      const label = labelOf(el);
      const name = el.getAttribute('name') || '';
      const placeholder = el.getAttribute('placeholder') || '';

      // 只打印前 50 个，避免 log 爆炸
      if (idx < 50) {
        console.log(`  [${idx}] ${el.tagName}.${el.type || ''} label="${label || '(空)'}" name="${name}" placeholder="${placeholder}" disabled=${el.disabled}`);
      }

      return {
        idx, label, name, placeholder, type,
        required: el.required || el.getAttribute('aria-required') === 'true',
        maxLength: el.maxLength > 0 ? el.maxLength : null
      };
    });
  }

  function nativeSet(el, value) {
    const proto = el.tagName === 'TEXTAREA'
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  /**
   * select 模糊匹配：处理"硕士" vs "硕士研究生"、"本科" vs "本科及以上"等差异
   */
  function findSelectOption(selectEl, rawValue) {
    const value = String(rawValue ?? '').trim();
    if (!value) return null;
    const v = value.toLowerCase();

    // 收集所有可见 option
    const options = Array.from(selectEl.options).filter((o) => o.text.trim() !== '');

    // 1. 精确匹配
    let hit = options.find((o) => o.text.trim() === value);
    if (hit) return hit;

    // 2. option 文本完整包含 value（如 option="硕士研究生" 包含 "硕士"）
    hit = options.find((o) => o.text.trim().includes(value));
    if (hit) return hit;

    // 3. value 完整包含 option 文本
    hit = options.find((o) => value.includes(o.text.trim()));
    if (hit) return hit;

    // 4. value 包含 option 的小写（处理中英文混合）
    hit = options.find((o) => value.includes(o.text.trim().toLowerCase()));
    if (hit) return hit;

    // 5. 关键词映射：学历同义词
    const DEGREE_MAP = {
      '硕士': ['master', '研究生', '硕士研究生', '硕士及以上'],
      '本科': ['学士', '本科及以上', '本科及以下', '本', 'bachelor'],
      '大专': ['专科', '大专及以上', '高职'],
      '博士': ['doctor', '博士生', '博士后'],
      '高中': ['中专', '职高'],
      '不限': ['无', '任意']
    };
    const synonyms = DEGREE_MAP[value] || [value];
    for (const syn of synonyms) {
      hit = options.find((o) => o.text.trim().includes(syn) || o.value.includes(syn));
      if (hit) return hit;
    }

    // 6. 最后兜底：value 与 option 文本有任何 2 字符以上的重叠
    hit = options.find((o) => {
      const t = o.text.trim();
      for (let i = 0; i <= t.length - 2; i++) {
        if (v.includes(t.slice(i, i + 2))) return true;
      }
      return false;
    });

    return hit || null;
  }

  function fillOne(el, rawValue) {
    const value = String(rawValue ?? '').trim();
    if (!value) {
      console.log('  → ⏭️ 跳过（值为空）');
      return false;
    }

    if (el.tagName === 'SELECT') {
      const hit = findSelectOption(el, value);
      if (!hit) {
        const opts = Array.from(el.options).map((o) => `"${o.text.trim()}"`).slice(0, 10).join(', ');
        console.log(`  → ❌ select 匹配失败  value="${value}"  可选: [${opts}]`);
        return false;
      }
      el.value = hit.value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      console.log(`  → ✅ select 选了 "${hit.text.trim()}"`);
      return true;
    }

    if (el.isContentEditable) {
      el.focus();
      el.textContent = value;
      el.dispatchEvent(new InputEvent('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }

    if (el.type === 'date') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        console.log(`  → ⏭️ date 格式不对："${value}"`);
        return false;
      }
      nativeSet(el, value);
      return true;
    }

    nativeSet(el, value);
    return true;
  }

  function fill(fills) {
    let count = 0;
    console.log('\n[简历速填 content] 📝 开始填充', fills.length, '个字段：');
    fills.forEach(({ idx, value, label }) => {
      const el = document.querySelector(`[data-rqf-idx="${idx}"]`);
      if (!el) {
        console.log(`  [${idx}] "${label || '?'}" → ⚠️ 找不到 DOM 元素（页面可能刷新了）`);
        return;
      }
      console.log(`  [${idx}] label="${label || '?'}" (${el.tagName}/${el.type || el.tagName})  ←  "${String(value).slice(0, 50)}"`);
      try {
        if (fillOne(el, value)) count += 1;
      } catch (err) {
        console.log(`  → ❌ 异常: ${err.message}`);
      }
    });
    console.log(`\n[简历速填 content] 填充完成：${count}/${fills.length} 成功`);
    return count;
  }

  const RQF_LISTENER = (msg, _sender, sendResponse) => {
    if (msg?.type === 'RQF_SCAN') {
      sendResponse({ ok: true, host: location.host, fields: scan() });
      return true;
    }
    if (msg?.type === 'RQF_FILL') {
      sendResponse({ ok: true, filled: fill(msg.fills || []) });
      return true;
    }
    return false;
  };
  window.__rqfListener = RQF_LISTENER;
  chrome.runtime.onMessage.addListener(RQF_LISTENER);
})();
