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
download_csv \
  "1/6" \
  "teams.csv" \
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQOdocYk8ObQRgGJj3FCgHlECXxOJ1v0JC5etquS1xGs-j5XU__lfCW5jFOWtQXvLRKQglX_2kYPmHO/pub?gid=1681226504&single=true&output=csv" \
  "data/teams.csv" \
  || FAILED_FILES+=("teams.csv")
download_csv \
  "2/6" \
  "players.csv" \
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQOdocYk8ObQRgGJj3FCgHlECXxOJ1v0JC5etquS1xGs-j5XU__lfCW5jFOWtQXvLRKQglX_2kYPmHO/pub?gid=1337045347&single=true&output=csv" \
  "data/players.csv" \
  || FAILED_FILES+=("players.csv")
download_csv \
  "3/6" \
  "matches.csv" \
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQOdocYk8ObQRgGJj3FCgHlECXxOJ1v0JC5etquS1xGs-j5XU__lfCW5jFOWtQXvLRKQglX_2kYPmHO/pub?gid=1561387699&single=true&output=csv" \
  "data/matches.csv" \
  || FAILED_FILES+=("matches.csv")
download_csv \
  "4/6" \
  "awards.csv" \
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQOdocYk8ObQRgGJj3FCgHlECXxOJ1v0JC5etquS1xGs-j5XU__lfCW5jFOWtQXvLRKQglX_2kYPmHO/pub?gid=869325336&single=true&output=csv" \
  "data/awards.csv" \
  || FAILED_FILES+=("awards.csv")
download_csv \
  "5/6" \
  "playerAlias.csv" \
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQOdocYk8ObQRgGJj3FCgHlECXxOJ1v0JC5etquS1xGs-j5XU__lfCW5jFOWtQXvLRKQglX_2kYPmHO/pub?gid=614293799&single=true&output=csv" \
  "data/playerAlias.csv" \
  || FAILED_FILES+=("playerAlias.csv")
download_csv \
  "6/6" \
  "news.csv" \
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQOdocYk8ObQRgGJj3FCgHlECXxOJ1v0JC5etquS1xGs-j5XU__lfCW5jFOWtQXvLRKQglX_2kYPmHO/pub?gid=1687688944&single=true&output=csv" \
  "data/news.csv" \
  || FAILED_FILES+=("news.csv")
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
  COMMIT_MESSAGE="データ更新 $(date '+%Y-%m-%d %H:%M')"
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
