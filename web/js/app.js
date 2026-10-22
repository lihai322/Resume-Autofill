import {
  state, loadState, saveSession, saveProfiles, saveSettings,
  getProfile, addProfile, resetAll
} from './store.js';
import { seedProfiles } from './seed.js';
import { collectForm, downloadJson, newId, today, toast } from './utils.js';
import * as authView from './views/auth.js';
import * as profilesView from './views/profiles.js';
import * as importView from './views/import.js';
import * as editorView from './views/editor.js';
import * as settingsView from './views/settings.js';

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

  if (state.view === 'import' && state.wizardStep === 1 && !state._parseStarted) {
    state._parseStarted = true;
    importView.logParsing();
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
    state.wizardStep = 1;
    state._parseStarted = false;
    render();
  },
  handleFile(file) {
    if (!file) return;
    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
      toast('请选择 PDF 格式的简历');
      return;
    }
    state.draftFileName = file.name;
    state.wizardStep = 1;
    state._parseStarted = false;
    render();
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
