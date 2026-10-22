import { seedProfile } from './lib/seed.js';
import { escapeHtml, getByPath, today } from './lib/utils.js';

const MOCK_FIELDS = [
  { idx: 0, label: '姓名', type: 'text', required: true },
  { idx: 1, label: '手机号码', type: 'tel', required: true },
  { idx: 2, label: '电子邮箱', type: 'email', required: true },
  { idx: 3, label: '出生日期', type: 'date', required: false },
  { idx: 4, label: '现居城市', type: 'text', required: false },
  { idx: 5, label: '毕业院校', type: 'text', required: true },
  { idx: 6, label: '专业', type: 'text', required: true },
  { idx: 7, label: '学历', type: 'select', required: true },
  { idx: 8, label: '项目名称', type: 'text', required: true },
  { idx: 9, label: '担任角色', type: 'text', required: true },
  { idx: 10, label: '项目描述', type: 'textarea', required: false },
  { idx: 11, label: '自我评价', type: 'textarea', required: false },
  { idx: 12, label: '技术栈', type: 'text', required: false },
  { idx: 13, label: '期望薪资', type: 'text', required: false }
];

const RULES = [
  { re: /(姓名|full.?name|^name$)/i, group: '基本信息', path: 'full_name', conf: 'high' },
  { re: /(手机|电话|mobile|phone)/i, group: '基本信息', path: 'phone', conf: 'high' },
  { re: /(邮箱|邮件|e-?mail)/i, group: '基本信息', path: 'email', conf: 'high' },
  { re: /(出生|生日|birth|dob)/i, group: '基本信息', path: 'birth_date', conf: 'high' },
  { re: /(城市|现居|所在地|city|location)/i, group: '基本信息', path: 'location', conf: 'low' },
  { re: /(学校|院校|school)/i, group: '教育经历', path: 'education.0.school', conf: 'high' },
  { re: /(专业|major)/i, group: '教育经历', path: 'education.0.major', conf: 'high' },
  { re: /(学历|degree)/i, group: '教育经历', path: 'education.0.degree', conf: 'high' },
  { re: /(项目名称|project.?name)/i, group: '项目经历', path: 'experiences.0.name', conf: 'high' },
  { re: /(担任角色|角色|职位|role)/i, group: '项目经历', path: 'experiences.0.role', conf: 'high' },
  { re: /(项目描述|描述|description)/i, group: '项目经历', path: 'experiences.0.desc', conf: 'low' },
  { re: /(自我评价|个人评价|self.?evaluation)/i, group: '其他', path: 'self_evaluation', conf: 'high' }
];

const CANDIDATES = [
  ['姓名', 'full_name'],
  ['手机号', 'phone'],
  ['邮箱', 'email'],
  ['出生日期', 'birth_date'],
  ['所在城市', 'location'],
  ['毕业院校', 'education.0.school'],
  ['专业', 'education.0.major'],
  ['学历', 'education.0.degree'],
  ['项目1-名称', 'experiences.0.name'],
  ['项目1-角色', 'experiences.0.role'],
  ['项目1-描述', 'experiences.0.desc'],
  ['自我评价', 'self_evaluation'],
  ['GitHub', 'custom_fields.0.value']
];

const state = {
  screen: 'loading',
  host: '',
  adapter: '通用适配器',
  tabId: null,
  fields: [],
  profile: seedProfile,
  settings: { mapping_memory: true },
  remembered: null,
  mapping: [],
  query: '',
  picker: null,
  skipped: 0
};

const app = document.getElementById('app');

/* ---------------- 初始化 ---------------- */
async function init() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    state.tabId = tab?.id ?? null;
    try {
      state.host = new URL(tab.url).host;
    } catch {
      state.host = 'demo.recruit-site.com';
    }

    const store = await chrome.storage.local.get(['rqf_profile', 'rqf_settings']);
    state.profile = store.rqf_profile || seedProfile;
    state.settings = { mapping_memory: true, ...(store.rqf_settings || {}) };

    state.adapter = adapterFor(state.host);
    state.fields = await scanFields();

    if (state.settings.mapping_memory) {
      const key = mappingKey(state.host);
      const saved = await chrome.storage.local.get(key);
      state.remembered = saved[key] || null;
    }
  } catch (err) {
    console.warn('[简历速填] 初始化失败：', err);
    state.host = state.host || 'demo.recruit-site.com';
    state.fields = MOCK_FIELDS;
  }
  state.screen = 'popup';
  render();
}

