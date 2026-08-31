
  const awardsArea =
  document.getElementById("awardsArea");

const yearSelect =
  document.getElementById("yearSelect");

const leagueSelect =
  document.getElementById("leagueSelect");

const AWARDS_STATE_KEY =
  "hldbAwardsState";


function getAwardsState() {
  try {
    return JSON.parse(
      sessionStorage.getItem(
        AWARDS_STATE_KEY
      ) || "{}"
    );
  } catch {
    return {};
  }
}


function saveAwardsState(
  restoreOnReturn = false
) {
  try {
    sessionStorage.setItem(
      AWARDS_STATE_KEY,
      JSON.stringify({
        year: yearSelect.value,
        league: leagueSelect.value,
        scrollY: window.scrollY,
        restoreOnReturn
      })
    );
  } catch {
    /* 保存できない環境でも通常どおり表示する */
  }
}


function restoreAwardsScroll() {
  const state =
    getAwardsState();

  if (!state.restoreOnReturn) {
    return;
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.scrollTo(
        0,
        Number(state.scrollY) || 0
      );

      saveAwardsState(false);
    });
  });
}

const leagueControl =
  document.getElementById("leagueControl");

const awardsSeasonTitle =
  document.getElementById("awardsSeasonTitle");

let awardsData = [];
let playersData = [];
let matchesData = [];
let yakumanData = [];

const ALL_TIME_VALUE = "ALL";
const ALL_TIME_MIN_GAMES = 20;
const allTimeRankingUnlocked =
  sessionStorage.getItem("hldbDetailedStatsUnlocked") === "1";


/* 順位を数値化 */
function normalizeRank(value) {
  const match = String(value || "").match(/\d+/);

  return match ? Number(match[0]) : 9999;
}


/* 部門アイコン */
function getAwardIcon(category) {
    if (category.includes("役満")) return '<i data-lucide="sparkles"></i>';
    if (category.includes("ポイント")) return '<i data-lucide="crown"></i>';
    if (category.includes("ラス回避率")) return '<i data-lucide="shield-check"></i>';
    if (category.includes("最多勝利")) return '<i data-lucide="medal"></i>';
    if (category.includes("最高得点")) return '<i data-lucide="target"></i>';
    if (category.includes("トップ率")) return '<i data-lucide="zap"></i>';
  
    return '<i data-lucide="award"></i>';
  }
  
  
  /* Web上の部門名 */
  function getDisplayCategory(category) {
    if (category === "ポイント賞") {
      return "MVP";
    }

    if (category === "役満賞") {
      return "役満回数";
    }
  
    return category;
  }
  
  
  /* 部門ごとの受賞条件 */
  function getAwardCondition(category) {
    if (category === "ポイント賞") {
      return `
        <span>対象：7試合以上出場</span>
        <span>同ポイントの場合</span>
        <span>① 試合数が多い選手</span>
        <span>② 同条件の場合は同順位</span>
      `;
    }
  
    if (category === "ラス回避率賞") {
      return `
        <span>対象：7試合以上出場</span>
        <span>同率の場合</span>
        <span>① 試合数が多い選手</span>
        <span>② ポイントが高い選手</span>
      `;
    }
  
    if (category === "最多勝利賞") {
      return `
        <span>対象：7試合以上出場</span>
        <span>同数の場合</span>
        <span>① 試合数が少ない選手</span>
        <span>② ポイントが高い選手</span>
      `;
    }
  
    if (category === "最高得点賞") {
      return `
        <span>対象：7試合以上出場</span>

      `;
    }
  
    if (category === "トップ率賞") {
      return `
        <span>対象：7試合以上出場</span>
        <span>同率の場合</span>
        <span>① 試合数が多い選手</span>
        <span>② ポイントが高い選手</span>
      `;
    }
  
    return `
      <span>対象：7試合以上出場</span>
    `;
  }
  
/* メダル表示 */
function getMedal(rank) {
  const number = normalizeRank(rank);

  if (number >= 1 && number <= 3) {
    return `<span class="rank-medal-badge rank-medal-${number}" aria-label="${number}位">${number}</span>`;
  }

  return `${number}位`;
}


