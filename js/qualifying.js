(function () {
  "use strict";

  const yearSelect = document.getElementById("qualifyingYear");
  const leagueSelect = document.getElementById("qualifyingLeague");
  const searchInput = document.getElementById("qualifyingSearch");
  const standingsArea = document.getElementById("qualifyingStandings");
  const playersArea = document.getElementById("qualifyingPlayers");
  const resultsArea = document.getElementById("qualifyingResults");
  const initialParams = new URLSearchParams(window.location.search);
  let qualifyingRows = [];

  const text = value => String(value ?? "").trim();
  const number = value => Number(text(value).replace(/,/g, "").replace(/[^0-9.+-]/g, "")) || 0;
  const escapeHtml = value => text(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const matchKey = row => ["年度", "リーグ", "ステージ", "試合No", "日付", "時間", "試合"].map(header => text(row[header])).join("|");
  const formatScore = value => `${value > 0 ? "+" : ""}${value.toFixed(1)}`;

  function displayDate(value) {
    const normalized = text(value).replaceAll("-", "/");
    const match = normalized.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    return match ? `${match[1]}/${match[2].padStart(2, "0")}/${match[3].padStart(2, "0")}` : normalized;
  }

  function teamUrl(team, year, league) {
    const params = new URLSearchParams({ team, year });
    if (league) params.set("league", league);
    return `qualifying-team.html?${params.toString()}`;
  }

  function playerUrl(row, year, league) {
    const playerParams = new URLSearchParams({ year });
    const playerId = text(row["選手ID"]);
    if (playerId) playerParams.set("id", playerId);
    else playerParams.set("player", text(row["選手名"]));
    if (league) playerParams.set("league", league);
    return `qualifying-player.html?${playerParams.toString()}`;
  }

  function populateFilters() {
    const years = [...new Set(qualifyingRows.map(row => text(row["年度"])).filter(Boolean))].sort((a, b) => Number(b) - Number(a));
    const leagues = [...new Set(qualifyingRows.map(row => text(row["リーグ"])).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ja"));
    yearSelect.innerHTML = (years.length ? years : ["2027"]).map(year => `<option value="${escapeHtml(year)}">${escapeHtml(year)}</option>`).join("");
    leagueSelect.innerHTML = `<option value="">すべて</option>${leagues.map(league => `<option value="${escapeHtml(league)}">${escapeHtml(league)}</option>`).join("")}`;
    if ([...yearSelect.options].some(option => option.value === initialParams.get("year"))) yearSelect.value = initialParams.get("year");
    if ([...leagueSelect.options].some(option => option.value === initialParams.get("league"))) leagueSelect.value = initialParams.get("league");
  }

  function renderStandings(rows, year, selectedLeague) {
    const teams = new Map();
    rows.forEach(row => {
      const team = text(row["チーム名"]);
      if (!team) return;
      const item = teams.get(team) || { team, league: text(row["リーグ"]), entries: 0, score: 0, places: [0, 0, 0, 0] };
      item.entries += 1;
      item.score += number(row["スコア"]);
      const place = number(row["着順"]);
      if (place >= 1 && place <= 4) item.places[place - 1] += 1;
      teams.set(team, item);
    });
    const standings = [...teams.values()].sort((a, b) => b.score - a.score || b.entries - a.entries || b.places[0] - a.places[0] || a.team.localeCompare(b.team, "ja"));
    if (!standings.length) {
      standingsArea.innerHTML = `<div class="qualifying-empty">${qualifyingRows.length ? "この条件の順位データはありません。" : "予選結果が登録されると順位が表示されます。"}</div>`;
      return;
    }
    standingsArea.innerHTML = `<table class="qualifying-standings-table"><thead><tr><th>順位</th><th>チーム</th><th>出場</th><th>ポイント</th><th>1着</th><th>2着</th><th>3着</th><th>4着</th></tr></thead><tbody>${standings.map((item, index) => {
      return `<tr><td class="qualifying-rank">${index + 1}</td><td><a class="qualifying-team-link" href="${escapeHtml(teamUrl(item.team, year, selectedLeague))}">${escapeHtml(item.team)}</a></td><td>${item.entries}</td><td class="${item.score < 0 ? "qualifying-score-negative" : "qualifying-score-positive"}">${formatScore(item.score)}</td>${item.places.map(count => `<td>${count}</td>`).join("")}</tr>`;
    }).join("")}</tbody></table>`;
  }

  function renderPlayers(rows, year, selectedLeague) {
    const players = new Map();
    rows.forEach(row => {
      const playerId = text(row["選手ID"]);
      const player = text(row["選手名"]);
      if (!playerId && !player) return;
      const key = playerId || `name:${player}`;
      const item = players.get(key) || { playerId, player, row, entries: 0, score: 0, places: [0, 0, 0, 0] };
      item.entries += 1;
      item.score += number(row["スコア"]);
      const place = number(row["着順"]);
      if (place >= 1 && place <= 4) item.places[place - 1] += 1;
      players.set(key, item);
    });
    const ranking = [...players.values()].sort((a, b) => b.score - a.score || b.entries - a.entries || b.places[0] - a.places[0] || a.player.localeCompare(b.player, "ja"));
    if (!ranking.length) {
      playersArea.innerHTML = `<div class="qualifying-empty">${qualifyingRows.length ? "この条件の個人成績はありません。" : "予選結果が登録されると個人成績が表示されます。"}</div>`;
      return;
    }
    playersArea.innerHTML = `<table class="qualifying-standings-table"><thead><tr><th>順位</th><th>選手</th><th>チーム</th><th>出場</th><th>ポイント</th><th>1着</th><th>2着</th><th>3着</th><th>4着</th></tr></thead><tbody>${ranking.map((item, index) => `<tr><td class="qualifying-rank">${index + 1}</td><td><a class="qualifying-team-link" href="${escapeHtml(playerUrl(item.row, year, selectedLeague))}">${escapeHtml(item.player)}</a></td><td>${escapeHtml(item.row["チーム名"])}</td><td>${item.entries}</td><td class="${item.score < 0 ? "qualifying-score-negative" : "qualifying-score-positive"}">${formatScore(item.score)}</td>${item.places.map(count => `<td>${count}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  }

  function render() {
    const year = yearSelect.value;
    const league = leagueSelect.value;
    const query = text(searchInput.value).normalize("NFKC").toLowerCase();
    const baseRows = qualifyingRows.filter(row => (!year || text(row["年度"]) === year) && (!league || text(row["リーグ"]) === league));
    const filtered = baseRows.filter(row => {
      const names = `${text(row["チーム名"])} ${text(row["選手名"])}`.normalize("NFKC").toLowerCase();
      return !query || names.includes(query);
    });
    renderStandings(baseRows, year, league);
    renderPlayers(baseRows, year, league);
    const groups = new Map();
    filtered.forEach(row => {
      const key = matchKey(row);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    });
    const matches = [...groups.values()].sort((a, b) => `${text(b[0]["日付"])} ${text(b[0]["時間"])} ${text(b[0]["試合No"])}`.localeCompare(`${text(a[0]["日付"])} ${text(a[0]["時間"])} ${text(a[0]["試合No"])}`, "ja", { numeric: true }));
    if (!matches.length) {
      resultsArea.innerHTML = `<div class="qualifying-empty">${qualifyingRows.length ? "条件に一致する予選結果はありません。" : "予選結果はまだ登録されていません。"}</div>`;
      return;
    }
    resultsArea.innerHTML = matches.map(rows => {
      const first = rows[0];
      const sortedRows = [...rows].sort((a, b) => number(a["着順"]) - number(b["着順"]));
      return `<article class="qualifying-match-card"><header class="qualifying-match-head"><strong>${escapeHtml(displayDate(first["日付"]))}　${escapeHtml(first["リーグ"] || "予選")}</strong><small>${escapeHtml(first["試合"] || `試合No ${first["試合No"] || "-"}`)}${first["時間"] ? `｜${escapeHtml(first["時間"])}` : ""}</small></header><table class="qualifying-match-table"><thead><tr><th>着順</th><th>チーム</th><th>選手</th><th>スコア</th><th>得点</th></tr></thead><tbody>${sortedRows.map(row => {
        const score = number(row["スコア"]);
        const scoreClass = score < 0 ? "qualifying-score-negative" : "qualifying-score-positive";
        return `<tr><td class="qualifying-rank">${escapeHtml(row["着順"] || "-")}</td><td><a class="qualifying-team-link" href="${escapeHtml(teamUrl(text(row["チーム名"]), year, text(row["リーグ"]))) }">${escapeHtml(row["チーム名"])}</a></td><td><a class="qualifying-team-link" href="${escapeHtml(playerUrl(row, year, text(row["リーグ"]))) }">${escapeHtml(row["選手名"])}</a></td><td class="${scoreClass}">${formatScore(score)}</td><td>${number(row["得点"]).toLocaleString("ja-JP")}</td></tr>`;
      }).join("")}</tbody></table></article>`;
    }).join("");
  }

  async function init() {
    try {
      qualifyingRows = await HLDB.loadData("qualifyingMatches", true);
      populateFilters();
      render();
    } catch (error) {
      console.error("予選結果CSVの読み込みに失敗しました", error);
      yearSelect.innerHTML = '<option value="2027">2027</option>';
      standingsArea.innerHTML = '<div class="qualifying-error">予選順位を読み込めませんでした。</div>';
      playersArea.innerHTML = '<div class="qualifying-error">予選個人成績を読み込めませんでした。</div>';
      resultsArea.innerHTML = '<div class="qualifying-error">予選結果を読み込めませんでした。時間をおいて再読み込みしてください。</div>';
    }
    if (window.lucide) window.lucide.createIcons();
  }

  yearSelect.addEventListener("change", render);
  leagueSelect.addEventListener("change", render);
  searchInput.addEventListener("input", render);
  init();
})();
