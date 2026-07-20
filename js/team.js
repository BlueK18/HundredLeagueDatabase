const TEAMS_CSV_URL =
  "data/teams.csv";

const MATCHES_CSV_URL =
  "data/matches.csv";

const PLAYERS_CSV_URL =
  "data/players.csv";

const params = new URLSearchParams(window.location.search);

const teamName = params.get("team") || "";
const year = params.get("year") || "";
const league = params.get("league") || "";
const stage = params.get("stage") || "";

const teamTitle = document.getElementById("teamTitle");
const teamInfo = document.getElementById("teamInfo");
const teamPlayers = document.getElementById("teamPlayers");
const teamMatches = document.getElementById("teamMatches");

teamTitle.textContent = teamName || "チーム詳細";

/* =========================
   データ読み込み
========================= */

async function loadTeamDetail() {
  try {
    const [
  teamsData,
  matchesData,
  playersData
] = await Promise.all([
  HLDB.loadData("teams"),
  HLDB.loadData("matches"),
  HLDB.loadData("players")
]);

    const selectedTeam = teamsData.find(row =>
      row["チーム"] === teamName &&
      row["年度"] === year &&
      HLDB.normalizeLeague(row["リーグ"]) === HLDB.normalizeLeague(league) &&
      HLDB.normalizeStage(row["ステージ"]) === HLDB.normalizeStage(stage)
    );

    if (!selectedTeam) {
      teamInfo.innerHTML = `
        <p>該当するチームデータが見つかりませんでした。</p>
        <p><a href="index.html">← 順位表へ戻る</a></p>
      `;

      teamPlayers.innerHTML = "";
      teamMatches.innerHTML = "";
      return;
    }

    renderTeamInfo(selectedTeam, teamsData);
    renderTeamPlayers(playersData);
    renderTeamMatches(matchesData);

  } catch (error) {
    console.error(error);

    teamInfo.innerHTML = `
      <p>チームデータを読み込めませんでした。</p>
      <p><a href="index.html">← 順位表へ戻る</a></p>
    `;

    teamPlayers.innerHTML =
      "<p>所属選手を読み込めませんでした。</p>";

    teamMatches.innerHTML =
      "<p>試合履歴を読み込めませんでした。</p>";
  }
}


/* =========================
   チーム情報
========================= */

function renderTeamInfo(team, teamsData) {
  const point = HLDB.toNumber(team["ポイント"]) ?? 0;
  const rank = Number(team["順位"]);

  const normalizedYear =
    HLDB.normalizeYear(team["年度"]);

  const normalizedLeague =
    HLDB.normalizeLeague(team["リーグ"]);

  const normalizedStage =
    HLDB.normalizeStage(team["ステージ"]);
    const isPastSingleLeague =
    normalizedLeague === "単一リーグ" &&
    (
      normalizedYear === "2023" ||
      normalizedYear === "2024"
    );

  /*
    同じ年度・リーグ・ステージのチームだけ取得
  */
  const stageTeams = teamsData
    .filter(row =>
      HLDB.normalizeYear(row["年度"]) === normalizedYear &&
      HLDB.normalizeLeague(row["リーグ"]) === normalizedLeague &&
      HLDB.normalizeStage(row["ステージ"]) === normalizedStage
    )
    .sort(
      (a, b) =>
        Number(a["順位"]) - Number(b["順位"])
    );

  /*
    1つ上のチームとの差
  */
  let upperDiffText = "首位";

  if (rank > 1) {
    const upperTeam = stageTeams.find(
      row => Number(row["順位"]) === rank - 1
    );

    const upperPoint =
      HLDB.toNumber(upperTeam?.["ポイント"]);

    if (upperPoint !== null) {
      const upperDiff =
        Math.abs(upperPoint - point);

      upperDiffText =
        `${HLDB.formatDecimal(upperDiff)} pt`;
    } else {
      upperDiffText = "―";
    }
  }

  /*
    進出ボーダー順位
  */
  let borderRank = null;

  if (normalizedStage === "レギュラー") {
    borderRank = 6;
  } else if (normalizedStage === "Semi-Final") {
    borderRank = 4;
  }

  /*
    ボーダーとの差
  */
  let borderDiffText = "対象外";

  if (borderRank !== null) {
    const comparisonRank =
      rank <= borderRank
        ? borderRank + 1
        : borderRank;

    const comparisonTeam = stageTeams.find(
      row => Number(row["順位"]) === comparisonRank
    );

    const comparisonPoint =
      HLDB.toNumber(comparisonTeam?.["ポイント"]);

    if (comparisonPoint !== null) {
      const borderDiff =
        Math.abs(point - comparisonPoint);

      borderDiffText =
        `${HLDB.formatDecimal(borderDiff)} pt`;
    } else {
      borderDiffText = "―";
    }
  }

  teamTitle.textContent =
    team["チーム"] || teamName;

  teamInfo.innerHTML = `
    <div class="team-detail">

      <p>
        ${team["年度"]}年・
        ${HLDB.normalizeLeague(team["リーグ"])}リーグ
      </p>

      <p>
        ${HLDB.displayStageName(team["ステージ"])}
      </p>

      <div class="team-stats">

        <div>
          <span>順位</span>
          <strong>${team["順位"]}位</strong>
        </div>

        <div>
          <span>ポイント</span>
          <strong>${HLDB.formatDecimal(point)} pt</strong>
        </div>

        <div>
          <span>試合数</span>
          <strong>${team["試合数"]}</strong>
        </div>

        <div class="placement-stat">
          <span>着順分布</span>
          <strong>${team["着順分布"]}</strong>
        </div>

        <div>
          <span>上位まで</span>
          <strong>${upperDiffText}</strong>
        </div>

                ${isPastSingleLeague ? "" : `
          <div>
            <span>ボーダーまで</span>
            <strong>${borderDiffText}</strong>
          </div>
        `}

      </div>

      <p>
        <a href="index.html">
          ← 順位表へ戻る
        </a>
      </p>

    </div>
  `;
}


