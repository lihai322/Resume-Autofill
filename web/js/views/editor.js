import { getProfile } from '../store.js?v=20261023s';
import { COLORS } from '../seed.js?v=20261023s';
import { escapeHtml, ageFrom, hexA } from '../utils.js?v=20261023s';

const NAV = [
  { k: 'basic', icon: '👤', label: '基本信息' },
  { k: 'edu', icon: '🎓', label: '学校' },
  { k: 'exp', icon: '💼', label: '项目/实践' },
  { k: 'honor', icon: '🏆', label: '荣誉奖励' },
  { k: 'lang', icon: '🗣', label: '语言能力' },
  { k: 'eval', icon: '✍', label: '自我评价' },
  { k: 'custom', icon: '⚙', label: '自定义字段' }
];

function input(label, path, value, extra = '') {
  return `<div class="field"><label>${label}</label>
    <input data-path="${path}" value="${escapeHtml(value)}" ${extra}></div>`;
}

export function render() {
  const p = getProfile();
  if (!p) return '<div class="empty">档案不存在</div>';
  const age = ageFrom(p.birth_date);

  return `
    <div class="page-head">
      <div>
        <h1>编辑档案</h1>
        <p>${escapeHtml(p.name)} · 年龄 ${age} 岁（由出生日期实时派生，不存储）</p>
      </div>
      <div class="actions">
        <button class="btn btn-ghost" onclick="A.go('list')">← 返回</button>
        <button class="btn btn-primary" onclick="A.saveProfile()">保存</button>
      </div>
    </div>
    <div class="editor-layout">
      <div class="editor-nav">
        ${NAV.map((n) => `<div class="nav-item" onclick="A.scrollTo('sec-${n.k}')">
          <span>${n.icon}</span><span>${n.label}</span></div>`).join('')}
      </div>
      <div class="editor-body">
        ${basicSection(p)}
        ${educationSection(p)}
        ${experienceSection(p)}
        ${honorSection(p)}
        ${languageSection(p)}
        ${evaluationSection(p)}
        ${customSection(p)}
      </div>
    </div>`;
}

function basicSection(p) {
  const initial = escapeHtml((p.full_name || '?').slice(0, 1));
  return `<div id="sec-basic" class="editor-section card" style="padding:24px">
    <h2>👤 基本信息</h2>
    <div class="flex gap-16 mb-16 items-center">
      <div class="avatar" style="width:64px;height:64px;font-size:24px">${initial}</div>
      <div>
        <button class="btn btn-ghost btn-sm">更换头像</button>
        <p class="text-xs text-3 mt-8">PDF 内嵌头像提取失败时可手动补传</p>
      </div>
    </div>
    <div class="row-2">
      ${input('姓名', 'full_name', p.full_name)}
      ${input('求职方向', 'target', p.target)}
      ${input('出生日期 <span class="text-xs text-3">（年龄自动计算）</span>', 'birth_date', p.birth_date, 'type="date"')}
      ${input('手机号', 'phone', p.phone)}
      ${input('邮箱', 'email', p.email)}
      ${input('所在城市', 'location', p.location)}
      <div class="field"><label>档案颜色 <span class="text-xs text-3">（决定小项目卡片整体背景色）</span></label>
        <div class="flex gap-8" style="padding-top:8px">
          ${COLORS.map((c) => `<span class="color-dot" title="${c}"
            style="background:${c};box-shadow:0 0 0 2px ${p.color === c ? 'var(--accent)' : hexA('#ffffff', 0.9)},0 0 0 3px ${p.color === c ? 'var(--accent)' : 'var(--border)'}"
            onclick="A.setColor('${c}')"></span>`).join('')}
        </div>
      </div>
    </div>
  </div>`;
}

function educationSection(p) {
  const items = (p.education || []).map((ed, i) => `
    <div class="exp-item">
      <div class="exp-head">
        <div class="t">${escapeHtml(ed.school || '未填写学校')}</div>
        <span class="chip">${escapeHtml(ed.degree || '学历')}</span>
      </div>
      <div class="row-2">
        ${input('毕业院校', `education.${i}.school`, ed.school)}
        ${input('起止时间', `education.${i}.period`, ed.period)}
        ${input('学历', `education.${i}.degree`, ed.degree)}
        ${input('学位', `education.${i}.academic_degree`, ed.academic_degree)}
        ${input('绩点', `education.${i}.gpa`, ed.gpa)}
        ${input('专业', `education.${i}.major`, ed.major)}
      </div>
      <div class="field"><label>主修课程</label>
        <input data-path="education.${i}.courses" value="${escapeHtml(ed.courses || '')}" placeholder="如：数据结构、操作系统、计算机网络"></div>
      <div class="flex" style="justify-content:flex-end">
        <button class="icon-btn" title="删除" onclick="A.removeItem('education',${i})">✕</button>
      </div>
    </div>`).join('');

  return `<div id="sec-edu" class="editor-section card" style="padding:24px">
    <h2>🎓 学校 <span class="chip chip-accent" style="font-weight:400;font-size:11px">教育经历</span></h2>
    ${items || '<div class="empty" style="padding:24px">暂无学校信息</div>'}
    <button class="btn btn-ghost btn-sm" onclick="A.addItem('education')">+ 添加学校</button>
  </div>`;
}

