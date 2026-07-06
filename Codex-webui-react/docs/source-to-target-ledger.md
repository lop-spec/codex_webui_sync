# Codex WebUI React Source Parity Ledger

目标：`Codex-webui-react` 必须按 `Codex-webui-ts` 的真实 UI 结构和前端行为运行；React 层不得用简化组件、假按钮或静态 JSON 面板冒充源码/UI 逻辑还原。用户本轮明确排除 Git 与内嵌终端工具。

## Scope Boundary

| Item | Source | Target | Status | Evidence |
|---|---|---|---|---|
| Project directory | `github-ui/Codex-webui-ts` | `github-ui/Codex-webui-react` | verified-equivalent | Sibling React project keeps isolated files |
| Web port | `5055` | `5155` | verified-equivalent | `server/server.ts` default port |
| app-server port | `5056` | `5156` | verified-equivalent | `server/services/app-server-client.ts` default URL |
| Public watchdog | `npm run public` supervises `5055` WebUI and public tunnel | `npm run public` builds then supervises `5155` WebUI and public tunnel | verified-equivalent | `package.json`, `server/public-tunnel.ts`, `tests/static.test.js` |
| Git UI/tool | `public/index.html` Git modal, app bindings, slash diff entry | React client shell | excluded-by-lop | Shell removes `gitModal`; bindings are optional; slash `showDiff` entry and modal open path removed |
| Embedded terminal UI/tool | `public/index.html` terminal modal and app bindings | React client shell | excluded-by-lop | Shell removes `terminalModal`; bindings are optional; modal open path removed |

## Backend Source Mapping

| Source segment | Target segment | Status | Evidence |
|---|---|---|---|
| `src/server.ts` static/API/SSE routes | `server/server.ts` | verified-equivalent | Backend copied, default port changed to 5155 |
| `src/services/codex.ts` Codex lifecycle, queue, SSE bridge | `server/services/codex.ts` | verified-equivalent | Backend copied, default lifecycle adjusted to 5155/5156; exec child spawn uses `windowsHide: true` for silent message sends |
| `src/services/app-server-client.ts` detached app-server websocket | `server/services/app-server-client.ts` | verified-equivalent | Default URL changed to `ws://127.0.0.1:5156` |
| `src/services/app-server-client.ts` endpoint state and fallback port allocation | `server/services/app-server-client.ts` | verified-equivalent | Copied fallback helpers; default URL adjusted to `ws://127.0.0.1:5156`; parity checks `APP_SERVER_ENDPOINT_STATE` and `allocateEndpointLike` |
| `src/services/preview.ts` | `server/services/preview.ts` | verified-equivalent | Copied |
| `src/services/skills.ts` | `server/services/skills.ts` | verified-equivalent | Copied |
| `src/services/mcp.ts` | `server/services/mcp.ts` | verified-equivalent | Copied |
| `src/services/memory.ts` | `server/services/memory.ts` | verified-equivalent | Copied |
| `src/services/transfer-store.ts` and `storage-to.ts` | `server/services/*` | verified-equivalent | Copied |
| `src/services/transfer-store.ts` Android companion inbox mirror and `localPath` metadata | `server/services/transfer-store.ts` | verified-equivalent | Copied `androidInbox` helpers; TS test covers Android upload mirror and `localPath`; parity checks target declarations |
| `src/server.ts` `/health` network URLs and `/transfer/files/:id/open-folder` | `server/server.ts` | verified-equivalent | Copied routes/helpers; default Web port adjusted to `5155`; TS tests cover health fields and open-folder endpoint |
| `src/server.ts` recycle restore scan, summary extraction, and `/session/restore` | `server/server.ts` | verified-equivalent | Ported helpers and routes; default history project is `历史对话`; parity checks route/helper declarations |
| `src/server.ts` manual project roots and `DELETE /project/root` | `server/server.ts` | verified-equivalent | Copied `validHistoryRoots`-only project listing, `projectListRootForWorkdir`, and persistent root removal; TS tests cover registered roots and delete behavior |
| `src/utils/*` and `src/types.ts` | `server/utils/*`, `server/types.ts` | verified-equivalent | Copied |
| `src/public-tunnel.ts` local/public watchdog | `server/public-tunnel.ts` | verified-equivalent | Copied; default port changed to `5155`, retains health monitor, web restart, and public tunnel restart |

