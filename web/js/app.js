import {
  state, loadState, saveSession, saveProfiles, saveSettings,
  getProfile, addProfile, resetAll
} from './store.js?v=20261023f';
import { seedProfiles } from './seed.js?v=20261023f';
import { collectForm, downloadJson, escapeHtml, newId, today, toast } from './utils.js?v=20261023f';
import * as authView from './views/auth.js?v=20261023f';
import * as profilesView from './views/profiles.js?v=20261023f';
import * as importView from './views/import.js?v=20261023f';
import * as editorView from './views/editor.js?v=20261023f';
import * as settingsView from './views/settings.js?v=20261023f';
import { extractText, ocrImage, parseResumeText, lowConfidenceFields } from './pdf/parser.js?v=20261023f';

loadState();

const app = document.getElementById('app');
const topActions = document.getElementById('topActions');
const VIEWS = {
  list: profilesView,
  import: importView,
  edit: editorView,
  settings: settingsView
};

function render() {
  if (!state.loggedIn) {
    app.innerHTML = authView.render();
    topActions.innerHTML = '';
    return;
  }
  if (!state.unlocked) {
    app.innerHTML = authView.unlock();
    topActions.innerHTML = '';
    return;
  }

  const view = VIEWS[state.view] || profilesView;
  app.innerHTML = `<div class="container">${view.render()}</div>`;
  topActions.innerHTML = `
    <div class="flex items-center gap-8">
      <button class="btn btn-ghost btn-sm" onclick="A.go('list')">我的小项目</button>
      <button class="btn btn-ghost btn-sm" onclick="A.go('settings')">设置</button>
      <button class="btn btn-ghost btn-sm" onclick="A.lock()">锁定</button>
    </div>`;
}

/* ---------------- PDF 解析 ---------------- */
function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }

function mergeDraft(parsed) {
  const base = structuredClone(seedProfiles[0]);
  const draft = {
    ...base,
    id: newId(),
    name: `${parsed.full_name || '新'}的简历`,
    target: base.target,
    updated_at: today(),
    full_name: parsed.full_name || base.full_name,
    phone: parsed.phone || base.phone,
    email: parsed.email || base.email,
    birth_date: parsed.birth_date || base.birth_date,
    location: parsed.location || base.location,
    education: parsed.education?.length ? parsed.education : base.education,
    experiences: parsed.experiences?.length ? parsed.experiences : base.experiences,
    honors: parsed.honors?.length ? parsed.honors : base.honors,
    languages: parsed.languages?.length ? parsed.languages : base.languages,
    self_evaluation: parsed.self_evaluation || base.self_evaluation,
    custom_fields: parsed.custom_fields || base.custom_fields
  };
  return draft;
}

function appendLog(msg) {
  const el = document.getElementById('parseLog');
  if (el) el.insertAdjacentHTML('beforeend', `<div style="padding:3px 0">${msg}</div>`);
}

async function runParse(file, useSimulated) {
  try {
    appendLog(`✓ 已接收文件：${state.draftFileName}`);
    if (useSimulated) {
      await delay(600);
      appendLog('⚙ 演示模式：使用内置示例档案');
      state.draft = mergeDraft({});
    } else {
      appendLog('⏳ 加载 PDF 解析引擎（首次较慢）…');
      let text;
      try {
        text = await extractText(file, (page, total) => appendLog(`✓ 解析第 ${page}/${total} 页`));
      } catch (e) {
        appendLog(`❌ PDF 解析失败：${e.message || e}`);
        appendLog('💡 文件可能已损坏或被加密');
        return;
      }
      if (text.trim().length < 50) {
        appendLog('⚠ 文本层几乎为空，疑似扫描件，启动 OCR（约 10-30 秒）…');
        try {
          text = await ocrImage(file);
          appendLog('✓ OCR 完成');
        } catch (e) {
          appendLog(`❌ OCR 失败：${e.message || e}`);
          appendLog('💡 请使用文本型 PDF，或改用演示模式');
          return;
        }
      }
      appendLog(`✓ 提取文本 ${text.length} 字符`);
      const preview = text.replace(/\s+/g, ' ').slice(0, 400);
      appendLog(`<div style="margin-top:6px;padding:8px;background:#f5f5f5;border-radius:6px;font-size:11px;color:#555;line-height:1.6;word-break:break-all">📄 原文片段：${escapeHtml(preview)}…</div>`);
      const parsed = parseResumeText(text);
      state.draft = mergeDraft(parsed);
      const low = lowConfidenceFields(state.draft);
      if (low.length) appendLog(`⚠ 低置信度字段：${low.join('、')}`);
    }
    appendLog('⚙ 准备预览确认…');
    await delay(300);
    state.wizardStep = 2;
    render();
  } catch (err) {
    console.error(err);
    appendLog(`❌ 出错：${err.message || err}`);
  }
}

