#!/usr/bin/env python3
"""CSV内の誤登録選手IDを正規IDへ統合する。"""

from __future__ import annotations

import csv
import io
from pathlib import Path


PROJECT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_DIR / "data"
ID_ALIASES = {"P0318": "P0002"}
NAME_TO_ID = {
    "悠紀子": "P0002",
    "。☆悠紀子☆。": "P0002",
}

DEDUPLICATION_RULES = {
    "players_main.csv": (
        ("選手ID", "集計区分", "年度", "シーズン"),
        ("解析済局数", "対局数"),
    ),
    "players_current.csv": (
        ("選手ID", "集計区分", "年度", "シーズン"),
        ("解析済局数", "対局数"),
    ),
    "roles_main.csv": (
        ("選手ID", "集計区分", "年度", "シーズン", "役名"),
        ("出現回数",),
    ),
    "roles_current.csv": (
        ("選手ID", "集計区分", "年度", "シーズン", "役名"),
        ("出現回数",),
    ),
    "playerAlias.csv": (
        ("検索名", "選手ID", "開始年度", "終了年度"),
        (),
    ),
}


def number(value: str) -> float:
    try:
        return float(str(value).replace(",", "").strip() or 0)
    except ValueError:
        return 0


def deduplicate(rows, key_fields, score_fields):
    output = []
    positions = {}
    for row in rows:
        key = tuple(row.get(field, "") for field in key_fields)
        if key not in positions:
            positions[key] = len(output)
            output.append(row)
            continue

        index = positions[key]
        previous = output[index]
        current_score = tuple(number(row.get(field, "")) for field in score_fields)
        previous_score = tuple(number(previous.get(field, "")) for field in score_fields)
        if current_score > previous_score:
            output[index] = row
    return output


def normalize_file(path: Path) -> bool:
    original = path.read_bytes()
    has_bom = original.startswith(b"\xef\xbb\xbf")
    newline = "\r\n" if b"\r\n" in original else "\n"
    text = original.decode("utf-8-sig")

    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        return False

    rows = list(reader)
    changed = False

    for row in rows:
        for field, value in row.items():
            if value in ID_ALIASES:
                row[field] = ID_ALIASES[value]
                changed = True

        if "選手ID" in row and "選手名" in row:
            player_name = row.get("選手名", "").strip()
            if not row.get("選手ID", "").strip() and player_name in NAME_TO_ID:
                row["選手ID"] = NAME_TO_ID[player_name]
                changed = True

    rule = DEDUPLICATION_RULES.get(path.name)
    if rule:
        deduplicated = deduplicate(rows, *rule)
        if len(deduplicated) != len(rows):
            rows = deduplicated
            changed = True

    if not changed:
        return False

    buffer = io.StringIO(newline="")
    writer = csv.DictWriter(
        buffer,
        fieldnames=reader.fieldnames,
        lineterminator=newline,
        extrasaction="ignore",
    )
    writer.writeheader()
    writer.writerows(rows)
    encoded = buffer.getvalue().encode("utf-8")
    if has_bom:
        encoded = b"\xef\xbb\xbf" + encoded
    path.write_bytes(encoded)
    return True


def main() -> None:
    changed_files = []
    for path in sorted(DATA_DIR.glob("*.csv")):
        if normalize_file(path):
            changed_files.append(path.name)

    if changed_files:
        print("補正: " + ", ".join(changed_files))
    else:
        print("補正対象なし")


if __name__ == "__main__":
    main()
