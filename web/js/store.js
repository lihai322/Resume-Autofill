import { seedProfiles } from './seed.js?v=20261023k';

const KEY = {
  profiles: 'rqf_profiles',
  settings: 'rqf_settings',
  session: 'rqf_session'
};

const defaultSettings = {
  fingerprint: true,
  e2e: true,
  mapping_memory: true,
  llm_fallback: true,
  auto_sync: true
};
export const state = {
  loggedIn: false,
  unlocked: false,
  view: 'list',
  profiles: [],
  currentId: null,
  settings: { ...defaultSettings },
  wizardStep: 0,
  draft: null,
  authMode: 'login'
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 存储不可用时静默降级为内存态 */
  }
}

export function loadState() {
  const stored = read(KEY.profiles, null);
  state.profiles = stored && stored.length ? stored : structuredClone(seedProfiles);
  state.settings = { ...defaultSettings, ...read(KEY.settings, {}) };
  state.currentId = state.profiles[0]?.id ?? null;
  const session = read(KEY.session, null);
  state.loggedIn = Boolean(session?.loggedIn);
  state.unlocked = Boolean(session?.unlocked);
}

export function saveSession() {
  write(KEY.session, { loggedIn: state.loggedIn, unlocked: state.unlocked });
}

export function saveProfiles() {
  write(KEY.profiles, state.profiles);
}

export function saveSettings() {
  write(KEY.settings, state.settings);
}

export function getProfile(id = state.currentId) {
  return state.profiles.find((p) => p.id === id) || null;
}

export function addProfile(profile) {
  state.profiles.unshift(profile);
  state.currentId = profile.id;
  saveProfiles();
}

export function removeProfile(id) {
  state.profiles = state.profiles.filter((p) => p.id !== id);
  if (state.currentId === id) state.currentId = state.profiles[0]?.id ?? null;
  saveProfiles();
}

export function resetAll() {
  [KEY.profiles, KEY.settings, KEY.session].forEach((k) => localStorage.removeItem(k));
  state.loggedIn = false;
  state.unlocked = false;
  state.view = 'list';
  state.profiles = structuredClone(seedProfiles);
  state.settings = { ...defaultSettings };
  state.currentId = state.profiles[0]?.id ?? null;
}