function adapterFor(host) {
  if (/zhaopin\.com$/.test(host)) return '智联招聘专用';
  if (/51job\.com$/.test(host)) return '前程无忧专用';
  return '通用适配器';
}

function mappingKey(host) {
  return `rqf_mapping:${host}`;
}

async function scanFields() {
  if (!state.tabId) return MOCK_FIELDS;
  try {
    const res = await sendToTab({ type: 'RQF_SCAN' });
    return res?.fields?.length ? res.fields : MOCK_FIELDS;
  } catch {
    return MOCK_FIELDS;
  }
}

async function sendToTab(message) {
  try {
    return await chrome.tabs.sendMessage(state.tabId, message);
  } catch {
    await chrome.scripting.executeScript({ target: { tabId: state.tabId }, files: ['content.js'] });
    return await chrome.tabs.sendMessage(state.tabId, message);
  }
}

/* ---------------- 映射构建 ---------------- */
function matchRule(text) {
  return RULES.find((rule) => rule.re.test(text)) || null;
}

function buildMapping() {
  const groups = new Map();
  state.fields.forEach((field) => {
    const text = `${field.label || ''} ${field.name || ''}`.trim();
    const rule = matchRule(text);
    const storedPath = state.remembered?.items?.[field.label || `字段${field.idx}`];
    const skipped = storedPath === '_skip';
    const path = skipped ? null : (storedPath || rule?.path || null);
    const value = path ? getByPath(state.profile, path) : '';
    const group = rule?.group || '其他';

    const item = {
      idx: field.idx,
      site: field.label || field.name || `字段 ${field.idx + 1}`,
      required: field.required,
      path,
      value: Array.isArray(value) ? value.join('、') : String(value ?? ''),
      conf: skipped ? 'none' : storedPath ? 'high' : rule?.conf || 'none',
      skip: skipped
    };

    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(item);
  });

  const order = ['基本信息', '教育经历', '项目经历', '其他', '未匹配字段'];
  state.mapping = order
    .filter((g) => groups.has(g))
    .map((g) => ({ group: g, items: groups.get(g) }));
}

function allItems() {
  return state.mapping.flatMap((g) => g.items);
}

/* ---------------- 渲染 ---------------- */
function render() {
  if (state.screen === 'loading') {
    app.innerHTML = '<div class="loading"><div class="spinner"></div>正在扫描当前页面…</div>';
    return;
  }
  if (state.screen === 'mapping') {
    app.innerHTML = `${topbar('📍 字段映射确认')}${mappingBody()}${mappingFooter()}${state.picker ? pickerSheet() : ''}`;
    return;
  }
  if (state.screen === 'done') {
    app.innerHTML = `${topbar('🎉 填充完成')}${doneBody()}${doneFooter()}`;
    return;
  }
  app.innerHTML = `${topbar(`🌐 ${escapeHtml(state.host)}`)}${popupBody()}${popupFooter()}`;
}

function topbar(title) {
  return `<header class="topbar">
    <div class="domain">${title}</div>
    <button class="close" data-action="close" title="关闭">✕</button>
  </header>`;
}

function popupBody() {
  const total = state.fields.length;
  const matched = countMatched();
  const pending = total - matched;
  const p = state.profile;

  return `<div class="body">
    <div class="adapter card">
      <div class="icon">🎯</div>
      <div>
        <div class="t">${state.adapter}</div>
        <div class="s">${state.adapter === '通用适配器' ? '实时扫描 + 语义匹配' : '固定 DOM 结构 + 预设映射'}</div>
      </div>
    </div>
    <div class="stats">
      <div class="stat"><div class="n">${total}</div><div class="l">扫描字段</div></div>
      <div class="stat"><div class="n">${matched}</div><div class="l">已匹配</div></div>
      <div class="stat"><div class="n">${pending}</div><div class="l">待确认</div></div>
    </div>
    <div class="profile">
      <span class="dot" style="background:${p.color || '#1a1a1a'}"></span>
      <div>
        <div class="name">${escapeHtml(p.name || '未命名档案')}</div>
        <div class="sub">${escapeHtml(p.target || '')}</div>
      </div>
      <span class="arrow">›</span>
    </div>
    ${state.remembered ? `<div class="tip"><span>💡</span><span>检测到该官网有历史映射，将自动复用已确认的映射关系</span></div>` : ''}
  </div>`;
}

