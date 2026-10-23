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

/**
 * RULES：页面字段 label → 档案路径的映射规则
 * - 固定字段（姓名、手机...）: path 直接指向档案字段
 * - 数组字段（教育经历、项目经历...）: arrayKey 表示同一类字段组，pathTemplate 带 {i} 下标占位
 *   buildMapping 会按页面出现顺序自动分配下标 0, 1, 2...
 */
const RULES = [
  /* === 基本信息（单值） === */
  { re: /(姓名|name(?!d)|full.?name)/i, group: '基本信息', path: 'full_name', conf: 'high' },
  { re: /(手机|电话|mobile|phone|tel)/i, group: '基本信息', path: 'phone', conf: 'high' },
  { re: /(邮箱|邮件|e-?mail)/i, group: '基本信息', path: 'email', conf: 'high' },
  { re: /(出生|生日|birth|dob)/i, group: '基本信息', path: 'birth_date', conf: 'high' },
  { re: /(城市|现居|所在地|居住地|city|location|address)/i, group: '基本信息', path: 'location', conf: 'low' },
  /* === 教育经历（多值） === */
  { re: /(学校名称|毕业院校|毕业学校|所在院校|所在学校|就读学校|教育院校|学校|院校|university|college|school)/i,
    group: '教育经历', arrayKey: 'edu_school', pathTemplate: 'education.{i}.school', conf: 'high' },
  { re: /(专业名称|所学专业|主修专业|专业方向|专业|major|specialty)/i,
    group: '教育经历', arrayKey: 'edu_major', pathTemplate: 'education.{i}.major', conf: 'high' },
  { re: /(第一学历|最高学历|学历层次|学历|degree|education)/i,
    group: '教育经历', arrayKey: 'edu_degree', pathTemplate: 'education.{i}.degree', conf: 'high' },
  { re: /(学位类型|学位|academic.?degree|bachelor|master|doctor)/i,
    group: '教育经历', arrayKey: 'edu_academic', pathTemplate: 'education.{i}.academic_degree', conf: 'medium' },
  { re: /(绩点|gpa|平均绩点|学分绩点|成绩|均分|加权)/i,
    group: '教育经历', arrayKey: 'edu_gpa', pathTemplate: 'education.{i}.gpa', conf: 'medium' },
  { re: /(主修课程|所学课程|课程|courses?)/i,
    group: '教育经历', arrayKey: 'edu_courses', pathTemplate: 'education.{i}.courses', conf: 'low' },
  { re: /(教育经历时间|就读时间|在校时间|起止时间|开始时间|结束时间|入学时间|毕业时间|学习时间|period|start.?date|end.?date)/i,
    group: '教育经历', arrayKey: 'edu_period', pathTemplate: 'education.{i}.period', conf: 'medium' },
  /* === 项目 / 实践经历（多值） === */
  { re: /(项目名称|项目名|实践名称|实践项目|实习名称|工作单位|公司名称|单位名称|project.?name|project|experience)/i,
    group: '项目经历', arrayKey: 'exp_name', pathTemplate: 'experiences.{i}.name', conf: 'high' },
  { re: /(担任角色|项目角色|担任职务|实习岗位|职位|岗位|职务|角色|role|position|title)/i,
    group: '项目经历', arrayKey: 'exp_role', pathTemplate: 'experiences.{i}.role', conf: 'high' },
  { re: /(开始时间|结束时间|起止时间|项目时间|实习时间|工作时间|start.?date|end.?date)/i,
    group: '项目经历', arrayKey: 'exp_period', pathTemplate: 'experiences.{i}.start', conf: 'medium' },
  { re: /(项目描述|项目介绍|项目详情|工作描述|工作职责|个人职责|实习内容|工作内容|实践内容|description|detail|responsibility)/i,
    group: '项目经历', arrayKey: 'exp_desc', pathTemplate: 'experiences.{i}.desc', conf: 'low' },
  /* === 语言能力（多值） === */
  { re: /(英语水平|外语水平|语言能力|语言类型|语种|language)/i,
    group: '其他', arrayKey: 'lang_lang', pathTemplate: 'languages.{i}.lang', conf: 'medium' },
  { re: /(英语等级|外语等级|水平等级|等级|level)/i,
    group: '其他', arrayKey: 'lang_level', pathTemplate: 'languages.{i}.level', conf: 'medium' },
  { re: /(语言成绩|考试成绩|分数|score|cet|tem|ielts|toefl)/i,
    group: '其他', arrayKey: 'lang_score', pathTemplate: 'languages.{i}.score', conf: 'medium' },
  /* === 自我评价 === */
  { re: /(自我评价|个人评价|个人简介|自我介绍|个人介绍|self.?evaluation|summary|objective)/i,
    group: '其他', path: 'self_evaluation', conf: 'high' }
];

