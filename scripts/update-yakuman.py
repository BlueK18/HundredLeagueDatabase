#!/usr/bin/env python3
"""解析済み局データから個人賞用の役満履歴CSVを安全に更新する。"""

import csv
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
OUTPUT = DATA / "yakuman.csv"
HEADERS = ["年度", "日付", "リーグ", "ステージ", "試合No", "選手ID", "選手名", "チーム名", "役満名", "回数"]
YAKUMAN_NAMES = (
    "国士無双十三面待ち", "国士無双", "四暗刻単騎待ち", "四暗刻", "大四喜", "小四喜",
    "大三元", "字一色", "緑一色", "清老頭", "純正九蓮宝燈", "九蓮宝燈",
    "天和", "地和", "四槓子", "数え役満",
)


def read_rows(path):
    if not path.exists():
        return []
    with path.open(encoding="utf-8-sig", newline="") as stream:
        return list(csv.DictReader(stream))


def clean(value):
    return str(value or "").strip()


def date_text(value):
    return clean(value).split(" ", 1)[0].replace("-", "/")


def time_seconds(value):
    for pattern in ("%H:%M:%S", "%H:%M"):
        try:
            parsed = datetime.strptime(clean(value), pattern)
            return parsed.hour * 3600 + parsed.minute * 60 + parsed.second
        except ValueError:
            pass
    return 0


def build_match_lookup():
    found = {}
    for filename in ("matches.csv", "matches-current.csv"):
        for row in read_rows(DATA / filename):
            key = (clean(row.get("年度")), clean(row.get("リーグ")), clean(row.get("ステージ")),
                   date_text(row.get("日付")), clean(row.get("選手ID")))
            found.setdefault(key, []).append(row)
    return found


def winner_identity(row):
    winner = clean(row.get("和了者"))
    for number in range(1, 5):
        names = {clean(row.get(f"選手{number}")), clean(row.get(f"選手{number}公式名"))}
        if winner in names:
            return clean(row.get(f"選手{number}ID")), clean(row.get(f"選手{number}公式名")) or winner
    return "", winner


def detect_yakuman(row):
    roles = clean(row.get("役"))
    detected = [name for name in YAKUMAN_NAMES if name in roles]
    if detected:
        # 上位名称に含まれる短い名称（例：国士無双）を重ねて数えない。
        return [name for name in detected if not any(name != other and name in other for other in detected)]
    try:
        return ["数え役満"] if float(clean(row.get("翻")) or 0) >= 13 else []
    except ValueError:
        return []


def main():
    matches = build_match_lookup()
    generated = {}
    seen_hands = set()
    for row in read_rows(DATA / "point-progress.csv"):
        if "和了" not in clean(row.get("結果区分")):
            continue
        names = detect_yakuman(row)
        if not names:
            continue
        game_key, hand = clean(row.get("対局キー")), clean(row.get("局順"))
        player_id, player_name = winner_identity(row)
        if not player_name:
            continue
        year, league, stage = clean(row.get("年度")), clean(row.get("リーグ")), clean(row.get("シーズン"))
        played_at, played_date = clean(row.get("対局日時")), date_text(row.get("対局日時"))
        candidates = matches.get((year, league, stage, played_date, player_id), [])
        target_time = time_seconds(played_at.split(" ", 1)[1] if " " in played_at else "")
        match = min(candidates, key=lambda item: abs(time_seconds(item.get("時間")) - target_time)) if candidates else {}
        for name in names:
            unique_hand = (game_key, hand, player_id or player_name, name)
            if unique_hand in seen_hands:
                continue
            seen_hands.add(unique_hand)
            key = (year, played_date, league, stage, clean(match.get("試合No")), player_id,
                   player_name, clean(match.get("チーム名")), name)
            generated[key] = generated.get(key, 0) + 1

    # 過年度など解析CSVに残っていない記録は維持。同一記録は加算せず大きい方を採用する。
    combined = {}
    for row in read_rows(OUTPUT):
        key = tuple(clean(row.get(header)) for header in HEADERS[:-1])
        try:
            count = int(float(clean(row.get("回数")) or 1))
        except ValueError:
            count = 1
        combined[key] = max(combined.get(key, 0), count)
    for key, count in generated.items():
        combined[key] = max(combined.get(key, 0), count)

    ordered = sorted(combined.items(), key=lambda item: (item[0][1], item[0][5], item[0][8]))
    with OUTPUT.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.writer(stream, lineterminator="\n")
        writer.writerow(HEADERS)
        for key, count in ordered:
            writer.writerow([*key, count])
    print(f"役満記録 {len(ordered)}件（解析データから{len(generated)}件確認）")


if __name__ == "__main__":
    main()
