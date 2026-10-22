/* 简历速填 content script
 * 职责：扫描当前页面表单字段、按索引回填、触发完整事件链。
 * 注意：content script 不能使用 ES Module，保持自包含。
 */
(() => {
  if (window.__rqfInjected) return;
  window.__rqfInjected = true;

  const SKIP_TYPES = new Set([
    'hidden', 'submit', 'button', 'reset', 'file', 'image', 'password',
    'radio', 'checkbox', 'range', 'color'
  ]);

  function labelOf(el) {
    if (el.id && window.CSS && CSS.escape) {
      const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (label && label.textContent.trim()) return label.textContent.trim();
    }
    const wrap = el.closest('label');
    if (wrap && wrap.textContent.trim()) return wrap.textContent.trim();

    const aria = el.getAttribute('aria-label');
    if (aria && aria.trim()) return aria.trim();

    let node = el.previousElementSibling;
    let hops = 0;
    while (node && hops < 3) {
      const text = (node.textContent || '').trim().replace(/\s+/g, ' ');
      if (text && text.length <= 24) return text;
      node = node.previousElementSibling;
      hops += 1;
    }
    return el.getAttribute('placeholder') || el.getAttribute('name') || '';
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

    return nodes.map((el, idx) => {
      el.setAttribute('data-rqf-idx', String(idx));
      const type = el.isContentEditable
        ? 'richtext'
        : el.tagName === 'SELECT'
          ? 'select'
          : el.tagName === 'TEXTAREA'
            ? 'textarea'
            : (el.type || 'text');
      return {
        idx,
        label: labelOf(el),
        name: el.getAttribute('name') || '',
        placeholder: el.getAttribute('placeholder') || '',
        type,
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

  function fillOne(el, rawValue) {
    const value = String(rawValue ?? '').trim();
    if (!value) return false;

    if (el.tagName === 'SELECT') {
      const options = Array.from(el.options).filter((o) => o.value !== '' && o.text.trim() !== '');
      const hit = options.find((o) => o.text.trim() === value)
        || options.find((o) => o.text.includes(value) || value.includes(o.text.trim()))
        || options.find((o) => o.value === value);
      if (!hit) return false;
      el.value = hit.value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
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
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
      nativeSet(el, value);
      return true;
    }

    nativeSet(el, value);
    return true;
  }

  function fill(fills) {
    let count = 0;
    fills.forEach(({ idx, value }) => {
      const el = document.querySelector(`[data-rqf-idx="${idx}"]`);
      if (!el) return;
      try {
        if (fillOne(el, value)) count += 1;
      } catch {
        /* 单个控件失败不影响其余字段 */
      }
    });
    return count;
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === 'RQF_SCAN') {
      sendResponse({ ok: true, host: location.host, fields: scan() });
      return true;
    }
    if (msg?.type === 'RQF_FILL') {
      sendResponse({ ok: true, filled: fill(msg.fills || []) });
      return true;
    }
    return false;
  });
})();
