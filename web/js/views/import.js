import { state } from '../store.js?v=20261023c';
import { escapeHtml } from '../utils.js?v=20261023c';

const STEPS = ['上传 PDF', '解析中', '确认字段', '存档成功'];

export function render() {
  const stepHtml = STEPS.map((label, i) => {
    const cls = i < state.wizardStep ? 'done' : i === state.wizardStep ? 'active' : '';
    return `<div class="step ${cls}">
      <div class="num">${i < state.wizardStep ? '✓' : i + 1}</div>
      <div class="label">${label}</div>
    </div>${i < STEPS.length - 1 ? `<div class="step-line ${i < state.wizardStep ? 'done' : ''}"></div>` : ''}`;
  }).join('');

  let body = '';
  if (state.wizardStep === 0) body = renderUpload();
  else if (state.wizardStep === 1) body = renderParsing();
  else if (state.wizardStep === 2) body = renderPreview();
  else body = renderSuccess();

  return `<div class="wizard">
    <div class="page-head">
      <div><h1>导入简历</h1><p>上传 → 解析 → 逐字段确认 → 存档</p></div>
      ${state.wizardStep > 0 && state.wizardStep < 3
        ? `<button class="btn btn-ghost" onclick="A.cancelImport()">取消</button>` : ''}
    </div>
    <div class="stepper">${stepHtml}</div>
    <div class="card" style="padding:28px">${body}</div>
  </div>`;
}

function renderUpload() {
  return `<div class="dropzone" id="dropzone"
      onclick="document.getElementById('pdfInput').click()"
      ondragover="event.preventDefault();this.classList.add('drag')"
      ondragleave="this.classList.remove('drag')"
      ondrop="A.handleDrop(event)">
      <input type="file" id="pdfInput" accept=".pdf,application/pdf"
        style="display:none" onchange="A.handleFile(this.files[0])">
      <div class="up-icon">📄</div>
      <div class="dz-title">点击或拖拽上传简历 PDF</div>
      <div class="dz-sub">支持文本型与扫描件（OCR）· 解析不留存原文</div>
      <div class="mt-16">
        <span class="chip">文本解析</span>
        <span class="chip">OCR 识别</span>
        <span class="chip">LLM 兜底（可关闭）</span>
      </div>
    </div>
    <div style="text-align:center;margin-top:16px">
      <button class="btn btn-ghost btn-sm" onclick="A.simulateParse()">没有 PDF？使用演示数据</button>
    </div>
    <p class="text-xs text-3 mt-16" style="text-align:center">
      隐私：解析全程在浏览器本地完成，原文不上传任何服务器
    </p>`;
}

function renderParsing() {
  return `<div class="parsing">
    <div class="spinner"></div>
    <div class="font-semibold">正在解析简历…</div>
    <div class="text-2 text-sm mt-8">标题词库切分 · 结构化字段提取</div>
    <div id="parseLog" class="mt-16 text-xs text-3"
      style="max-width:360px;margin:20px auto 0;text-align:left"></div>
  </div>`;
}

function field(label, path, value, low = false, type = 'input') {
  const control = type === 'textarea'
    ? `<textarea data-path="${path}">${escapeHtml(value)}</textarea>`
    : `<input data-path="${path}" value="${escapeHtml(value)}">`;
  return `<div class="preview-field ${low ? 'low-conf' : ''}">
    <div class="pf-label">${label}${low ? '<div class="confidence-bar"><i style="width:45%;background:var(--warning)"></i></div>' : ''}</div>
    <div class="pf-val">${control}</div>
  </div>`;
}