/**
 * CANDIDATES：手动选择时可挑选的档案字段
 * 动态生成 education.0~2、experiences.0~2 的全套选项
 */
function buildCandidates(profile) {
  const list = [
    ['姓名', 'full_name'],
    ['手机号', 'phone'],
    ['邮箱', 'email'],
    ['出生日期', 'birth_date'],
    ['所在城市', 'location']
  ];
  // 动态枚举教育经历
  const eduCount = Math.max(profile?.education?.length || 0, 1);
  for (let i = 0; i < eduCount && i < 3; i++) {
    list.push(`教育${i + 1}-学校`, `education.${i}.school`);
    list.push(`教育${i + 1}-专业`, `education.${i}.major`);
    list.push(`教育${i + 1}-学历`, `education.${i}.degree`);
    list.push(`教育${i + 1}-学位`, `education.${i}.academic_degree`);
    list.push(`教育${i + 1}-起止时间`, `education.${i}.period`);
    list.push(`教育${i + 1}-绩点`, `education.${i}.gpa`);
  }
  // 动态枚举项目/实践
  const expCount = Math.max(profile?.experiences?.length || 0, 1);
  for (let i = 0; i < expCount && i < 3; i++) {
    list.push(`经历${i + 1}-名称`, `experiences.${i}.name`);
    list.push(`经历${i + 1}-角色`, `experiences.${i}.role`);
    list.push(`经历${i + 1}-开始时间`, `experiences.${i}.start`);
    list.push(`经历${i + 1}-结束时间`, `experiences.${i}.end`);
    list.push(`经历${i + 1}-描述`, `experiences.${i}.desc`);
  }
  list.push(['自我评价', 'self_evaluation']);
  if (profile?.custom_fields?.length) {
    profile.custom_fields.forEach((f, i) => {
      list.push([f.label || `自定义字段${i + 1}`, `custom_fields.${i}.value`]);
    });
  }
  return list;
}

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
  skipped: 0,
  debug: null // { scan: [...], eduSummary: '...', expSummary: '...' }
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

    // 诊断日志：打印扫描到的所有字段（可在扩展弹窗 DevTools Console 查看）
    console.log('[简历速填] 🔍 扫描完成，共', state.fields.length, '个字段：');
    state.fields.forEach((f) => {
      console.log(`  [${f.idx}] label="${f.label || '(空)'}" name="${f.name}" type=${f.type} required=${f.required}`);
    });

    // 预构建一次映射用于诊断摘要（展示在弹窗 UI 上，用户不用跑 Console）
    const summary = buildDebugSummary();
    state.debug = summary;
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
  if (!state.tabId) {
    console.warn('[简历速填] 没有 tabId，使用 mock 数据');
    return MOCK_FIELDS;
  }
  // 强制注入最新 content script
  try {
    await chrome.scripting.executeScript({ target: { tabId: state.tabId }, files: ['content.js'] });
  } catch (err) {
    console.warn('[简历速填] 注入 content.js 失败：', err?.message);
  }
  try {
    const res = await chrome.tabs.sendMessage(state.tabId, { type: 'RQF_SCAN' });
    if (res?.fields?.length) return res.fields;
    console.warn('[简历速填] content 返回空字段，使用 mock 数据');
    return MOCK_FIELDS;
  } catch (err) {
    console.warn('[简历速填] 扫描失败：', err?.message, ' 使用 mock 数据');
    return MOCK_FIELDS;
  }
}

