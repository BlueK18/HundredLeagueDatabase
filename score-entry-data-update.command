#!/bin/bash

PROJECT_DIR="/Users/blue-k18/Documents/website/assets/css/HundredLeagueDatabase"
SCHEDULE_URL="https://docs.google.com/spreadsheets/d/e/2PACX-1vR-ESV6MQe4qMfBjhaGVfzMxDOw_ACbqJjUQGbbeQWoItRN90nMv2BMHeRZgnO8_0WOgl24q_6iJeNq/pub?gid=0&single=true&output=csv"
PLAYERS_URL="https://docs.google.com/spreadsheets/d/e/2PACX-1vR-ESV6MQe4qMfBjhaGVfzMxDOw_ACbqJjUQGbbeQWoItRN90nMv2BMHeRZgnO8_0WOgl24q_6iJeNq/pub?gid=1242200473&single=true&output=csv"

cd "$PROJECT_DIR" || exit 1

pause_and_exit() {
  echo ""
  read -n 1 -s -r -p "何かキーを押すと閉じます..."
  exit "$1"
}

download_csv() {
  local label="$1"
  local url="$2"
  local output="$3"
  local expected_header="$4"
  local temp_file="${output}.tmp"

  echo "$label を更新中..."
  if ! curl --http1.1 --fail --location --max-time 300 --silent --show-error \
    --retry 3 --retry-all-errors --retry-delay 2 --user-agent "Mozilla/5.0" \
    "$url" --output "$temp_file"; then
    rm -f "$temp_file"
    echo "❌ $label の取得に失敗しました。"
    return 1
  fi

  if [ ! -s "$temp_file" ] || grep -q '#N/A' "$temp_file"; then
    rm -f "$temp_file"
    echo "❌ $label のデータが空、または #N/A を含んでいます。"
    return 1
  fi

  local first_line
  first_line="$(head -n 1 "$temp_file" | tr -d '\r')"
  if [ "$first_line" != "$expected_header" ]; then
    rm -f "$temp_file"
    echo "❌ $label の見出しが想定と違うため、上書きしません。"
    echo "   取得した見出し：$first_line"
    return 1
  fi

  if [ "$(awk 'NR > 1 && $0 !~ /^[[:space:]]*$/ { count++ } END { print count + 0 }' "$temp_file")" -eq 0 ]; then
    rm -f "$temp_file"
    echo "❌ $label にデータ行がありません。"
    return 1
  fi

  mv "$temp_file" "$output"
  echo "✅ $label 完了"
  echo ""
}

echo "========================================"
echo "成績入力用 予定表・選手登録CSV更新"
echo "========================================"
echo ""
echo "通常の update.command とは別の低頻度更新です。"
echo ""

download_csv "1/2 Web用予定表" "$SCHEDULE_URL" "data/score-schedule.csv" \
  "対局日,開催区分,リーグ,卓,チーム1,チーム2,チーム3,チーム4,URL対象,参照元" || pause_and_exit 1

download_csv "2/2 Web用選手" "$PLAYERS_URL" "data/score-players.csv" \
  "リーグ,チーム,選手,参照元" || pause_and_exit 1

git add -- data/score-schedule.csv data/score-players.csv

if git diff --cached --quiet; then
  echo "変更はありませんでした。"
  pause_and_exit 0
fi

if ! git commit -m "成績入力用予定表・選手登録更新 $(date '+%Y-%m-%d %H:%M')"; then
  echo "❌ コミットに失敗しました。"
  pause_and_exit 1
fi

if ! git push origin main; then
  echo "❌ GitHubへの送信に失敗しました。"
  pause_and_exit 1
fi

echo "✅ 予定表・選手登録CSVをGitHubへ送信しました。"
echo "通常30秒〜数分で成績入力ページへ反映されます。"
pause_and_exit 0
