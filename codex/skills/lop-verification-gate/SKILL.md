---
name: lop-verification-gate
description: "Final proof gate before claiming 完成/修好了/交付. Use after code, config, rules, skills, hooks, scripts, generated artifacts, debugging, UI, or long-task work to verify evidence and report unverified risks."
---

# Lop Verification Gate

## Required Gate

Before the final answer, prove the task against the requested acceptance criteria.

1. Restate the acceptance target internally:
   - What did lop ask to be true?
   - Which files, pages, commands, configs, artifacts, or runtime paths are in scope?
   - What would count as failure?

2. Build an evidence matrix:
   - Changed files or generated files.
   - Commands run, tests/builds/checks, and important outputs.
   - Runtime validation such as app launch, API call, UI screenshot, DOM/console/network check, database read-only query, or config parser.
   - Artifact proof such as output directory, file name, version, size, hash, and open/run result.

3. Run the strongest available verification:
   - Code: focused test first, then broader tests/build/lint when cheap enough.
   - UI: run the page/app and verify visible state plus console/network evidence when applicable.
   - Config/rules/skills: parse or validate syntax and confirm trigger text exists.
   - Windows/proxy/ops: verify actual process, registry/env/config/listening port/read-only diagnostic output.
   - Docs/reports: verify file exists, section headings render/search, links/paths are correct, and required content is present.

4. Handle failures before reporting:
   - If a check fails, diagnose and fix it.
   - If a check cannot be run, mark it as "未验证", explain the exact blocker, and give the next smallest action.
   - Do not convert a failed verification into a user todo unless the blocker is real.

5. Final response shape for lop:
   - Start with a 1-2 sentence conclusion.
   - For bugfix, debugging, recovery, rule/prompt/skill changes, or any task where lop asks "why" or "what is the solution", begin with a compact summary of root cause, solution, and current result before listing changed files or commands.
   - If lop corrects a missing summary or missing rule solidification, treat it as a verification miss: state the real cause, identify whether rule/prompt/skill wording was underspecified, update the smallest applicable rule or skill unless lop explicitly forbids edits, and report the validation evidence.
   - If lop asked for a report, summary report, comparison, benchmark, or analysis report, include the readable report summary in the chat body before artifact paths; artifact proof supplements the report and must not replace it.
   - For test, benchmark, or performance reports, include a concrete comparison matrix with per-case metrics, sample size, winner, ratio/delta, outliers, and practical interpretation; a total win count alone is not enough.
   - Then list only the necessary details: changed files, validation, unverified items, risks, and next step.
   - For generated artifacts, follow the active three-piece local artifact output rule exactly.

## Completion Rule

"Done" requires evidence. If there is no direct or equivalent verification, the work is not complete; it is at most implemented but unverified.

