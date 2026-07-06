---
name: lop-design-polish
description: UI, document, and report polish workflow for 美观、布局、排版、轻量、低噪声、图标优先但不猜谜、扁平现代、柔和分割、丝滑轻动画、可读性压倒风格、性能即审美、视觉节奏、字体清晰、克制配色、即时反馈、少卡片嵌套、清爽侧栏、加载态轻巧、扫描效率、线条流畅自然、边框柔和圆润、低分辨率可读性. Use for program UI 美化 or document/report beautification; apply DBA/ops identity only for explicit operations problems.
---

# Lop Design Polish

## Purpose

Turn vague "make it beautiful/readable" requests into concrete UI, document, or report improvements with mature references, minimal implementation, performance awareness, and visible verification.

Default to lop's non-ops taste: push aesthetics, UI quality, layout, typography, efficiency, performance, and lightness as far as the current project constraints allow. Use DBA/ops framing only for explicit operations problems such as incidents, runtime outages, deployment failures, service unavailability, alerts, capacity, resources, network/proxy faults, or database runtime troubleshooting.

## Preference Calibration

Known hard constraints: lop wants low-noise UI, icon-first but not guessy controls, flat modern surfaces, soft separation, silky lightweight motion/smooth motion, readability over style, performance as aesthetics/extreme performance, extreme lightness/lightweight, minimalism, non-abrupt separation, uncluttered density, and best low-resolution readability for color, background, and fonts.

## Confirmed Aesthetic Rules

- Low-noise interface: reduce borders, shadows, color blocks, repeated information, and decorative panels.
- Icon-first but not a guessing game: tool buttons should use icons with tooltip/label/accessibility when meaning is not obvious.
- Flat modern structure: use color, lines, spacing, and alignment instead of skeuomorphic depth.
- Soft separation: divide areas with spacing, quiet 1px lines, gentle surface shifts, and rhythm instead of abrupt blocks.
- Silky lightweight motion: short, fast, natural motion only for feedback, state, and direction.
- Readability over style: font, contrast, line height, and low-resolution reading speed override decoration.
- Performance as aesthetics: fast loading, fast response, few dependencies, and low animation cost are visual quality.
- Keyword checklist: visual rhythm, clear typography, restrained palette, instant feedback, fewer nested cards, clean sidebar, lightweight loading state, scan efficiency, naturally flowing lines, and soft rounded borders.

Prefer lightweight high-performance modern display and interaction controls such as options, event triggers, click actions, disclosure, menus, segmented controls, status chips, and icon buttons over long ordinary static display. Do not sacrifice critical state visibility, accessibility, or operation speed.

Before locking a visual direction, palette, density, or reference system, ask up to 3 short calibration questions when the user has not provided screenshots, brand cues, disliked examples, or explicit taste. Mature open-source design systems are references, not substitutes for lop's personal taste.

## Source Routing

Load references only as needed:

- For choosing design-system inspiration or citing research, read `references/source-selection.md`.
- For program UI, WebUI, admin panels, dashboards, forms, or layout/color work, read `references/ui-polish-playbook.md`.
- For Markdown/HTML documentation, summaries, generated reports, or explicit ops-problem reports, read `references/docs-reports-playbook.md`.
- For judging whether the output is strong enough to claim polished, read `references/quality-rubric.md`.
- For a drop-in CSS baseline, adapt `assets/lop-workbench-theme.css`.
- For a Markdown report skeleton, adapt `assets/report-template.md`.
- For color contrast proof, run `scripts/contrast_check.py`.
- For this skill's own bundle integrity, run `scripts/audit_skill_bundle.py`.

## Default Style Selection

Use this order unless the project already has a stronger local design system:

| Target | Default reference mix | Why |
|---|---|---|
| Codex WebUI, local utilities, developer tools | Primer + Carbon + Radix/shadcn | Code/workflow UI, dense data, accessible primitives |
| Ops incident tools and runbooks | Carbon + Primer + WCAG | Operational clarity, evidence, status, dense data |
| Heavy enterprise forms/tables | Ant Design + Carbon | Rich controls and table patterns |
| Windows/M365-like app | Fluent 2 + Primer density | Native Windows mental model |
| Android/mobile app | Material 3 + platform conventions | Mobile typography, touch targets, system color |
| Public service/form flow | GOV.UK + WCAG | Clarity and accessibility first |
| Docs/reports | Diataxis + Google/Microsoft style | Scan-friendly technical writing |

