#!/bin/bash
PROJECT_DIR="/Users/blue-k18/Documents/website/assets/css/HundredLeagueDatabase"
cd "$PROJECT_DIR" || {
  echo ""
  echo "❌ プロジェクトフォルダを開けませんでした。"
  echo "$PROJECT_DIR"
  echo ""
  read -n 1 -s -r -p "何かキーを押すと閉じます..."
  exit 1
}
echo "========================================"
echo "ハンドレッドリーグ データ更新"
echo "========================================"
echo ""
echo "1：全CSVを更新（シーズン切替時）"
echo "2：current CSVのみ更新（普段はこちら）"
echo ""
read -r -p "更新方法を選択してください [1/2]：" UPDATE_MODE
echo ""

if [ "$UPDATE_MODE" != "1" ] && [ "$UPDATE_MODE" != "2" ]; then
  echo "❌ 1または2を入力してください。"
  echo ""
  read -n 1 -s -r -p "何かキーを押すと閉じます..."
  exit 1
fi

download_csv() {
  local number="$1"
  local filename="$2"
  local url="$3"
  local output="$4"
  local temp_file="${output}.tmp"
  echo "$number $filename を更新中..."
  if curl \
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
    if [ ! -s "$temp_file" ]; then
      echo "❌ $filename の取得に失敗しました。"
      echo "   ダウンロードしたファイルが空です。"
      rm -f "$temp_file"
      return 1
    fi
    mv "$temp_file" "$output"
    echo "✅ $filename 完了"
    echo ""
    return 0
  else
    echo ""
    echo "❌ $filename の更新に失敗しました。"
    echo "   Googleスプレッドシートの公開設定や通信状態を確認してください。"
    echo ""
    rm -f "$temp_file"
    return 1
  fi
}
FAILED_FILES=()

if [ "$UPDATE_MODE" = "1" ]; then
  download_csv "1/13" "teams.csv" \
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQOdocYk8ObQRgGJj3FCgHlECXxOJ1v0JC5etquS1xGs-j5XU__lfCW5jFOWtQXvLRKQglX_2kYPmHO/pub?gid=1681226504&single=true&output=csv" \
    "data/teams.csv" || FAILED_FILES+=("teams.csv")

  download_csv "2/13" "players.csv" \
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQOdocYk8ObQRgGJj3FCgHlECXxOJ1v0JC5etquS1xGs-j5XU__lfCW5jFOWtQXvLRKQglX_2kYPmHO/pub?gid=1337045347&single=true&output=csv" \
    "data/players.csv" || FAILED_FILES+=("players.csv")

  download_csv "3/13" "matches.csv" \
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQOdocYk8ObQRgGJj3FCgHlECXxOJ1v0JC5etquS1xGs-j5XU__lfCW5jFOWtQXvLRKQglX_2kYPmHO/pub?gid=1561387699&single=true&output=csv" \
    "data/matches.csv" || FAILED_FILES+=("matches.csv")

  download_csv "4/13" "awards.csv" \
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQOdocYk8ObQRgGJj3FCgHlECXxOJ1v0JC5etquS1xGs-j5XU__lfCW5jFOWtQXvLRKQglX_2kYPmHO/pub?gid=869325336&single=true&output=csv" \
    "data/awards.csv" || FAILED_FILES+=("awards.csv")

  download_csv "5/13" "playerAlias.csv" \
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQOdocYk8ObQRgGJj3FCgHlECXxOJ1v0JC5etquS1xGs-j5XU__lfCW5jFOWtQXvLRKQglX_2kYPmHO/pub?gid=614293799&single=true&output=csv" \
    "data/playerAlias.csv" || FAILED_FILES+=("playerAlias.csv")

  download_csv "6/13" "news.csv" \
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQOdocYk8ObQRgGJj3FCgHlECXxOJ1v0JC5etquS1xGs-j5XU__lfCW5jFOWtQXvLRKQglX_2kYPmHO/pub?gid=1687688944&single=true&output=csv" \
    "data/news.csv" || FAILED_FILES+=("news.csv")

  download_csv "7/13" "teams-current.csv" \
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQOdocYk8ObQRgGJj3FCgHlECXxOJ1v0JC5etquS1xGs-j5XU__lfCW5jFOWtQXvLRKQglX_2kYPmHO/pub?gid=2026080101&single=true&output=csv" \
    "data/teams-current.csv" || FAILED_FILES+=("teams-current.csv")

  download_csv "8/13" "players-current.csv" \
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQOdocYk8ObQRgGJj3FCgHlECXxOJ1v0JC5etquS1xGs-j5XU__lfCW5jFOWtQXvLRKQglX_2kYPmHO/pub?gid=2026080102&single=true&output=csv" \
    "data/players-current.csv" || FAILED_FILES+=("players-current.csv")

  download_csv "9/13" "matches-current.csv" \
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQOdocYk8ObQRgGJj3FCgHlECXxOJ1v0JC5etquS1xGs-j5XU__lfCW5jFOWtQXvLRKQglX_2kYPmHO/pub?gid=2026080103&single=true&output=csv" \
    "data/matches-current.csv" || FAILED_FILES+=("matches-current.csv")

  download_csv "10/13" "players_main.csv" \
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vS-ko9LDvGCpZNN-VBF8TC2VTSZLyu2vl4BE0BzOqZDSiT3DbTLHYvOL_LEpihVVVLtODHtGzJ5QADE/pub?gid=2026081004&single=true&output=csv" \
    "data/players_main.csv" || FAILED_FILES+=("players_main.csv")

  download_csv "11/13" "roles_main.csv" \
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vS-ko9LDvGCpZNN-VBF8TC2VTSZLyu2vl4BE0BzOqZDSiT3DbTLHYvOL_LEpihVVVLtODHtGzJ5QADE/pub?gid=2026081005&single=true&output=csv" \
    "data/roles_main.csv" || FAILED_FILES+=("roles_main.csv")

  download_csv "12/13" "players_current.csv" \
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vS-ko9LDvGCpZNN-VBF8TC2VTSZLyu2vl4BE0BzOqZDSiT3DbTLHYvOL_LEpihVVVLtODHtGzJ5QADE/pub?gid=2026081008&single=true&output=csv" \
    "data/players_current.csv" || FAILED_FILES+=("players_current.csv")

  download_csv "13/13" "roles_current.csv" \
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vS-ko9LDvGCpZNN-VBF8TC2VTSZLyu2vl4BE0BzOqZDSiT3DbTLHYvOL_LEpihVVVLtODHtGzJ5QADE/pub?gid=2026081009&single=true&output=csv" \
    "data/roles_current.csv" || FAILED_FILES+=("roles_current.csv")