/* 順位ごとのCSSクラス */
function getRankClass(rank) {
  const number = normalizeRank(rank);

  if (number === 1) return "award-first";
  if (number === 2) return "award-second";
  if (number === 3) return "award-third";

  return "";
}



/* 部門別の数値表示 */
function formatAwardValue(row) {
  const category = String(row["部門"] || "").trim();
  const unit = String(row["単位"] || "").trim();
  const number = HLDB.toNumber(row["数値"]);

  if (number === null) {
    return "―";
  }

  if (category.includes("最高得点")) {
    return `${Math.round(number).toLocaleString("ja-JP")}${unit || "点"}`;
  }

  if (
    category.includes("トップ率") ||
    category.includes("ラス回避率")
  ) {
    const percent = Math.abs(number) <= 1
      ? number * 100
      : number;

    return `${percent.toFixed(1)}${unit || "%"}`;
  }

  if (category.includes("最多勝利")) {
    return `${Math.round(number)}${unit || "勝"}`;
  }

  if (category.includes("役満")) {
    return `${Math.round(number)}${unit || "回"}`;
  }

  return `${number.toFixed(1)}${unit || "pt"}`;
}


/* ラス回避率賞・最多勝利賞の試合数 */
function getAwardGameCount(row) {
  const category =
    String(row["部門"] || "").trim();

  if (
    category !== "ラス回避率賞" &&
    category !== "最多勝利賞"
  ) {
    return null;
  }

  const playerId =
    String(row["選手ID"] || "").trim();

  const playerName =
    String(row["選手名"] || "").trim();

  const year =
    HLDB.normalizeYear(row["年度"]);

  const league =
    normalizeAwardLeague(row["リーグ"]);

  const playerRow =
    playersData.find(player => {
      const samePlayer =
        playerId
          ? String(player["選手ID"] || "").trim() ===
            playerId
          : String(player["選手名"] || "").trim() ===
            playerName;

      return (
        samePlayer &&
        HLDB.normalizeYear(player["年度"]) === year &&
        normalizeAwardLeague(player["リーグ"]) === league &&
        String(player["ステージ"] || "").trim() ===
          "レギュラー"
      );
    });

  const gameCount =
    HLDB.toNumber(playerRow?.["試合数"]);

  return gameCount === null
    ? null
    : Math.round(gameCount);
}


/* 選手ページURL */
function createPlayerUrl(row) {
return HLDB.createPlayerUrl({
  id: row["選手ID"] || "",
  player: row["選手名"] || "",
  year: row["年度"] || "",
    league: row["リーグ"] || "",
    stage: "レギュラー"
  });
}


/* ========================================
   全期間ランキング
======================================== */

function buildAllTimePlayers() {
  const players = new Map();

  matchesData.forEach((row, index) => {
    const playerId = String(row["選手ID"] || "").trim();
    const playerName = String(row["選手名"] || "").trim();
    const key = playerId || `name:${playerName}`;
    const score = HLDB.toNumber(row["スコア"]);
    const gameScore = HLDB.toNumber(row["得点"]);
    const placing = normalizeRank(row["着順"]);

    if (!playerName || score === null || placing > 4) return;

    if (!players.has(key)) {
      players.set(key, {
        playerId,
        playerName,
        teamName: "",
        games: 0,
        points: 0,
        wins: 0,
        fourths: 0,
        highestScore: null,
        highestScoreDate: "",
        latestOrder: ""
      });
    }

    const player = players.get(key);
    const order = `${String(row["年度"] || "")}|${String(row["日付"] || "")}|${String(row["試合No"] || "").padStart(8, "0")}|${index}`;

    player.games += 1;
    player.points += score;
    player.wins += placing === 1 ? 1 : 0;
    player.fourths += placing === 4 ? 1 : 0;
    if (
      gameScore !== null &&
      (player.highestScore === null || gameScore > player.highestScore)
    ) {
      player.highestScore = gameScore;
      player.highestScoreDate = String(row["日付"] || "").trim();
    }

    if (order >= player.latestOrder) {
      player.latestOrder = order;
      player.teamName = String(row["チーム名"] || "").trim();
      player.playerName = playerName;
    }
  });

  return [...players.values()]
    .map(player => ({
      ...player,
      topRate: player.wins / player.games,
      avoidFourthRate: (player.games - player.fourths) / player.games
    }));
}


