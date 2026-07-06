---
name: lop-tdd-minimal-change
description: "Use for code, scripts, UI logic, APIs, data flow, refactors, or bugfixes with a feasible repro/test path. Prefer failing check, smallest fix, then verification; skip pure read-only Q&A."
---

# Lop TDD Minimal Change

## Workflow

1. Scope the change:
   - Identify the user-visible behavior, affected entry points, call chain, and existing tests/build commands.
   - Preserve unrelated user edits and avoid broad refactors.

2. Choose the smallest proof:
   - Prefer an existing failing test or add a focused test that fails for the right reason.
   - If the project has no usable test harness, create the closest cheap proof: repro script, command fixture, UI interaction, API call, or documented manual check.
   - For UI behavior, include runtime validation rather than only static code inspection.

3. Red phase when feasible:
   - Run the focused test/repro before editing and capture the failure.
   - If red phase is impractical, state why internally and still define the expected verification before coding.

4. Minimal implementation:
   - Change only the necessary production code/config.
   - Do not rewrite architecture, rename unrelated symbols, adjust unrelated formatting, or weaken assertions to make tests pass.
   - Prefer existing local patterns, helpers, and ownership boundaries.

5. Green phase:
   - Run the focused proof until it passes.
   - Run the cheapest broader regression check that covers the touched surface.
   - If a broader check fails, determine whether it is caused by this change before final reporting.

6. Refine only when useful:
   - Clean up duplication or complexity introduced by the change.
   - Keep refactors local and behavior-preserving unless explicitly requested.

7. Handoff:
   - Report behavior changed, tests/proofs run, files touched, unverified gaps, and residual risk.
   - If no test was added, explain the equivalent verification used.

## Guardrails

Tests are proof, not decoration. Do not add tests that only assert implementation details, mirror wrong behavior, depend on brittle timing, or require unavailable credentials/services unless the task explicitly needs that integration.