function countMatched() {
  return state.fields.filter((field) => {
    const text = `${field.label || ''} ${field.name || ''}`.trim();
    const stored = state.remembered?.items?.[field.label || `字段${field.idx}`];
    if (stored && stored !== '_skip') return true;
    return matchRule(text)?.conf === 'high';
  }).length;
}

function popupFooter() {
  return `<footer class="footer">
    <button class="btn btn-primary btn-block" data-action="open-mapping">确认映射并填充</button>
  </footer>`;
}

function mappingBody() {
  const items = allItems();
  const matched = items.filter((i) => i.path && !i.skip).length;
  const skipped = items.filter((i) => i.skip).length;
  const groups = state.mapping.map((g, gi) => `
    <div class="group">
      <div class="g-title">${g.group} · ${g.items.length}</div>
      ${g.items.map((it, ii) => row(it, gi, ii)).join('')}
    </div>`).join('');

  return `<div class="body">
    <div class="search">
      <input type="text" data-role="search" placeholder="搜索官网字段或档案字段…" value="${escapeHtml(state.query)}">
    </div>
    <div class="meta">共 ${items.length} 字段 · 已匹配 <b style="color:var(--success)">${matched}</b> · 留空 <b style="color:var(--warning)">${skipped}</b></div>
    ${groups}
  </div>`;
}

function row(item, gi, ii) {
  const status = item.skip ? 'skip' : (!item.path ? 'unmatched' : item.conf === 'low' ? 'low' : 'matched');
  const pill = item.skip
    ? ''
    : `<span class="pill ${item.path ? (item.conf === 'low' ? 'low' : 'high') : 'none'}">${
      item.path ? (item.conf === 'low' ? '低置信' : '高置信') : '未匹配'
    }</span>`;
  const text = item.skip ? '（留空不填）' : (item.value || '未匹配');

  return `<div class="mrow ${status}" data-site="${escapeHtml(item.site)}" data-value="${escapeHtml(item.value)}">
    <div class="site">${escapeHtml(item.site)}${item.required ? '<span class="req">*必填</span>' : ''}${pill}</div>
    <div class="map-row">
      <div class="field-value ${item.skip || !item.path ? 'empty' : ''}"
        data-action="pick" data-group="${gi}" data-index="${ii}">${escapeHtml(text)}</div>
      <button class="skip-btn ${item.skip ? 'on' : ''}" data-action="skip"
        data-group="${gi}" data-index="${ii}" title="留空不填">⊘</button>
    </div>
  </div>`;
}

function mappingFooter() {
  return `<footer class="footer">
    <button class="btn btn-ghost" style="flex:1" data-action="back-popup">返回</button>
    <button class="btn btn-primary" style="flex:2" data-action="fill">确认并填充</button>
  </footer>`;
}

function pickerSheet() {
  const { group, index } = state.picker;
  const items = CANDIDATES.map(([label, path]) => {
    const value = getByPath(state.profile, path);
    return `<div class="pick" data-action="pick-field" data-group="${group}" data-index="${index}"
      data-path="${path}">
      <span class="pl">${escapeHtml(label)}</span>
      <span class="pv">${escapeHtml(Array.isArray(value) ? value.join('、') : value ?? '')}</span>
    </div>`;
  }).join('');

  return `<div class="sheet-mask" data-action="close-sheet">
    <div class="sheet">
      <div class="sh"><span>选择档案字段</span>
        <button data-action="close-sheet" style="color:var(--text-3)">✕</button></div>
      <div class="sb">
        <div class="pick skip" data-action="pick-skip" data-group="${group}" data-index="${index}">⊘ 留空不填</div>
        ${items}
      </div>
    </div>
  </div>`;
}