function saveCurrentForm() {
  const profile = getProfile();
  if (!profile) return;
  collectForm(profile);
  normalizeAchievements(profile);
}

function normalizeAchievements(profile) {
  (profile.experiences || []).forEach((e) => {
    if (typeof e.achievements === 'string') {
      e.achievements = e.achievements.split(/[、,，]/).map((s) => s.trim()).filter(Boolean);
    }
  });
}

const A = {
  state,
  render,
  go(view) {
    state.view = view;
    render();
  },
  login() {
    state.loggedIn = true;
    state.unlocked = true;
    saveSession();
    render();
  },
  showRegister() {
    state.authMode = 'register';
    render();
  },
  showLogin() {
    state.authMode = 'login';
    render();
  },
  unlock() {
    state.unlocked = true;
    saveSession();
    render();
  },
  lock() {
    state.unlocked = false;
    saveSession();
    render();
  },
  openProfile(id) {
    state.currentId = id;
    state.view = 'edit';
    render();
  },
  editCurrent() {
    state.view = 'edit';
    render();
  },
  saveProfile() {
    saveCurrentForm();
    saveProfiles();
    toast('已保存');
    render();
  },
  setColor(color) {
    saveCurrentForm();
    const p = getProfile();
    if (!p) return;
    p.color = color;
    saveProfiles();
    render();
  },
  scrollTo(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },
  toggleSetting(key) {
    state.settings[key] = !state.settings[key];
    saveSettings();
    render();
  },
  addItem(type) {
    saveCurrentForm();
    const p = getProfile();
    if (!p) return;
    p[type] = p[type] || [];
    p[type].push(editorView.emptyItem[type]());
    saveProfiles();
    render();
  },
  removeItem(type, index) {
    saveCurrentForm();
    const p = getProfile();
    if (!p) return;
    p[type].splice(index, 1);
    saveProfiles();
    render();
  },
  startImport() {
    const draft = structuredClone(seedProfiles[0]);
    draft.id = newId();
    draft.name = '技术岗版 · 导入';
    draft.updated_at = today();
    state.draft = draft;
    state.wizardStep = 0;
    state._parseStarted = false;
    state.view = 'import';
    render();
  },
  simulateParse() {
    state.draftFileName = 'resume.pdf';
    state.wizardStep = 1;
    state._parseStarted = false;
    render();
    runParse(new File([], 'resume.pdf'), true);
  },
  async handleFile(file) {
    if (!file) return;
    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
      toast('请选择 PDF 格式的简历');
      return;
    }
    state.draftFileName = file.name;
    state.wizardStep = 1;
    state._parseStarted = false;
    render();
    await runParse(file, false);
  },
  handleDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    const dropzone = event.currentTarget;
    dropzone.classList.remove('drag');
    const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
    if (file) A.handleFile(file);
  },
  nextWizardStep(step) {
    state.wizardStep = step;
    render();
  },
  cancelImport() {
    state.draft = null;
    state.wizardStep = 0;
    state.view = 'list';
    render();
  },
  addDraftExperience() {
    if (!state.draft) return;
    collectForm(state.draft);
    state.draft.experiences.push({
      type: '项目', name: '新经历', role: '', start: '', end: '', desc: '', achievements: []
    });
    render();
  },
  addDraftEducation() {
    if (!state.draft) return;
    collectForm(state.draft);
    state.draft.education = state.draft.education || [];
    state.draft.education.push({
      school: '', major: '', degree: '', academic_degree: '', gpa: '', courses: '', period: ''
    });
    render();
  },
  removeDraftItem(type, index) {
    if (!state.draft) return;
    collectForm(state.draft);
    state.draft[type].splice(index, 1);
    render();
  },
  confirmArchive() {
    if (!state.draft) return;
    collectForm(state.draft);
    normalizeAchievements(state.draft);
    state.draft.updated_at = today();
    addProfile(state.draft);
    state.wizardStep = 3;
    render();
  },
  exportData() {
    downloadJson(`resume-quickfill-${today()}.json`, {
      exported_at: new Date().toISOString(),
      profiles: state.profiles,
      settings: state.settings
    });
    toast('已导出');
  },
  deleteAccount() {
    if (!window.confirm('确定删除账号及全部本地数据？此操作不可恢复。')) return;
    resetAll();
    saveSession();
    state.view = 'list';
    render();
  }
};

window.A = A;
render();
