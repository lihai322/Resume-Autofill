# 简历速填

以一份结构化简历档案为中枢，实现「导入一次、处处自动填写」。当前仓库包含可运行的 Web 控制台 Demo 与 Chrome 扩展（MV3）骨架。

## 目录结构

```
resume-quickfill/
├── web/                        # Web 控制台（纯静态，可直接部署到 GitHub Pages）
│   ├── index.html
│   ├── .nojekyll
│   ├── assets/styles.css
│   └── js/
│       ├── app.js              # 路由 / 全局动作
│       ├── store.js            # 本地存储与会话
│       ├── seed.js             # 示例档案
│       ├── utils.js
│       └── views/              # auth / profiles / import / editor / settings
├── extension/                  # Chrome 扩展（Manifest V3）
│   ├── manifest.json
│   ├── popup.html / popup.js / popup.css
│   ├── content.js              # 表单扫描与填充注入
│   ├── background.js           # Service Worker
│   └── options.html / options.js
└── .github/workflows/deploy-pages.yml
```

## 本地运行 Web 控制台

页面使用原生 ES Modules，需要通过 HTTP 访问（不能直接双击打开）：

```bash
cd resume-quickfill
python3 -m http.server 8080
# 打开 http://localhost:8080/web/
```

也可以使用任意静态服务器，如 `npx serve web`。

## 部署到 GitHub Pages

1. 新建 GitHub 仓库并推送代码：
   ```bash
   git init
   git add .
   git commit -m "feat: 简历速填 Web 控制台与扩展骨架"
   git branch -M main
   git remote add origin git@github.com:<你的用户名>/<仓库名>.git
   git push -u origin main
   ```
2. 打开仓库 **Settings → Pages**，将 **Build and deployment → Source** 设为 **GitHub Actions**。
3. 推送后工作流 [deploy-pages.yml](.github/workflows/deploy-pages.yml) 会自动构建并发布，访问：
   `https://<你的用户名>.github.io/<仓库名>/`
4. 若仓库名不是根站点路径，页面内全部使用相对路径，无需修改。

> 说明：GitHub Pages 只能托管 Web 控制台。浏览器扩展不能通过 GitHub 网页直接安装，需要按下面的方式加载，或以 zip 形式通过 GitHub Releases 分发。

## 加载浏览器扩展

1. 打开 `chrome://extensions/`，开启右上角 **开发者模式**。
2. 点击 **加载已解压的扩展程序**，选择仓库中的 `extension/` 目录。
3. 打开任意招聘官网的简历填写页，点击扩展图标 → 「确认映射并填充」。
4. 在映射面板中校对字段，点击「确认并填充」，然后**手动检查并提交**。

打包分发：

```bash
cd extension && zip -r ../resume-quickfill-extension.zip .
```

将 zip 上传到 GitHub Releases，即可作为可下载版本分发（仍非商店安装）。

## 当前实现范围

- Web 控制台：登录/解锁、小项目列表（卡片背景色随档案颜色变化）、PDF 导入向导、档案分区编辑、自定义字段、设置项。
- 扩展：官网域名识别、适配器徽标、字段扫描、语义映射、映射确认面板（搜索 / 改映射 / 留空）、映射记忆、填充完成态。
- 数据：Web 端使用 `localStorage`，扩展端使用 `chrome.storage.local`，均为本地演示实现；尚未接入账号体系、端到端加密和云端同步。

## 边界与后续

- 不实现自动提交，填充后由用户人工检查并提交。
- 通用适配器依赖表单语义可读性，低置信度字段通过映射确认面板兜底。
- 后续可接入 `POST /api/v1/parse/pdf` 等接口，替换本地模拟解析（见产品说明第 7 节）。