function experienceSection(p) {
  const items = p.experiences.map((e, i) => `
    <div class="exp-item">
      <div class="exp-head">
        <div class="t">${escapeHtml(e.type)} · ${escapeHtml(e.name)}</div>
        <span class="chip">${escapeHtml(e.type)}</span>
      </div>
      <div class="row-2">
        ${input('名称', `experiences.${i}.name`, e.name)}
        ${input('角色', `experiences.${i}.role`, e.role)}
        ${input('开始时间', `experiences.${i}.start`, e.start)}
        ${input('结束时间', `experiences.${i}.end`, e.end)}
      </div>
      <div class="field"><label>描述</label>
        <textarea rows="2" data-path="experiences.${i}.desc">${escapeHtml(e.desc)}</textarea></div>
      <div class="field"><label>成果</label>
        <input data-path="experiences.${i}.achievements" value="${escapeHtml((e.achievements || []).join('、'))}"
          placeholder="多条成果用顿号分隔"></div>
      <div class="flex justify-between items-center">
        <span class="text-xs text-3">项目与实践使用统一结构，由类型区分</span>
        <button class="icon-btn" title="删除" onclick="A.removeItem('experiences',${i})">✕</button>
      </div>
    </div>`).join('');

  return `<div id="sec-exp" class="editor-section card" style="padding:24px">
    <h2>💼 项目 / 实践经历 <span class="chip chip-accent" style="font-weight:400;font-size:11px">统一结构</span></h2>
    ${items || '<div class="empty" style="padding:24px">暂无经历</div>'}
    <button class="btn btn-ghost btn-sm" onclick="A.addItem('experiences')">+ 添加经历</button>
  </div>`;
}

function honorSection(p) {
  const items = p.honors.map((h, i) => `
    <div class="exp-item">
      <div class="row-2">
        ${input('名称', `honors.${i}.name`, h.name)}
        ${input('级别', `honors.${i}.level`, h.level)}
        ${input('时间', `honors.${i}.time`, h.time)}
        ${input('描述', `honors.${i}.desc`, h.desc)}
      </div>
      <div class="flex" style="justify-content:flex-end">
        <button class="icon-btn" title="删除" onclick="A.removeItem('honors',${i})">✕</button>
      </div>
    </div>`).join('');

  return `<div id="sec-honor" class="editor-section card" style="padding:24px">
    <h2>🏆 荣誉奖励</h2>
    ${items || '<div class="empty" style="padding:24px">暂无荣誉记录</div>'}
    <button class="btn btn-ghost btn-sm" onclick="A.addItem('honors')">+ 添加荣誉</button>
  </div>`;
}

function languageSection(p) {
  const items = p.languages.map((l, i) => `
    <div class="exp-item">
      <div class="exp-head"><div class="t">${escapeHtml(l.lang)}</div><span class="chip">语种</span></div>
      <div class="row-2">
        ${input('英语水平', `languages.${i}.level`, l.level)}
        ${input('熟练度', `languages.${i}.proficiency`, l.proficiency)}
        ${input('分数', `languages.${i}.score`, l.score)}
      </div>
      <div class="flex" style="justify-content:flex-end">
        <button class="icon-btn" title="删除" onclick="A.removeItem('languages',${i})">✕</button>
      </div>
    </div>`).join('');

  return `<div id="sec-lang" class="editor-section card" style="padding:24px">
    <h2>🗣 语言能力</h2>
    ${items || '<div class="empty" style="padding:24px">暂无语言记录</div>'}
    <button class="btn btn-ghost btn-sm" onclick="A.addItem('languages')">+ 添加语言</button>
  </div>`;
}

function evaluationSection(p) {
  return `<div id="sec-eval" class="editor-section card" style="padding:24px">
    <h2>✍ 自我评价</h2>
    <div class="field">
      <textarea rows="4" data-path="self_evaluation">${escapeHtml(p.self_evaluation)}</textarea>
    </div>
  </div>`;
}

function customSection(p) {
  const rows = p.custom_fields.map((f, i) => `
    <div class="custom-field-row">
      <input data-path="custom_fields.${i}.label" value="${escapeHtml(f.label)}" placeholder="字段名">
      <select data-path="custom_fields.${i}.type">
        ${['text', 'date', 'number', 'option'].map((t) => `<option value="${t}" ${f.type === t ? 'selected' : ''}>${
          { text: '文本', date: '日期', number: '数字', option: '选项' }[t]
        }</option>`).join('')}
      </select>
      <input data-path="custom_fields.${i}.value" value="${escapeHtml(f.value)}" placeholder="值">
      <button class="icon-btn" title="删除" onclick="A.removeItem('custom_fields',${i})">✕</button>
    </div>`).join('');

  return `<div id="sec-custom" class="editor-section card" style="padding:24px">
    <h2>⚙ 自定义字段</h2>
    <p class="text-sm text-2 mb-12">支持文本 / 日期 / 数字 / 选项类型，满足个性化字段需求</p>
    ${rows || '<div class="empty" style="padding:16px">暂无自定义字段</div>'}
    <button class="btn btn-ghost btn-sm" onclick="A.addItem('custom_fields')">+ 添加自定义字段</button>
  </div>`;
}

export const emptyItem = {
  education: () => ({
    school: '', major: '', degree: '', academic_degree: '', gpa: '', courses: '', period: ''
  }),
  experiences: () => ({
    type: '项目', name: '', role: '', start: '', end: '', desc: '', achievements: []
  }),
  honors: () => ({ name: '', level: '', time: '', desc: '' }),
  languages: () => ({ lang: '英语', level: '', proficiency: '', score: '' }),
  custom_fields: () => ({ key: newIdKey(), label: '', type: 'text', value: '' })
};

function newIdKey() {
  return `custom_${Date.now().toString(36)}`;
}
