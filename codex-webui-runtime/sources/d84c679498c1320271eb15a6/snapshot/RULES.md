# 项目规则

## 本地链接展示

展示本地文件、目录、程序或产物时，必须区分文件链接和目录打开入口：本地文件链接只作为精确定位/打开请求，不得假定客户端可直接打开；需要用户直接打开目录时，必须优先给 Windows 原生目录路径和可复制 `start "" "C:\Users\...\dir"` 打开命令，Markdown 目录链接只能作为辅助，禁止只给相对目录名。生成产物仍按全局三件套输出产物目录、打开命令和文件名/完整路径/哈希。

## UI 范围锁定

当 lop 要求“UI 和基本功能”的全量实现或指出“不是所有功能”时，必须把范围锁定为目标 UI 外观、导航、会话/发送/停止/历史/错误等基础可用链路完整到位；不得把截图或上游源码中的每个高级功能都扩展为完整实现，除非 lop 明确要求全仓库、全源码、所有 Plus 模块或所有高级功能。

## Plus 命名功能块

当 lop 点名某个 Codex WebUI/Plus 功能块、对话框或入口（例如账户、导航栏账户信息、speed、计划模式、完全访问权限、+ 号菜单、模型/权限/发送按钮），必须把该命名块视为当前范围内的源码级等价任务：按 Plus 源码逻辑、UI、字段、入口、状态、错误态和可见信息建立差距清单并逐项验收。不得用“基础范围”“高级功能不在范围”或旧记忆里的 basic scope 把点名块排除、降级或转移到设置页；旧记忆与本轮点名冲突时，以本轮点名为准。

## WebUI <-> React 双向等价链路

- `Codex-webui-ts` 与 `Codex-webui-react` 的同步验收以逻辑/UI 等价为准，不要求逐字相同；每次改动 WebUI 或 React 源码、规则、ledger 后，必须至少运行 `npm run parity:check`。
- 交付功能改动、UI 改动或源码等价任务前，必须运行 `npm run parity:check:full`；该命令会先做双向语义签名检测，再串两边构建、静态检查和测试。
- 本地 WebUI <-> React watcher、GitHub -> React apply、React -> GitHub sync 全部硬关闭；不得保留 `npm run github:sync:*:react`、`npm run github:pull:*:react`、`--with-react` 或 `GITHUB_SYNC_REACT` 这类临时开启入口。GitHub sync/pull 一律不包含、不监听、不写入 `Codex-webui-react/**`。
- 两边 `tests/` 是隔离验证代码，不属于同步检测对象，也不触发 watcher；full 模式可以运行现有测试做验证，但不得要求测试源码彼此等价。
- 每次同步检测必须记录本地步骤耗时到 `outputs/parity-sync/performance-log.jsonl`，刷新 `outputs/parity-sync/performance-comparison.md`；不再创建或维护置顶会话“性能对比”。耗时口径只统计本地检测/命令执行，不把大模型等待误差算入性能比较。
- React 侧已明确排除 Git UI 与内嵌终端 UI；检测器只能在 manifest 标记允许排除的前端 shell/app.js 比对中跳过这些锚点，其他后端/API/状态能力仍按双向检测执行。

## 历史耗时审计口径

- 用户询问“回复慢”“单次问题”“单轮回复”“调用链耗时”时，必须按 user turn 粒度统计：从该次用户输入到该轮最后一个 assistant/tool 事件，逐项列出 `function_call`/`function_call_output`、`custom_tool_call`、`write_stdin`、`web_search_call` 和相邻事件 gap；不得用整条 session 首尾耗时代替单次回复耗时。只有用户明确要求“整条会话/全会话”时才按 session 聚合。
- 这类耗时审计的最终聊天正文必须直接给 TOP 表和每个慢 turn 的占比矩阵，至少包含初始等待、工具调用合计、模型/非工具 gap、最慢调用、最慢 gap 及各自占比；产物文件只能补充明细，不能替代正文报告。

## 回复与执行速度优化

- 工具返回大日志、大输出或长文本后，禁止直接把完整输出作为主要分析输入；必须先用脚本抽取摘要、错误签名、关键时间段、TopN 或结构化表，再基于摘要判断，完整原文只作为可追溯产物保留。
- 长任务、构建、benchmark、联网实测或持续运行命令，禁止连续多次 30s `yield_time_ms`/`write_stdin` 轮询刷屏；优先让命令写日志/JSON 状态文件，后台运行后用少量短轮询读取状态、尾部摘要和退出码。
- `npm test`、`npm run parity:check:full`、benchmark、全量构建等高成本验证只在收口或关键门槛运行；开发中优先跑最小测试、静态检查、定点脚本或单项 benchmark，避免同一轮重复跑 full。
- 复杂功能、跨模块修复、UI/性能方案或多路径取舍，动手改代码前必须先生成结构化检查表，列目标、边界、调用链、最小验证、风险和预计耗时；用检查表压缩 1-4 分钟级 model planning gap，再进入编辑。
- 同一轮内同类命令或同一命令族第 3 次出现前，必须改成批处理脚本、一次性 runner、并行读取或状态文件；如果确实不能合并，必须在继续重复前说明原因和预期收益。
- benchmark、联网实测、跨 repo parity 或多场景验证必须先建立用例矩阵，再一次性批量执行并输出 JSON/Markdown；禁止边搜、边装、边测、边改导致重复 benchmark。
- 主回复链路里默认禁止安装依赖；只有现有依赖、内置工具和轻量替代都无法满足，且安装收益明确大于耗时/污染风险时，才允许执行 `npm install`、`pip install`、`cargo install` 等安装命令。
- 计时敏感路径、HTTP probe、文件读取、搜索和轻量状态检查默认用 `cmd`/`nu` 或项目脚本；禁止用 PowerShell 作为默认起手或高频重复调用，除非该操作确实需要 Windows 对象/注册表/服务能力。
- WebUI 耗时拆分展示只属于诊断/观测能力，不列为回复速度优化的 P0/P1 项；除非用户明确要求做 UI 展示，否则不得为了展示耗时而增加主链路工作、测试或运行时开销。
