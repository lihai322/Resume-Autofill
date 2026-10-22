const tgMemory = document.getElementById('tgMemory');
const tgLlm = document.getElementById('tgLlm');
const profileName = document.getElementById('profileName');
const btnReload = document.getElementById('btnReload');
const btnClear = document.getElementById('btnClear');
const btnImport = document.getElementById('btnImport');
const fileImport = document.getElementById('fileImport');
const importStatus = document.getElementById('importStatus');

let settings = { mapping_memory: true, llm_fallback: true };

function paint() {
  tgMemory.classList.toggle('on', Boolean(settings.mapping_memory));
  tgMemory.setAttribute('aria-checked', String(Boolean(settings.mapping_memory)));
  tgLlm.classList.toggle('on', Boolean(settings.llm_fallback));
  tgLlm.setAttribute('aria-checked', String(Boolean(settings.llm_fallback)));
}

async function save() {
  await chrome.storage.local.set({ rqf_settings: settings });
}

function showImportStatus(msg, ok) {
  importStatus.textContent = msg;
  importStatus.style.display = 'block';
  importStatus.style.color = ok ? 'var(--success)' : '#ef4444';
  setTimeout(() => { importStatus.style.display = 'none'; }, 4000);
}

async function load() {
  const store = await chrome.storage.local.get(['rqf_settings', 'rqf_profile']);
  settings = { mapping_memory: true, llm_fallback: true, ...(store.rqf_settings || {}) };
  profileName.textContent = store.rqf_profile
    ? `${store.rqf_profile.name || '未命名'}（${store.rqf_profile.full_name || ''}）`.trim()
    : '未设置（使用内置示例）';
  paint();
}

tgMemory.addEventListener('click', () => {
  settings.mapping_memory = !settings.mapping_memory;
  paint();
  save();
});

tgLlm.addEventListener('click', () => {
  settings.llm_fallback = !settings.llm_fallback;
  paint();
  save();
});

btnReload.addEventListener('click', load);

btnImport.addEventListener('click', () => fileImport.click());

fileImport.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const profile = JSON.parse(text);
    // 基本校验：至少是一个对象且有姓名或 full_name
    if (typeof profile !== 'object' || profile === null || Array.isArray(profile)) {
      throw new Error('档案格式不对：应为一个 JSON 对象');
    }
    if (!profile.full_name && !profile.name) {
      throw new Error('档案缺少姓名（full_name 或 name 字段）');
    }
    await chrome.storage.local.set({ rqf_profile: profile });
    showImportStatus(`✅ 已导入档案「${profile.name || profile.full_name}」`, true);
    load();
  } catch (err) {
    showImportStatus(`❌ 导入失败：${err.message}`, false);
  } finally {
    fileImport.value = '';
  }
});

btnClear.addEventListener('click', async () => {
  const all = await chrome.storage.local.get(null);
  const keys = Object.keys(all).filter((k) => k.startsWith('rqf_mapping:'));
  if (!keys.length) {
    btnClear.textContent = '已清空';
    return;
  }
  await chrome.storage.local.remove(keys);
  btnClear.textContent = `已清除 ${keys.length} 条`;
});

load();
