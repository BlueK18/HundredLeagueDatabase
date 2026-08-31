(function () {
  "use strict";

  const switchArea = document.getElementById("teamViewSwitch");
  if (!switchArea) return;

  const params = new URLSearchParams(window.location.search);
  const team = String(params.get("team") || "").trim();
  const currentView = switchArea.dataset.currentView;
  let switchLoaded = false;

  const text = value => String(value ?? "").trim();
  const escapeHtml = value => text(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");

  function isAdminInThisTab() {
    return sessionStorage.getItem("hldbAdminUnlocked") === "1" || sessionStorage.getItem("hldbDetailedStatsUnlocked") === "1" || sessionStorage.getItem("hldbScoreAdminMode") === "1";
  }

  function latestRow(rows) {
    return [...rows].sort((a, b) => Number(text(b["年度"])) - Number(text(a["年度"])) || text(a["リーグ"]).localeCompare(text(b["リーグ"]), "ja"))[0];
  }

  function mainTeamUrl(row) {
    const mainParams = new URLSearchParams({
      team,
      year: text(row["年度"]),
      league: text(row["リーグ"]),
      stage: text(row["ステージ"])
    });
    return `team.html?${mainParams.toString()}`;
  }

  function qualifyingTeamUrl(row) {
    const qualifyingParams = new URLSearchParams({
      team,
      year: text(row["年度"])
    });
    if (text(row["リーグ"])) qualifyingParams.set("league", text(row["リーグ"]));
    return `qualifying-team.html?${qualifyingParams.toString()}`;
  }

  async function showSwitch() {
    if (switchLoaded || !team) return;
    switchLoaded = true;
    try {
      const [qualifyingRows, mainRows] = await Promise.all([
        HLDB.loadData("qualifyingMatches"),
        HLDB.loadData("teams")
      ]);
      const teamQualifyingRows = qualifyingRows.filter(row => text(row["チーム名"]) === team);
      if (!teamQualifyingRows.length) return;

      const requestedQualifying = teamQualifyingRows.find(row => text(row["年度"]) === text(params.get("year")) && (!params.get("league") || text(row["リーグ"]) === text(params.get("league"))));
      const qualifyingRow = requestedQualifying || latestRow(teamQualifyingRows);
      const teamMainRows = mainRows.filter(row => text(row["チーム"]) === team);
      const requestedMain = teamMainRows.find(row => text(row["年度"]) === text(params.get("year")) && (!params.get("league") || HLDB.normalizeLeague(row["リーグ"]) === HLDB.normalizeLeague(params.get("league"))) && (!params.get("stage") || HLDB.normalizeStage(row["ステージ"]) === HLDB.normalizeStage(params.get("stage"))));
      const mainRow = requestedMain || latestRow(teamMainRows);

      const mainControl = currentView === "main"
        ? '<span class="is-active" aria-current="page">本戦</span>'
        : mainRow ? `<a href="${escapeHtml(mainTeamUrl(mainRow))}">本戦</a>` : "";
      const qualifyingControl = currentView === "qualifying"
        ? '<span class="is-active" aria-current="page">予選</span>'
        : `<a href="${escapeHtml(qualifyingTeamUrl(qualifyingRow))}">予選</a>`;

      if (!mainControl || !qualifyingControl) return;
      switchArea.innerHTML = `${mainControl}${qualifyingControl}`;
      switchArea.hidden = false;
    } catch (error) {
      console.error("チーム成績切り替えの読み込みに失敗しました", error);
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
