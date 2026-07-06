# Docs And Reports Playbook

Use this file for Markdown, HTML docs, generated reports, comparison reports, summaries, runbooks, and explicit ops-problem reports.

## Structure

Default report order:

1. Conclusion: 1-2 sentences.
2. Key evidence: table, numbers, or concrete artifacts.
3. Judgment rule: how to decide pass/fail or option A/B.
4. Changes or findings.
5. Validation.
6. Unverified items and risks.
7. Next smallest action.

For documentation, choose one Diataxis mode:

| Mode | Use When | Shape |
|---|---|---|
| Tutorial | Reader is learning | Guided path, successful end state |
| How-to | Reader has a task | Steps, prerequisites, expected result |
| Reference | Reader needs facts | Complete, structured, minimal interpretation |
| Explanation | Reader needs understanding | Concepts, tradeoffs, why |

Do not mix all four in one flat page unless the document is explicitly an index.

## Visual Rules

- Use headings as navigation, not decoration.
- Prefer short paragraphs and compact tables.
- Keep tables narrow; split wide evidence tables by topic.
- Use code fences with language tags and copy-ready commands.
- Put warnings/risks in short labeled blocks, not long prose.
- Use meaningful link text; avoid "click here".
- For HTML reports, constrain content width, use high-contrast code blocks, and keep print/PDF readability.

## Ops-Only Bias

Apply this subsection only when the content is an explicit operations problem: incident, runtime outage, deployment failure, service unavailability, alert, capacity, resource, network/proxy fault, or database runtime troubleshooting. A database topic alone is not enough. For other docs/reports, optimize primarily for beauty, layout, typography, scan efficiency, performance, and lightness.

- Put command/SQL/mongosh snippets in one consolidated block when possible.
- Convert raw JSON into tables for reading.
- Separate observed facts, inferred causes, and proposed actions.
- Always include time window, target system, query scope, and unverified gaps when relevant.
- Show rollback or "read-only" status for operational actions.

## Markdown Pattern

```markdown
# <Report Title>

**结论**
<1-2 sentences>

**关键证据**
| Item | Value | Meaning |
|---|---:|---|

**判断规则**
<short rule>

**验证**
| Check | Result | Evidence |
|---|---|---|

**未验证/风险**
- <item>

**下一步**
<one smallest action>
```

## HTML/CSS Pattern

- `body`: 16px, line-height 1.55, readable sans-serif.
- `main`: max-width 960-1120px for reports, 720-860px for long prose.
- `table`: 13-14px, sticky header only for long scroll pages, zebra rows only if it improves scanning.
- `pre`: dark or high-contrast light block, 14px mono, overflow auto.
- Print: avoid dark full-page backgrounds; preserve tables and code wrapping.

## Verification Checklist

- The answer is readable without opening an artifact when the user asked for a report.
- Headings are searchable and not generic duplicates.
- Tables render with header separators.
- Code blocks have languages and are copy-friendly.
- Links and local paths are correct.
- The final response follows lop's directory-first artifact rule when files are generated.
