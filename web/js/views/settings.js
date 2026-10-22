import { state } from '../store.js?v=20261023u';

export function render() {
  const row = (title, desc, on, key) => `
    <div class="setting-row">
      <div><div class="sr-t">${title}</div>${desc ? `<div class="sr-d">${desc}</div>` : ''}</div>
      <div class="toggle ${on ? 'on' : ''}" role="switch" aria-checked="${on}"
        onclick="A.toggleSetting('${key}')"></div>
    </div>`;

  return `
    <div class="page-head">
      <div><h1>设置</h1><p>账号安全、设备管理、数据主权</p></div>
      <button class="btn btn-ghost" onclick="A.go('list')">← 返回</button>
    </div>
    <div class="card" style="padding:8px 24px;max-width:720px">
      <div class="settings-group">
        <h3>账号与安全</h3>
        ${row('指纹解锁', '基于 WebAuthn 平台认证器，仅本地解锁密钥库', state.settings.fingerprint, 'fingerprint')}
        ${row('端到端加密', '所有简历字段本地加密后上云，云端不可见明文', state.settings.e2e, 'e2e')}
        <div class="setting-row">
          <div><div class="sr-t">修改主密码</div><div class="sr-d">主密码是加密体系的根</div></div>
          <button class="btn btn-ghost btn-sm">修改</button>
        </div>
      </div>
      <div class="settings-group">
        <h3>设备管理</h3>
        <div class="device-item">
          <div class="di-info"><div class="di-icon">💻</div>
            <div><div class="font-semibold">当前设备</div><div class="text-xs text-3">最近活跃：刚刚</div></div>
          </div>
          <span class="chip chip-success">当前</span>
        </div>
        <div class="device-item">
          <div class="di-info"><div class="di-icon">📱</div>
            <div><div class="font-semibold">iPhone</div><div class="text-xs text-3">最近活跃：2 天前</div></div>
          </div>
          <button class="btn btn-ghost btn-sm">移除</button>
        </div>
      </div>
      <div class="settings-group">
        <h3>填充设置</h3>
        ${row('映射记忆', '记住官网字段映射，再次访问自动复用', state.settings.mapping_memory, 'mapping_memory')}
        ${row('LLM 语义兜底', '低置信度字段可选走 LLM 识别，可整体关闭', state.settings.llm_fallback, 'llm_fallback')}
        ${row('多设备同步', '新设备登录后用主密码恢复密钥', state.settings.auto_sync, 'auto_sync')}
      </div>
      <div class="settings-group">
        <h3>数据主权</h3>
        <div class="setting-row">
          <div><div class="sr-t">导出全部数据</div><div class="sr-d">下载加密的完整档案副本</div></div>
          <button class="btn btn-ghost btn-sm" onclick="A.exportData()">导出</button>
        </div>
        <div class="setting-row">
          <div><div class="sr-t" style="color:var(--danger)">删除账号及云端数据</div>
            <div class="sr-d">不可恢复，请谨慎操作</div></div>
          <button class="btn btn-danger btn-sm" onclick="A.deleteAccount()">删除</button>
        </div>
      </div>
    </div>`;
}
