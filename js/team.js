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

    const specialStats =
      renderTeamInfo(
      selectedTeam,
      teamsData,
      matchesData
    );

    renderTeamPlayers(playersData);
    renderTeamMatches(
      matchesData,
      specialStats
    );

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

function renderTeamInfo(
  team,
  teamsData,
  matchesData
) {
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
      normalizedYear === "2021" ||
      normalizedYear === "2022" ||
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

  /*
    表示中のチーム・年度・リーグ・ステージに
    該当する試合だけを取得する
  */
  const selectedMatches =
    matchesData.filter(row =>
      HLDB.normalizeYear(row["年度"]) === normalizedYear &&
      row["チーム名"] === (team["チーム"] || teamName) &&
      HLDB.normalizeLeague(row["リーグ"]) === normalizedLeague &&
      HLDB.normalizeStage(row["ステージ"]) === normalizedStage
    );

  /*
    日付ごとに試合をまとめる
  */
  const matchesByDate =
    new Map();

  selectedMatches.forEach(match => {

    const matchDate =
      String(match["日付"] || "")
        .trim();

    if (!matchDate) {
      return;
    }

    if (!matchesByDate.has(matchDate)) {
      matchesByDate.set(matchDate, []);
    }

    matchesByDate
      .get(matchDate)
      .push(match);

  });

  let dailyDoubleCount = 0;
  let consecutiveAppearanceCount = 0;

  const dailyDoubleDates = [];
  const consecutiveAppearanceDates = [];

  matchesByDate.forEach((
    dayMatches,
    matchDate
  ) => {

    /*
      同じ日の2試合でチームが両方1着なら
      デイリーダブル1回
    */
    const firstPlaceCount =
      dayMatches.filter(match =>
        parseInt(
          String(match["着順"] || ""),
          10
        ) === 1
      ).length;

    if (firstPlaceCount >= 2) {
      dailyDoubleCount += 1;
      dailyDoubleDates.push(matchDate);
    }

    /*
      同じ日の2試合へ同じ選手が出場したら
      連投1回
    */
    const playerCounts =
      new Map();

    dayMatches.forEach(match => {

      const playerKey =
        String(
          match["選手ID"] ||
          match["選手名"] ||
          ""
        ).trim();

      if (!playerKey) {
        return;
      }

      playerCounts.set(
        playerKey,
        (playerCounts.get(playerKey) || 0) + 1
      );

    });

    const hasConsecutiveAppearance =
      Array.from(playerCounts.values())
        .some(count => count >= 2);

    if (hasConsecutiveAppearance) {
      consecutiveAppearanceCount += 1;
      consecutiveAppearanceDates.push(
        matchDate
      );
    }

  });

  teamTitle.textContent =
  team["チーム"] || teamName;

HLDB.screenshotData = {
  type: "team",
  teamName: team["チーム"] || teamName,
  year: team["年度"] || year,
  league: HLDB.normalizeLeague(team["リーグ"]),
  stage: HLDB.displayStageName(team["ステージ"]),
  rank: team["順位"] || "―",
  point: HLDB.formatDecimal(point),
  matches: team["試合数"] || "―",
  placements: team["着順分布"] || "―",
  upperDiff: upperDiffText,
  borderDiff: borderDiffText,
  isPastSingleLeague
};

teamInfo.innerHTML = `
    <div class="team-detail">

      <p>
        ${team["年度"]}年${
          isPastSingleLeague
            ? ""
            : `・${HLDB.normalizeLeague(
                team["リーグ"]
              )}リーグ`
        }
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

        <div
          id="dailyDoubleCard"
          class="team-special-stat-card is-daily-double"
          role="button"
          tabindex="0"
          aria-label="デイリーダブル達成日を表示">
          <span>デイリーダブル</span>
          <strong>${dailyDoubleCount}回</strong>
        </div>

        <div
          id="consecutiveAppearanceCard"
          class="team-special-stat-card is-consecutive-appearance"
          role="button"
          tabindex="0"
          aria-label="連投した日を表示">
          <span>連投回数</span>
          <strong>${consecutiveAppearanceCount}回</strong>
        </div>

      </div>

      <p>
        <a href="index.html">
          ← 順位表へ戻る
        </a>
      </p>

    </div>
  `;

  ensureSpecialStatsStyles();

  bindSpecialStatCard(
    "dailyDoubleCard",
    "デイリーダブル達成日",
    dailyDoubleDates,
    "daily-double"
  );

  bindSpecialStatCard(
    "consecutiveAppearanceCard",
    "連投した日",
    consecutiveAppearanceDates,
    "consecutive-appearance"
  );

  return {
    dailyDoubleDates,
    consecutiveAppearanceDates
  };
}


/* =========================
   特別記録カード・ポップアップ
========================= */