function allTimeCategoryRows(players, category) {
  if (category === "役満賞") {
    const records = new Map();

    yakumanData.forEach(row => {
      const playerId = String(row["選手ID"] || "").trim();
      const playerName = String(row["選手名"] || "").trim();
      const key = playerId || `name:${playerName}`;
      const count = HLDB.toNumber(row["回数"]) ?? 1;
      const date = String(row["日付"] || "").trim();

      if (!playerName) return;

      if (!records.has(key)) {
        records.set(key, {
          playerId,
          playerName,
          teamName: "",
          count: 0,
          latestDate: "",
          year: "",
          league: "",
          stage: "",
          matchNo: "",
          yakumanNames: new Set()
        });
      }

      const record = records.get(key);
      record.count += count;
      record.yakumanNames.add(String(row["役満名"] || "役満").trim());

      if (date >= record.latestDate) {
        record.latestDate = date;
        record.teamName = String(row["チーム名"] || "").trim();
        record.year = String(row["年度"] || "").trim();
        record.league = String(row["リーグ"] || "").trim();
        record.stage = String(row["ステージ"] || "").trim();
        record.matchNo = String(row["試合No"] || "").trim();
      }
    });

    return [...records.values()]
      .sort((a, b) => b.count - a.count || b.latestDate.localeCompare(a.latestDate, "ja"))
      .slice(0, 10)
      .map((record, index) => ({
        "順位": index + 1,
        "部門": category,
        "選手ID": record.playerId,
        "選手名": record.playerName,
        "チーム名": record.teamName,
        "役満名": [...record.yakumanNames].join("・"),
        "年度": record.year,
        "リーグ": record.league,
        "ステージ": record.stage,
        "試合No": record.matchNo,
        "試合数": "",
        "記録日": record.latestDate,
        "数値": record.count,
        "単位": "回"
      }));
  }

  const sorters = {
    "ポイント賞": (a, b) => b.points - a.points || b.games - a.games,
    "ラス回避率賞": (a, b) => b.avoidFourthRate - a.avoidFourthRate || b.games - a.games || b.points - a.points,
    "最多勝利賞": (a, b) => b.wins - a.wins || a.games - b.games || b.points - a.points,
    "最高得点賞": (a, b) => (b.highestScore ?? -Infinity) - (a.highestScore ?? -Infinity) || b.points - a.points,
    "トップ率賞": (a, b) => b.topRate - a.topRate || b.games - a.games || b.points - a.points
  };

  const eligiblePlayers = category === "最高得点賞"
    ? players.filter(player => player.highestScore !== null)
    : players.filter(player => player.games >= ALL_TIME_MIN_GAMES);

  return [...eligiblePlayers]
    .sort(sorters[category])
    .slice(0, 10)
    .map((player, index) => ({
      "順位": index + 1,
      "部門": category,
      "選手ID": player.playerId,
      "選手名": player.playerName,
      "チーム名": player.teamName,
      "年度": ALL_TIME_VALUE,
      "リーグ": "",
      "ステージ": "ALL",
      "試合数": player.games,
      "記録日": player.highestScoreDate,
      "数値": category === "ポイント賞" ? player.points
        : category === "ラス回避率賞" ? player.avoidFourthRate
        : category === "最多勝利賞" ? player.wins
        : category === "最高得点賞" ? player.highestScore
        : player.topRate,
      "単位": category === "ポイント賞" ? "pt"
        : category === "最多勝利賞" ? "勝"
        : category === "最高得点賞" ? "点"
        : "%"
    }));
}


function createAllTimeRankingUrl(row, category) {
  if (category !== "役満賞") {
    return HLDB.createPlayerUrl({
      id: row["選手ID"],
      player: row["選手名"],
      year: ALL_TIME_VALUE,
      stage: "ALL"
    });
  }

  const url = new URLSearchParams({
    id: row["選手ID"] || "",
    player: row["選手名"] || "",
    year: row["年度"] || "",
    league: row["リーグ"] || "",
    stage: row["ステージ"] || "",
    match: row["試合No"] || ""
  });

  return `player.html?${url.toString()}`;
}


