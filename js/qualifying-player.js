(function () {
  "use strict";

  const params = new URLSearchParams(window.location.search);
  const selectedId = String(params.get("id") || "").trim();
  const selectedName = String(params.get("player") || "").trim();
  const selectedYear = String(params.get("year") || "").trim();
  const selectedLeague = String(params.get("league") || "").trim();
  const nameArea = document.getElementById("qualifyingPlayerName");
  const contextArea = document.getElementById("qualifyingPlayerContext");
  const summaryArea = document.getElementById("qualifyingPlayerSummary");
  const teamsArea = document.getElementById("qualifyingPlayerTeams");
  const historyArea = document.getElementById("qualifyingPlayerHistory");
  const backLink = document.getElementById("qualifyingPlayerBackLink");

  const text = value => String(value ?? "").trim();
  const number = value => Number(text(value).replace(/,/g, "")) || 0;
  const escapeHtml = value => text(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const formatScore = value => `${value > 0 ? "+" : ""}${value.toFixed(1)}`;

  function renderEmpty(message) {
    summaryArea.innerHTML = `<div class="qualifying-empty qualifying-team-empty">${escapeHtml(message)}</div>`;
    teamsArea.innerHTML = "";
    historyArea.innerHTML = "";
  }

  function render(rows) {
    const totalScore = rows.reduce((sum, row) => sum + number(row["スコア"]), 0);
    const places = [1, 2, 3, 4].map(place => rows.filter(row => number(row["着順"]) === place).length);
    const averagePlace = rows.reduce((sum, row) => sum + number(row["着順"]), 0) / rows.length;
    summaryArea.innerHTML = [
      ["出場数", `${rows.length}試合`],
      ["予選ポイント", formatScore(totalScore)],
      ["平均順位", averagePlace.toFixed(2)],
      ["着順", places.join("-")]
    ].map(([label, value]) => `<div class="qualifying-team-stat"><span>${label}</span><strong>${value}</strong></div>`).join("");

    const teams = new Map();
    rows.forEach(row => {
      const team = text(row["チーム名"]) || "名称未登録";
      const item = teams.get(team) || { team, entries: 0, score: 0 };
      item.entries += 1;
      item.score += number(row["スコア"]);
      teams.set(team, item);
    });
    teamsArea.innerHTML = `<table class="qualifying-detail-table"><thead><tr><th>チーム</th><th>出場</th><th>ポイント</th></tr></thead><tbody>${[...teams.values()].sort((a, b) => b.score - a.score).map(item => `<tr><td>${escapeHtml(item.team)}</td><td>${item.entries}</td><td class="${item.score < 0 ? "qualifying-score-negative" : "qualifying-score-positive"}">${formatScore(item.score)}</td></tr>`).join("")}</tbody></table>`;

    const history = [...rows].sort((a, b) => `${text(b["日付"])} ${text(b["時間"])}`.localeCompare(`${text(a["日付"])} ${text(a["時間"])}`, "ja", { numeric: true }));
    historyArea.innerHTML = `<table class="qualifying-detail-table"><thead><tr><th>日付・試合</th><th>チーム</th><th>着順</th><th>ポイント</th><th>得点</th></tr></thead><tbody>${history.map(row => { const score = number(row["スコア"]); return `<tr><td>${escapeHtml(text(row["日付"]).replaceAll("-", "/"))}<br><small>${escapeHtml(row["試合"] || `試合No ${row["試合No"] || "-"}`)}</small></td><td>${escapeHtml(row["チーム名"])}</td><td>${escapeHtml(row["着順"] || "-")}</td><td class="${score < 0 ? "qualifying-score-negative" : "qualifying-score-positive"}">${formatScore(score)}</td><td>${number(row["得点"]).toLocaleString("ja-JP")}</td></tr>`; }).join("")}</tbody></table>`;
  }

  async function init() {
    contextArea.textContent = [selectedYear ? `${selectedYear}年度` : "", selectedLeague, "予選"].filter(Boolean).join("　");
    const backParams = new URLSearchParams();
    if (selectedYear) backParams.set("year", selectedYear);
    if (selectedLeague) backParams.set("league", selectedLeague);
    backLink.href = `qualifying.html${backParams.toString() ? `?${backParams.toString()}` : ""}`;
    if ((!selectedId && !selectedName) || !selectedYear) {
      nameArea.textContent = selectedName || "予選個人成績";
      renderEmpty("選手または年度が指定されていません。");
      return;
    }
    try {
      const allRows = await HLDB.loadData("qualifyingMatches", true);
      const rows = allRows.filter(row => (selectedId ? text(row["選手ID"]) === selectedId : text(row["選手名"]) === selectedName) && text(row["年度"]) === selectedYear && (!selectedLeague || text(row["リーグ"]) === selectedLeague));
      nameArea.textContent = text(rows[0]?.["選手名"]) || selectedName || selectedId;
      if (!rows.length) renderEmpty("該当する予選個人成績はまだありません。");
      else render(rows);
    } catch (error) {
      console.error("予選個人成績の読み込みに失敗しました", error);
      renderEmpty("予選個人成績を読み込めませんでした。時間をおいて再読み込みしてください。");
    }
    if (window.lucide) window.lucide.createIcons();
  }

  init();
})();