function doneBody() {
  const total = allItems().length;
  const filled = allItems().filter((i) => i.path && !i.skip).length;
  return `<div class="body">
    <div class="done">
      <div class="check">✓</div>
      <h3>已成功预填表单</h3>
      <div class="sub">请仔细检查后手动点击提交</div>
      <div class="done-stats">
        <div class="done-stat"><div class="n">${filled}</div><div class="l">已填充字段</div></div>
        <div class="done-stat"><div class="n">${state.skipped}</div><div class="l">留空字段</div></div>
      </div>
      <div class="warn"><span>⚠</span>
        <span><b>请人工检查并点击提交。</b>产品不会自动提交，避免替用户做出承诺性行为。</span>
      </div>
      <div class="chips">
        <span class="chip">✓ 文本字段</span>
        <span class="chip">✓ 下拉选择</span>
        <span class="chip">✓ 日期控件</span>
        <span class="chip">✓ 受控组件</span>
      </div>
    </div>
  </div>`;
}

function doneFooter() {
  return `<footer class="footer">
    <button class="btn btn-ghost" style="flex:1" data-action="edit-mapping">返回修改</button>
    <button class="btn btn-primary" style="flex:2" data-action="close">完成</button>
  </footer>`;
}

/* ---------------- 交互 ---------------- */
app.addEventListener('click', async (event) => {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  const { group, index, path } = target.dataset;

  if (action === 'close') {
    window.close();
    return;
  }
  if (action === 'open-mapping') {
    buildMapping();
    state.screen = 'mapping';
    render();
    return;
  }
  if (action === 'back-popup') {
    state.screen = 'popup';
    render();
    return;
  }
  if (action === 'edit-mapping') {
    state.screen = 'mapping';
    render();
    return;
  }
  if (action === 'skip') {
    const item = state.mapping[group]?.items[index];
    if (item) {
      item.skip = !item.skip;
      if (item.skip) item.path = null;
      render();
    }
    return;
  }
  if (action === 'pick') {
    state.picker = { group: Number(group), index: Number(index) };
    render();
    return;
  }
  if (action === 'close-sheet') {
    if (target.classList.contains('sheet-mask') && event.target !== target) return;
    state.picker = null;
    render();
    return;
  }
  if (action === 'pick-field') {
    const item = state.mapping[group]?.items[index];
    if (item) {
      item.path = path;
      const value = getByPath(state.profile, path);
      item.value = Array.isArray(value) ? value.join('、') : String(value ?? '');
      item.conf = 'high';
      item.skip = false;
    }
    state.picker = null;
    render();
    return;
  }
  if (action === 'pick-skip') {
    const item = state.mapping[group]?.items[index];
    if (item) {
      item.path = null;
      item.value = '';
      item.skip = true;
      item.conf = 'none';
    }
    state.picker = null;
    render();
    return;
  }
  if (action === 'fill') {
    await doFill();
  }
});

app.addEventListener('input', (event) => {
  if (event.target.dataset.role !== 'search') return;
  const q = event.target.value.trim().toLowerCase();
  state.query = event.target.value;
  app.querySelectorAll('.mrow').forEach((rowEl) => {
    const text = `${rowEl.dataset.site} ${rowEl.dataset.value}`.toLowerCase();
    rowEl.style.display = !q || text.includes(q) ? '' : 'none';
  });
  app.querySelectorAll('.group').forEach((g) => {
    const visible = Array.from(g.querySelectorAll('.mrow')).some((r) => r.style.display !== 'none');
    const title = g.querySelector('.g-title');
    if (title) title.style.display = visible ? '' : 'none';
  });
});

/* ---------------- 填充 ---------------- */
async function doFill() {
  const items = allItems();
  const fills = items
    .filter((i) => i.path && !i.skip && i.value !== '')
    .map((i) => ({ idx: i.idx, value: i.value }));

  state.skipped = items.filter((i) => i.skip).length;

  try {
    await sendToTab({ type: 'RQF_FILL', fills });
  } catch {
    /* 页面不可注入时仍展示映射完成态 */
  }

  if (state.settings.mapping_memory) {
    const payload = { host: state.host, updated_at: today(), items: {} };
    items.forEach((i) => {
      payload.items[i.site] = i.skip ? '_skip' : i.path;
    });
    await chrome.storage.local.set({ [mappingKey(state.host)]: payload });
    state.remembered = payload;
  }

  state.screen = 'done';
  render();
}

init();
