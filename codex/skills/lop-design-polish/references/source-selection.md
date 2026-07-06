# Source Selection

Use this file when choosing a design direction or explaining why a reference was selected. Prefer official docs and active open-source design systems over inspiration galleries.

## Primary Sources

| Source | Use For | Notes |
|---|---|---|
| W3C WCAG 2.2 | Hard accessibility gates | Contrast, reflow, focus, text spacing, keyboard, non-text contrast |
| W3C Low Vision Needs | Low-resolution and low-vision readability | Font size, spacing, contrast, customization, reduced visual clutter |
| web.dev Animation Performance | Smooth lightweight animation | Animate transform/opacity first; avoid layout/paint-triggering animation in performance-critical paths |
| MDN Motion Accessibility/Performance | Motion accessibility and browser behavior | Use `prefers-reduced-motion`; understand CSS/JS animation performance and transitions |
| GitHub Primer | Code/workflow product UI | Best default for developer tools, repo UIs, navigation, forms, markdown-adjacent surfaces |
| GitLab Pajamas | Developer-tool product UI | Strong match for project trees, CI/dev workflow density, issues, diffs, and open-source software UI |
| IBM Carbon | Enterprise product UI and docs | Dense tables, left navigation, product/docs layouts, data-heavy work |
| Carbon Motion | Productive, coordinated motion | Best fit for quick functional microinteractions and non-jarring motion choreography |
| Atlassian Design System | Product-workflow layout and hierarchy | Use for modern page shells, panels, teamwork/productivity layout, and information hierarchy |
| Material 3 Motion | Easing/duration reference | Borrow timing/easing concepts, not Material's full visual language unless mobile/Android |
| Fluent 2 Motion | Smooth physical-feeling motion | Borrow predictable, consistent, fluid motion for Windows-like surfaces |
| Radix UI / Radix Colors | Accessible primitives and color scales | Use when building custom React UI without a heavy visual framework |
| shadcn/ui | Copy-owned component patterns | Good for Tailwind/React apps where components should live in the repo |
| React Aria | Accessible unstyled interactions | Prefer for custom lightweight controls where behavior/accessibility matter more than visual framework |
| Open Props | Lightweight token ideas | Borrow token scale ideas; do not import wholesale unless the repo already wants it |
| Lucide | Default icon family | Clean, consistent, tree-shakable, lightweight icon-first UI; prefer existing repo icon library if present |
| Tabler Icons | Large icon coverage | Optional when Lucide lacks an icon; keep stroke style consistent |
| Heroicons | Tailwind-style icons | Optional when the repo already uses Tailwind/Heroicons |
| Ant Design | Enterprise forms, admin tables, CRUD dashboards | Use only when heavier component defaults are acceptable |
| Shopify Polaris | Commerce/admin content patterns | Optional for commerce/admin writing and forms; not default for lop because it is less lightweight and less developer-tool oriented |
| Fluent 2 | Windows/M365-like apps | Use when the app should feel native to Microsoft surfaces |
| Material 3 | Android/mobile apps | Use for mobile-first layouts, dynamic color, touch-oriented UI |
| GOV.UK Design System | Forms and public-service clarity | Excellent for plain language, accessibility, and task completion |
| Diataxis | Documentation architecture | Split tutorials, how-to guides, reference, and explanation |
| Google Developer Docs Style | Developer docs clarity and accessibility | Active voice, global audience, accessible docs |
| Microsoft Writing Style Guide | Technical wording and UI copy | Short, clear, action-oriented technical communication |

## Agent/Skill Design Sources

Use these only to shape local skill/rule design, not visual styling:

- OpenAI Codex skills: progressive disclosure, trigger descriptions, required `SKILL.md`.
- AGENTS.md standard: predictable instruction files for coding agents.
- Anthropic Claude Code memory and skills: keep persistent instructions concise; turn repeated procedures into skills.
- GitHub Spec Kit: clarify what to build before implementation.
- Awesome Copilot and Cursor Rules: project-specific instructions should be concrete, scoped, and testable.

## Selection Rules