function ensureSpecialStatsStyles() {

  if (
    document.getElementById(
      "teamSpecialStatsStyles"
    )
  ) {
    return;
  }

  const style =
    document.createElement("style");

  style.id =
    "teamSpecialStatsStyles";

  style.textContent = `
    .team-special-stat-card{
      cursor:pointer;
      transition:
        transform .18s ease,
        border-color .18s ease,
        box-shadow .18s ease;
    }

    .team-special-stat-card:hover,
    .team-special-stat-card:focus-visible{
      transform:translateY(-3px);
      outline:none;
    }

    .team-special-stat-card.is-daily-double:hover,
    .team-special-stat-card.is-daily-double:focus-visible{
      border-color:#ff5c5c;
      box-shadow:0 10px 28px rgba(255,76,76,.18);
    }

    .team-special-stat-card.is-consecutive-appearance:hover,
    .team-special-stat-card.is-consecutive-appearance:focus-visible{
      border-color:#4aa3ff;
      box-shadow:0 10px 28px rgba(74,163,255,.18);
    }

    .team-match-row.is-daily-double{
      background:rgba(255,77,77,.14);
      box-shadow:inset 4px 0 0 #ff4d4d;
    }

    .team-match-row.is-consecutive-appearance{
      background:rgba(74,163,255,.14);
      box-shadow:inset 4px 0 0 #4aa3ff;
    }

    .team-match-row.is-daily-double.is-consecutive-appearance{
      background:linear-gradient(
        90deg,
        rgba(255,77,77,.16),
        rgba(74,163,255,.16)
      );
      box-shadow:
        inset 4px 0 0 #ff4d4d,
        inset -4px 0 0 #4aa3ff;
    }

    .team-match-row.is-special-stat-focus{
      animation:teamSpecialStatFocus 1.1s ease;
    }

    @keyframes teamSpecialStatFocus{
      0%,100%{ filter:brightness(1); }
      45%{ filter:brightness(1.8); }
    }

    .team-special-popup-overlay{
      position:fixed;
      inset:0;
      z-index:10000;
      display:flex;
      align-items:center;
      justify-content:center;
      padding:20px;
      background:rgba(0,0,0,.74);
    }

    .team-special-popup{
      width:min(430px, 100%);
      padding:24px;
      color:#fff;
      background:#181818;
      border:1px solid rgba(212,175,55,.42);
      border-radius:18px;
      box-shadow:0 22px 60px rgba(0,0,0,.5);
    }

    .team-special-popup h3{
      margin:0 0 8px;
      color:#d4af37;
      font-size:21px;
    }

    .team-special-popup-message{
      margin:0 0 18px;
      color:rgba(255,255,255,.68);
      font-size:13px;
    }

    .team-special-popup-dates{
      display:grid;
      gap:9px;
      max-height:330px;
      overflow:auto;
    }

    .team-special-popup-date{
      width:100%;
      padding:12px 14px;
      color:#fff;
      text-align:left;
      background:#242424;
      border:1px solid rgba(255,255,255,.1);
      border-radius:10px;
      cursor:pointer;
    }

    .team-special-popup-date:hover{
      border-color:#d4af37;
    }

    .team-special-popup-date.is-daily-double{
      border-left:4px solid #ff4d4d;
    }

    .team-special-popup-date.is-consecutive-appearance{
      border-left:4px solid #4aa3ff;
    }

    .team-special-popup-empty{
      margin:0;
      padding:16px;
      color:rgba(255,255,255,.62);
      text-align:center;
      background:#222;
      border-radius:10px;
    }

    .team-special-popup-close{
      width:100%;
      margin-top:18px;
      padding:12px;
      color:#111;
      font-weight:800;
      background:#d4af37;
      border:0;
      border-radius:10px;
      cursor:pointer;
    }
  `;

  document.head.appendChild(style);

}


function bindSpecialStatCard(
  cardId,
  title,
  dates,
  type
) {

  const card =
    document.getElementById(cardId);

  if (!card) {
    return;
  }

  const openPopup = () => {
    showSpecialStatsPopup(
      title,
      dates,
      type
    );
  };

  card.addEventListener(
    "click",
    openPopup
  );

  card.addEventListener(
    "keydown",
    event => {

      if (
        event.key !== "Enter" &&
        event.key !== " "
      ) {
        return;
      }

      event.preventDefault();
      openPopup();

    }
  );

}