function renderAllTimeAwards() {
  const players = buildAllTimePlayers();

  if (awardsSeasonTitle) {
    awardsSeasonTitle.textContent = "全年度・全リーグ・全ステージ";
  }

  awardsArea.innerHTML = `
    <p class="all-time-ranking-note">
      レギュラー・セミファイナル・ファイナルを含む全期間Top 10です。最高得点・役満回数以外は通算${ALL_TIME_MIN_GAMES}試合以上を対象とします。
    </p>
    <div class="awards-grid all-time-awards-grid">
      ${CATEGORY_ORDER.map((category, categoryIndex) => {
        const categoryRows = allTimeCategoryRows(players, category);

        return `
        <article class="award-category-card">
          <div class="award-category-header">
            <span class="award-category-icon">${getAwardIcon(category)}</span>
            <h2>${HLDB.escapeHtml(getDisplayCategory(category))}</h2>
          </div>
          <div class="award-ranking-list">
            ${categoryRows.map((row, rowIndex) => `
              <a class="award-player-row all-time-player-row ${getRankClass(row["順位"])}"
                ${rowIndex >= 3 ? `data-all-time-extra="${categoryIndex}" hidden` : ""}
                href="${createAllTimeRankingUrl(row, category)}">
                <div class="award-medal">${getMedal(row["順位"])}</div>
                <div class="award-player-info">
                  <strong>${HLDB.escapeHtml(row["選手名"])}</strong>
                  <span>
                    ${HLDB.escapeHtml(row["チーム名"] || "所属チームなし")}
                    ${category === "役満賞" && row["役満名"]
                      ? `｜${HLDB.escapeHtml(row["役満名"])}`
                      : ""}
                  </span>
                </div>
                <div class="award-result">
                  <div class="award-value">${formatAwardValue(row)}</div>
                  <span class="award-game-count ${category === "最高得点賞" || category === "役満賞" ? "award-record-date" : ""}">
                    ${category === "最高得点賞" || category === "役満賞"
                      ? `${category === "役満賞" ? "最終記録" : "記録日"} ${HLDB.escapeHtml(row["記録日"] || "日付不明")}`
                      : `${row["試合数"]}試合`}
                  </span>
                </div>
              </a>
            `).join("")}
            ${categoryRows.length > 3 ? `
              <button
                class="all-time-ranking-toggle"
                type="button"
                data-all-time-toggle="${categoryIndex}"
                aria-expanded="false"
              >
                4位〜${categoryRows.length}位を見る
              </button>
            ` : ""}
          </div>
          <div class="award-condition">
            <span>
              ${category === "最高得点賞"
                ? "対象：試合数条件なし（記録日を表示）"
                : category === "役満賞"
                  ? "対象：2026年以降に確認できた役満和了（対局URLは掲載しません）"
                : `対象：通算${ALL_TIME_MIN_GAMES}試合以上出場`}
            </span>
          </div>
        </article>
      `;
      }).join("")}
    </div>
  `;

  if (window.lucide) lucide.createIcons();
}


/* 部門順を固定 */
const CATEGORY_ORDER = [
  "ポイント賞",
  "ラス回避率賞",
  "最多勝利賞",
  "最高得点賞",
  "トップ率賞",
  "役満賞"
];
/* ========================================
   リーグ表記の統一
======================================== */

function normalizeAwardLeague(value) {
  const text =
    String(value || "").trim();

  if (
    text === "単一リーグ" ||
    text === "2023リーグ" ||
    text === "2024リーグ" ||
    text === "ハンドレッドリーグ" ||
    text === "2023" ||
    text === "2024"
  ) {
    return "単一リーグ";
  }

  if (text.startsWith("A")) {
    return "A";
  }

  if (text.startsWith("B")) {
    return "B";
  }

  return text;
}


/* ========================================
   年度に応じたリーグ切替
======================================== */

