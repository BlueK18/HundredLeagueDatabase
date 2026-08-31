(function () {
  "use strict";

  const params = new URLSearchParams(window.location.search);
  const selectedTeam = String(params.get("team") || "").trim();
  const selectedYear = String(params.get("year") || "").trim();
  const selectedLeague = String(params.get("league") || "").trim();
  const nameArea = document.getElementById("qualifyingTeamName");
  const contextArea = document.getElementById("qualifyingTeamContext");
  const summaryArea = document.getElementById("qualifyingTeamSummary");
  const playersArea = document.getElementById("qualifyingTeamPlayers");
  const historyArea = document.getElementById("qualifyingTeamHistory");
  const backLink = document.getElementById("qualifyingBackLink");

  const text = value => String(value ?? "").trim();
  const number = value => Number(text(value).replace(/,/g, "")) || 0;
  const escapeHtml = value => text(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const formatScore = value => `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
  const displayDate = value => text(value).replaceAll("-", "/");

  function playerUrl(item) {
    const playerParams = new URLSearchParams({ year: selectedYear });
    if (item.playerId) playerParams.set("id", item.playerId);
    else playerParams.set("player", item.player);
    if (selectedLeague) playerParams.set("league", selectedLeague);
    return `qualifying-player.html?${playerParams.toString()}`;
  }

  function renderEmpty(message) {
    summaryArea.innerHTML = `<div class="qualifying-empty qualifying-team-empty">${escapeHtml(message)}</div>`;
    playersArea.innerHTML = "";
    historyArea.innerHTML = "";
  }

  function render(rows) {
    const totalScore = rows.reduce((sum, row) => sum + number(row["スコア"]), 0);
    const places = [1, 2, 3, 4].map(place => rows.filter(row => number(row["着順"]) === place).length);
    summaryArea.innerHTML = [
      ["出場数", `${rows.length}試合`],
      ["予選ポイント", formatScore(totalScore)],
      ["平均ポイント", formatScore(totalScore / rows.length)],
      ["着順", `${places[0]}-${places[1]}-${places[2]}-${places[3]}`]
    ].map(([label, value]) => `<div class="qualifying-team-stat"><span>${label}</span><strong>${value}</strong></div>`).join("");

    const players = new Map();
    rows.forEach(row => {
      const player = text(row["選手名"]) || "名称未登録";
      const item = players.get(player) || { player, playerId: text(row["選手ID"]), entries: 0, score: 0, raw: 0, places: [0, 0, 0, 0] };
      item.entries += 1;
      item.score += number(row["スコア"]);
      item.raw += number(row["得点"]);
      const place = number(row["着順"]);
      if (place >= 1 && place <= 4) item.places[place - 1] += 1;
      players.set(player, item);
    });
    const playerRows = [...players.values()].sort((a, b) => b.score - a.score || b.entries - a.entries || a.player.localeCompare(b.player, "ja"));
    playersArea.innerHTML = `<table class="qualifying-detail-table"><thead><tr><th>選手</th><th>出場</th><th>ポイント</th><th>素点合計</th><th>1-2-3-4着</th></tr></thead><tbody>${playerRows.map(item => `<tr><td><a class="qualifying-team-link" href="${escapeHtml(playerUrl(item))}">${escapeHtml(item.player)}</a></td><td>${item.entries}</td><td class="${item.score < 0 ? "qualifying-score-negative" : "qualifying-score-positive"}">${formatScore(item.score)}</td><td>${item.raw.toLocaleString("ja-JP")}</td><td>${item.places.join("-")}</td></tr>`).join("")}</tbody></table>`;

    const history = [...rows].sort((a, b) => `${text(b["日付"])} ${text(b["時間"])}`.localeCompare(`${text(a["日付"])} ${text(a["時間"])}`, "ja", { numeric: true }));
    historyArea.innerHTML = `<table class="qualifying-detail-table"><thead><tr><th>日付・試合</th><th>選手</th><th>着順</th><th>ポイント</th><th>得点</th></tr></thead><tbody>${history.map(row => { const score = number(row["スコア"]); return `<tr><td>${escapeHtml(displayDate(row["日付"]))}<br><small>${escapeHtml(row["試合"] || `試合No ${row["試合No"] || "-"}`)}</small></td><td>${escapeHtml(row["選手名"])}</td><td>${escapeHtml(row["着順"] || "-")}</td><td class="${score < 0 ? "qualifying-score-negative" : "qualifying-score-positive"}">${formatScore(score)}</td><td>${number(row["得点"]).toLocaleString("ja-JP")}</td></tr>`; }).join("")}</tbody></table>`;
  }

  async function init() {
    nameArea.textContent = selectedTeam || "予選チーム成績";
    contextArea.textContent = [selectedYear ? `${selectedYear}年度` : "", selectedLeague, "予選"].filter(Boolean).join("　");
    const backParams = new URLSearchParams();
    if (selectedYear) backParams.set("year", selectedYear);
    if (selectedLeague) backParams.set("league", selectedLeague);
    backLink.href = `qualifying.html${backParams.toString() ? `?${backParams.toString()}` : ""}`;
    if (!selectedTeam || !selectedYear) {
      renderEmpty("チームまたは年度が指定されていません。");
      return;
    }
    try {
      const allRows = await HLDB.loadData("qualifyingMatches", true);
      const rows = allRows.filter(row => text(row["チーム名"]) === selectedTeam && text(row["年度"]) === selectedYear && (!selectedLeague || text(row["リーグ"]) === selectedLeague));
      if (!rows.length) renderEmpty("該当する予選成績はまだありません。");
      else render(rows);
    } catch (error) {
      console.error("予選チーム成績の読み込みに失敗しました", error);
      renderEmpty("予選チーム成績を読み込めませんでした。時間をおいて再読み込みしてください。");
    }
    if (window.lucide) window.lucide.createIcons();
  }

  init();
})();