/* =========================
   所属選手一覧
========================= */

function renderTeamPlayers(playersData) {
  const selectedPlayers = playersData
    .filter(row =>
      row["年度"] === year &&
      row["チーム名"] === teamName &&
      HLDB.normalizeLeague(row["リーグ"]) === HLDB.normalizeLeague(league) &&
      HLDB.normalizeStage(row["ステージ"]) === HLDB.normalizeStage(stage)
    )
    .sort((a, b) =>
      Number(a["順位"] || 9999) -
      Number(b["順位"] || 9999)
    );

  if (selectedPlayers.length === 0) {
    teamPlayers.innerHTML = `
      <p>所属選手のデータがありません。</p>
    `;
    return;
  }

  teamPlayers.innerHTML = `
    <div class="player-list">

      ${selectedPlayers.map(player => {
        const playerUrl = HLDB.createPlayerUrl({
          id: player["選手ID"],
          year: player["年度"],
          league: player["リーグ"],
          stage: player["ステージ"]
        });

        return `
          <a class="player-card" href="${playerUrl}">

            <div class="player-card-name">
              ${player["選手名"]}
            </div>

            <div class="player-card-stats">
              <span>${player["順位"]}位</span>
              <span>${HLDB.formatDecimal(player["ポイント"])} pt</span>
              <span>${player["試合数"]}試合</span>
            </div>

          </a>
        `;
      }).join("")}

    </div>
  `;
}


/* =========================
   試合履歴
========================= */

function renderTeamMatches(matchesData) {
  const selectedMatches = matchesData.filter(row =>
    row["年度"] === year &&
    row["チーム名"] === teamName &&
    HLDB.normalizeLeague(row["リーグ"]) === HLDB.normalizeLeague(league) &&
    HLDB.normalizeStage(row["ステージ"]) === HLDB.normalizeStage(stage)
  );

  if (selectedMatches.length === 0) {
    teamMatches.innerHTML = `
      <p>このステージの試合履歴はありません。</p>
    `;
    return;
  }

  teamMatches.innerHTML = `
    <div class="matches-table-wrapper">

      <table>
        <thead>
          <tr>
            <th>日付</th>
            <th>選手</th>
            <th>着順</th>
            <th>スコア</th>
          </tr>
        </thead>

        <tbody>
          ${selectedMatches.map(match => `
            <tr>

              <td>
                ${match["日付"] || "―"}
              </td>

              <td>
                <a
  class="team-link"
  href="${HLDB.createPlayerUrl({
    id: match["選手ID"],
    year,
    league,
    stage
  })}"
>
  ${match["選手名"] || "―"}
</a>
              </td>

              <td>
                ${HLDB.formatPlacement(match["着順"])}
              </td>

              <td>
                ${match["スコア"] !== ""
                  ? `${HLDB.formatDecimal(match["スコア"])} pt`
                  : "―"}
              </td>

            </tr>
          `).join("")}
        </tbody>

      </table>

    </div>
  `;
}


loadTeamDetail();