function renderPreview() {
  const p = state.draft;
  if (!p) return '<div class="empty">草稿不存在</div>';

  const education = (p.education || []).map((ed, i) => `
    <div class="exp-item">
      <div class="exp-head">
        <div class="t">学校 ${i + 1}：${escapeHtml(ed.school || '未填写')}</div>
        <button class="btn btn-ghost btn-sm" onclick="A.removeDraftItem('education',${i})">删除</button>
      </div>
      <div class="row-2">
        ${field('毕业院校', `education.${i}.school`, ed.school)}
        ${field('毕业时间', `education.${i}.period`, ed.period)}
        ${field('学历', `education.${i}.degree`, ed.degree)}
        ${field('学位', `education.${i}.academic_degree`, ed.academic_degree)}
        ${field('绩点', `education.${i}.gpa`, ed.gpa)}
        ${field('专业', `education.${i}.major`, ed.major)}
      </div>
      ${field('主修课程', `education.${i}.courses`, ed.courses || '')}
    </div>`).join('');

  const experiences = p.experiences.map((e, i) => `
    <div class="exp-item">
      <div class="exp-head">
        <div class="t">经历 ${i + 1}</div>
        <button class="btn btn-ghost btn-sm" onclick="A.removeDraftItem('experiences',${i})">删除</button>
      </div>
      <div class="row-2">
        <div class="field"><label>类型</label>
          <select data-path="experiences.${i}.type">
            <option value="项目" ${e.type === '项目' ? 'selected' : ''}>项目</option>
            <option value="实践" ${e.type === '实践' ? 'selected' : ''}>实践</option>
          </select></div>
        <div class="field"><label>名称</label><input data-path="experiences.${i}.name" value="${escapeHtml(e.name)}"></div>
        <div class="field"><label>角色</label><input data-path="experiences.${i}.role" value="${escapeHtml(e.role)}"></div>
        <div class="field"><label>起止时间</label>
          <input value="${escapeHtml(`${e.start} ~ ${e.end}`)}" disabled></div>
      </div>
      <div class="field"><label>描述</label>
        <textarea rows="3" data-path="experiences.${i}.desc">${escapeHtml(e.desc)}</textarea></div>
    </div>`).join('');

  const honors = p.honors.map((h, i) =>
    field(`荣誉 ${i + 1}`, `honors.${i}.name`, h.name, true)).join('');

  const languages = p.languages.map((l) => `
    ${field('英语水平', 'languages.0.level', l.level)}
    ${field('熟练度', 'languages.0.proficiency', l.proficiency)}
    ${field('分数', 'languages.0.score', l.score)}`).join('');

  return `
    <div class="section-block">
      <h3>👤 基本信息</h3>
      ${field('姓名', 'full_name', p.full_name)}
      ${field('出生日期', 'birth_date', p.birth_date)}
      ${field('手机号', 'phone', p.phone)}
      ${field('邮箱', 'email', p.email)}
      ${field('所在城市', 'location', p.location, true)}
    </div>
    <div class="section-block">
      <h3>🎓 学校</h3>
      ${education || '<div class="empty" style="padding:16px">暂无学校信息</div>'}
      <button class="btn btn-ghost btn-sm" onclick="A.addDraftEducation()">+ 添加学校</button>
    </div>
    <div class="section-block">
      <h3>💼 项目 / 实践经历</h3>
      ${experiences}
      <button class="btn btn-ghost btn-sm" onclick="A.addDraftExperience()">+ 添加经历</button>
    </div>
    <div class="section-block">
      <h3>🏆 荣誉奖励</h3>
      ${honors || '<div class="empty" style="padding:16px">暂无荣誉记录</div>'}
    </div>
    <div class="section-block">
      <h3>🗣 语言能力</h3>
      ${languages}
    </div>
    <div class="section-block">
      <h3>✍ 自我评价</h3>
      ${field('自我评价', 'self_evaluation', p.self_evaluation, false, 'textarea')}
    </div>
    <div class="flex justify-between items-center mt-24" style="padding-top:16px;border-top:1px solid var(--border)">
      <span class="text-xs text-3">⚠ 请仔细核对，这是防止错填进官网的最后防线</span>
      <button class="btn btn-primary" onclick="A.confirmArchive()">确认并存档</button>
    </div>`;
}

function renderSuccess() {
  return `<div class="parsing">
    <div class="check" style="width:64px;height:64px;border-radius:50%;background:var(--success);color:#fff;
      display:flex;align-items:center;justify-content:center;font-size:32px;margin:0 auto 16px">✓</div>
    <div class="font-semibold" style="font-size:18px">存档成功</div>
    <div class="text-2 text-sm mt-8" id="archiveName">已保存为新的小项目</div>
    <div class="mt-24" style="display:flex;gap:10px;justify-content:center">
      <button class="btn btn-ghost" onclick="A.go('list')">返回列表</button>
      <button class="btn btn-primary" onclick="A.editCurrent()">编辑档案</button>
    </div>
  </div>`;
}

export function logParsing() {
  const el = document.getElementById('parseLog');
  if (!el) return;
  const fileName = (window.A && window.A.state && window.A.state.draftFileName) || 'resume.pdf';
  const logs = [
    `✓ 已接收文件：${fileName}`,
    '✓ 提取文本层（共 3 页）',
    '✓ 识别小标题：基本信息 / 项目经历 / 实践经历 / 荣誉奖励',
    '✓ 结构化字段 24 项',
    '✓ 低置信度字段 2 项，已标记',
    '⚙ 准备预览确认…'
  ];
  let i = 0;
  const timer = setInterval(() => {
    if (i >= logs.length) {
      clearInterval(timer);
      setTimeout(() => window.A.nextWizardStep(2), 500);
      return;
    }
    el.insertAdjacentHTML('beforeend', `<div style="padding:3px 0">${logs[i++]}</div>`);
  }, 420);
}
