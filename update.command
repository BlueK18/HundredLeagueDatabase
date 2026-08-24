#!/bin/bash

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

POINT_PROGRESS_URL="https://docs.google.com/spreadsheets/d/e/2PACX-1vS-ko9LDvGCpZNN-VBF8TC2VTSZLyu2vl4BE0BzOqZDSiT3DbTLHYvOL_LEpihVVVLtODHtGzJ5QADE/pub?gid=2026081012&single=true&output=csv"
SCHEDULE_URL="https://docs.google.com/spreadsheets/d/e/2PACX-1vR-ESV6MQe4qMfBjhaGVfzMxDOw_ACbqJjUQGbbeQWoItRN90nMv2BMHeRZgnO8_0WOgl24q_6iJeNq/pub?gid=0&single=true&output=csv"
SCORE_PLAYERS_URL="https://docs.google.com/spreadsheets/d/e/2PACX-1vR-ESV6MQe4qMfBjhaGVfzMxDOw_ACbqJjUQGbbeQWoItRN90nMv2BMHeRZgnO8_0WOgl24q_6iJeNq/pub?gid=1242200473&single=true&output=csv"

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
  echo ""
  echo "❌ プロジェクトフォルダを開けませんでした。"
  echo "$PROJECT_DIR"
  pause_on_error
}

echo "========================================"
echo "ハンドレッドリーグ 更新メニュー"
echo "========================================"
echo ""
echo "1：日々のデータ更新（普段はこちら）"
echo "2：予定表・選手登録更新"
echo "3：全データ更新（シーズン切替時）"
echo "4：Web変更のみ送信（CSV更新なし）"
echo ""
read -r -p "更新方法を選択してください [1/2/3/4]：" UPDATE_MODE
echo ""

case "$UPDATE_MODE" in
  1)
    MODE_NAME="日々のデータ更新"
    COMMIT_PREFIX="currentデータ・点数推移・Web更新"
    ;;
  2)
    MODE_NAME="予定表・選手登録更新"
    COMMIT_PREFIX="成績入力データ・Web更新"
    ;;
  3)
    MODE_NAME="全データ更新"
    COMMIT_PREFIX="全データ・点数推移・Web更新"
    ;;
  4)
    MODE_NAME="Web変更のみ送信"
    COMMIT_PREFIX="Web更新"
    ;;
  *)
    echo "❌ 1〜4のいずれかを入力してください。"
    pause_on_error
    ;;
esac

echo "実行内容：$MODE_NAME"
echo ""

download_csv() {
  local number="$1"
  local filename="$2"
  local url="$3"
  local output="$4"
  local allow_header_only="$5"
  local expected_header="$6"
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
    echo "❌ $filename は #N/A を含むため上書きしません。"
    return 1
  fi

  if [ -n "$expected_header" ]; then
    local first_line
    first_line="$(head -n 1 "$temp_file" | tr -d '\r')"
    if [ "$first_line" != "$expected_header" ]; then
      rm -f "$temp_file"
      echo "❌ $filename の見出しが想定と違うため上書きしません。"
      echo "   取得した見出し：$first_line"
      return 1
    fi
  fi

  local data_row_count
  data_row_count="$(awk '
    NR > 1 && $0 !~ /^[[:space:]]*$/ { count += 1 }
    END { print count + 0 }
  ' "$temp_file")"

  if [ "$data_row_count" -eq 0 ] && [ "$allow_header_only" != "1" ]; then
    rm -f "$temp_file"
    echo "❌ $filename は見出しだけのため上書きしません。"
    return 1
  fi

  if [ "$data_row_count" -eq 0 ]; then
    echo "ℹ️ $filename は現在データなし（見出しのみ）です。"
  fi

  mv "$temp_file" "$output"
  echo "✅ $filename 完了"
  echo ""
  return 0
}

FAILED_FILES=()

download_or_record() {
  local number="$1"
  local filename="$2"
  local url="$3"
  local output="$4"
  local allow_header_only="$5"
  local expected_header="$6"

  download_csv "$number" "$filename" "$url" "$output" "$allow_header_only" "$expected_header" || \
    FAILED_FILES+=("$filename")
}

download_or_keep_existing() {
  local number="$1"
  local filename="$2"
  local url="$3"
  local output="$4"
  local allow_header_only="$5"
  local expected_header="$6"

  if download_csv "$number" "$filename" "$url" "$output" "$allow_header_only" "$expected_header"; then
    return 0
  fi

  if [ -s "$output" ]; then
    echo "⚠️ $filename の取得に失敗したため、既存ファイルを保持して続行します。"
    echo ""
    return 0
  fi

  echo "❌ $filename は既存ファイルもないため続行できません。"
  FAILED_FILES+=("$filename")
}

