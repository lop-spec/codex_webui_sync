# Local Context Lookup Helper

Use this helper only when a long task may depend on lop history, prior project decisions, old paths, tool locations, or repeated preferences.

Command:

```powershell
pwsh -NoProfile -File C:\Users\lop\.codex\scripts\lop-context-lookup.ps1 <keyword...>
```

Use `-Deep` only when the fast lookup does not find enough evidence, because it also scans rollout summaries:

```powershell
pwsh -NoProfile -File C:\Users\lop\.codex\scripts\lop-context-lookup.ps1 smart-proxy APK version -Deep -Max 120
```

Default lookup scans:

- `C:\Users\lop\.codex\memories\MEMORY.md`
- `C:\Users\lop\.codex\history.jsonl`
- `C:\Users\lop\.codex\session_index.jsonl`

Rules:

- Prefer fast lookup first.
- Use targeted keywords from the current task, not broad generic terms.
- Treat lookup output as pointers; open the referenced memory or rollout files before relying on detailed facts.
- Do not write sensitive snippets into final answers unless the user explicitly asks and it is safe.

