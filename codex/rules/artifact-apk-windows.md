# Windows、产物、APK 专项规则

读取触发：任务涉及 Windows shell/路径、cmd/nu/nush/nushell、文件或目录展示、生成产物、安装包/APK、Android 本地测试、可执行文件、打包签名、版本号、可打开路径。

## Windows 命令

- 按 2026-07-04 本机横评强制路由 shell：`cmd` 负责 shell 启动/短命令、固定字符串搜索、读文本、端口监听探测、小目录复制删除、`rg/curl/robocopy/where` 等简单外部 exe；`nu` 负责工具定位、大目录枚举、JSON/table 解析筛选、进程列表过滤、HTTP 响应解析和结构化管道。
- 用户层禁用 `pwsh` 作为默认执行壳；除非上级安全规则、Windows 对象模型、注册表/服务/WMI/CIM、锁定文件/安全递归移动删除，或 `cmd/nu` 已验证无法表达，否则不得主动改用 `pwsh`。例外使用必须说明原因。
- 简单读文件、查文本、列目录、`rg/git/jq/where` 等外部工具必须用 `cmd`；`exec_command(shell="cmd")` 只用于无嵌套引号、无空格敏感参数、无 `|&<>()%` 控制符的扁平命令体。
- 复杂 `cmd` 先转通用 wrapper，不许归因给 `cmd` 本身：含带空格路径、中文多词、正则管道、括号、重定向、多段命令、内联代码或嵌套引号时，用 `cmd.exe /d /s /c "..."`，wrapper 内部参数引号写成 `""...""`；仍复杂就落临时 `.cmd`/`.js`/参数文件。
- 固定字符串搜索优先 `rg -n -F -- "text" "file"`；正则优先 `rg -n -- "pattern" "file"`；多个词不要拼 `a|b c`，改用多个 `-e` 或 pattern 文件，例：`rg -n -e text1 -e "text two" -- "file"`。
- `findstr` 只用于单词级简单过滤；多词、中文、标点、正则、括号和路径有空格时，改用 `rg -F`、`rg -e` 或脚本探针，禁止堆多层转义。
- 大复制优先 `robocopy`；超大枚举或结构化管道必须优先用 `nu`。
- `cmd` 中禁止使用 PowerShell 语法如 `$ts=...`、`$(...)`、反引号和对象管道；需要变量用 `set "NAME=value"` 和 `%NAME%`，需要时间戳优先固定文件名、纯 cmd 片段或临时脚本。
- `node -e`、`python -c`、JSON、HTML、正则和多行逻辑只允许短表达式；一旦出现引号嵌套、反斜杠、括号或中文，必须改临时脚本加 argv/文件输入，不能继续硬拼一行。
- Windows 下从 Node/脚本启动 `.cmd` wrapper 易受 spawn/引号影响；能定位到真实 JS/EXE 入口就直调入口，必须跑 `.cmd`/`npm` 时用 shell 模式或显式 `cmd.exe /d /s /c`。
- 当前 `exec_command(shell="cmd")` 中，路径不含空格且命令扁平时可不加引号；路径含空格或参数需要引号时，进入复杂 wrapper/参数文件模板，不能把引号当字面量传给 `rg/python/nu` 导致 `os error 123`。
- `nu`/`nush` 一律按 Nushell 处理：优先用 `C:\Users\lop\AppData\Local\Programs\nu\bin\nu.exe --no-config-file --no-history --no-std-lib -c "..."`；脚本内路径用正斜杠和单引号，外部命令加 `^`，丢弃输出用 `| ignore`，避免把 `>nul`、`%VAR%`、`&&`、`||` 等 cmd 语法塞进 nu。
- `cmd` 或 `nu` 发生语法、引号、重定向、编码或管道错误时，禁止直接逃回 `pwsh`；必须先按上面模板分类改写并重跑，记录成功形态。只有 wrapper/脚本/参数文件仍失败，且任务属于本文件列出的 PowerShell 例外，才可临时用 `pwsh` 并说明原因。
- 若某类 `cmd/nu` 语法错误被修成可复用通用格式，必须立即写入本文件或项目 `RULES.md`，并验证触发词可命中。

## 本地文件/产物展示

- 本地文件链接只用于精确定位/编辑；需要用户直接打开时必须优先给目录链接。
- 生成产物交付必须三件套：第一行单独输出产物所在目录 Windows 绝对路径；随后给同一目录的 `C:/Users/.../dist` 可点击 Markdown 目录链接；再给文件名、完整路径、哈希/版本/运行方式等必要信息。
- 禁止只给生成文件路径；禁止用 `dir-c`/`dist-c` 当链接文字；禁止输出 `dir -c 路径` 样式；不要假定反斜杠文件链接一定可直开。

## APK/Android

- 做 APK/安装包改包时，每次重新产出必须递增 versionCode/versionName 或同等版本标识，并使用短文件名，避免长描述导致装错。
- 讨论 APK 本地测试或自动跑通时，必须先盘点当前机器已有 Android/ADB/SDK/反编译/签名工具和运行环境。
- 必须区分宿主机静态检查/构建/反编译/签名/manifest 校验和真实运行 APK；真实运行必须依赖真机、云真机、模拟器、容器或子系统，不能未盘点环境就要求安装完整模拟镜像。
- 当 lop 要 APK 功能场景测试、复现功能、指定流程或“代码/命令跑通功能”时，必须优先给可脚本化的场景复现方案；按“只有 APK 黑盒：Maestro/Appium/uiautomator2/ADB input”，“有源码或测试 APK：Espresso/UIAutomator/Instrumentation/Orchestrator”，“最低依赖命令层：adb am/input/uiautomator dump/logcat/screencap”排序说明。禁止把随机 Monkey、静态分析、云真机/模拟器选型或环境安装当成主答案；这些只能作为运行载体或补充验证。
