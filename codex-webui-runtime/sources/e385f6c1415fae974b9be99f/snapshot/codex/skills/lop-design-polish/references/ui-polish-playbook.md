# UI Polish Playbook

Use this file for program UI beautification, especially local WebUI, admin, dashboard, settings, and developer-tool interfaces.

## Lop Workbench Baseline

Default visual character:

- Beautiful product UI, not marketing; polish must improve aesthetics, layout, typography, efficiency, performance, and lightness together.
- Lop's known taste: low-noise interface, icon-first but not guessy controls, flat modern surfaces, soft separation, silky lightweight motion, readability over style, performance as aesthetics, extreme lightness, minimalism, uncluttered density, and low-resolution readability.
- Required keywords: visual rhythm, clear typography, restrained palette, instant feedback, fewer nested cards, clean sidebar, lightweight loading state, scan efficiency, naturally flowing lines, and soft rounded borders.
- Warm-neutral background, crisp black text, restrained blue/teal accent, clear status colors.
- Dense but not cramped: 8px micro gap, 12px control gap, 16px section gap, 24px page gap.
- 8px maximum card radius, 1px borders, subtle shadows only for overlays.
- Left navigation + main work surface + optional detail panel for desktop; drawer for mobile.

Reference blend:

- Primer for code/workflow navigation, markdown-adjacent surfaces, and restrained developer-product polish.
- GitLab Pajamas for project trees, CI/dev workflow density, issues/diffs, and open-source developer-tool patterns.
- Carbon for dense data, left navigation, tables, and documentation structure.
- Atlassian for page shells, panels, hierarchy, and productivity-tool composition.
- Radix/shadcn/React Aria for accessible behavior and primitives without importing a heavy visual framework.
- Open Props only as token-scale inspiration; do not add it as a dependency only for polish.

## Theme Tokens

Use these as a starting point when the repo lacks better tokens:

| Token | Light | Dark |
|---|---|---|
| `--bg` | `#f7f7f2` | `#101214` |
| `--surface` | `#fffdf8` | `#17191c` |
| `--surface-soft` | `#efefe4` | `#22262b` |
| `--border` | `#d8d7cb` | `#343a40` |
| `--text` | `#111111` | `#f3f4f6` |
| `--text-muted` | `#555e66` | `#c2c8cf` |
| `--accent` | `#2563eb` | `#6ea8fe` |
| `--accent-2` | `#0f766e` | `#5eead4` |
| `--success` | `#15803d` | `#86efac` |
| `--warning` | `#b45309` | `#fbbf24` |
| `--danger` | `#b91c1c` | `#fca5a5` |

Typography:

- Body: 16px, line-height 1.5 to 1.6.
- Small/meta: 13px minimum.
- Code/terminal: 14px, line-height 1.45 to 1.55.
- Avoid viewport-scaled font sizes. Avoid negative letter spacing.

Font stack:

```css
font-family: "Segoe UI Variable", "Segoe UI", "Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", Verdana, Tahoma, Arial, sans-serif;
```

Mono stack:

```css
font-family: "Cascadia Mono", Consolas, ui-monospace, SFMono-Regular, Menlo, "Liberation Mono", monospace;
```

## Layout Rules

- Use stable dimensions for boards, sidebars, toolbars, icon buttons, counters, tabs, and status chips.
- Build visual rhythm with repeated spacing, aligned baselines, consistent row heights, and predictable toolbar/sidebar geometry.
- At 1024px width, the primary task must still be usable without horizontal scrolling.
- Sidebars: 260-320px desktop, drawer on mobile, never a tiny collapsed-only experience when navigation is required.
- Sidebars should feel clean: clear grouping, limited decoration, stable icons, readable labels, and no noisy nested blocks.
- Topbars: keep 44-52px height; hide low-value pills before wrapping controls into multiple rows.
- Cards: use for repeated items, dialogs, and framed tools only. Do not put cards inside cards.
- Separators must be visible but quiet: prefer 1px low-contrast borders, spacing, subtle surface shifts, and aligned grid rhythm over harsh dividers, heavy shadows, or abrupt blocks.
- Borders should be soft and rounded where they frame controls, but never pill-shaped by default unless the component pattern expects it.
- Tables: provide sticky headers only when helpful; keep row height readable; expose search/filter/actions in a toolbar.
- Forms/settings: group by task, not by implementation object; keep save/reset state visible.