else
  download_csv "1/5" "teams-current.csv" \
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQOdocYk8ObQRgGJj3FCgHlECXxOJ1v0JC5etquS1xGs-j5XU__lfCW5jFOWtQXvLRKQglX_2kYPmHO/pub?gid=2026080101&single=true&output=csv" \
    "data/teams-current.csv" || FAILED_FILES+=("teams-current.csv")

  download_csv "2/5" "players-current.csv" \
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQOdocYk8ObQRgGJj3FCgHlECXxOJ1v0JC5etquS1xGs-j5XU__lfCW5jFOWtQXvLRKQglX_2kYPmHO/pub?gid=2026080102&single=true&output=csv" \
    "data/players-current.csv" || FAILED_FILES+=("players-current.csv")

  download_csv "3/5" "matches-current.csv" \
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQOdocYk8ObQRgGJj3FCgHlECXxOJ1v0JC5etquS1xGs-j5XU__lfCW5jFOWtQXvLRKQglX_2kYPmHO/pub?gid=2026080103&single=true&output=csv" \
    "data/matches-current.csv" || FAILED_FILES+=("matches-current.csv")

  download_csv "4/5" "players_current.csv" \
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vS-ko9LDvGCpZNN-VBF8TC2VTSZLyu2vl4BE0BzOqZDSiT3DbTLHYvOL_LEpihVVVLtODHtGzJ5QADE/pub?gid=2026081008&single=true&output=csv" \
    "data/players_current.csv" || FAILED_FILES+=("players_current.csv")

  download_csv "5/5" "roles_current.csv" \
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vS-ko9LDvGCpZNN-VBF8TC2VTSZLyu2vl4BE0BzOqZDSiT3DbTLHYvOL_LEpihVVVLtODHtGzJ5QADE/pub?gid=2026081009&single=true&output=csv" \
    "data/roles_current.csv" || FAILED_FILES+=("roles_current.csv")
fi
if [ ${#FAILED_FILES[@]} -gt 0 ]; then
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
  echo "失敗箇所を確認して、もう一度実行してください。"
  echo ""
  read -n 1 -s -r -p "何かキーを押すと閉じます..."
  exit 1
fi
echo "========================================"
echo "✅ すべてのCSV更新が完了しました"
echo "========================================"
echo ""
echo "GitHubへ送信する準備中..."
if ! git add .; then
  echo ""
  echo "❌ git add に失敗しました。"
  echo ""
  read -n 1 -s -r -p "何かキーを押すと閉じます..."
  exit 1
fi
if git diff --cached --quiet; then
  echo ""
  echo "変更はありませんでした。"
else
  if [ "$UPDATE_MODE" = "1" ]; then
    COMMIT_MESSAGE="全データ更新 $(date '+%Y-%m-%d %H:%M')"
  else
    COMMIT_MESSAGE="currentデータ更新 $(date '+%Y-%m-%d %H:%M')"
  fi
  echo "GitHubへコミット中..."
  if ! git commit -m "$COMMIT_MESSAGE"; then
    echo ""
    echo "❌ git commit に失敗しました。"
    echo ""
    read -n 1 -s -r -p "何かキーを押すと閉じます..."
    exit 1
  fi
  echo ""
  echo "GitHubへ送信中..."
  if ! git push origin main; then
    echo ""
    echo "❌ GitHubへの送信に失敗しました。"
    echo "   通信状態やGitHubへのログイン状態を確認してください。"
    echo ""
    read -n 1 -s -r -p "何かキーを押すと閉じます..."
    exit 1
  fi
  echo ""
  echo "✅ GitHubへ送信しました。"
  echo "GitHub Pagesへ反映中です。"
  echo "通常30秒〜数分で更新されます。"
fi
echo ""
echo "========================================"
echo "✅ すべての処理が完了しました"
echo "========================================"
echo ""
echo "この画面は閉じて大丈夫です。"
echo ""

read -n 1 -s -r -p "何かキーを押すと閉じます..."