function updateLeagueControl() {
  if (yearSelect.value === ALL_TIME_VALUE) {
    leagueControl.style.display = "none";
    return;
  }

  const selectedYear =
  HLDB.normalizeYear(yearSelect.value);

  const isSingleLeagueYear =
    selectedYear === "2021" ||
    selectedYear === "2022" ||
    selectedYear === "2023" ||
    selectedYear === "2024";

  if (isSingleLeagueYear) {
    leagueSelect.innerHTML = `
      <option value="単一リーグ">
        単一リーグ
      </option>
    `;

    leagueSelect.value =
      "単一リーグ";

    leagueControl.style.display =
      "none";

    return;
  }

  leagueSelect.innerHTML = `
    <option value="A">
      Aリーグ
    </option>

    <option value="B">
      Bリーグ
    </option>
  `;

  leagueSelect.value = "A";

  leagueControl.style.display = "";
}


/* ========================================
   個人賞を表示
======================================== */

function renderAwards() {
  console.log("yearSelect.value =", yearSelect.value);

  if (yearSelect.value === ALL_TIME_VALUE) {
    renderAllTimeAwards();
    return;
  }

  const selectedYear =
  HLDB.normalizeYear(yearSelect.value);

  const isSingleLeagueYear =
    selectedYear === "2021" ||
    selectedYear === "2022" ||
    selectedYear === "2023" ||
    selectedYear === "2024";

  const selectedLeague =
    isSingleLeagueYear
      ? "単一リーグ"
      : normalizeAwardLeague(
          leagueSelect.value
        );

  if (awardsSeasonTitle) {
    awardsSeasonTitle.textContent =
      `${selectedYear} レギュラーシーズン`;
  }

  const filtered =
    awardsData.filter(row => {
      const rowYear =
      HLDB.normalizeYear(
          row["年度"]
        );

      const rowLeague =
        normalizeAwardLeague(
          row["リーグ"]
        );

      const rank =
        normalizeRank(
          row["順位"]
        );

      const player =
        String(
          row["選手名"] || ""
        ).trim();

      return (
        rowYear === selectedYear &&
        rowLeague === selectedLeague &&
        (
          rank <= 3 ||
          player === "該当者なし"
        )
      );
    });

  if (filtered.length === 0) {
    awardsArea.innerHTML = `
      <p class="no-data-message">
        該当する個人賞データがありません。
      </p>
    `;

    return;
  }

  const categories =
    CATEGORY_ORDER.filter(category =>
      filtered.some(row =>
        String(
          row["部門"] || ""
        ).trim() === category
      )
    );

  awardsArea.innerHTML = `
    <div class="awards-grid">

      ${categories.map(category => {
        const categoryRows =
          filtered
            .filter(row =>
              String(
                row["部門"] || ""
              ).trim() === category
            )
            .sort((a, b) =>
              normalizeRank(
                a["順位"]
              ) -
              normalizeRank(
                b["順位"]
              )
            );

        const noWinner =
          categoryRows.some(row =>
            String(
              row["選手名"] || ""
            ).trim() ===
              "該当者なし"
          );

        return `
          <article class="award-category-card">

            <div class="award-category-header">

              <span class="award-category-icon">
                ${getAwardIcon(category)}
              </span>

              <h2>
                ${HLDB.escapeHtml(
                  getDisplayCategory(
                    category
                  )
                )}
              </h2>

            </div>

            <div class="award-ranking-list">

              ${
                noWinner
                  ? `
                    <div class="award-no-winner">
                      <i data-lucide="award" class="ui-icon"></i>
                      該当者なし
                    </div>
                  `
                  : categoryRows.map(row => `
                    <a
                      class="award-player-row ${getRankClass(
                        row["順位"]
                      )}"
                      href="${createPlayerUrl(row)}"
                    >

                      <div class="award-medal">
                        ${getMedal(
                          row["順位"]
                        )}
                      </div>

                      <div class="award-player-info">

                        <strong>
                          ${HLDB.escapeHtml(
                            row["選手名"]
                          )}
                        </strong>

                        <span>
                          ${HLDB.escapeHtml(
                            row["チーム名"]
                          )}
                        </span>

                      </div>

                      <div class="award-result">

                        <div class="award-value">
                          ${formatAwardValue(row)}
                        </div>

                        ${
                          getAwardGameCount(row) !== null
                            ? `
                              <span class="award-game-count">
                                ${getAwardGameCount(row)}試合
                              </span>
                            `
                            : ""
                        }

                      </div>

                    </a>
                  `).join("")
              }

            </div>

            <div class="award-condition">
              ${getAwardCondition(category)}
            </div>
    <a
  class="award-ranking-card"
  href="award-ranking.html?year=${encodeURIComponent(
    selectedYear
  )}&league=${encodeURIComponent(
    selectedLeague
  )}&category=${encodeURIComponent(
    category
  )}"
