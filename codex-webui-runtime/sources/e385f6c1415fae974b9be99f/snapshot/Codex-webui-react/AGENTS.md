# Codex WebUI React 执行入口

本项目是 `Codex-webui-ts` 的 React 承载版。任何 UI、前端逻辑、迁移、源码等价或 Plus/WebUI 还原任务，都必须先读根目录 `RULES.md`、`docs/source-to-target-ledger.md`、源项目 `..\Codex-webui-ts\AGENTS.md` / `RULES.md`、全局 `C:\Users\lop\.codex\rules\webui-plus-parity.md`，再读真实源码。

## 强制规则

- React 不能用简化组件、静态 JSON 面板、假按钮或视觉近似冒充 `Codex-webui-ts` 源码/UI 逻辑还原。
- 涉及一对一、源码逻辑、UI 逻辑、完全还原、逐段迁移时，先更新 source-to-target ledger；只有真实 DOM、事件、API、状态和运行证据等价后才能标 `verified-equivalent`。
- 用户本轮已明确排除 Git 与内嵌终端工具；除非 lop 重新点名要求恢复，这两个入口不得重新暴露到 React UI。
- 修 UI 必须跑静态测试、构建，并用运行态页面验证核心界面；无法验证必须标未验证。
- React 承载 legacy shell 时，源 CSS/JS 不能只复制到 `static` 或 `public` 后用 200 响应当证据；必须确认页面入口真实引用 `/css/app.css`、`/js/app.js`、`/js/transfer.js`，并验证 `.app` 已形成布局、`.modal` 默认隐藏、核心 composer/sidebar 可见。
