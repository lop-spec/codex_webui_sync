#!/usr/bin/env python3
"""Audit the lop-design-polish skill bundle for lightweight completeness."""

from __future__ import annotations

import argparse
from pathlib import Path
import sys


REQUIRED_FILES = [
    "SKILL.md",
    "agents/openai.yaml",
    "references/source-selection.md",
    "references/ui-polish-playbook.md",
    "references/docs-reports-playbook.md",
    "references/quality-rubric.md",
    "assets/lop-workbench-theme.css",
    "assets/report-template.md",
    "scripts/contrast_check.py",
]

REQUIRED_SKILL_TEXT = [
    ("lop-design-polish", "skill name"),
    ("美观", "cn trigger: aesthetics"),
    ("布局", "cn trigger: layout"),
    ("排版", "cn trigger: typography"),
    ("效率", "cn trigger: efficiency"),
    ("性能", "cn trigger: performance"),
    ("轻量", "cn trigger: lightweight"),
    ("低噪声", "cn trigger: low noise"),
    ("图标优先但不猜谜", "cn trigger: icon-first not guessy"),
    ("柔和分割", "cn trigger: soft separation"),
    ("丝滑轻动画", "cn trigger: silky light motion"),
    ("性能即审美", "cn trigger: performance as aesthetics"),
    ("视觉节奏", "cn keyword: visual rhythm"),
    ("字体清晰", "cn keyword: clear typography"),
    ("克制配色", "cn keyword: restrained palette"),
    ("即时反馈", "cn keyword: instant feedback"),
    ("少卡片嵌套", "cn keyword: fewer nested cards"),
    ("清爽侧栏", "cn keyword: clean sidebar"),
    ("加载态轻巧", "cn keyword: lightweight loading"),
    ("扫描效率", "cn keyword: scan efficiency"),
    ("线条流畅自然", "cn keyword: flowing lines"),
    ("边框柔和圆润", "cn keyword: soft rounded borders"),
    ("extreme performance", "known taste: extreme performance"),
    ("minimalism", "known taste: minimalism"),
    ("icon-first", "known taste: icon-first"),
    ("smooth motion", "known taste: smooth motion"),
    ("non-abrupt", "known taste: non-abrupt separation"),
    ("explicit operations problems", "ops boundary"),
    ("quality-rubric.md", "quality rubric route"),
    ("contrast_check.py", "contrast script route"),
]

FORBIDDEN_TEXT = [
    "[TODO",
    "TODO:",
    "Complete and informative",
    "Replace with",
    "Structuring This Skill",
]


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def check(condition: bool, name: str, detail: str = "") -> tuple[str, bool, str]:
    return name, condition, detail


def audit(skill_dir: Path) -> list[tuple[str, bool, str]]:
    rows: list[tuple[str, bool, str]] = []
    skill_md = skill_dir / "SKILL.md"

    rows.append(check(skill_dir.is_dir(), "skill directory exists", str(skill_dir)))
    for rel in REQUIRED_FILES:
        path = skill_dir / rel
        rows.append(check(path.is_file(), f"required file: {rel}", f"{path.stat().st_size} bytes" if path.exists() else "missing"))

    if skill_md.is_file():
        skill_text = read_text(skill_md)
        line_count = len(skill_text.splitlines())
        rows.append(check(line_count <= 140, "SKILL.md stays concise", f"{line_count} lines"))
        rows.append(check(skill_text.startswith("---\nname: lop-design-polish"), "frontmatter starts correctly"))
        for text, label in REQUIRED_SKILL_TEXT:
            rows.append(check(text in skill_text, f"SKILL.md contains {label}"))
        for text in FORBIDDEN_TEXT:
            rows.append(check(text not in skill_text, f"no template residue: {text}"))

    openai_yaml = skill_dir / "agents" / "openai.yaml"
    if openai_yaml.is_file():
        text = read_text(openai_yaml)
        rows.append(check("$lop-design-polish" in text, "openai.yaml default prompt names skill"))

    source_selection = skill_dir / "references" / "source-selection.md"
    if source_selection.is_file():
        text = read_text(source_selection)
        for source in ["WCAG", "web.dev", "MDN", "Primer", "Pajamas", "Carbon", "Material", "Fluent", "Atlassian", "React Aria", "Open Props", "Lucide", "Radix", "Diataxis"]:
            rows.append(check(source in text, f"source selection includes {source}"))

    rubric = skill_dir / "references" / "quality-rubric.md"
    if rubric.is_file():
        text = read_text(rubric)
        for gate in ["Performance/lightness", "Rhythm", "Motion", "Separation", "Ops boundary", "Blockers"]:
            rows.append(check(gate in text, f"quality rubric includes {gate}"))

    return rows


def print_rows(rows: list[tuple[str, bool, str]]) -> None:
    print("| check | result | detail |")
    print("|---|---|---|")
    for name, ok, detail in rows:
        result = "pass" if ok else "fail"
        print(f"| {name} | {result} | {detail} |")


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Audit lop-design-polish skill bundle.")
    parser.add_argument("skill_dir", nargs="?", default=str(Path(__file__).resolve().parents[1]))
    args = parser.parse_args(argv)

    rows = audit(Path(args.skill_dir).resolve())
    print_rows(rows)
    return 0 if all(ok for _, ok, _ in rows) else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
