# Codex WebUI React 项目规则

## React 源码还原硬验收

- 触发条件：lop 提到 React 还原、Web UI 源码、源码迁移、源码等价、完全还原、挨个转换、再次偷懒、不要偷懒，或点名 Codex WebUI/Plus 任一功能块。
- 默认来源为 `../Codex-webui-ts`；如果任务点名 Plus，则同时按全局 `webui-plus-parity.md` 对照 Plus 源码/行为。
- 交付前必须维护 `docs/source-to-target-ledger.md`，且每一行至少包含：来源路径、来源函数/DOM/API/状态语义、目标文件、目标实现、状态、验证方式、证据。
- 禁止用整文件或整模块一句 `implemented` 代替逐段映射；必须拆到用户可验收的行为粒度，例如会话列表、历史恢复、发送/停止/重启、队列、用户输入、设置、账户、项目、附件、预览、错误态、空态、加载态、移动端/低分辨率。
- `Known Parity Notes`、`follow-up polish`、`当前用户 scope`、`不做 pixel-perfect`、`JSON first` 只能解释未完成原因，不能让缺失源码行为显示为 `implemented`。若 lop 未明确排除，状态必须写 `missing`、`partial`、`deferred by explicit scope` 或 `blocked`。
- 复制后端文件只证明服务端代码存在，不证明 React 前端已暴露该功能；JSON 面板、假按钮、不可达入口、固定文案、截图通过、接口 200、静态资源 200 都不能单独算源码等价完成。
- React 承载 `public/index.html` legacy shell 时，必须同时映射并引用源 HTML、源 CSS、源 JS；若 `/css/app.css` 未进入真实页面，或 `.app` 未布局、`.modal` 默认未隐藏，视为不可用事故，不得报完成。
- 任何用户点名功能块都必须覆盖 UI、入口、字段、状态、错误态、交互链路和运行态证据；不得用基础范围、旧 memory 或旧文档把点名块降级。

## 完成交付门槛

- 声称完成前必须检索目标源码、`docs/source-to-target-ledger.md`、测试和验证文档中的 `missing`、`partial`、`in_progress`、`unmapped`、`unknown`、`todo`、`placeholder`、`fake`、`固定提示词`、`未迁移`、`not implemented`、`follow-up`、`polish`、`Known Parity Notes`；规则文件、备份文件和第三方构建产物不计入该禁用词检索。除 lop 明确排除外，命中即不能说完成。
- 必须跑 `npm test` 和 `npm run check`；若改动涉及运行态 UI/API，还必须启动 `npm run serve` 或等价服务，验证真实页面、关键接口、控制台/网络和至少一张当前截图。无法截图时，至少要给出等价运行态 DOM/CSS 证据：页面 HTML 引用源 CSS/JS、CSS 内容包含关键布局/隐藏规则、当前服务返回的是本次构建产物。
- 对源码还原任务，最终回复必须列出账本清零情况、仍缺失项、显式排除项、验证命令和运行态证据；不得只给构建通过或截图路径。