async function sendToTab(message) {
  // 先尝试注入最新 content.js（如果已存在会因版本门控自动替换）
  try {
    await chrome.scripting.executeScript({ target: { tabId: state.tabId }, files: ['content.js'] });
  } catch { /* 忽略注入错误，可能权限受限 */ }
  // 发送消息
  try {
    return await chrome.tabs.sendMessage(state.tabId, message);
  } catch (err) {
    console.warn('[简历速填] 发消息失败：', err?.message || err);
    return null;
  }
}

/* ---------------- 映射构建 ---------------- */
function matchRule(text) {
  return RULES.find((rule) => rule.re.test(text)) || null;
}

function buildMapping() {
  const groups = new Map();
  const arrayCounters = {}; // arrayKey -> 当前下标计数器
  const labelOccurences = {}; // label -> 出现次数（检测旧记忆是否应该跳过）

  state.fields.forEach((field) => {
    const text = `${field.label || ''} ${field.name || ''}`.trim();
    const rule = matchRule(text);

    // 先看是否有记忆中的映射（记忆优先级最高，但数组字段有例外）
    const memoryKey = field.label || `字段${field.idx}`;
    const storedPath = state.remembered?.items?.[memoryKey];
    const skipped = storedPath === '_skip';

    let path = null;
    let conf = 'none';

    if (skipped) {
      path = null; conf = 'none';
    } else if (storedPath) {
      // 记忆存在，但如果记忆指向数组字段（education.0.* / experiences.0.*），
      // 且该 label 在页面出现了多次，说明记忆是旧版本遗留的硬编码，
      // 跳过记忆让 RULES 重新按顺序分配下标
      const isArrayMem = /^(education|experiences|languages)\.\d+\./.test(storedPath);
      labelOccurences[memoryKey] = (labelOccurences[memoryKey] || 0) + 1;
      if (isArrayMem && labelOccurences[memoryKey] > 1) {
        // 旧记忆跳过，用 RULES 重新分配
        console.log(`  ↳ 跳过旧记忆 [${memoryKey}] -> ${storedPath}（数组字段第${labelOccurences[memoryKey]}次出现）`);
        path = null; conf = 'none';
      } else {
        path = storedPath; conf = 'high';
      }
    }

    if (!path && rule) {
      conf = rule.conf || 'none';
      if (rule.pathTemplate && rule.arrayKey) {
        // 数组字段：按出现顺序分配下标
        const key = rule.arrayKey;
        const idx = arrayCounters[key] || 0;
        arrayCounters[key] = idx + 1;
        path = rule.pathTemplate.replace('{i}', idx);
      } else {
        path = rule.path || null;
      }
    }

    const value = path ? getByPath(state.profile, path) : '';
    const group = rule?.group || '其他';

    const item = {
      idx: field.idx,
      site: field.label || field.name || `字段 ${field.idx + 1}`,
      required: field.required,
      path,
      value: Array.isArray(value) ? value.join('、') : String(value ?? ''),
      conf,
      skip: false
    };

    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(item);
  });

  // 映射诊断日志
  console.log('[简历速填] 📋 映射结果：');
  for (const [group, items] of groups) {
    console.log(`  —— ${group}（${items.length}个）——`);
    items.forEach((it) => {
      console.log(`  [${it.idx}] "${it.site}" → ${it.path || '(未匹配)'} | 值: "${it.value.slice(0, 30)}"`);
    });
  }
  console.log('  📊 数组计数器:', arrayCounters);

  const order = ['基本信息', '教育经历', '项目经历', '其他', '未匹配字段'];
  state.mapping = order
    .filter((g) => groups.has(g))
    .map((g) => ({ group: g, items: groups.get(g) }));
}

function allItems() {
  return state.mapping.flatMap((g) => g.items);
}

/**
 * 初始化时快速模拟一次映射，生成诊断摘要
 * 返回 { edu: [...], exp: [...], ungrouped: [{idx, label, name, why}] }
 */