function showSpecialStatsPopup(
  title,
  dates,
  type
) {

  document
    .querySelector(
      ".team-special-popup-overlay"
    )
    ?.remove();

  const overlay =
    document.createElement("div");

  overlay.className =
    "team-special-popup-overlay";

  const dateButtons =
    dates.length > 0
      ? dates.map(date => `
          <button
            type="button"
            class="team-special-popup-date is-${type}"
            data-match-date="${date}">
            ${date}
          </button>
        `).join("")
      : `
          <p class="team-special-popup-empty">
            該当する日はありません
          </p>
        `;

  overlay.innerHTML = `
    <div
      class="team-special-popup"
      role="dialog"
      aria-modal="true"
      aria-labelledby="teamSpecialPopupTitle">

      <h3 id="teamSpecialPopupTitle">
        ${title}
      </h3>

      <p class="team-special-popup-message">
        日付を押すと、該当する試合履歴へ移動します。
      </p>

      <div class="team-special-popup-dates">
        ${dateButtons}
      </div>

      <button
        type="button"
        class="team-special-popup-close">
        閉じる
      </button>

    </div>
  `;

  const closePopup = () => {
    overlay.remove();
  };

  overlay
    .querySelector(
      ".team-special-popup-close"
    )
    ?.addEventListener(
      "click",
      closePopup
    );

  overlay.addEventListener(
    "click",
    event => {

      if (event.target === overlay) {
        closePopup();
      }

    }
  );

  overlay
    .querySelectorAll(
      ".team-special-popup-date"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const targetDate =
            button.dataset.matchDate;

          const targetRows =
            Array.from(
              document.querySelectorAll(
                ".team-match-row"
              )
            )
              .filter(row =>
                row.dataset.matchDate === targetDate
              );

          closePopup();

          if (targetRows.length === 0) {
            return;
          }

          targetRows[0].scrollIntoView({
            behavior: "smooth",
            block: "center"
          });

          targetRows.forEach(row => {

            row.classList.remove(
              "is-special-stat-focus"
            );

            requestAnimationFrame(() => {
              row.classList.add(
                "is-special-stat-focus"
              );
            });

          });

        }
      );

    });

  const escapeHandler = event => {

    if (event.key !== "Escape") {
      return;
    }

    closePopup();
    document.removeEventListener(
      "keydown",
      escapeHandler
    );

  };

  document.addEventListener(
    "keydown",
    escapeHandler
  );

  document.body.appendChild(overlay);

  overlay
    .querySelector("button")
    ?.focus();

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
  player: player["選手名"],
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

function renderTeamMatches(
  matchesData,
  specialStats = {}
) {

  const selectedMatches = matchesData
    .filter(row =>
      row["年度"] === year &&
      row["チーム名"] === teamName &&
      HLDB.normalizeLeague(row["リーグ"]) === HLDB.normalizeLeague(league) &&
      HLDB.normalizeStage(row["ステージ"]) === HLDB.normalizeStage(stage)
    )
    .sort((a, b) => {
      const dateA = new Date(String(a["日付"] || "").replace(/\//g, "-"));
      const dateB = new Date(String(b["日付"] || "").replace(/\//g, "-"));
      return dateB - dateA;
    });

  if (selectedMatches.length === 0) {
    teamMatches.innerHTML = `
      <p>このステージの試合履歴はありません。</p>
    `;
    return;
  }

  const dailyDoubleDateSet =
    new Set(
      specialStats.dailyDoubleDates || []
    );

  const consecutiveAppearanceDateSet =
    new Set(
      specialStats.consecutiveAppearanceDates || []
    );

  teamMatches.innerHTML = `
    <div class="matches-table-wrapper">

      <table class="team-match-table">

        <thead>
          <tr>
            <th>日付</th>
            <th>選手</th>
            <th>着順</th>
            <th>スコア</th>
          </tr>
        </thead>

        <tbody>

          ${selectedMatches.map(match => {

            const matchDate =
              String(match["日付"] || "")
                .trim();

            const rowClasses = [
              "team-match-row"
            ];

            if (
              dailyDoubleDateSet.has(matchDate)
            ) {
              rowClasses.push(
                "is-daily-double"
              );
            }

            if (
              consecutiveAppearanceDateSet.has(
                matchDate
              )
            ) {
              rowClasses.push(
                "is-consecutive-appearance"
              );
            }

            return `

            <tr
              class="${rowClasses.join(" ")}"
              data-match-date="${matchDate}"
data-url="${HLDB.createPlayerUrl({
  id: match["選手ID"],
  player: match["選手名"],
  year,
                league,
                stage
              })}"
            >

              <td>
                ${match["日付"] || "―"}
              </td>

              <td class="team-player-name">
                ${match["選手名"] || "―"}
              </td>

              <td>
                ${
                  match["着順"]
                    ? `${parseInt(match["着順"],10)}着`
                    : "―"
                }
              </td>

              <td>
                ${
                  match["スコア"] !== ""
                    ? `${HLDB.formatDecimal(match["スコア"])} pt`
                    : "―"
                }
              </td>

            </tr>

          `;

          }).join("")}

        </tbody>

      </table>

    </div>
  `;

  document.querySelectorAll(".team-match-row").forEach(row => {

    row.style.cursor = "pointer";

    row.addEventListener("click", () => {
      location.href = row.dataset.url;
    });

  });

}

loadTeamDetail();