## Interaction Rules

- Use lucide or the existing icon library for tool buttons.
- Prefer Lucide for new icon-first web UI; use Tabler only when Lucide lacks coverage; use Heroicons only in Tailwind/Heroicons repos.
- Keep icons 16-20px for dense tools, 20-24px for primary actions, one stroke style per surface, and no decorative icon clutter.
- Icon-only controls need labels/tooltips or accessible names.
- Immediate feedback is mandatory for clicks, toggles, async commands, drag/drop, uploads, and selection changes.
- Use segmented controls for modes, toggles/checkboxes for binary settings, sliders/steppers/inputs for numbers, menus for option sets, tabs for peer views.
- Prefer lightweight high-performance modern display controls: disclosure, compact option groups, segmented controls, status chips, menus, click-to-reveal details, and event-triggered actions instead of long static panels.
- Keep critical state visible without extra clicks; use interaction to reduce clutter, not to hide required information.
- Every async action needs loading, success, error, retry, and disabled/concurrent state where applicable.
- Empty states must explain the next real action, not decorative filler.
- Error copy must state what failed and the next action.

## Motion Rules

- Motion must feel extremely smooth but stay lightweight: default to CSS transitions/Web Animations over animation libraries.
- Prefer animating `transform` and `opacity`; avoid animating layout/paint-heavy properties such as width, height, top, left, box-shadow, blur, and large filters on hot paths.
- Use short functional durations for tools: 80-120ms for hover/focus, 120-180ms for menus/drawers, 180-240ms for larger transitions.
- Use consistent easing tokens; avoid linear motion for UI transitions unless it is a progress indicator.
- Use `prefers-reduced-motion` to reduce or remove non-essential motion.
- Do not animate primary content into view in a way that delays reading, LCP, or repeated work.
- Stagger only when it clarifies direction; avoid decorative cascade animations in dense tools.
- Loading states should be lightweight: skeletons or subtle inline progress only when useful; avoid heavy spinners or blocking overlays for quick operations.

## Color Rules

- Primary accent is for selected, active, primary action, and focus. Do not use it for every border.
- Secondary accent is for links, info, or selection alternatives.
- Status colors are reserved for state.
- Verify contrast for text, icons, focus rings, borders that carry meaning, and code blocks.
- Avoid gradients unless a brand/marketing surface explicitly calls for them.
- Use a restrained palette: neutral surfaces, one primary accent, one secondary accent, and semantic status colors only when they carry state.
- At low resolution, background, color, and font choices must preserve reading speed before style.

## Implementation Steps

1. Search the repo for design tokens, CSS variables, component library, and screenshot/test tools.
2. Add or normalize tokens first.
3. Fix typography and spacing before decorative details.
4. Fix layout overflow and responsive states.
5. Replace ambiguous controls with familiar controls.
6. Replace verbose static display with lightweight interactive controls when it improves scanning and performance.
7. Add missing states only when the underlying behavior exists.
8. Add motion tokens and reduced-motion fallback when changing animation.
9. Reject purely decorative rewrites if they worsen scan speed, bundle size, interaction latency, or low-resolution readability.
10. Capture before/after or final screenshots at desktop and mobile/low-res.

## Verification Checklist

- Build/test/lint passes.
- Main page has no horizontal overflow at 1024x768 and 390px mobile.
- Text does not overlap buttons/cards/toolbars.
- Body text is at least 16px where users read paragraphs/messages.
- Small text is at least 13px unless it is purely decorative metadata.
- Normal text contrast is at least WCAG AA; target AAA for core reading surfaces when practical.
- Keyboard focus is visible.
- Motion uses transform/opacity where practical, has reduced-motion handling, and does not cause visible jank.
- Separators are quiet and aligned; no abrupt hard blocks unless required by state/severity.
- Console/network errors are checked for web UI.
