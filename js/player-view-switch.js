(function () {
  "use strict";

  const switchArea = document.getElementById("playerViewSwitch");
  if (!switchArea) return;

  const params = new URLSearchParams(window.location.search);
  const playerId = String(params.get("id") || "").trim();
  const playerName = String(params.get("player") || "").trim();
  const currentView = switchArea.dataset.currentView;
  let switchLoaded = false;

  const text = value => String(value ?? "").trim();
  const escapeHtml = value => text(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const matchesPlayer = row => playerId ? text(row["選手ID"]) === playerId : text(row["選手名"]) === playerName;
  const latestRow = rows => [...rows].sort((a, b) => Number(text(b["年度"])) - Number(text(a["年度"])))[0];

  function isAdminInThisTab() {
    return sessionStorage.getItem("hldbAdminUnlocked") === "1" || sessionStorage.getItem("hldbDetailedStatsUnlocked") === "1" || sessionStorage.getItem("hldbScoreAdminMode") === "1";
  }

  function mainPlayerUrl(row) {
    const mainParams = new URLSearchParams({ id: text(row["選手ID"]), year: text(row["年度"]), league: text(row["リーグ"]) });
    return `player.html?${mainParams.toString()}`;
  }

  function qualifyingPlayerUrl(row) {
    const qualifyingParams = new URLSearchParams({ year: text(row["年度"]) });
    if (text(row["選手ID"])) qualifyingParams.set("id", text(row["選手ID"]));
    else qualifyingParams.set("player", text(row["選手名"]));
    if (text(row["リーグ"])) qualifyingParams.set("league", text(row["リーグ"]));
    return `qualifying-player.html?${qualifyingParams.toString()}`;
  }

  async function showSwitch() {
    if (switchLoaded || (!playerId && !playerName)) return;
    switchLoaded = true;
    try {
      const [qualifyingRows, mainRows] = await Promise.all([HLDB.loadData("qualifyingMatches"), HLDB.loadData("players")]);
      const playerQualifyingRows = qualifyingRows.filter(matchesPlayer);
      if (!playerQualifyingRows.length) return;
      const requestedQualifying = playerQualifyingRows.find(row => text(row["年度"]) === text(params.get("year")) && (!params.get("league") || text(row["リーグ"]) === text(params.get("league"))));
      const qualifyingRow = requestedQualifying || latestRow(playerQualifyingRows);
      const playerMainRows = mainRows.filter(matchesPlayer);
      const requestedMain = playerMainRows.find(row => text(row["年度"]) === text(params.get("year")) && (!params.get("league") || HLDB.normalizeLeague(row["リーグ"]) === HLDB.normalizeLeague(params.get("league"))));
      const mainRow = requestedMain || latestRow(playerMainRows);

      const mainControl = currentView === "main" ? '<span class="is-active" aria-current="page">本戦</span>' : mainRow ? `<a href="${escapeHtml(mainPlayerUrl(mainRow))}">本戦</a>` : "";
      const qualifyingControl = currentView === "qualifying" ? '<span class="is-active" aria-current="page">予選</span>' : `<a href="${escapeHtml(qualifyingPlayerUrl(qualifyingRow))}">予選</a>`;
      if (!mainControl || !qualifyingControl) return;
      switchArea.innerHTML = `${mainControl}${qualifyingControl}`;
      switchArea.hidden = false;
    } catch (error) {
      console.error("個人成績切り替えの読み込みに失敗しました", error);
    }
  }

  if (isAdminInThisTab()) showSwitch();
  if ("BroadcastChannel" in window) {
    const adminChannel = new BroadcastChannel("hldbAdminNavigation");
    adminChannel.addEventListener("message", event => {
      if (event.data?.type === "admin-status" && event.data.unlocked) showSwitch();
    });
    adminChannel.postMessage({ type: "admin-status-request" });
  }
})();
