import { state } from '../store.js?v=20261023';
import { escapeHtml, hexA } from '../utils.js?v=20261023';

export function render() {
  const cards = state.profiles.map((p) => {
    const initial = escapeHtml((p.full_name || '?').slice(0, 1));
    return `<div class="profile-card"
        style="background:${hexA(p.color, 0.14)};border-color:${hexA(p.color, 0.4)}"
        onclick="A.openProfile('${p.id}')">
      <div class="color-bar" style="background:${p.color}"></div>
      <div class="card-top">
        <div class="avatar">${p.avatar ? `<img src="${escapeHtml(p.avatar)}" alt="">` : initial}</div>
        <div>
          <div class="name">${escapeHtml(p.name)}</div>
          <div class="target">${escapeHtml(p.target || '未设置方向')}</div>
        </div>
      </div>
      <div class="stats">
        <span><b>${p.experiences?.length || 0}</b> 经历</span>
        <span><b>${p.honors?.length || 0}</b> 荣誉</span>
        <span><b>${p.languages?.length || 0}</b> 语言</span>
      </div>
      <div class="updated">更新于 ${escapeHtml(p.updated_at || '')}</div>
    </div>`;
  }).join('');

  return `
    <div class="page-head">
      <div><h1>我的小项目</h1><p>每份档案为独立数据源，卡片整体背景色可自定义区分</p></div>
      <div class="actions">
        <button class="btn btn-ghost" onclick="A.go('settings')">⚙ 设置</button>
        <button class="btn btn-primary" onclick="A.startImport()">+ 导入 PDF</button>
      </div>
    </div>
    <div class="profile-grid">
      ${cards}
      <div class="profile-card new-card" onclick="A.startImport()">
        <div class="plus">+</div><div>新建 / 导入小项目</div>
      </div>
    </div>`;
}
