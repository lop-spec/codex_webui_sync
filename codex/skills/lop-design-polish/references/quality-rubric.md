# Quality Rubric

Use this file before claiming a UI, document, or report is polished, beautiful, strongest, complete, or production-ready.

## Scoring

Score each relevant row:

- `2`: meets the bar with direct evidence.
- `1`: partially meets the bar or depends on an assumption.
- `0`: fails, missing, fake, or unverified.

Do not claim "strongest" if any row is `0`. Do not claim "perfect" unless every relevant row is `2` and visible/runtime evidence exists.

## UI Rubric

| Gate | Pass Bar |
|---|---|
| Aesthetic coherence | One clear visual direction, no collage of unrelated design systems |
| Reference fit | Local developer tools prefer Primer/Pajamas/Carbon/Radix/React Aria/Lucide; heavy or marketing systems need a project-specific reason |
| Lop taste fit | Low-noise, icon-first but not guessy, flat modern, soft separation, silky lightweight motion, readability-first, performance-first, and uncluttered density are visible in the result |
| Typography | 16px readable surfaces, 13px minimum secondary text, stable line height, no viewport font scaling |
| Color | WCAG AA text contrast, restrained palette, status colors reserved for state |
| Layout | No horizontal overflow, no nested cards, stable toolbar/sidebar/control dimensions |
| Hierarchy | Primary task, secondary info, metadata, and actions are visually distinguishable |
| Rhythm | Visual rhythm is clear through repeated spacing, stable row heights, aligned baselines, and naturally flowing lines |
| Interaction | Real lightweight controls, accessible names/tooltips, icon-first where useful, instant feedback, loading/error/empty/retry states where applicable |
| Motion | Smooth, short, consistent, transform/opacity-first, reduced-motion aware, and never decorative at the cost of reading speed |
| Separation | Layout divisions are quiet, aligned, and readable without harsh dividers, heavy shadows, abrupt blocks, or noisy nested cards |
| Responsiveness | 1024x768 desktop and 390px mobile/low-res remain usable for web UI |
| Performance/lightness | No unnecessary large dependency, background process, animation, font asset, or image payload |
| Verification | Build/test or equivalent check plus screenshots/DOM/console/network proof when applicable |

## Document And Report Rubric

| Gate | Pass Bar |
|---|---|
| Conclusion | First 1-2 sentences answer the question directly |
| Scanability | Headings, tables, bullets, and spacing let the reader find decisions quickly |
| Evidence | Claims map to files, commands, screenshots, metrics, links, or explicit assumptions |
| Judgment rule | Recommendation has a concrete decision rule, not taste-only wording |
| Typography/layout | Markdown or HTML is readable, constrained, high contrast, and not visually noisy |
| Code/data | Code fences have languages; raw JSON is summarized unless raw output is requested |
| Artifact proof | Generated files have directory, file names, verification, and unverified risks |
| Ops boundary | DBA/ops framing appears only for explicit operations problems |

## Blockers

Any of these blocks a "done/strongest/perfect" claim:

- fake button, fake data, fixed prompt, static visual-only replacement for real behavior;
- text overlap, clipped controls, unreadable small text, or horizontal overflow;
- weak contrast on reading surfaces or state-bearing labels;
- noisy visual design: too many borders, shadows, color blocks, repeated labels, or nested cards;
- heavy library or runtime process added only for appearance without strong reason;
- design reference copied for popularity instead of fit with lop's beauty/layout/performance/lightness priorities;
- decorative or verbose layout that ignores lop's extreme performance/lightweight/minimal/flat/icon-first/smooth-motion preference;
- janky, long, layout-triggering, or non-reduced animations;
- abrupt layout splits, harsh separators, heavy shadows, or blocky section breaks without functional reason;
- interaction that hides critical status, slows repeated work, or hurts low-resolution readability;
- report that requires opening a file to understand the conclusion;
- no practical verification run when a cheap verification path exists.
