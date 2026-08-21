#!/bin/bash

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

pause_on_error() {
  echo ""
  read -n 1 -s -r -p "何かキーを押すと処理を終了します（エラー画面は残ります）..."
  exit 1
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

cd "$PROJECT_DIR" || {
  echo "❌ プロジェクトフォルダを開けませんでした。"
  pause_on_error
}

echo "========================================"
echo "詳細成績CSVのみ更新"
echo "========================================"
echo ""
echo "player-stats.html 用の次の4ファイルだけを更新します。"
echo "・players_main.csv"
echo "・roles_main.csv"
echo "・players_current.csv"
echo "・roles_current.csv"
echo ""
echo "試合・チーム・予定表など、ほかのCSVは更新しません。"
echo ""

FAILED_FILES=()
UPDATED_FILES=()

download_csv() {
  local number="$1"
  local filename="$2"
  local url="$3"
  local output="$4"
  local allow_header_only="$5"
  local temp_file="${output}.tmp"

  echo "$number $filename を更新中..."

  if ! curl \
    --http1.1 \
    --fail \
    --location \
    --max-time 300 \
    --silent \
    --show-error \
    --retry 3 \
    --retry-all-errors \
    --retry-delay 2 \
    --user-agent "Mozilla/5.0" \
    "$url" \
    --output "$temp_file"
  then
    rm -f "$temp_file"
    echo "❌ $filename の取得に失敗しました。"
    return 1
  fi

  if [ ! -s "$temp_file" ]; then
    rm -f "$temp_file"
    echo "❌ $filename の取得データが空です。"
    return 1
  fi

  if grep -q '#N/A' "$temp_file"; then
    rm -f "$temp_file"
    echo "❌ $filename に #N/A が含まれるため更新を中止します。"
    return 1
  fi

  local line_count
  line_count="$(awk 'END { print NR }' "$temp_file")"
  if [ "$allow_header_only" != "1" ] && [ "$line_count" -lt 2 ]; then
    rm -f "$temp_file"
    echo "❌ $filename にデータ行がありません。"
    return 1
  fi

  mv "$temp_file" "$output"
  UPDATED_FILES+=("$output")
  echo "✅ $filename 完了"
}

download_or_record() {
  if ! download_csv "$@"; then
    FAILED_FILES+=("$2")
  fi
}

download_or_record "1/4" "players_main.csv" \
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vS-ko9LDvGCpZNN-VBF8TC2VTSZLyu2vl4BE0BzOqZDSiT3DbTLHYvOL_LEpihVVVLtODHtGzJ5QADE/pub?gid=2026081004&single=true&output=csv" \
  "data/players_main.csv" "0"

download_or_record "2/4" "roles_main.csv" \
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vS-ko9LDvGCpZNN-VBF8TC2VTSZLyu2vl4BE0BzOqZDSiT3DbTLHYvOL_LEpihVVVLtODHtGzJ5QADE/pub?gid=2026081005&single=true&output=csv" \
  "data/roles_main.csv" "0"

download_or_record "3/4" "players_current.csv" \
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vS-ko9LDvGCpZNN-VBF8TC2VTSZLyu2vl4BE0BzOqZDSiT3DbTLHYvOL_LEpihVVVLtODHtGzJ5QADE/pub?gid=2026081008&single=true&output=csv" \
  "data/players_current.csv" "1"

download_or_record "4/4" "roles_current.csv" \
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vS-ko9LDvGCpZNN-VBF8TC2VTSZLyu2vl4BE0BzOqZDSiT3DbTLHYvOL_LEpihVVVLtODHtGzJ5QADE/pub?gid=2026081009&single=true&output=csv" \
  "data/roles_current.csv" "1"

if [ ${#FAILED_FILES[@]} -gt 0 ]; then
  echo ""
  echo "========================================"
  echo "❌ 詳細成績CSVの更新に失敗しました"
  echo "========================================"
  echo ""
  echo "失敗したファイル："
  for file in "${FAILED_FILES[@]}"; do
    echo "・$file"
  done
  echo ""
  echo "GitHubへの送信は行っていません。"
  pause_on_error
fi

echo ""
echo "詳細成績CSVをGitHubへ送信する準備中..."

if ! git add -- \
  data/players_main.csv \
  data/roles_main.csv \
  data/players_current.csv \
  data/roles_current.csv
then
  echo "❌ git add に失敗しました。"
  pause_on_error
fi

if git diff --cached --quiet -- \
  data/players_main.csv \
  data/roles_main.csv \
  data/players_current.csv \
  data/roles_current.csv
then
  echo ""
  echo "変更はありませんでした。"
  echo ""
  echo "========================================"
  echo "✅ 詳細成績CSVの確認が完了しました"
  echo "========================================"
  close_on_success
fi

COMMIT_MESSAGE="詳細成績CSV更新 $(date '+%Y-%m-%d %H:%M')"
echo "GitHubへコミット中..."
if ! git commit -m "$COMMIT_MESSAGE" -- \
  data/players_main.csv \
  data/roles_main.csv \
  data/players_current.csv \
  data/roles_current.csv
then
  echo "❌ git commit に失敗しました。"
  pause_on_error
fi

echo ""
echo "GitHubへ送信中..."
if ! git push origin main; then
  echo "❌ GitHubへの送信に失敗しました。"
  echo "   通信状態やGitHubへのログイン状態を確認してください。"
  pause_on_error
fi

echo ""
echo "✅ 詳細成績CSVをGitHubへ送信しました。"
echo "GitHub Pagesへの反映は通常30秒〜数分です。"
echo ""
echo "========================================"
echo "✅ すべての処理が完了しました"
echo "========================================"

close_on_success