## Frontend Source Mapping

| Source segment | Target segment | Status | Evidence |
|---|---|---|---|
| `public/index.html` shell/sidebar/topbar/timeline/composer/modals | `src/client/legacy-shell.ts` mounted by `src/client/App.tsx` | verified-equivalent | React renders the source DOM shell via `legacyShellHtml` |
| `public/css/app.css` visual system | `static/css/app.css`, `/css/app.css`, `index.html`, `src/client/App.tsx` stylesheet guard | verified-equivalent | Copied from source project, linked by the React host before scripts, and copied into build output by Vite |
| `public/js/app.js` sessions, projects, composer, queue, user input, settings, account, preview, skills, MCP, memory, SSE, timeline | `static/js/app.js` copied to `/js/app.js` and loaded by React | verified-equivalent | Copied from source project; Git/terminal bindings guarded |
| `public/index.html`, `public/js/app.js`, `public/css/app.css` recycle restore dialog | `src/client/legacy-shell.ts`, `static/js/app.js`, `public/js/app.js`, `static/css/app.css`, `public/css/app.css` | verified-equivalent | Shell exposes `restoreHistoryBtn`; JS calls `/session/recycle-candidates` and `/session/restore`; styles copied |
| `public/js/app.js` assistant reply copy buttons | `static/js/app.js`, `public/js/app.js` | verified-equivalent | Copied source functions and MutationObserver wiring; static tests assert copy helpers and button class |
| `public/js/app.js` silent persistent project root removal | `static/js/app.js`, `public/js/app.js` | verified-equivalent | Copied `/project/root` delete call and removed success toast; TS static tests assert no removal notification text |
| `public/js/transfer.js` provider chain, upload/download, transfer conversation | `static/js/transfer.js` copied to `/js/transfer.js` and loaded by React | verified-equivalent | Copied from source project |
| `public/index.html` transfer mode/LAN info controls | `src/client/legacy-shell.ts`, `public/index.html` | verified-equivalent | Legacy shell regenerated from source HTML; parity checks `transferMode` and `transferLanInfo` ids |
| `public/js/transfer.js` transfer mode, LAN health display, open-folder action | `static/js/transfer.js`, `public/js/transfer.js` | verified-equivalent | Copied source logic; static tests assert `plusTransferMode`, `/health`, `/path/open`, and `open-folder` |
| `public/css/app.css` transfer mode and LAN info styling | `static/css/app.css`, `public/css/app.css` | verified-equivalent | Copied source CSS with `.transfer-field` and `.transfer-lan-info` selectors |
| React mount lifecycle | `src/client/App.tsx` | verified-equivalent | Mounts source DOM once, ensures source CSS is present, then loads source scripts in order |
| Static parity tests | `tests/static.test.js` | verified-equivalent | Asserts shell markers, source CSS wiring, modal hidden rules, excluded modals, guarded bindings, and isolated ports |
| Bidirectional parity sync guard | `parity/bidirectional-manifest.json`, `scripts/parity-check.mjs`, `scripts/parity-watch.mjs` | verified-equivalent | Root guard compares WebUI and React semantic signatures, CSS/UI shell anchors, ledger state, and optional full build/test commands |
| Parity performance report | `outputs/parity-sync/performance-log.jsonl`, `outputs/parity-sync/performance-comparison.md`, pinned history session | verified-equivalent | Each parity run records local step timings, excludes model wait variance, and exposes the latest report as a pinned “性能对比” session in both projects |

## Notes

- React currently acts as the parity host instead of a hand-rewritten component tree. This is intentional: it restores source UI and behavior first, avoiding a simplified React clone that looks close but misses real logic.
- Future componentization must keep this ledger current and can only mark a segment `verified-equivalent` after matching DOM, event behavior, API calls, states, and runtime evidence.