download_current_files() {
  download_or_record "1/6" "teams-current.csv" \
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQOdocYk8ObQRgGJj3FCgHlECXxOJ1v0JC5etquS1xGs-j5XU__lfCW5jFOWtQXvLRKQglX_2kYPmHO/pub?gid=2026080101&single=true&output=csv" \
    "data/teams-current.csv" "1" ""

  download_or_keep_existing "2/6" "players-current.csv" \
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQOdocYk8ObQRgGJj3FCgHlECXxOJ1v0JC5etquS1xGs-j5XU__lfCW5jFOWtQXvLRKQglX_2kYPmHO/pub?gid=2026080102&single=true&output=csv" \
    "data/players-current.csv" "1" ""

  download_or_record "3/6" "matches-current.csv" \
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQOdocYk8ObQRgGJj3FCgHlECXxOJ1v0JC5etquS1xGs-j5XU__lfCW5jFOWtQXvLRKQglX_2kYPmHO/pub?gid=2026080103&single=true&output=csv" \
    "data/matches-current.csv" "1" ""

  download_or_record "4/6" "players_current.csv" \
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vS-ko9LDvGCpZNN-VBF8TC2VTSZLyu2vl4BE0BzOqZDSiT3DbTLHYvOL_LEpihVVVLtODHtGzJ5QADE/pub?gid=2026081008&single=true&output=csv" \
    "data/players_current.csv" "1" ""

  download_or_record "5/6" "roles_current.csv" \
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vS-ko9LDvGCpZNN-VBF8TC2VTSZLyu2vl4BE0BzOqZDSiT3DbTLHYvOL_LEpihVVVLtODHtGzJ5QADE/pub?gid=2026081009&single=true&output=csv" \
    "data/roles_current.csv" "1" ""

  download_or_record "6/6" "point-progress.csv" \
    "$POINT_PROGRESS_URL" "data/point-progress.csv" "0" \
    "対局キー,局順,対局日時,サーバーID,ゲームID,親席,選手1,選手2,選手3,選手4,開始点1,開始点2,開始点3,開始点4,終了点1,終了点2,終了点3,終了点4,増減1,増減2,増減3,増減4,元URL,年度,シーズン,リーグ,選手1ID,選手2ID,選手3ID,選手4ID,選手1公式名,選手2公式名,選手3公式名,選手4公式名,結果区分,和了方法,和了者,放銃者,和了点,和了者増減,翻,符,役,ドラ,赤ドラ,裏ドラ,副露者,副露回数,リーチ者"
}

