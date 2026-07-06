#!/usr/bin/env python3
"""Check WCAG contrast ratios for hex color pairs.

Usage:
  python contrast_check.py "#111111,#f7f7f2" "#555e66,#ffffff"
"""

from __future__ import annotations

import argparse
import re
import sys


HEX_RE = re.compile(r"^#?([0-9a-fA-F]{6})$")


def parse_hex(value: str) -> tuple[int, int, int]:
    match = HEX_RE.match(value.strip())
    if not match:
        raise ValueError(f"invalid hex color: {value!r}")
    text = match.group(1)
    return tuple(int(text[i : i + 2], 16) for i in (0, 2, 4))


def channel_to_linear(channel: int) -> float:
    value = channel / 255
    if value <= 0.04045:
        return value / 12.92
    return ((value + 0.055) / 1.055) ** 2.4


def luminance(rgb: tuple[int, int, int]) -> float:
    r, g, b = (channel_to_linear(channel) for channel in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast_ratio(foreground: str, background: str) -> float:
    l1 = luminance(parse_hex(foreground))
    l2 = luminance(parse_hex(background))
    lighter = max(l1, l2)
    darker = min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)


def grade(ratio: float) -> str:
    normal = "AAA" if ratio >= 7 else "AA" if ratio >= 4.5 else "fail"
    large = "AAA" if ratio >= 4.5 else "AA" if ratio >= 3 else "fail"
    return f"normal:{normal} large:{large}"


def parse_pair(pair: str) -> tuple[str, str]:
    parts = [part.strip() for part in pair.split(",")]
    if len(parts) != 2:
        raise ValueError(f"pair must be foreground,background: {pair!r}")
    parse_hex(parts[0])
    parse_hex(parts[1])
    return parts[0], parts[1]


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Check WCAG contrast for hex color pairs.")
    parser.add_argument("pairs", nargs="+", help='Color pair like "#111111,#ffffff"')
    args = parser.parse_args(argv)

    rows = []
    try:
        for raw_pair in args.pairs:
            fg, bg = parse_pair(raw_pair)
            ratio = contrast_ratio(fg, bg)
            rows.append((fg, bg, ratio, grade(ratio)))
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2

    print("| foreground | background | ratio | wcag |")
    print("|---|---|---:|---|")
    for fg, bg, ratio, rating in rows:
        print(f"| {fg} | {bg} | {ratio:.2f}:1 | {rating} |")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
