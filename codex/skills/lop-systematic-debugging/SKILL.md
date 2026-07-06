---
name: lop-systematic-debugging
description: "Evidence-first debugging for errors, failures, flaky behavior, build/test issues, proxy/network, UI, database or ops incidents, 修复/定位原因/不能用. Reproduce, diagnose, fix, and verify instead of guessing."
---

# Lop Systematic Debugging

## Workflow

1. Define the failure precisely:
   - Capture the exact symptom, command/page/API/path, expected behavior, actual behavior, and latest known good state.
   - Preserve user changes and current state before editing. Do not reset, reinstall, delete caches, or restart services unless evidence justifies it.

2. Reproduce or collect equivalent evidence:
   - Run the smallest safe command, test, page action, log query, or local check that demonstrates the failure.
   - If reproduction is impossible, collect comparable evidence and mark the gap as unverified.

3. Map the boundary:
   - Identify the relevant entry point, config, environment, dependency, recent change, and call chain.
   - For UI issues, inspect runtime evidence such as DOM, console, network, screenshots, and source linkage.
   - For DBA/ops issues, prefer read-only diagnostics first; follow the local MySQL, MongoDB, Windows, proxy, and shell rules from active AGENTS/RULES.

4. Form and test hypotheses:
   - List 2-3 plausible causes ranked by evidence.
   - Test one hypothesis at a time with the cheapest decisive check.
   - Treat failed hypotheses as information and narrow the boundary before editing.

5. Fix minimally:
   - Change the smallest necessary code/config/rule surface.
   - Avoid unrelated refactors, broad rewrites, fake data, fake buttons, or cosmetic-only fixes for functional failures.
   - If multiple files are touched, maintain a short evidence trail for why each file is in scope.

6. Verify the original failure:
   - Rerun the failing command/action or the closest equivalent.
   - Add focused regression coverage when the repo has a test path or when a small repro script is feasible.
   - Continue debugging if verification fails; do not hand a raw failure back unless blocked by missing permission, credentials, destructive risk, or external service state.

7. Report only what matters:
   - State root cause, changed files, verification commands/results, unverified items, residual risk, and rollback path when relevant.
   - Use concrete evidence, not "should", "probably", or "seems".

## Stop Conditions

Ask lop only when the next step requires credentials, paid/external actions, destructive data changes, irreversible system changes, or mutually conflicting acceptance criteria. Otherwise continue independently until fixed, verified, or genuinely blocked.