1. Pick one primary visual system and one supporting source. More than two usually creates visual noise.
2. For lop's current aesthetic, default to Primer + GitLab Pajamas + Carbon + Radix/shadcn + React Aria + Lucide.
3. Borrow Atlassian for page shells and information hierarchy, not for brand-heavy decoration.
4. Borrow Carbon/Material/Fluent motion only for motion rules; implement with native CSS/Web Animations first.
5. Borrow Open Props for token-scale thinking, not as a required dependency.
6. For icon-first UI, prefer Lucide; use Tabler for breadth and Heroicons only when the Tailwind ecosystem is already present.
7. For low-resolution readability, WCAG and W3C low-vision guidance override decorative choices.
8. For reports, Diataxis and Microsoft/Google writing rules override visual ornament.
9. Do not install a large UI library just for polish unless it already exists or the user asks for a redesign.
10. If the user gives a screenshot or named product, inspect that concrete target before applying this default.

## Fit Ranking For Lop

| Tier | Sources | Decision |
|---|---|---|
| Default | Primer, GitLab Pajamas, Carbon, Radix/shadcn, React Aria, Lucide, WCAG, web.dev/MDN animation performance | Best fit for extreme performance, lightness, flat/icon-first developer-product UI |
| Borrow | Atlassian, Carbon Motion, Material Motion, Fluent Motion, Open Props, Tabler Icons, Diataxis, Google/Microsoft style | Use selected rules only; do not copy full personality |
| Conditional | Ant Design, Fluent 2, Material 3, GOV.UK, Heroicons, Polaris | Use only when the project type or existing stack matches |
| Avoid by default | Heavy visual frameworks, marketing template systems, decoration-first galleries | Usually conflict with lop's lightweight/minimal/performance-first taste |

## Reference Links

- W3C WCAG 2.2: https://www.w3.org/TR/WCAG22/
- W3C WCAG quick reference: https://www.w3.org/WAI/WCAG22/quickref/
- W3C Low Vision Needs: https://www.w3.org/TR/low-vision-needs/
- web.dev high-performance animations: https://web.dev/articles/animations-guide
- MDN prefers-reduced-motion: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion
- MDN CSS and JavaScript animation performance: https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/CSS_JavaScript_animation_performance
- Primer: https://primer.style/
- Primer documentation guidance: https://primer.style/product/contribute/documentation/
- GitLab Pajamas: https://design.gitlab.com/
- GitLab Pajamas source: https://gitlab.com/gitlab-org/gitlab-services/design.gitlab.com
- Carbon: https://carbondesignsystem.com/
- Carbon 2x grid: https://carbondesignsystem.com/elements/2x-grid/usage/
- Carbon motion: https://carbondesignsystem.com/elements/motion/overview/
- Carbon motion choreography: https://carbondesignsystem.com/elements/motion/choreography/
- Atlassian Design System: https://atlassian.design/
- Material 3 motion duration/easing: https://m3.material.io/styles/motion/easing-and-duration
- Fluent 2 motion: https://fluent2.microsoft.design/motion
- Radix UI: https://www.radix-ui.com/
- Radix Colors: https://www.radix-ui.com/colors
- shadcn/ui: https://ui.shadcn.com/docs
- React Aria: https://react-aria.adobe.com/
- React Aria quality: https://react-aria.adobe.com/quality
- Open Props: https://open-props.style/
- Lucide: https://lucide.dev/
- Tabler Icons: https://tabler.io/icons
- Heroicons: https://heroicons.com/
- Ant Design: https://ant.design/docs/react/introduce/
- Shopify Polaris: https://polaris-react.shopify.com/
- Fluent 2: https://fluent2.microsoft.design/
- Material 3: https://m3.material.io/
- GOV.UK Design System: https://design-system.service.gov.uk/
- Diataxis: https://diataxis.fr/
- Google developer documentation style guide: https://developers.google.com/style
- Microsoft Writing Style Guide: https://learn.microsoft.com/en-us/style-guide/welcome/
- OpenAI Codex skills: https://developers.openai.com/codex/skills
- AGENTS.md: https://agents.md/
- Claude Code skills: https://docs.anthropic.com/en/docs/claude-code/skills
- GitHub Spec Kit: https://github.github.com/spec-kit/
- Awesome Copilot: https://github.com/github/awesome-copilot
- Cursor Rules: https://cursor.com/docs/rules