function buildDebugSummary() {
  // 跟 buildMapping 一模一样的规则，只跑一次不写 state.mapping
  const counters = {};
  const result = { edu: [], exp: [], all: [] };

  state.fields.forEach((f) => {
    const text = `${f.label || ''} ${f.name || ''}`.trim();
    const rule = matchRule(text);

    let path = null;
    if (rule?.pathTemplate && rule.arrayKey) {
      const idx = counters[rule.arrayKey] || 0;
      counters[rule.arrayKey] = idx + 1;
      path = rule.pathTemplate.replace('{i}', idx);
    } else if (rule?.path) {
      path = rule.path;
    }

    const value = path ? getByPath(state.profile, path) : '';
    const rec = {
      idx: f.idx, label: f.label || '(无label)', name: f.name || '(无name)',
      matched: !!path, path: path || null,
      value: Array.isArray(value) ? value.join('、') : String(value ?? ''),
      rule: rule?.group || null,
      why: path ? (value ? '✅ 有值' : '⚠️ 匹配但档案无值') : '❌ 未匹配'
    };

    if (rule?.group === '教育经历') result.edu.push(rec);
    else if (rule?.group === '项目经历') result.exp.push(rec);
    else result.all.push(rec);
  });

  result.counters = counters;
  return result;
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

  const dbg = state.debug;
  let debugHtml = '';
  if (dbg) {
    const eduOk = dbg.edu.filter((r) => r.matched && r.value);
    const eduBad = dbg.edu.filter((r) => !r.matched || !r.value);
    const expOk = dbg.exp.filter((r) => r.matched && r.value);

    const eduRows = dbg.edu.map((r) => {
      const cls = !r.matched ? 'bad' : !r.value ? 'warn' : 'ok';
      return `<div class="dc-row ${cls}">
        <span class="dc-idx">[${r.idx}]</span>
        <span class="dc-label">${escapeHtml(r.label)}</span>
        <span class="dc-path">${r.path || '—'}</span>
        <span class="dc-why">${r.why}</span>
      </div>`;
    }).join('') || '<div style="color:var(--text-3);font-size:11px;padding:4px 0">页面上没扫描到任何教育相关字段</div>';

    const expRows = dbg.exp.map((r) => {
      const cls = !r.matched ? 'bad' : !r.value ? 'warn' : 'ok';
      return `<div class="dc-row ${cls}">
        <span class="dc-idx">[${r.idx}]</span>
        <span class="dc-label">${escapeHtml(r.label)}</span>
        <span class="dc-path">${r.path || '—'}</span>
        <span class="dc-why">${r.why}</span>
      </div>`;
    }).join('');

    debugHtml = `<div class="debug-card">
      <div class="dc-head">
        <div class="dc-title">🔧 诊断：教育 ${eduOk.length}/${dbg.edu.length} 成功 · 项目 ${expOk.length}/${dbg.exp.length} 成功</div>
        <span class="dc-toggle" data-action="toggle-debug">展开 ▾</span>
      </div>
      <div class="dc-body">
        <div class="dc-section">
          <div class="dc-section-title">🎓 教育经历（扫描到 ${dbg.edu.length} 个相关字段）</div>
          ${eduRows}
        </div>
        ${expRows ? `<div class="dc-section">
          <div class="dc-section-title">💼 项目/实践（扫描到 ${dbg.exp.length} 个相关字段）</div>
          ${expRows}
        </div>` : ''}
        ${dbg.counters && Object.keys(dbg.counters).length ? `<div class="dc-section">
          <div class="dc-section-title">📊 数组字段分配计数器</div>
          <div style="font-family:monospace;font-size:10px;color:#555;padding:4px 0">${JSON.stringify(dbg.counters)}</div>
        </div>` : ''}
      </div>
    </div>`;
  }

  return `<div class="body">
    ${debugHtml}
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
    const rule = matchRule(text);
    return rule && (rule.conf === 'high');
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
  const candidates = buildCandidates(state.profile);
  const items = candidates.map(([label, path]) => {
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
  if (action === 'toggle-debug') {
    const card = target.closest('.debug-card');
    if (card) {
      card.classList.toggle('open');
      target.textContent = card.classList.contains('open') ? '收起 ▴' : '展开 ▾';
    }
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
    .map((i) => ({ idx: i.idx, value: i.value, label: i.site, path: i.path }));

  state.skipped = items.filter((i) => i.skip).length;

  console.log('[简历速填 popup] 🚀 开始填充，', fills.length, '个字段：');
  fills.forEach((f) => console.log(`  [${f.idx}] "${f.label}" ← "${f.value.slice(0, 40)}"  (${f.path})`));

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