## Execution Workflow

1. Inspect the real artifact first: current UI/page/doc/report, framework, CSS/theme files, screenshots, build/test entry, and existing conventions.
2. If subjective taste is unknown, ask a short calibration question set before choosing a style.
3. Classify the surface: workbench/admin, dashboard, settings, data table, chat/WebUI, mobile, docs, report, landing page, or mixed.
4. Choose one visual direction from the table. Do not mix many design systems into a collage.
5. Build a short audit with at most 7 issues: typography, color/contrast, layout density, hierarchy, navigation, controls/states, responsive/low-res.
6. Implement the smallest real improvement. Prefer tokens, spacing scale, component states, and existing helpers over new libraries.
7. Verify visually and mechanically: build/test, screenshot at desktop and mobile or low-res, contrast checks, no text overlap, no horizontal overflow, no console errors when applicable.
8. Report only changed files, visible result, validation, unverified items, and remaining risk.

## Quality Gate

Do not claim "perfect", "strongest", "done", or "beautiful" unless the relevant rubric passes.

- UI work must pass visual coherence, readable hierarchy, responsive layout, state coverage, performance/lightness, and screenshot/build verification.
- Docs/reports must pass conclusion-first structure, scan-friendly layout, evidence clarity, readable typography, link/code quality, and artifact/path verification.
- Any missing real behavior, fake control, text overlap, horizontal overflow, weak contrast, unnecessary heavy dependency, or unverified visible result blocks the claim.
- When time or environment prevents full proof, say exactly which gate is unverified and the smallest next verification.

## UI Guardrails

- Start the app/tool itself on the first screen; do not create a marketing landing page for a tool.
- Use 16px readable body text, 13px minimum secondary text, 14px code/mono text, and 1.45-1.65 line height for reading surfaces.
- Prefer "Segoe UI Variable", "Segoe UI", "Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", Verdana, Tahoma, Arial, sans-serif on Windows/local web UI.
- Use neutral surfaces plus one primary accent and status colors. Avoid one-hue palettes, purple/blue gradient dominance, beige-only themes, decorative orbs, and nested cards.
- Keep cards at 8px radius or less unless the existing design system requires otherwise.
- Use icon buttons for tools, toggles for binary settings, segmented controls for modes, sliders/inputs for numbers, menus for option sets, and tabs for views.
- Preserve real behavior. Do not replace missing features with fake buttons, fixed prompts, static screenshots, or visual-only placeholders.
- For low resolution, verify 1024x768 desktop and a 390px mobile viewport when web UI is involved.

## Document And Report Guardrails

- Lead with a 1-2 sentence conclusion, then evidence. Do not bury the answer under background.
- Use tables for comparisons, status, metrics, and verification matrices.
- Use short sections and strong labels: conclusion, key data, judgment rule, changes, validation, unverified, risk, next step.
- For long docs, separate tutorial/how-to/reference/explanation instead of one giant mixed page.
- Use code fences with language tags, copy-friendly command blocks, meaningful links, and high-contrast code blocks.
- Avoid giant raw JSON, decorative covers, vague "overview" sections, and report files that are pretty but not scannable.

## Validation

Run the strongest cheap proof before claiming completion:

```powershell
python C:\Users\lop\.codex\skills\lop-design-polish\scripts\contrast_check.py "#111111,#f7f7f2" "#555e66,#f7f7f2" "#2563eb,#ffffff"
python C:\Users\lop\.codex\skills\lop-design-polish\scripts\audit_skill_bundle.py C:\Users\lop\.codex\skills\lop-design-polish
```

For UI changes, also run the project build/test and capture screenshots. For docs/reports, verify headings, tables, links, code blocks, and output paths.
