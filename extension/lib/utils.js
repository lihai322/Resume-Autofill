export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

export function getByPath(obj, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function commaList(list) {
  return Array.isArray(list) ? list.join('、') : String(list ?? '');
}