>

  <div class="award-ranking-card-left">

    <span class="award-ranking-icon">
  <i data-lucide="arrow-right-circle"></i>
</span>

    <div>

      ${
  getDisplayCategory(category).includes("最高得点")
    ? `
      <div>
        <strong>ランキングを見る</strong>
        <small>TOP10表示</small>
      </div>
    `
    : `
      <div>
        <strong>
          <i data-lucide="chart-no-axes-column-increasing" class="ui-icon"></i>
          全ランキングを見る
        </strong>
      </div>
    `
}

    </div>

  </div>

  <i data-lucide="chevron-right"></i>

</a>

          </article>
        `;
      }).join("")}

    </div>
  `;
  if (window.lucide) {
    lucide.createIcons();
  }
}
/* CSV読込 */
async function loadAwards() {
  try {
    awardsArea.innerHTML = `
      <p class="no-data-message">
        読み込み中...
      </p>
    `;
    if (window.lucide) {
      lucide.createIcons();
    }

    [awardsData, playersData] = await Promise.all([
      HLDB.loadData("awards"),
      HLDB.loadData("players")
    ]);

    if (allTimeRankingUnlocked) {
      [matchesData, yakumanData] = await Promise.all([
        HLDB.loadData("matches"),
        HLDB.loadData("yakuman")
      ]);
    }

    HLDB.populateYearSelect(
      "yearSelect",
      awardsData
    );
    if (allTimeRankingUnlocked) {
      yearSelect.insertAdjacentHTML(
        "afterbegin",
        `<option value="${ALL_TIME_VALUE}">全期間</option>`
      );
    }
    console.log("populate後", yearSelect.value);

    const savedState =
      getAwardsState();

    const shouldRestoreState =
      savedState.restoreOnReturn === true;

    if (
      shouldRestoreState &&
      savedState.year &&
      Array.from(yearSelect.options)
        .some(option =>
          option.value === savedState.year
        )
    ) {
      yearSelect.value = savedState.year;
    }


    updateLeagueControl();

    if (
      shouldRestoreState &&
      savedState.league &&
      Array.from(leagueSelect.options)
        .some(option =>
          option.value === savedState.league
        )
    ) {
      leagueSelect.value = savedState.league;
    }

    renderAwards();
    restoreAwardsScroll();

  } catch (error) {
    console.error(error);

    awardsArea.innerHTML = `
      <p class="no-data-message">
        個人賞データを読み込めませんでした。
      </p>
    `;
  }
}


/* ========================================
   プルダウン切替
======================================== */

yearSelect.addEventListener(
  "change",
  () => {
    updateLeagueControl();
    renderAwards();
    saveAwardsState(false);
  }
);

leagueSelect.addEventListener(
  "change",
  () => {
    renderAwards();
    saveAwardsState(false);
  }
);

awardsArea.addEventListener(
  "click",
  event => {
    const toggleButton = event.target.closest(
      ".all-time-ranking-toggle"
    );

    if (toggleButton) {
      const card = toggleButton.closest(
        ".award-category-card"
      );
      const extraRows = card.querySelectorAll(
        "[data-all-time-extra]"
      );
      const willExpand =
        toggleButton.getAttribute("aria-expanded") !== "true";

      extraRows.forEach(row => {
        row.hidden = !willExpand;
      });

      toggleButton.setAttribute(
        "aria-expanded",
        String(willExpand)
      );
      toggleButton.textContent = willExpand
        ? "Top 3に戻す"
        : `4位〜${3 + extraRows.length}位を見る`;

      return;
    }

    if (
      event.target.closest(
        ".award-ranking-card, " +
        ".award-player-row"
      )
    ) {
      saveAwardsState(true);
    }
  }
);


/* ========================================
   初期表示
======================================== */

loadAwards();
