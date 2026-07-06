---
name: lop-requirement-preflight
description: "Requirement preflight for nontrivial implementation, architecture, UI, API, data, cross-module work, unclear goals, 需求分析/方案对比/不要直接写代码. Produces scope, options, impact, and acceptance before coding; skip trivial Q&A or tiny edits."
---

# lop Requirement Preflight

## Contract

Use this skill before coding when the task is non-trivial or ambiguity could change the implementation. The goal is not to produce a long document; the goal is to prevent wrong work.

If the task also triggers `$lop-long-task`, run this preflight first to produce the task contract, then continue with the long-task protocol.

Do not ask lop to fill a form. Inspect available code, configs, pages, logs, memory, history, screenshots, and small probes first. Ask at most 1-3 short questions only when a decision cannot be inferred safely.

## Fast Decision Rule

Use the full preflight when any item is true:

- behavior crosses API, UI, data, config, service, job, CLI, or permission boundaries;
- UI/feature parity, migration, restore, redesign, refactor, or architecture choice is involved;
- correctness depends on existing code, data model, historical behavior, or external dependency;
- user complains that prior work missed the target, looked unchanged, or was not useful;
- validation requires more than one command or more than one layer.

For tiny, explicit edits, compress the same checks internally and proceed.

## Preflight Output Shape

Keep output Chinese and concise. Prefer tables. Lead with the recommended path.

### 1. Target

- Restate the goal in one or two sentences.
- Name the acceptance target: what must be visibly or behaviorally true.
- List ambiguity only if it changes implementation.

### 2. Missing Decisions

List only decision-grade gaps. Do not ask about details that can be discovered from code or small validation.

Use this format:

| Gap | Why it matters | Can infer? |
|---|---|---|

### 3. Options

Give 2-3 options only. Include "do nothing / narrow fix" only when it is a real option.

| Option | Cost | Risk | Impact | Maintainability |
|---|---:|---|---|---|

Recommend one option and state why it is the smallest safe path.

### 4. System Impact

Cover the concrete layers relevant to the repo:

- Entries: API routes, pages, UI events, CLI commands, scheduled jobs, hooks, workers.
- Modules: files/classes/components/services likely touched.
- Data/dependencies: tables, files, config keys, external APIs, local storage, caches.
- Call chain: main request/event path from entry to side effects.
- Risks: permission, compatibility, historical logic, concurrency, rollback, data consistency.
- Confirmation: only the decisions that cannot be inferred safely.

### 5. Minimum Task

Define the smallest implementation slice that can be completed and verified this turn.

Include:

- files or modules likely touched;
- files or modules explicitly out of scope;
- expected user-visible result;
- rollback or containment if relevant.

### 6. Validation

Define checks before coding, not after.

At minimum:

- unit/build/lint command when available;
- endpoint, page, DOM, log, data, or CLI checks tied to the acceptance target;
- negative/error state if user-facing;
- "unverified" conditions and the smallest next action to verify them.

## Anti-Laziness Checks

Before implementation, confirm:

- I have inspected real code/config/page/history enough to avoid guessing.
- I know the visible acceptance target, not just an internal technical success.
- I am not replacing real behavior with fake buttons, fake data, fixed prompts, or cosmetic-only changes.
- I have a validation path that would catch "looks unchanged" or "click still fails".
- The planned diff is the smallest safe diff.

## Final Handoff

After preflight:

- If no blocking question remains, implement the recommended minimum task directly.
- If a blocking question remains, ask only that question and stop.
- If the user explicitly requested analysis only, stop after the preflight.

