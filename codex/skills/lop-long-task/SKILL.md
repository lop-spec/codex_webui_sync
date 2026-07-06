---
name: lop-long-task
description: "Autonomous end-to-end delivery for lop. Use for multi-step implementation, debugging, migration, runnable artifacts, reports, UI/function parity, or phrases like 闭环/成品/直接能用/不要反复问/按全局规则执行. Not for pure Q&A."
---

# lop Long Task

## Required Reference

For every task that triggers this skill, read `references/lop-long-task-protocol-v1.md` before planning or executing.

That reference is the authoritative execution protocol for lop long tasks. It defines:

- what lop should and should not need to provide;
- required history/config/code/page evidence lookup;
- autonomous task decomposition and subagent rules;
- design review scope;
- execution, validation, retry, and blocking gates;
- artifact delivery format;
- final report shape;
- anti-laziness checks.

When prior local context may matter, also read `references/local-context-lookup.md` and use the helper script described there before broad exploration.

## Execution Contract

Apply the protocol as a mandatory workflow, not as optional advice.

Start by deriving a task contract from the user's message and available context. Do not ask lop to fill a long form. Use local files, memory, history, project rules, code, logs, pages, and small validations to resolve ambiguity whenever possible.

Ask lop at most 1-3 short questions only when the protocol's blocking conditions are met: missing credentials, high-risk or irreversible action, possible data destruction, clear cost increase, mutually conflicting acceptance criteria, or an external business decision that cannot be inferred.

## Default Workflow

1. Read the full protocol reference.
2. Confirm the actionable goal, scope, evidence, and acceptance criteria internally.
3. Inspect real local context before deciding.
4. Use subagents when the work safely splits into 2-4 independent evidence chains and the current environment allows it.
5. Implement the smallest necessary change.
6. Run every practical validation available in the current environment.
7. Fix failures instead of handing them back to lop.
8. Deliver the finished artifact or explicit blocking evidence.

## Output Rules

Keep user-facing updates concise and Chinese by default.

Final replies must lead with the result, then include only the necessary details:

- changes made;
- files touched;
- validation run and result;
- unverified items with reason;
- remaining risk;
- next minimum action.

For generated artifacts, use lop's artifact three-piece format from the protocol.