download_full_files() {
  download_or_record "1/14" "teams.csv" \
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQOdocYk8ObQRgGJj3FCgHlECXxOJ1v0JC5etquS1xGs-j5XU__lfCW5jFOWtQXvLRKQglX_2kYPmHO/pub?gid=1681226504&single=true&output=csv" \
    "data/teams.csv" "0" ""
  download_or_record "2/14" "players.csv" \
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQOdocYk8ObQRgGJj3FCgHlECXxOJ1v0JC5etquS1xGs-j5XU__lfCW5jFOWtQXvLRKQglX_2kYPmHO/pub?gid=1337045347&single=true&output=csv" \
    "data/players.csv" "0" ""
  download_or_record "3/14" "matches.csv" \
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQOdocYk8ObQRgGJj3FCgHlECXxOJ1v0JC5etquS1xGs-j5XU__lfCW5jFOWtQXvLRKQglX_2kYPmHO/pub?gid=1561387699&single=true&output=csv" \
    "data/matches.csv" "0" ""
  download_or_record "4/14" "awards.csv" \
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQOdocYk8ObQRgGJj3FCgHlECXxOJ1v0JC5etquS1xGs-j5XU__lfCW5jFOWtQXvLRKQglX_2kYPmHO/pub?gid=869325336&single=true&output=csv" \
    "data/awards.csv" "0" ""
  download_or_record "5/14" "playerAlias.csv" \
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQOdocYk8ObQRgGJj3FCgHlECXxOJ1v0JC5etquS1xGs-j5XU__lfCW5jFOWtQXvLRKQglX_2kYPmHO/pub?gid=614293799&single=true&output=csv" \
    "data/playerAlias.csv" "0" ""
  download_or_record "6/14" "news.csv" \
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQOdocYk8ObQRgGJj3FCgHlECXxOJ1v0JC5etquS1xGs-j5XU__lfCW5jFOWtQXvLRKQglX_2kYPmHO/pub?gid=1687688944&single=true&output=csv" \
    "data/news.csv" "0" ""
  download_or_record "7/14" "teams-current.csv" \
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQOdocYk8ObQRgGJj3FCgHlECXxOJ1v0JC5etquS1xGs-j5XU__lfCW5jFOWtQXvLRKQglX_2kYPmHO/pub?gid=2026080101&single=true&output=csv" \
    "data/teams-current.csv" "1" ""
  download_or_keep_existing "8/14" "players-current.csv" \
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQOdocYk8ObQRgGJj3FCgHlECXxOJ1v0JC5etquS1xGs-j5XU__lfCW5jFOWtQXvLRKQglX_2kYPmHO/pub?gid=2026080102&single=true&output=csv" \
    "data/players-current.csv" "1" ""
  download_or_record "9/14" "matches-current.csv" \
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQOdocYk8ObQRgGJj3FCgHlECXxOJ1v0JC5etquS1xGs-j5XU__lfCW5jFOWtQXvLRKQglX_2kYPmHO/pub?gid=2026080103&single=true&output=csv" \
    "data/matches-current.csv" "1" ""
  download_or_record "10/14" "players_main.csv" \
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vS-ko9LDvGCpZNN-VBF8TC2VTSZLyu2vl4BE0BzOqZDSiT3DbTLHYvOL_LEpihVVVLtODHtGzJ5QADE/pub?gid=2026081004&single=true&output=csv" \
    "data/players_main.csv" "0" ""
  download_or_record "11/14" "roles_main.csv" \
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vS-ko9LDvGCpZNN-VBF8TC2VTSZLyu2vl4BE0BzOqZDSiT3DbTLHYvOL_LEpihVVVLtODHtGzJ5QADE/pub?gid=2026081005&single=true&output=csv" \
    "data/roles_main.csv" "0" ""
  download_or_record "12/14" "players_current.csv" \
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vS-ko9LDvGCpZNN-VBF8TC2VTSZLyu2vl4BE0BzOqZDSiT3DbTLHYvOL_LEpihVVVLtODHtGzJ5QADE/pub?gid=2026081008&single=true&output=csv" \
    "data/players_current.csv" "1" ""
  download_or_record "13/14" "roles_current.csv" \
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vS-ko9LDvGCpZNN-VBF8TC2VTSZLyu2vl4BE0BzOqZDSiT3DbTLHYvOL_LEpihVVVLtODHtGzJ5QADE/pub?gid=2026081009&single=true&output=csv" \
    "data/roles_current.csv" "1" ""
  download_or_record "14/14" "point-progress.csv" \
    "$POINT_PROGRESS_URL" "data/point-progress.csv" "0" \
    "対局キー,局順,対局日時,サーバーID,ゲームID,親席,選手1,選手2,選手3,選手4,開始点1,開始点2,開始点3,開始点4,終了点1,終了点2,終了点3,終了点4,増減1,増減2,増減3,増減4,元URL,年度,シーズン,リーグ,選手1ID,選手2ID,選手3ID,選手4ID,選手1公式名,選手2公式名,選手3公式名,選手4公式名,結果区分,和了方法,和了者,放銃者,和了点,和了者増減,翻,符,役,ドラ,赤ドラ,裏ドラ,副露者,副露回数,リーチ者"
}

download_score_entry_files() {
  download_or_record "1/2" "score-schedule.csv" \
    "$SCHEDULE_URL" "data/score-schedule.csv" "0" \
    "対局日,開催区分,リーグ,卓,チーム1,チーム2,チーム3,チーム4,URL対象,参照元"
  download_or_record "2/2" "score-players.csv" \
    "$SCORE_PLAYERS_URL" "data/score-players.csv" "0" \
    "リーグ,チーム,選手,参照元"
}

case "$UPDATE_MODE" in
  1) download_current_files ;;
  2) download_score_entry_files ;;
  3) download_full_files ;;
  4) echo "CSV更新を省略し、Web変更だけを送信します。" ;;
esac

if [ ${#FAILED_FILES[@]} -gt 0 ]; then
  echo ""
  echo "========================================"
  echo "❌ CSV更新に失敗しました"
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
echo "GitHubへ送信する準備中..."
if ! git add .; then
  echo "❌ git add に失敗しました。"
  pause_on_error
fi

if git diff --cached --quiet; then
  echo ""
  echo "新しい変更はありません。未送信のコミットがあれば続けて送信します。"
else
  COMMIT_MESSAGE="$COMMIT_PREFIX $(date '+%Y-%m-%d %H:%M')"
  echo "GitHubへコミット中..."
  if ! git commit -m "$COMMIT_MESSAGE"; then
    echo "❌ git commit に失敗しました。"
    pause_on_error
  fi
fi

echo ""
echo "GitHub側の更新を確認中..."
if ! git pull --rebase origin main; then
  git rebase --abort >/dev/null 2>&1 || true
  echo "❌ GitHub側の変更を自動で取り込めませんでした。"
  echo "   ローカルの変更は削除していません。画面を残して確認してください。"
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
echo "✅ GitHubへ送信しました。"
echo "GitHub Pagesへの反映は通常30秒〜数分です。"
echo ""
echo "========================================"
echo "✅ すべての処理が完了しました"
echo "========================================"

close_on_success
