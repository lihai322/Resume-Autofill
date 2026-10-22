import { state } from '../store.js?v=20261023p';

export function render() {
  if (state.authMode === 'register') return register();
  return login();
}

function login() {
  return `<div class="auth-wrap"><div class="auth-card card">
    <h1>欢迎回来</h1>
    <p class="sub">登录以同步你的简历档案</p>
    <div class="field"><label>邮箱</label>
      <input type="email" id="loginEmail" placeholder="you@example.com" value="liming@example.com">
    </div>
    <div class="field"><label>主密码</label>
      <input type="password" id="loginPassword" placeholder="主密码是加密体系的根">
      <div class="hint">仅本地派生密钥，服务端不存储明文</div>
    </div>
    <button class="btn btn-primary btn-block" onclick="A.login()">登录</button>
    <div class="divider">或</div>
    <button class="btn btn-ghost btn-block" onclick="A.showRegister()">没有账号？注册</button>
  </div></div>`;
}

function register() {
  return `<div class="auth-wrap"><div class="auth-card card">
    <h1>创建账号</h1>
    <p class="sub">一份简历，处处速填</p>
    <div class="field"><label>邮箱</label><input type="email" placeholder="you@example.com"></div>
    <div class="field"><label>主密码</label>
      <input type="password" placeholder="至少 8 位，包含字母与数字">
      <div class="hint">主密码遗失后无法找回，请妥善保存</div>
    </div>
    <div class="field"><label>确认主密码</label><input type="password" placeholder="再次输入"></div>
    <button class="btn btn-primary btn-block" onclick="A.login()">注册并登录</button>
    <div class="divider">或</div>
    <button class="btn btn-ghost btn-block" onclick="A.showLogin()">已有账号？登录</button>
  </div></div>`;
}

export function unlock() {
  return `<div class="auth-wrap"><div class="auth-card card" style="text-align:center">
    <h1>解锁简历速填</h1>
    <p class="sub">使用指纹或主密码解锁本地密钥库</p>
    <button class="fingerprint-btn" onclick="A.unlock()" title="指纹解锁">👆</button>
    <p class="text-sm text-2" style="margin-bottom:20px">点击使用指纹解锁</p>
    <div class="divider">或</div>
    <div class="field" style="text-align:left"><label>主密码</label>
      <input type="password" placeholder="输入主密码">
    </div>
    <button class="btn btn-primary btn-block" onclick="A.unlock()">解锁</button>
    <p class="text-xs text-3 mt-16">指纹仅本地认证，不上传任何生物特征。</p>
  </div></div>`;
}
