# Windows、产物、APK 专项规则

读取触发：任务涉及 Windows shell/路径、cmd/nu/nush/nushell、文件或目录展示、生成产物、安装包/APK、Android 本地测试、可执行文件、打包签名、版本号、可打开路径。

## Windows 命令

- Windows 本地操作默认 shellless：命令执行、文件、打开、注册表、服务、进程、端口、文本、JSON、zip/unzip 一律先触发 `$lop-winops`，首选 `C:\Users\lop\.codex\tools\winops\winops.exe <job.json>`；复杂内容只写 UTF-8 job 文件，主结果写 result.json，stdout 只作为结果路径提示。
- `cmd/pwsh/nu/nush` 只允许三类例外：当前 Codex 执行工具需要宿主进程来启动 `winops.exe` 的 bootstrap；winops 尚未覆盖的系统对象/API；用户明确要求 shell 复现。例外必须说明原因，且复杂业务内容仍不得进入 shell 命令行。
- 2026-07-04 的 `cmd`/`nu` 横评只保留为 legacy fallback 参考，不再作为默认路线：`cmd` 可处理极短只读外部命令，`nu` 可处理简单结构化过滤；一旦涉及引号、反引号、空格、中文、JSON/HTML/Markdown/正则、长参数或原样输出，立即回到 winops job。
- `winops.exe` 适用：外部进程 argv 保真、文件读写/复制/移动/删除/hash、打开文件/目录/URL、注册表、服务、进程、端口、文本搜索替换、JSON 读写选择、zip/unzip；参数含空格/中文/引号/反引号/`&|()<>%!`、JSON/HTML/Markdown/正则、长参数、需要原样输出、或之前在 `cmd/nu` 中出现拆参/乱码/转义失败时，不再二次堆 shell 转义。
- `run-argv.mjs` 仅作为旧兼容；新任务默认用 `winops.exe`。`.cmd/.bat` 默认拒绝，必须定位真实 `.exe/.js` 入口；确实必须跑 `.cmd/.bat` 时才回到显式 shell 例外并记录原因。
- `winops.exe` job 必须把 `op`、`input`、路径和参数分开写；破坏性操作默认 dry-run，实际执行必须同时设置 `dryRun:false` 和 `confirm:true`；删除默认进 `%USERPROFILE%\.codex\quarantine\winops`，不得默认硬删。
- 总原则：最稳方案不是继续修 shell 转义，而是让业务输入完全退出 shell 命令行；失败默认按规则迁移到 winops job/result，不再归因给 `cmd`、`nu` 或外层转义。
- legacy fallback 转换顺序：只有 winops 不覆盖或用户明确要求 shell 时，才生成目标 shell 标准形态；仍不稳定就停止堆转义，改成 winops job、参数文件或输入文件。
- Legacy shell fallback 只用于用户点名 shell 复现、winops 未覆盖对象/API，或当前 Codex 执行器只能借 shell 启动 `winops.exe` 的 bootstrap；fallback 命令必须短、只读、无复杂 payload，并在回复或执行记录里说明原因。
- 若 fallback 第一次出现拆参、乱码、`SyntaxError`、`os error 123`、重定向/管道/引号失败，立即停止 shell 方向，改 winops job、参数文件、pattern 文件或输入文件；禁止二次、三次堆 `cmd/nu/pwsh/nush` 转义。
- `.cmd/.bat/npm` wrapper 默认不跑；能定位真实 `.exe/.js` 入口就通过 winops `exec` argv 直调。用户明确要求 wrapper 复现时才允许 shell fallback。
- `node -e`、`python -c`、JSON、HTML、Markdown、正则、多行逻辑、中文或原样引号输出默认禁止进命令行；写临时脚本或输入文件后由 winops argv 执行。

## 本地文件/产物展示

- 本地文件链接只用于精确定位/编辑；需要用户直接打开目录时，Windows 原生目录路径和可复制 Windows 打开命令是硬要求，Markdown 链接只能作为可选辅助，不得承诺一定可点击打开。
- 生成产物交付必须三件套：第一行单独输出产物所在目录 Windows 绝对路径；随后给同一目录的可复制打开命令 `explorer.exe "C:\Users\...\dist"`，或说明 Codex 已用 winops open 打开；再给文件名、完整路径、哈希/版本/运行方式等必要信息。
- Windows 目录路径必须用原生反斜杠形态 `C:\Users\...\dir`；`C:/...`、`/C:/...`、Markdown 目录链接或渲染器伪路径不得作为唯一打开方式。
- 禁止只给生成文件路径；禁止用 `dir-c`/`dist-c` 当链接文字；禁止输出 `dir -c 路径` 样式；禁止把 `目录链接：reply-layout-previews` 这类相对目录名当作可打开入口；不要假定任何目录超链接一定可直开。

## APK/Android

- 做 APK/安装包改包时，每次重新产出必须递增 versionCode/versionName 或同等版本标识，并使用短文件名，避免长描述导致装错。
- 讨论 APK 本地测试或自动跑通时，必须先盘点当前机器已有 Android/ADB/SDK/反编译/签名工具和运行环境。
- 必须区分宿主机静态检查/构建/反编译/签名/manifest 校验和真实运行 APK；真实运行必须依赖真机、云真机、模拟器、容器或子系统，不能未盘点环境就要求安装完整模拟镜像。
- 当 lop 要 APK 功能场景测试、复现功能、指定流程或“代码/命令跑通功能”时，必须优先给可脚本化的场景复现方案；按“只有 APK 黑盒：Maestro/Appium/uiautomator2/ADB input”，“有源码或测试 APK：Espresso/UIAutomator/Instrumentation/Orchestrator”，“最低依赖命令层：adb am/input/uiautomator dump/logcat/screencap”排序说明。禁止把随机 Monkey、静态分析、云真机/模拟器选型或环境安装当成主答案；这些只能作为运行载体或补充验证。
