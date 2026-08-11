#!/bin/bash

PROJECT_DIR="/Users/blue-k18/Documents/HundredLeagueDatabase"
SCHEDULE_URL="https://docs.google.com/spreadsheets/d/e/2PACX-1vR-ESV6MQe4qMfBjhaGVfzMxDOw_ACbqJjUQGbbeQWoItRN90nMv2BMHeRZgnO8_0WOgl24q_6iJeNq/pub?gid=0&single=true&output=csv"
PLAYERS_URL="https://docs.google.com/spreadsheets/d/e/2PACX-1vR-ESV6MQe4qMfBjhaGVfzMxDOw_ACbqJjUQGbbeQWoItRN90nMv2BMHeRZgnO8_0WOgl24q_6iJeNq/pub?gid=1242200473&single=true&output=csv"

cd "$PROJECT_DIR" || exit 1

pause_and_exit() {
  echo ""
  read -n 1 -s -r -p "何かキーを押すと処理を終了します（エラー画面は残ります）..."
  exit "$1"
}

close_on_success() {
  echo ""
  read -n 1 -s -r -p "何かキーを押すと閉じます..."
  echo ""

  if [ "$TERM_PROGRAM" = "Apple_Terminal" ]; then
    local command_tty
    command_tty="$(tty)"
    nohup osascript - "$command_tty" <<'APPLESCRIPT' >/dev/null 2>&1 &
on run argv
  delay 0.8
  tell application "Terminal"
    repeat with terminalWindow in windows
      repeat with terminalTab in tabs of terminalWindow
        if tty of terminalTab is item 1 of argv then
          close terminalWindow
          return
        end if
      end repeat
    end repeat
  end tell
end run
APPLESCRIPT
    disown 2>/dev/null || true
  fi

  exit 0
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
echo "予定表・選手登録CSVと、変更済みのHTML・CSS・JSを更新します。"
echo ""

download_csv "1/2 Web用予定表" "$SCHEDULE_URL" "data/score-schedule.csv" \
  "対局日,開催区分,リーグ,卓,チーム1,チーム2,チーム3,チーム4,URL対象,参照元" || pause_and_exit 1

download_csv "2/2 Web用選手" "$PLAYERS_URL" "data/score-players.csv" \
  "リーグ,チーム,選手,参照元" || pause_and_exit 1

git add -- data/score-schedule.csv data/score-players.csv
git add -u -- '*.html' 'css/*.css' 'js/*.js'

if git diff --cached --quiet; then
  echo "変更はありませんでした。"
  close_on_success
fi

if ! git commit -m "成績入力データ・Web更新 $(date '+%Y-%m-%d %H:%M')"; then
  echo "❌ コミットに失敗しました。"
  pause_and_exit 1
fi

if ! git push origin main; then
  echo "❌ GitHubへの送信に失敗しました。"
  pause_and_exit 1
fi

echo "✅ 予定表・選手登録CSVをGitHubへ送信しました。"
echo "通常30秒〜数分で成績入力ページへ反映されます。"
close_on_success
