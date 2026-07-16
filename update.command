#!/bin/bash

set -e

PROJECT_DIR="/Users/blue-k18/Documents/website/assets/css/HundredLeagueDatabase"

cd "$PROJECT_DIR"

echo "========================================"
echo "ハンドレッドリーグ データ更新"
echo "========================================"
echo ""

echo "1/5 teams.csv を更新中..."
curl --fail --location --max-time 60 \
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQOdocYk8ObQRgGJj3FCgHlECXxOJ1v0JC5etquS1xGs-j5XU__lfCW5jFOWtQXvLRKQglX_2kYPmHO/pub?gid=1681226504&single=true&output=csv" \
  --output data/teams.csv

echo "2/5 players.csv を更新中..."
curl --fail --location --max-time 60 \
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQOdocYk8ObQRgGJj3FCgHlECXxOJ1v0JC5etquS1xGs-j5XU__lfCW5jFOWtQXvLRKQglX_2kYPmHO/pub?gid=1337045347&single=true&output=csv" \
  --output data/players.csv

echo "3/5 matches.csv を更新中..."
curl --fail --location --max-time 60 \
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQOdocYk8ObQRgGJj3FCgHlECXxOJ1v0JC5etquS1xGs-j5XU__lfCW5jFOWtQXvLRKQglX_2kYPmHO/pub?gid=1561387699&single=true&output=csv" \
  --output data/matches.csv

echo "4/5 awards.csv を更新中..."
curl --fail --location --max-time 60 \
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQOdocYk8ObQRgGJj3FCgHlECXxOJ1v0JC5etquS1xGs-j5XU__lfCW5jFOWtQXvLRKQglX_2kYPmHO/pub?gid=869325336&single=true&output=csv" \
  --output data/awards.csv

  echo "5/5 playerAlias.csv を更新中..."
curl --fail --location --max-time 60 \
"https://docs.google.com/spreadsheets/d/e/2PACX-1vQOdocYk8ObQRgGJj3FCgHlECXxOJ1v0JC5etquS1xGs-j5XU__lfCW5jFOWtQXvLRKQglX_2kYPmHO/pub?gid=614293799&single=true&output=csv" \
--output data/playerAlias.csv

echo ""
echo "CSV更新完了"
echo ""

git add .

if git diff --cached --quiet; then
  echo "変更はありませんでした。"
else
  COMMIT_MESSAGE="データ更新 $(date '+%Y-%m-%d %H:%M')"

  git commit -m "$COMMIT_MESSAGE"
  git push origin main

  echo ""
  echo "GitHubへ送信しました。"
  echo "Netlifyの公開サイトも自動更新されます。"
fi

echo ""
echo "処理が完了しました。"
echo "この画面は閉じて大丈夫です。"
echo ""

read -n 1 -s -r -p "何かキーを押すと閉じます..."
