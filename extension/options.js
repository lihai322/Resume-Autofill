const tgMemory = document.getElementById('tgMemory');
const tgLlm = document.getElementById('tgLlm');
const profileName = document.getElementById('profileName');
const btnReload = document.getElementById('btnReload');
const btnClear = document.getElementById('btnClear');

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

async function load() {
  const store = await chrome.storage.local.get(['rqf_settings', 'rqf_profile']);
  settings = { mapping_memory: true, llm_fallback: true, ...(store.rqf_settings || {}) };
  profileName.textContent = store.rqf_profile
    ? `${store.rqf_profile.name}（${store.rqf_profile.full_name || '未命名'}）`
    : '使用内置示例档案';
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
