const PLAYERS_CSV_URL =
  "data/players.csv";

const MATCHES_CSV_URL =
  "data/matches.csv";

const AWARDS_CSV_URL =
  "data/awards.csv";

const POINT_PROGRESS_CSV_URL =
  "data/point-progress.csv";
/* ========================================
   URL・画面要素
======================================== */

const params = new URLSearchParams(window.location.search);

const playerId = params.get("id") || "";
const playerName = params.get("player") || "";
let displayPlayerName = playerName;
const urlYear = params.get("year") || "";
const urlLeague = params.get("league") || "";

const playerTitle =
  document.getElementById("playerTitle");

const playerInfo =
  document.getElementById("playerInfo");

const playerMatches =
  document.getElementById("playerMatches");

const headToHeadSearchInput =
  document.getElementById(
    "headToHeadSearchInput"
  );

const headToHeadSearchResults =
  document.getElementById(
    "headToHeadSearchResults"
  );

const headToHeadResult =
  document.getElementById(
    "headToHeadResult"
  );

const headToHeadTapNote =
  document.getElementById(
    "headToHeadTapNote"
  );

const favoriteButton =
  document.getElementById("favoriteButton");

const playerDetailedStatsButton =
  document.getElementById(
    "playerDetailedStatsButton"
  );

const DETAILED_STATS_PLAYER_IDS =
  new Set(["P0018"]);

function updateDetailedStatsButton() {
  if (!playerDetailedStatsButton) {
    return;
  }

  const isAvailable =
    DETAILED_STATS_PLAYER_IDS.has(
      currentPlayerId
    );

  playerDetailedStatsButton.hidden =
    !isAvailable;

  if (isAvailable) {
    const detailParams =
      new URLSearchParams(params);

    detailParams.set(
      "id",
      currentPlayerId
    );

    playerDetailedStatsButton.href =
      `player-stats.html?${detailParams.toString()}`;
  }
}


/* ========================================
   状態
======================================== */

let playersData = [];
let matchesData = [];
let awardsData = [];
let pointProgressData = [];
let pointProgressLoaded = false;
let pointProgressLoadPromise = null;
let html2CanvasLoadPromise = null;

let playerAliasData = [];
let currentPlayerId = "";
let currentPlayerAliasNames = [];

let activeYear = "";
let activeLeague = "";
let activeStage = "ALL";
let currentPlayerRecords = [];

function ensureHtml2Canvas() {
  if (window.html2canvas) return Promise.resolve();
  if (html2CanvasLoadPromise) return html2CanvasLoadPromise;
  html2CanvasLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
    script.onload = resolve;
    script.onerror = () => reject(new Error("画像作成機能を読み込めませんでした。"));
    document.head.appendChild(script);
  });
  return html2CanvasLoadPromise;
}

/* ========================================
   CSV解析
======================================== */

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const character = line[i];
    const nextCharacter = line[i + 1];

    if (
      character === '"' &&
      insideQuotes &&
      nextCharacter === '"'
    ) {
      current += '"';
      i++;
      continue;
    }

    if (character === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (character === "," && !insideQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += character;
  }

  values.push(current);

  return values;
}


function parseCsv(text) {
  const lines = String(text || "")
    .trim()
    .split(/\r?\n/)
    .filter(line => line.trim() !== "");

  if (lines.length === 0) {
    return [];
  }

  const headers = parseCsvLine(lines.shift()).map(
    (header, index) => {
      const cleaned = header.trim();

      return index === 0
        ? cleaned.replace(/^\uFEFF/, "")
        : cleaned;
    }
  );

  return lines.map(line => {
    const values = parseCsvLine(line);
    const item = {};

    headers.forEach((header, index) => {
      item[header] =
        values[index]?.trim() || "";
    });

    return item;
  });
}


/* ========================================
   表記統一
======================================== */

function normalizeYear(value) {
  const match =
    String(value || "").match(/\d{4}/);

  return match ? match[0] : "";
}


function normalizeLeague(value) {
  const text =
    String(value || "").trim();

  if (text.startsWith("A")) return "A";
  if (text.startsWith("B")) return "B";

  return text;
}


function normalizeStage(value) {
  const text =
    String(value || "").trim();

  if (
    text.includes("Semi") ||
    text.includes("セミファイナル") ||
    text.includes("セミ")
  ) {
    return "Semi-Final";
  }

  if (
    text.includes("Final") ||
    text.includes("ファイナル")
  ) {
    return "Final";
  }

  return "レギュラー";
}


function displayLeagueName(value) {
  const league = normalizeLeague(value);

  if (league === "A") return "Aリーグ";
  if (league === "B") return "Bリーグ";

  return league || "―";
}


function displayStageName(value) {
  const stage = normalizeStage(value);

  if (stage === "Semi-Final") {
    return "セミファイナル";
  }

  if (stage === "Final") {
    return "ファイナル";
  }

  return "レギュラー";
}


function getStageClass(value) {
  const stage = normalizeStage(value);

  if (stage === "Semi-Final") {
    return "stage-semifinal";
  }

  if (stage === "Final") {
    return "stage-final";
  }

  return "stage-regular";
}


/* ========================================
   数値処理
======================================== */

function toNumber(value) {
  const text = String(value ?? "")
    .replace(/,/g, "")
    .replace(/pt/gi, "")
    .replace(/点/g, "")
    .replace(/勝/g, "")
    .replace(/%/g, "")
    .replace(/着/g, "")
    .trim();

  if (text === "") {
    return null;
  }

  const number = Number(text);

  return Number.isFinite(number)
    ? number
    : null;
}


function formatDecimal(value, digits = 1) {
  const number = toNumber(value);

  if (number === null) {
    return "―";
  }

  return number.toFixed(digits);
}


function formatInteger(value) {
  const number = toNumber(value);

  if (number === null) {
    return "―";
  }

  return Math.round(number)
    .toLocaleString("ja-JP");
}


function formatRank(value) {
  const text =
    String(value ?? "").trim();

  if (text === "") {
    return "―";
  }

  return text.endsWith("位")
    ? text
    : `${text}位`;
}


function formatScore(value) {
  const number = toNumber(value);

  if (number === null) {
    return "―";
  }

  const sign = number > 0 ? "+" : "";

  return `${sign}${number.toFixed(1)} pt`;
}


function formatPlacement(value) {
  const number = toNumber(value);

  if (number === null) {
    return "―";
  }

  return `${number}着`;
}


function formatPercentFromRatio(value) {
  if (!Number.isFinite(value)) {
    return "―";
  }

  return `${(value * 100).toFixed(1)}%`;
}


function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


/* ========================================
   年度・リーグ判定
======================================== */

function getPlayerYears() {
  const years = matchesData
    .filter(row =>
      String(row["選手ID"] || "").trim() ===
      currentPlayerId
    )
    .map(row =>
      normalizeYear(row["年度"])
    )
    .filter(Boolean);

  return [...new Set(years)].sort(
    (a, b) => Number(b) - Number(a)
  );
}


function getLeagueForYear(year) {
  if (!year || year === "ALL") {
    return "";
  }

  /*
    URLから開いた最初の年度だけは、
    URLのリーグを優先します。
  */
  if (
    urlLeague &&
    normalizeYear(urlYear) === year
  ) {
    return normalizeLeague(urlLeague);
  }

  /*
    Playersのレギュラー行から探します。
  */
  const regularPlayer = playersData.find(row =>
    String(row["選手ID"] || "").trim() ===
      currentPlayerId &&
    normalizeYear(row["年度"]) === year &&
    normalizeStage(row["ステージ"]) ===
      "レギュラー"
  );

  if (regularPlayer) {
    return normalizeLeague(
      regularPlayer["リーグ"]
    );
  }

  /*
    PlayersになければMatchesから探します。
  */
  const match = matchesData.find(row =>
    String(row["選手ID"] || "").trim() ===
      currentPlayerId &&
    normalizeYear(row["年度"]) === year
  );

  return normalizeLeague(
    match?.["リーグ"]
  );
}


/* ========================================
   試合データ抽出
======================================== */

function getSelectedMatches() {

  return matchesData
    .filter(row => {
    const playerMatches =
  String(row["選手ID"] || "").trim() ===
  currentPlayerId;

    const yearMatches =
      activeYear === "ALL" ||
      normalizeYear(row["年度"]) ===
        activeYear;

    const leagueMatches =
      activeYear === "ALL" ||
      !activeLeague ||
      normalizeLeague(row["リーグ"]) ===
        activeLeague;

    const stageMatches =
      activeStage === "ALL" ||
      normalizeStage(row["ステージ"]) ===
        activeStage;

        return (
          playerMatches &&
          yearMatches &&
          leagueMatches &&
          stageMatches
        );
      })
      .sort((a, b) => {
        const dateA = new Date(
          String(a["日付"]).replace(/\//g, "-")
        );
    
        const dateB = new Date(
          String(b["日付"]).replace(/\//g, "-")
        );
    
        return dateB - dateA;
      });
    }


/* ========================================
   選択範囲の成績を再集計
======================================== */

function calculatePlayerStats(matches) {
  const validMatches = matches.filter(match =>
    toNumber(match["スコア"]) !== null &&
    toNumber(match["着順"]) !== null
  );

  const gameCount = validMatches.length;

  const scores = validMatches
    .map(match =>
      toNumber(match["スコア"])
    )
    .filter(value => value !== null);

  const placements = validMatches
    .map(match =>
      toNumber(match["着順"])
    )
    .filter(value => value !== null);

  const mahjongScores = validMatches
    .map(match =>
      toNumber(match["得点"])
    )
    .filter(value => value !== null);

  const totalPoint = scores.reduce(
    (sum, value) => sum + value,
    0
  );

  const averageScore =
    gameCount > 0
      ? totalPoint / gameCount
      : null;

  const placementTotal = placements.reduce(
    (sum, value) => sum + value,
    0
  );

  const averagePlacement =
    gameCount > 0
      ? placementTotal / gameCount
      : null;

  const firstCount = placements.filter(
    value => value === 1
  ).length;

  const secondCount = placements.filter(
    value => value === 2
  ).length;

  const thirdCount = placements.filter(
    value => value === 3
  ).length;

  const fourthCount = placements.filter(
    value => value === 4
  ).length;

  const topRate =
    gameCount > 0
      ? firstCount / gameCount
      : null;

  const avoidRate =
    gameCount > 0
      ? 1 - fourthCount / gameCount
      : null;

  const highestScore =
    mahjongScores.length > 0
      ? Math.max(...mahjongScores)
      : null;

  const lowestScore =
    mahjongScores.length > 0
      ? Math.min(...mahjongScores)
      : null;

  const teamNames = [
    ...new Set(
      validMatches
        .map(match =>
          String(
            match["チーム名"] || ""
          ).trim()
        )
        .filter(Boolean)
    )
  ];

  return {
    gameCount,
    totalPoint,
    averageScore,
    averagePlacement,
    firstCount,
    secondCount,
    thirdCount,
    fourthCount,
    topRate,
    avoidRate,
    highestScore,
    lowestScore,
    teamNames
  };
}


/* ========================================
   レギュラー順位データ
======================================== */

function getRegularPlayerRecord() {
  if (activeYear === "ALL") {
    return null;
  }

  return playersData.find(row => {
    const rowPlayerId =
      String(
        row["選手ID"] || ""
      ).trim();

    return (
      rowPlayerId === currentPlayerId &&
      normalizeYear(row["年度"]) ===
        activeYear &&
      (
        !activeLeague ||
        normalizeLeague(
          row["リーグ"]
        ) === activeLeague
      ) &&
      normalizeStage(
        row["ステージ"]
      ) === "レギュラー"
    );
  }) || null;
}


/* ========================================
   年度・ステージ切替
======================================== */

function renderFilters() {
  const years = getPlayerYears();

  return `
    <section class="player-filter-section">

      <label>
        <span>年度</span>

        <select id="playerYearSelect">

          <option
            value="ALL"
            ${activeYear === "ALL"
              ? "selected"
              : ""}
          >
            全年度
          </option>

          ${years.map(year => `
            <option
              value="${escapeHtml(year)}"
              ${year === activeYear
                ? "selected"
                : ""}
            >
              ${escapeHtml(year)}年
            </option>
          `).join("")}

        </select>
      </label>

      <label>
        <span>ステージ</span>

        <select id="playerStageSelect">

          <option
            value="ALL"
            ${activeStage === "ALL"
              ? "selected"
              : ""}
          >
            全ステージ
          </option>

          <option
            value="レギュラー"
            ${activeStage === "レギュラー"
              ? "selected"
              : ""}
          >
            レギュラー
          </option>

          <option
            value="Semi-Final"
            ${activeStage === "Semi-Final"
              ? "selected"
              : ""}
          >
            セミファイナル
          </option>

          <option
            value="Final"
            ${activeStage === "Final"
              ? "selected"
              : ""}
          >
            ファイナル
          </option>

        </select>
      </label>

    </section>
  `;
}


/* ========================================
   レギュラー順位表示
======================================== */

function renderRegularRanking(
  regularPlayer
) {
  const regularPlayerCount =
  playersData.filter(
    player =>
      normalizeYear(
        player["年度"]
      ) === activeYear &&
      normalizeLeague(
        player["リーグ"]
      ) === activeLeague &&
      normalizeStage(
        player["ステージ"]
      ) === "レギュラー"
  ).length;
  if (activeYear === "ALL") {
    return `
      <section class="regular-ranking-section">

        <h2>
          <i data-lucide="chart-no-axes-column-increasing"></i>
          レギュラーシーズン順位
        </h2>

        <p class="regular-ranking-empty">
          歴代通算には順位を設定していません。
          年度を選択すると、その年度の順位を確認できます。
        </p>

      </section>
    `;
  }

  return `
    <section class="regular-ranking-section">

      <h2>
        <i data-lucide="chart-no-axes-column-increasing"></i>
        レギュラーシーズン順位
      </h2>

      ${
        regularPlayer
          ? `
            <div class="regular-ranking-list">

              <div class="regular-ranking-row">
                <span class="regular-ranking-label">
                  ポイント
                </span>

                <strong class="regular-ranking-value">
  ${
    regularPlayer["順位"]
      ? `${regularPlayer["順位"]}位 / ${regularPlayerCount}人`
      : "―"
  }
</strong>
              </div>

              <div class="regular-ranking-row">
                <span class="regular-ranking-label">
                  最高得点
                </span>

                <strong class="regular-ranking-value">
                  ${formatRank(
                    regularPlayer[
                      "最高得点順位"
                    ]
                  )}
                </strong>
              </div>

              <div class="regular-ranking-row">
                <span class="regular-ranking-label">
                  最多勝利
                </span>

                <strong class="regular-ranking-value">
                  ${formatRank(
                    regularPlayer[
                      "最多勝利順位"
                    ]
                  )}
                </strong>
              </div>

              <div class="regular-ranking-row">
                <span class="regular-ranking-label">
                  トップ率
                </span>

                <strong class="regular-ranking-value">
                  ${formatRank(
                    regularPlayer[
                      "トップ率順位"
                    ]
                  )}
                </strong>
              </div>

              <div class="regular-ranking-row">
                <span class="regular-ranking-label">
                  ラス回避率
                </span>

                <strong class="regular-ranking-value">
                  ${formatRank(
                    regularPlayer[
                      "ラス回避率順位"
                    ]
                  )}
                </strong>
              </div>

            </div>
          `
          : `
            <p class="regular-ranking-empty">
              レギュラーシーズン順位がありません。
            </p>
          `
      }

      <p class="regular-ranking-note">
        ※順位・各種ランキングは、${escapeHtml(
          activeYear
        )}年のレギュラーシーズンのみを対象としています。
      </p>

    </section>
  `;
}


/* ========================================
   選手概要
======================================== */

function renderPlayerInfo() {
  const selectedMatches =
    getSelectedMatches();

  const stats =
    calculatePlayerStats(selectedMatches);

  const regularPlayer =
    getRegularPlayerRecord();

  const selectedStageName =
    activeStage === "ALL"
      ? "全ステージ通算"
      : displayStageName(activeStage);

      const teamDisplay =
      stats.teamNames.length > 0
        ? stats.teamNames.join(" / ")
        : regularPlayer?.["チーム名"] ||
          "―";
    
          const teamLinkName =
          stats.teamNames[0] ||
          regularPlayer?.["チーム名"] ||
          "";
        
        const teamLinkMatch =
          selectedMatches.find(match =>
            String(
              match["チーム名"] || ""
            ).trim() === teamLinkName
          ) ||
          selectedMatches[0] ||
          null;
        
        const teamLinkYear =
          normalizeYear(
            teamLinkMatch?.["年度"] ||
            regularPlayer?.["年度"] ||
            ""
          );
        
        const teamLinkLeague =
          teamLinkMatch?.["リーグ"] ||
          regularPlayer?.["リーグ"] ||
          "";
        
        const teamLinkStage =
          teamLinkMatch?.["ステージ"] ||
          regularPlayer?.["ステージ"] ||
          "Regular";
        
        const teamDetailUrl =
          teamLinkName && teamLinkYear
            ? `team.html?team=${encodeURIComponent(
                teamLinkName
              )}&year=${encodeURIComponent(
                teamLinkYear
              )}&league=${encodeURIComponent(
                teamLinkLeague
              )}&stage=${encodeURIComponent(
                teamLinkStage
              )}`
            : "";


  const activeLeagueDisplay =
    displayLeagueName(activeLeague);

  const periodDisplay =
    activeYear === "ALL"
      ? "全年度・全リーグ・歴代通算"
      : activeLeagueDisplay === "単一リーグ"
        ? `${escapeHtml(activeYear)}年`
        : `${escapeHtml(activeYear)}年・${escapeHtml(
            activeLeagueDisplay
          )}`;
        const playerScreenshotButton =
  document.getElementById(
    "playerScreenshotButton"
  );

if (playerScreenshotButton) {

  playerScreenshotButton.onclick = async () => {
    try {
      await ensureHtml2Canvas();
    } catch (error) {
      alert(error.message);
      return;
    }
    
    const regularPlayerCount =
  playersData.filter(
    player =>
      normalizeYear(
        player["年度"]
      ) === activeYear &&
      normalizeLeague(
        player["リーグ"]
      ) === activeLeague &&
      normalizeStage(
        player["ステージ"]
      ) === "レギュラー"
  ).length;

  const screenshotTeamNames =
  String(teamDisplay || "")
    .split("/")
    .map(team => team.trim())
    .filter(Boolean);

    const screenshotCurrentTeam =
    activeYear === "ALL"
      ? screenshotTeamNames[0] || ""
      : teamDisplay;
  
  const screenshotPastTeams =
    activeYear === "ALL"
      ? screenshotTeamNames.slice(1)
      : [];

      const getRankNumber = value => {

        const rank =
          Number(
            String(value ?? "")
              .replace(/[^\d.-]/g, "")
          );
      
        return Number.isFinite(rank) &&
          rank > 0
          ? rank
          : null;
      
      };
      
      const historicalRegularRecords =
        currentPlayerRecords.filter(record =>
          String(record["ステージ"] || "")
            .trim() === "レギュラー"
        );
      
      const findBestHistoricalRank =
        columnName => {
      
          const candidates =
            historicalRegularRecords
              .map(record => ({
                rank:
                  getRankNumber(
                    record[columnName]
                  ),
      
                year:
                  String(
                    record["年度"] || ""
                  ).trim()
              }))
              .filter(item =>
                item.rank !== null &&
                item.year
              )
              .sort((a, b) => {
      
                if (a.rank !== b.rank) {
                  return a.rank - b.rank;
                }
      
                return (
                  Number(b.year) -
                  Number(a.year)
                );
      
              });
      
          return candidates[0] || null;
      
        };
      
      const bestRanks = {
      
        mvp:
          findBestHistoricalRank(
            "ポイント賞順位"
          ),
      
        topRate:
          findBestHistoricalRank(
            "トップ率賞順位"
          ),
      
        avoidRate:
          findBestHistoricalRank(
            "ラス回避率賞順位"
          ),
      
        mostWins:
          findBestHistoricalRank(
            "最多勝利賞順位"
          ),
      
        highestScore:
          findBestHistoricalRank(
            "最高得点賞順位"
          )
      
      };

    HLDB.playerScreenshotData = {

      playerName:
        displayPlayerName,

      year:
        activeYear,

      league:
        displayLeagueName(
          activeLeague
        ),

      stage:
        selectedStageName,

        teamName:
        screenshotCurrentTeam,
      
      pastTeams:
        screenshotPastTeams,

      totalPoint:
        stats.totalPoint,

      gameCount:
        stats.gameCount,

        mvpRank:
        regularPlayer?.["順位"] || null,
      
      topRateRank:
        regularPlayer?.["トップ率順位"] || null,
      
      avoidRateRank:
        regularPlayer?.["ラス回避率順位"] || null,
      
      mostWinsRank:
        regularPlayer?.["最多勝利順位"] || null,
      
      playerCount:
        regularPlayerCount,

        bestRanks:
  bestRanks,

      averagePlacement:
        stats.averagePlacement,

      topRate:
        stats.topRate,

      avoidRate:
        stats.avoidRate,

        highestScoreRank:
  regularPlayer?.["最高得点順位"] || null,

      highestScore:
        stats.highestScore,

      firstCount:
        stats.firstCount,

      secondCount:
        stats.secondCount,

      thirdCount:
        stats.thirdCount,

      fourthCount:
        stats.fourthCount

    };

    HLDB.openPlayerScreenshotMode();

  };

}

        playerTitle.textContent =
        displayPlayerName || "選手詳細";

  playerInfo.innerHTML = `
    <div class="player-detail">

      ${renderFilters()}

      <div class="player-summary">

        <p>${periodDisplay}</p>

        <p>
          ${escapeHtml(selectedStageName)}
        </p>

        ${
          teamDetailUrl
            ? `
              <a
                class="player-team-link"
                href="${teamDetailUrl}"
              >
                <span class="player-team-link-label">
                  所属チーム
                </span>
        
                <strong>
                  ${escapeHtml(teamDisplay)}
                </strong>
        
                <i data-lucide="arrow-right"></i>
              </a>
            `
            : `
              <h2>
                ${escapeHtml(teamDisplay)}
              </h2>
            `
        }

      </div>

      ${
        stats.gameCount === 0
          ? `
            <p class="no-data-message">
              選択した条件の試合データがありません。
            </p>
          `
          : `
            <div class="team-stats">

              <div>
                <span>ポイント</span>
                <strong>
                  ${formatScore(
                    stats.totalPoint
                  )}
                </strong>
              </div>

              <div>
                <span>試合数</span>
                <strong>
                  ${stats.gameCount}
                </strong>
              </div>

              <div>
                <span>平均スコア</span>
                <strong>
                  ${formatScore(
                    stats.averageScore
                  )}
                </strong>
              </div>

              <div>
                <span>平均順位</span>
                <strong>
                  ${formatDecimal(
                    stats.averagePlacement,
                    2
                  )}
                </strong>
              </div>

              <div>
                <span>最高得点</span>
                <strong>
                  ${formatInteger(
                    stats.highestScore
                  )}点
                </strong>
              </div>

              <div>
                <span>最低得点</span>
                <strong>
                  ${formatInteger(
                    stats.lowestScore
                  )}点
                </strong>
              </div>

              <div>
                <span>トップ数</span>
                <strong>
                  ${stats.firstCount}勝
                </strong>
              </div>

              <div>
                <span>トップ率</span>
                <strong>
                  ${formatPercentFromRatio(
                    stats.topRate
                  )}
                </strong>
              </div>

              <div>
                <span>ラス回避率</span>
                <strong>
                  ${formatPercentFromRatio(
                    stats.avoidRate
                  )}
                </strong>
              </div>

            </div>

            <section class="placing-section">

  <h2>
    <i data-lucide="chart-no-axes-column"></i>
    着順分布
  </h2>

  <div class="placing-grid">

    <div class="placing-card placing-first">
      

      <span class="placement-name">
        1着
      </span>

      <strong>
        ${stats.firstCount}
        <small>回</small>
      </strong>
    </div>

    <div class="placing-card placing-second">
      

      <span class="placement-name">
        2着
      </span>

      <strong>
        ${stats.secondCount}
        <small>回</small>
      </strong>
    </div>

    <div class="placing-card placing-third">
      

      <span class="placement-name">
        3着
      </span>

      <strong>
        ${stats.thirdCount}
        <small>回</small>
      </strong>
    </div>

    <div class="placing-card placing-fourth">
      

      <span class="placement-name">
        4着
      </span>

      <strong>
        ${stats.fourthCount}
        <small>回</small>
      </strong>
    </div>

  </div>

</section>
          `
      }

      ${renderRegularRanking(
        regularPlayer
      )}

    </div>
  `;
  if (window.lucide) {
    lucide.createIcons();
  }

  attachFilterEvents();
}


/* ========================================
   切替イベント
======================================== */

function attachFilterEvents() {
    const yearSelect =
      document.getElementById(
        "playerYearSelect"
      );
  
    const stageSelect =
      document.getElementById(
        "playerStageSelect"
      );
  
    yearSelect?.addEventListener(
      "change",
      event => {
        activeYear =
          event.target.value;
  
        activeLeague =
          activeYear === "ALL"
            ? ""
            : getLeagueForYear(
                activeYear
              );
  
        renderPlayerPage();
      }
    );
  
    stageSelect?.addEventListener(
      "change",
      event => {
        activeStage =
          event.target.value;
  
        renderPlayerPage();
      }
    );
  }
  
  
  /* ========================================
     受賞歴
  ======================================== */
  
  function getAwardIcon(category) {
    if (category.includes("ポイント")) {
      return '<i data-lucide="crown"></i>';
    }
  
    if (category.includes("ラス回避率")) {
      return '<i data-lucide="shield-check"></i>';
    }
  
    if (category.includes("最多勝利")) {
      return '<i data-lucide="medal"></i>';
    }
  
    if (category.includes("最高得点")) {
      return '<i data-lucide="target"></i>';
    }
  
    if (category.includes("トップ率")) {
      return '<i data-lucide="zap"></i>';
    }
  
    return '<i data-lucide="award"></i>';
  }
  
  
  function getDisplayAwardName(category) {
    if (category === "ポイント賞") {
      return "MVP";
    }
  
    return category;
  }
  
  
  function renderPlayerAwards() {
    const playerAwards =
      document.getElementById(
        "playerAwards"
      );
  
    if (!playerAwards) {
      return;
    }
  
    const awards = awardsData
      .filter(row => {
        const awardPlayerId =
          String(
            row["選手ID"] || ""
          ).trim();
  
        const awardPlayer =
          String(
            row["選手名"] || ""
          ).trim();
  
        const yearMatches =
          activeYear === "ALL" ||
          normalizeYear(
            row["年度"]
          ) === activeYear;
  
        return (
          awardPlayerId === currentPlayerId &&
          awardPlayer !== "該当者なし" &&
          yearMatches
        );
      })
      .sort((a, b) => {
        const yearDiff =
          Number(
            normalizeYear(
              b["年度"]
            )
          ) -
          Number(
            normalizeYear(
              a["年度"]
            )
          );
  
        if (yearDiff !== 0) {
          return yearDiff;
        }
  
        return (
          (toNumber(a["順位"]) ?? 9999) -
          (toNumber(b["順位"]) ?? 9999)
        );
      });
  
    if (awards.length === 0) {
      playerAwards.innerHTML = `
        <p class="no-data-message">
          受賞歴はありません。
        </p>
      `;
  
      return;
    }
  
    playerAwards.innerHTML = `
      <div class="player-awards-list">
  
        ${awards.map(award => {
          const awardYear =
            normalizeYear(
              award["年度"]
            );
  
          const originalLeague =
          String(
            award["リーグ"] || ""
          ).trim();
        
        const awardLeague =
          originalLeague === "Aリーグ"
            ? "A"
            : originalLeague === "Bリーグ"
              ? "B"
              : originalLeague;
  
          /*
            URLに使う元の部門名
            例：ポイント賞
          */
          const awardCategory =
            String(
              award["部門"] || ""
            ).trim();
  
          /*
            画面に表示する部門名
            例：MVP
          */
          const displayAwardName =
            getDisplayAwardName(
              awardCategory
            );
  
          const awardUrl =
            `award-ranking.html?year=${encodeURIComponent(
              awardYear
            )}&league=${encodeURIComponent(
              awardLeague
            )}&category=${encodeURIComponent(
              awardCategory
            )}`;
  
          return `
            <a
              class="player-award-card"
              href="${awardUrl}"
              aria-label="${escapeHtml(
                displayAwardName
              )}のランキングを見る"
            >
  
              <div class="player-award-icon">
                ${getAwardIcon(
                  awardCategory
                )}
              </div>
  
              <div class="player-award-main">
  
                <strong>
                  ${escapeHtml(
                    displayAwardName
                  )}
                </strong>
  
                <span>
                  ${escapeHtml(
                    awardYear
                  )}年・${escapeHtml(
                    displayLeagueName(
                      award["リーグ"]
                    )
                  )}
                </span>
  
              </div>
  
              <div class="player-award-rank">
                ${formatRank(
                  award["順位"]
                )}
              </div>
  
              <i
                class="player-award-arrow"
                data-lucide="chevron-right"
                aria-hidden="true"
              ></i>
  
            </a>
          `;
        }).join("")}
  
      </div>
    `;
  
    if (window.lucide) {
      lucide.createIcons();
    }
  }
  
  
  /* ========================================
     直接対決
  ======================================== */

  function getHeadToHeadMatchKey(match) {
    const matchNo =
      getMatchNo(match);

    return [
      normalizeYear(match["年度"]),
      normalizeLeague(match["リーグ"]),
      normalizeStage(match["ステージ"]),
      matchNo || String(match["日付"] || "").trim(),
      matchNo ? "" : String(match["時間"] || "").trim()
    ].join("|");
  }


  function getHeadToHeadPlayers() {
    const playerMap =
      new Map();

    matchesData.forEach(match => {
      const opponentId =
        String(match["選手ID"] || "").trim();

      const opponentName =
        String(match["選手名"] || "").trim();

      if (
        !opponentId ||
        !opponentName ||
        opponentId === currentPlayerId
      ) {
        return;
      }

      const year =
        Number(
          normalizeYear(match["年度"])
        ) || 0;

      const existing =
        playerMap.get(opponentId);

      if (!existing) {
        playerMap.set(opponentId, {
          id: opponentId,
          name: opponentName,
          latestYear: year,
          searchNames: new Set([
            opponentName
          ])
        });

        return;
      }

      existing.searchNames.add(
        opponentName
      );

      if (year >= existing.latestYear) {
        existing.name = opponentName;
        existing.latestYear = year;
      }
    });

    return [...playerMap.values()]
      .sort((a, b) =>
        a.name.localeCompare(
          b.name,
          "ja"
        )
      );
  }


  function getHeadToHeadMatches(
    opponentId
  ) {
    const opponentMatchMap =
      new Map();

    matchesData.forEach(match => {
      if (
        String(match["選手ID"] || "").trim() !==
        opponentId
      ) {
        return;
      }

      opponentMatchMap.set(
        getHeadToHeadMatchKey(match),
        match
      );
    });

    return matchesData
      .filter(match =>
        String(match["選手ID"] || "").trim() ===
        currentPlayerId
      )
      .map(selfMatch => {
        const opponentMatch =
          opponentMatchMap.get(
            getHeadToHeadMatchKey(
              selfMatch
            )
          );

        return opponentMatch
          ? {
              selfMatch,
              opponentMatch
            }
          : null;
      })
      .filter(Boolean)
      .sort((a, b) => {
        const dateCompare =
          String(
            b.selfMatch["日付"] || ""
          ).localeCompare(
            String(
              a.selfMatch["日付"] || ""
            )
          );

        if (dateCompare !== 0) {
          return dateCompare;
        }

        return (
          Number(
            getMatchNo(b.selfMatch)
          ) || 0
        ) - (
          Number(
            getMatchNo(a.selfMatch)
          ) || 0
        );
      });
  }


  function renderHeadToHeadResult(
    opponent
  ) {
    if (!headToHeadResult) {
      return;
    }

    const directMatches =
      getHeadToHeadMatches(
        opponent.id
      );

    if (headToHeadTapNote) {
      headToHeadTapNote.hidden =
        directMatches.length === 0;
    }

    let wins = 0;
    let losses = 0;
    let draws = 0;

    directMatches.forEach(item => {
      const selfScore =
        toNumber(
          item.selfMatch["スコア"]
        );

      const opponentScore =
        toNumber(
          item.opponentMatch["スコア"]
        );

      if (
        selfScore === null ||
        opponentScore === null ||
        selfScore === opponentScore
      ) {
        draws++;
      } else if (selfScore > opponentScore) {
        wins++;
      } else {
        losses++;
      }
    });

    headToHeadResult.innerHTML = `
      <div class="player-head-to-head-summary">

        <div class="player-head-to-head-versus">
          <strong>${escapeHtml(displayPlayerName)}</strong>
          <span>VS</span>
          <strong>${escapeHtml(opponent.name)}</strong>
        </div>

        <div class="player-head-to-head-record">
          <span>${directMatches.length}戦</span>
          <strong>${wins}勝</strong>
          <span>${losses}敗</span>
          ${
            draws > 0
              ? `<span>${draws}分</span>`
              : ""
          }
        </div>

      </div>

      ${
        directMatches.length === 0
          ? `
            <p class="player-head-to-head-empty">
              ${escapeHtml(opponent.name)}選手との対戦記録はありません。
            </p>
          `
          : `
            <div class="player-head-to-head-list">
              ${directMatches.map((item, index) => {
                const selfScore =
                  toNumber(
                    item.selfMatch["スコア"]
                  );

                const opponentScore =
                  toNumber(
                    item.opponentMatch["スコア"]
                  );

                const resultClass =
                  selfScore === null ||
                  opponentScore === null ||
                  selfScore === opponentScore
                    ? "is-draw"
                    : selfScore > opponentScore
                      ? "is-win"
                      : "is-loss";

                const resultText =
                  resultClass === "is-win"
                    ? "勝"
                    : resultClass === "is-loss"
                      ? "負"
                      : "分";

                return `
                  <button
                    type="button"
                    class="player-head-to-head-match ${resultClass}"
                    data-head-to-head-index="${index}"
                  >
                    <span class="player-head-to-head-date">
                      ${escapeHtml(
                        item.selfMatch["日付"] || "日付不明"
                      )}
                    </span>

                    <span class="player-head-to-head-result">
                      ${resultText}
                    </span>

                    <span class="player-head-to-head-score">
                      <span>
                        <span class="player-head-to-head-name">
                          ${escapeHtml(displayPlayerName)}
                        </span>
                        <b>${formatPlacement(item.selfMatch["着順"])}</b>
                        <strong>${formatScore(item.selfMatch["スコア"])}</strong>
                      </span>

                      <span class="player-head-to-head-score-divider">
                        VS
                      </span>

                      <span>
                        <span class="player-head-to-head-name">
                          ${escapeHtml(opponent.name)}
                        </span>
                        <b>${formatPlacement(item.opponentMatch["着順"])}</b>
                        <strong>${formatScore(item.opponentMatch["スコア"])}</strong>
                      </span>
                    </span>
                  </button>
                `;
              }).join("")}
            </div>
          `
      }
    `;

    headToHeadResult
      .querySelectorAll(
        ".player-head-to-head-match"
      )
      .forEach(button => {
        button.addEventListener(
          "click",
          () => {
            const index =
              Number(
                button.dataset
                  .headToHeadIndex
              );

            const selected =
              directMatches[index];

            if (selected) {
              openMatchDetail(
                selected.selfMatch
              );
            }
          }
        );
      });
  }


  function initializeHeadToHeadSearch() {
    if (
      !headToHeadSearchInput ||
      !headToHeadSearchResults ||
      headToHeadSearchInput.dataset
        .initialized === "true"
    ) {
      return;
    }

    headToHeadSearchInput.dataset
      .initialized = "true";

    const opponents =
      getHeadToHeadPlayers();

    let visibleOpponents = [];

    const closeSearchResults = () => {
      headToHeadSearchResults.innerHTML = "";
      headToHeadSearchResults.classList.remove(
        "is-open"
      );
      visibleOpponents = [];
    };

    const selectOpponent = opponent => {
      headToHeadSearchInput.value =
        opponent.name;

      closeSearchResults();
      renderHeadToHeadResult(opponent);
    };

    const showSearchResults = keyword => {
      const searchText =
        HLDB.normalizeSearchText(
          keyword
        );

      if (!searchText) {
        closeSearchResults();
        return;
      }

      visibleOpponents =
        opponents
          .filter(opponent => {
            return [...opponent.searchNames]
              .some(name =>
                HLDB.normalizeSearchText(
                  name
                ).includes(searchText)
              );
          })
          .slice(0, 10);

      headToHeadSearchResults.innerHTML =
        visibleOpponents.length > 0
          ? visibleOpponents.map((opponent, index) => `
              <button
                type="button"
                data-opponent-index="${index}"
              >
                ${escapeHtml(opponent.name)}
              </button>
            `).join("")
          : `
              <p>該当する選手がいません。</p>
            `;

      headToHeadSearchResults.classList.add(
        "is-open"
      );
    };

    headToHeadSearchInput.addEventListener(
      "input",
      event => {
        showSearchResults(
          event.target.value
        );
      }
    );

    headToHeadSearchInput.addEventListener(
      "keydown",
      event => {
        if (
          event.key === "Enter" &&
          visibleOpponents[0]
        ) {
          event.preventDefault();
          selectOpponent(
            visibleOpponents[0]
          );
        }

        if (event.key === "Escape") {
          closeSearchResults();
        }
      }
    );

    headToHeadSearchResults.addEventListener(
      "click",
      event => {
        const button =
          event.target.closest(
            "[data-opponent-index]"
          );

        if (!button) {
          return;
        }

        const opponent =
          visibleOpponents[
            Number(
              button.dataset.opponentIndex
            )
          ];

        if (opponent) {
          selectOpponent(opponent);
        }
      }
    );

    document.addEventListener(
      "click",
      event => {
        if (
          event.target ===
            headToHeadSearchInput ||
          headToHeadSearchResults.contains(
            event.target
          )
        ) {
          return;
        }

        closeSearchResults();
      }
    );
  }


  /* ========================================
     試合履歴
  ======================================== */
  
  function renderPlayerMatches() {
    const selectedMatches =
      getSelectedMatches();
  
    if (selectedMatches.length === 0) {
      playerMatches.innerHTML = `
        <p class="no-data-message">
          選択した条件の試合履歴はありません。
        </p>
      `;
  
      return;
    }
  
    playerMatches.innerHTML = `
  <div class="matches-table-wrapper">

    <table class="match-history-table">

      <thead>
        <tr>
          <th>日付</th>
          <th>着順</th>
          <th>スコア</th>
          <th>得点</th>
          <th>ステージ</th>
        </tr>
      </thead>

      <tbody>

        ${selectedMatches.map(
          (match, index) => `
            <tr
              class="player-match-row"
              data-match-index="${index}"
              tabindex="0"
              role="button"
              aria-label="対局詳細を表示"
            >

              <td class="match-date">
                ${escapeHtml(
                  match["日付"] || "―"
                )}
              </td>

              <td>
                ${formatPlacement(
                  match["着順"]
                )}
              </td>

              <td>
                ${formatScore(
                  match["スコア"]
                )}
              </td>

              <td>
                ${
                  toNumber(
                    match["得点"]
                  ) !== null
                    ? `${formatInteger(
                        match["得点"]
                      )}点`
                    : "―"
                }
              </td>

              <td>
                <span
                  class="stage-badge ${getStageClass(
                    match["ステージ"]
                  )}"
                >
                  ${escapeHtml(
                    displayStageName(
                      match["ステージ"]
                    )
                  )}
                </span>
              </td>

            </tr>
          `
        ).join("")}

      </tbody>

    </table>

  </div>
`;
  
    playerMatches
      .querySelectorAll(
        ".player-match-row"
      )
      .forEach(row => {
        const openDetail = () => {
          const index =
            Number(
              row.dataset.matchIndex
            );
  
          const match =
            selectedMatches[index];
  
          if (match) {
            openMatchDetail(match);
          }
        };
  
        row.addEventListener(
          "click",
          openDetail
        );
  
        row.addEventListener(
          "keydown",
          event => {
            if (
              event.key === "Enter" ||
              event.key === " "
            ) {
              event.preventDefault();
              openDetail();
            }
          }
        );
      });
  }
  
  
  /* ========================================
     対局詳細ポップアップ
  ======================================== */
  
  function getMatchNo(match) {
    return String(
      match["試合No"] ||
      match["試合No."] ||
      match["試合NO"] ||
      match["試合NO."] ||
      ""
    ).trim();
  }
  
  
  function getSameTableMatches(
    selectedMatch
  ) {
    const selectedYear =
      normalizeYear(
        selectedMatch["年度"]
      );
  
    const selectedMatchNo =
      getMatchNo(selectedMatch);
  
    const selectedDate =
      String(
        selectedMatch["日付"] || ""
      ).trim();
  
    const selectedTime =
      String(
        selectedMatch["時間"] || ""
      ).trim();
  
    const selectedLeague =
      normalizeLeague(
        selectedMatch["リーグ"]
      );

    const selectedStage =
      normalizeStage(
        selectedMatch["ステージ"]
      );
  
    return matchesData
      .filter(match => {
        const sameYear =
          normalizeYear(
            match["年度"]
          ) === selectedYear;
  
        const sameLeague =
          !selectedLeague ||
          normalizeLeague(
            match["リーグ"]
          ) === selectedLeague;

        const sameStage =
          !selectedStage ||
          normalizeStage(
            match["ステージ"]
          ) === selectedStage;
  
        const matchNo =
          getMatchNo(match);
  
        if (
          selectedMatchNo !== "" &&
          matchNo !== ""
        ) {
          return (
            sameYear &&
            sameLeague &&
            sameStage &&
            matchNo === selectedMatchNo
          );
        }
  
        return (
          sameYear &&
          sameLeague &&
          sameStage &&
          String(
            match["日付"] || ""
          ).trim() === selectedDate &&
          String(
            match["時間"] || ""
          ).trim() === selectedTime
        );
      })
      .sort((a, b) => {
        return (
          (toNumber(a["着順"]) ?? 9999) -
          (toNumber(b["着順"]) ?? 9999)
        );
      });
  }
  
  
  function getMatchMedal(placement) {
    const number =
      toNumber(placement);
  
    if (number >= 1 && number <= 4) {
      return `<span class="rank-medal-badge rank-medal-${number}" aria-label="${number}着">${number}</span>`;
    }
  
    return "―";
  }


  function normalizeMatchDate(value) {
    return String(value || "")
      .match(/\d+/g)
      ?.slice(0, 3)
      .map((part, index) =>
        index === 0
          ? part.padStart(4, "0")
          : part.padStart(2, "0")
      )
      .join("-") || "";
  }


  function getProgressRows(selectedMatch, tableMatches) {
    if (!pointProgressData.length) return [];

    const selectedDate = normalizeMatchDate(
      selectedMatch["日付"]
    );
    const selectedTime = String(
      selectedMatch["時間"] || ""
    ).trim();
    const selectedLeague = normalizeLeague(
      selectedMatch["リーグ"]
    );
    const selectedStage = normalizeStage(
      selectedMatch["ステージ"]
    );
    const selectedIds = new Set(
      tableMatches
        .map(match => String(match["選手ID"] || "").trim())
        .filter(Boolean)
    );
    const selectedNames = new Set(
      tableMatches
        .map(match => String(match["選手名"] || "").trim())
        .filter(Boolean)
    );
    const groups = new Map();

    pointProgressData.forEach(row => {
      const key = String(row["対局キー"] || "").trim();
      if (!key) return;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    });

    let best = null;

    groups.forEach(rows => {
      const first = rows[0];
      const rawDateTime = String(first["対局日時"] || "").trim();
      if (normalizeMatchDate(rawDateTime) !== selectedDate) return;

      let score = 5;
      if (
        selectedLeague &&
        normalizeLeague(first["リーグ"]) === selectedLeague
      ) score += 2;
      if (
        selectedStage &&
        normalizeStage(first["シーズン"]) === selectedStage
      ) score += 2;
      if (
        selectedTime &&
        rawDateTime.includes(selectedTime)
      ) score += 5;

      const rawIds = new Set(
        [1, 2, 3, 4]
          .map(index => String(first[`選手${index}ID`] || "").trim())
          .filter(Boolean)
      );
      const rawNames = new Set(
        [1, 2, 3, 4]
          .flatMap(index => [
            String(first[`選手${index}公式名`] || "").trim(),
            String(first[`選手${index}`] || "").trim()
          ])
          .filter(Boolean)
      );
      const idMatches = [...selectedIds]
        .filter(id => rawIds.has(id)).length;
      const nameMatches = [...selectedNames]
        .filter(name => rawNames.has(name)).length;

      score += idMatches * 4 + nameMatches * 2;

      if (
        (idMatches >= 3 || nameMatches >= 3) &&
        (!best || score > best.score)
      ) {
        best = { score, rows };
      }
    });

    return (best?.rows || []).sort(
      (a, b) =>
        (toNumber(a["局順"]) ?? 999) -
        (toNumber(b["局順"]) ?? 999)
    );
  }


  function renderPointProgressGraph(rows, tableMatches) {
    if (!rows.length) return "";

    const first = rows[0];
    const officialFinalPointsById = new Map(
      tableMatches
        .map(match => [
          String(match["選手ID"] || "").trim(),
          toNumber(match["得点"])
        ])
        .filter(([id, points]) => id && points !== null)
    );
    const officialFinalPointsByName = new Map(
      tableMatches
        .map(match => [
          String(match["選手名"] || "").trim(),
          toNumber(match["得点"])
        ])
        .filter(([name, points]) => name && points !== null)
    );
    const colors = ["#d4af37", "#8fa8cf", "#67b63d", "#b070d1"];
    const series = [1, 2, 3, 4].map((index, seriesIndex) => {
      const id = String(first[`選手${index}ID`] || "").trim();
      const name = String(
        first[`選手${index}公式名`] ||
        first[`選手${index}`] ||
        `選手${index}`
      ).trim();
      const officialFinalPoints =
        officialFinalPointsById.get(id) ??
        officialFinalPointsByName.get(name) ??
        null;
      const progressValues = rows.map(row =>
        toNumber(row[`終了点${index}`]) ?? 0
      );
      if (officialFinalPoints !== null && progressValues.length) {
        progressValues[progressValues.length - 1] = officialFinalPoints;
      }
      return {
        id,
        name,
        color: colors[seriesIndex],
        values: [
          toNumber(first[`開始点${index}`]) ?? 25000,
          ...progressValues
        ]
      };
    });
    const values = series.flatMap(item => item.values);
    const startPoint = 25000;
    const maxDeviation = Math.max(
      ...values.map(value =>
        Math.abs(value - startPoint)
      )
    );
    const axisHalfRange = Math.max(
      6000,
      maxDeviation * 1.12
    );
    const min = startPoint - axisHalfRange;
    const max = startPoint + axisHalfRange;
    const width = 720;
    const height = 300;
    const left = 64;
    const right = 20;
    const top = 24;
    const bottom = 42;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;
    const count = rows.length + 1;
    const x = index =>
      left + (count <= 1 ? 0 : (plotWidth * index) / (count - 1));
    const y = value =>
      top + plotHeight - ((value - min) / (max - min || 1)) * plotHeight;
    const guides = [0, 0.5, 1].map(ratio => {
      const value = max - (max - min) * ratio;
      const py = top + plotHeight * ratio;
      const middleClass = ratio === 0.5 ? " is-start-line" : "";
      return `<g><line x1="${left}" y1="${py}" x2="${width - right}" y2="${py}" class="progress-grid-line${middleClass}"/><text x="${left - 10}" y="${py + 4}" class="progress-axis-label${middleClass}" text-anchor="end">${formatInteger(Math.round(value))}</text></g>`;
    }).join("");
    const verticals = Array.from({ length: count }, (_, index) =>
      `<line x1="${x(index)}" y1="${top}" x2="${x(index)}" y2="${top + plotHeight}" class="progress-grid-line is-vertical"/>`
    ).join("");
    const labels = Array.from({ length: count }, (_, index) => {
      const label = index === 0 ? "開始" : String(rows[index - 1]["局順"] || index);
      return `<text x="${x(index)}" y="${height - 14}" class="progress-x-label" text-anchor="middle">${escapeHtml(label)}</text>`;
    }).join("");
    const lines = series.map(item => {
      const points = item.values
        .map((value, index) => `${x(index)},${y(value)}`)
        .join(" ");
      const dots = item.values.map((value, index) =>
        `<circle cx="${x(index)}" cy="${y(value)}" r="3.5" fill="${item.color}"/>`
      ).join("");
      return `<polyline points="${points}" fill="none" stroke="${item.color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${dots}`;
    }).join("");

    return `
      <section class="match-progress-section">
        <h3>点数推移</h3>
        <div class="match-progress-legend">
          ${series.map(item => `
            <span><i style="--series-color:${item.color}"></i>${escapeHtml(item.name)}</span>
          `).join("")}
        </div>
        <div class="match-progress-scroll">
          <svg class="match-progress-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="局ごとの点数推移">
            ${guides}${verticals}${labels}${lines}
          </svg>
        </div>
      </section>
    `;
  }


  function renderEnhancedMatchDetail(tableMatches, progressRows) {
    const last = progressRows[progressRows.length - 1];
    const first = progressRows[0];
    const playerIndexById = new Map(
      [1, 2, 3, 4].map(index => [
        String(first[`選手${index}ID`] || "").trim(),
        index
      ])
    );
    const playerIndexByName = new Map(
      [1, 2, 3, 4].flatMap(index => [
        [String(first[`選手${index}公式名`] || "").trim(), index],
        [String(first[`選手${index}`] || "").trim(), index]
      ])
    );
    const drawCount = progressRows.filter(row =>
      String(row["結果区分"] || "").includes("流局")
    ).length;
    const countPlayerInField = (fieldName, names) =>
      progressRows.filter(row => {
        const tokens = String(row[fieldName] || "")
          .split(/[\/／・,、|｜]/)
          .map(value => value.trim())
          .filter(Boolean);
        return names.some(name => tokens.includes(name));
      }).length;

    return `
      <div class="match-broadcast-summary">
        <strong>総局数 / ${progressRows.length}局</strong>
        <span>（流局数 / ${drawCount}局）</span>
      </div>
      <div class="match-broadcast-results">
        <div class="match-broadcast-head" aria-hidden="true">
          <span>順位</span><span>選手</span><span>最終持ち点</span><span>リーチ回数</span><span>和了回数</span><span>放銃回数</span>
        </div>
        ${tableMatches.map(match => {
          const id = String(match["選手ID"] || "").trim();
          const name = String(match["選手名"] || "").trim();
          const index = playerIndexById.get(id) || playerIndexByName.get(name);
          // The hand-history feed can leave an unclaimed riichi stick in its
          // last-row total. Use the official match result for the settled score.
          const finalPoints =
            toNumber(match["得点"]) ??
            (index ? toNumber(last[`終了点${index}`]) : null);
          const rawName = index ? String(first[`選手${index}`] || "").trim() : "";
          const officialName = index ? String(first[`選手${index}公式名`] || "").trim() : "";
          const matchNames = [...new Set([name, rawName, officialName].filter(Boolean))];
          const riichiCount = countPlayerInField("リーチ者", matchNames);
          const winCount = countPlayerInField("和了者", matchNames);
          const dealInCount = countPlayerInField("放銃者", matchNames);
          const placement = toNumber(match["着順"]) || 4;
          const playerQuery = new URLSearchParams({
            id,
            player: name,
            year: normalizeYear(match["年度"]),
            league: match["リーグ"] || "",
            stage: match["ステージ"] || ""
          });
          const playerUrl = `player.html?${playerQuery.toString()}`;
          return `
            <article class="match-broadcast-row rank-tone-${placement} ${id && id === currentPlayerId ? "is-current-player" : ""}">
              <div class="match-broadcast-rank">${getMatchMedal(match["着順"])}</div>
              <div class="match-broadcast-player"><a href="${playerUrl}">${escapeHtml(name || "―")}</a><span>${escapeHtml(match["チーム名"] || "―")}</span></div>
              <div class="match-broadcast-points"><strong>${finalPoints !== null ? `${formatInteger(finalPoints)}点` : "―"}</strong><span class="${toNumber(match["スコア"]) < 0 ? "is-negative" : ""}">${formatScore(match["スコア"])}</span></div>
              <div class="match-broadcast-stat"><strong>${riichiCount}</strong><span>回</span></div>
              <div class="match-broadcast-stat"><strong>${winCount}</strong><span>回</span></div>
              <div class="match-broadcast-stat"><strong>${dealInCount}</strong><span>回</span></div>
            </article>
          `;
        }).join("")}
      </div>
      ${renderPointProgressGraph(progressRows, tableMatches)}
    `;
  }
  
  
  function openMatchDetail(
    selectedMatch
  ) {
    const modal =
      document.getElementById(
        "matchDetailModal"
      );
  
    const title =
      document.getElementById(
        "matchDetailTitle"
      );
  
    const body =
      document.getElementById(
        "matchDetailBody"
      );
  
    if (
      !modal ||
      !title ||
      !body
    ) {
      console.error(
        "対局詳細モーダルのHTMLが見つかりません。"
      );
  
      return;
    }
  
    const tableMatches =
      getSameTableMatches(
        selectedMatch
      );
  
    const year =
      normalizeYear(
        selectedMatch["年度"]
      );
  
    const matchNo =
      getMatchNo(selectedMatch);
  
    const date =
      String(
        selectedMatch["日付"] || ""
      ).trim();
  
    const time =
      String(
        selectedMatch["時間"] || ""
      ).trim();
  
    const stage =
      displayStageName(
        selectedMatch["ステージ"]
      );
  
    title.textContent =
      matchNo
        ? `${year}年 第${matchNo}試合`
        : `${year}年 対局詳細`;
  
    if (tableMatches.length === 0) {
      body.innerHTML = `
        <p class="no-data-message">
          同卓データが見つかりませんでした。
        </p>
      `;
    } else {
      const progressRows = getProgressRows(
        selectedMatch,
        tableMatches
      );

      body.innerHTML = progressRows.length
        ? `
          <div class="match-detail-meta">
            <span>${escapeHtml(date || "日付不明")}</span>
            ${time ? `<span>${escapeHtml(time)}</span>` : ""}
            <span class="stage-badge ${getStageClass(selectedMatch["ステージ"])}">${escapeHtml(stage)}</span>
          </div>
          ${renderEnhancedMatchDetail(tableMatches, progressRows)}
        `
        : `
        <div class="match-detail-meta">
  
          <span>
            ${escapeHtml(
              date || "日付不明"
            )}
          </span>
  
          ${
            time
              ? `
                <span>
                  ${escapeHtml(time)}
                </span>
              `
              : ""
          }
  
          <span
            class="stage-badge ${getStageClass(
              selectedMatch["ステージ"]
            )}"
          >
            ${escapeHtml(stage)}
          </span>
  
        </div>
  
        <div class="match-detail-results">
  
          ${tableMatches.map(match => {
            const matchPlayerName =
              String(
                match["選手名"] || ""
              ).trim();
  
            const query =
              new URLSearchParams({
                player:
                  matchPlayerName,
                year:
                  normalizeYear(
                    match["年度"]
                  ),
                league:
                  match["リーグ"] || "",
                stage:
                  match["ステージ"] || ""
              });
  
            const playerUrl =
              `player.html?${query.toString()}`;
  
            return `
              <article
                class="match-detail-player ${
                  matchPlayerName === playerName
                    ? "is-current-player"
                    : ""
                }"
              >
  
                <div class="match-detail-rank">
                  ${getMatchMedal(
                    match["着順"]
                  )}
                </div>
  
                <div class="match-detail-player-info">
  
                  <a href="${playerUrl}">
                    ${escapeHtml(
                      matchPlayerName || "―"
                    )}
                  </a>
  
                  <span>
                    ${escapeHtml(
                      match["チーム名"] || "―"
                    )}
                  </span>
  
                </div>
  
                <div class="match-detail-score">
  
                  <strong>
                    ${formatScore(
                      match["スコア"]
                    )}
                  </strong>
  
                  <span>
                    ${
                      toNumber(
                        match["得点"]
                      ) !== null
                        ? `${formatInteger(
                            match["得点"]
                          )}点`
                        : "―"
                    }
                  </span>
  
                </div>
  
              </article>
            `;
          }).join("")}
  
        </div>
      `;
    }
  
    modal.classList.add(
      "is-open"
    );
  
    modal.setAttribute(
      "aria-hidden",
      "false"
    );
  
    document.body.classList.add(
      "modal-open"
    );
    if (window.lucide) {
      lucide.createIcons();
    }
    if (!pointProgressLoaded) {
      ensurePointProgressData().then(() => {
        if (modal.classList.contains("is-open")) {
          openMatchDetail(selectedMatch);
        }
      });
    }
  }
  
  
  function closeMatchDetail() {
    const modal =
      document.getElementById(
        "matchDetailModal"
      );
  
    if (!modal) {
      return;
    }
  
    modal.classList.remove(
      "is-open"
    );
  
    modal.setAttribute(
      "aria-hidden",
      "true"
    );
  
    document.body.classList.remove(
      "modal-open"
    );
  }
  
  
  function initializeMatchDetailModal() {
    document
      .querySelectorAll(
        "[data-close-match-modal]"
      )
      .forEach(element => {
        element.addEventListener(
          "click",
          closeMatchDetail
        );
      });
  
    document.addEventListener(
      "keydown",
      event => {
        if (event.key === "Escape") {
          closeMatchDetail();
        }
      }
    );
  }
  
  
  /* ========================================
     選手ページ全体を表示
  ======================================== */
  
  function renderPlayerPage() {
    renderPlayerInfo();
    renderPlayerAwards();
    initializeHeadToHeadSearch();
    renderPlayerMatches();
  }


/* ========================================
   データ読み込み
======================================== */

async function loadPointProgressData() {
  try {
    const response = await fetch(
      POINT_PROGRESS_CSV_URL,
      { cache: "no-store" }
    );

    if (!response.ok) {
      throw new Error(`Status: ${response.status}`);
    }

    return parseCsv(await response.text());
  } catch (error) {
    console.warn(
      "点数推移CSVを読み込めないため、従来の試合詳細を表示します。",
      error
    );
    return [];
  }
}

function ensurePointProgressData() {
  if (pointProgressLoaded) return Promise.resolve(pointProgressData);
  if (!pointProgressLoadPromise) {
    pointProgressLoadPromise = loadPointProgressData().then(rows => {
      pointProgressData = rows;
      pointProgressLoaded = true;
      return rows;
    });
  }
  return pointProgressLoadPromise;
}

async function loadPlayerDetail() {
    try {
      if (!playerId && !playerName) {
        playerInfo.innerHTML = `
          <p class="no-data-message">
            選手が指定されていません。
          </p>
  
          <p class="back-link-area">
            <a href="index.html">
              ← 順位表へ戻る
            </a>
          </p>
        `;
  
        playerMatches.innerHTML = "";
  
        const playerAwards =
          document.getElementById("playerAwards");
  
        if (playerAwards) {
          playerAwards.innerHTML = "";
        }
  
        return;
      }
  
      [
        playersData,
        matchesData,
        awardsData,
        playerAliasData
      ] = await Promise.all([
        HLDB.loadData("players"),
        HLDB.loadData("matches"),
        HLDB.loadData("awards"),
        HLDB.loadData("playerAlias")
      ]);
      
      
      /*
  URLでID指定されている場合はそのまま使用。
  旧URL(player=)の場合はAliasからIDを取得。
*/
if (playerId) {
  currentPlayerId = playerId;
} else {
  currentPlayerId =
    HLDB.getPlayerIdFromAlias(
      playerName,
      playerAliasData
    );
}

updateDetailedStatsButton();
      
      
      /*
        PlayerAliasに登録されていない選手は、
        従来どおり本人の名前だけを使用
      */
      if (currentPlayerId) {
        currentPlayerAliasNames =
          HLDB.getPlayerAliasNames(
            currentPlayerId,
            playerAliasData
          );
      } else {
        currentPlayerAliasNames = [
          String(playerName).trim()
        ];
      }
      
      /*
        念のためURLで開いた名前も検索対象へ含める
      */
      if (
        playerName &&
        !currentPlayerAliasNames.includes(
          String(playerName).trim()
        )
      ) {
        currentPlayerAliasNames.push(
          String(playerName).trim()
        );
      }
      
      console.log(
        "選手統合情報:",
        {
          playerName,
          currentPlayerId,
          currentPlayerAliasNames
        }
      );
      currentPlayerRecords =
  playersData
    .filter(row =>
      String(row["選手ID"] || "").trim() ===
        currentPlayerId
    )
    .sort((a, b) =>
      Number(normalizeYear(b["年度"])) -
      Number(normalizeYear(a["年度"]))
    );

const currentPlayer =
  currentPlayerRecords[0];

displayPlayerName =
  currentPlayer?.["選手名"] ||
  currentPlayerAliasNames[
    currentPlayerAliasNames.length - 1
  ] ||
  playerName;
  
      const years =
        getPlayerYears();
  
      if (years.length === 0) {
        playerInfo.innerHTML = `
          <p class="no-data-message">
            該当する選手データが見つかりませんでした。
          </p>
        `;
  
        playerMatches.innerHTML = "";
  
        const playerAwards =
          document.getElementById("playerAwards");
  
        if (playerAwards) {
          playerAwards.innerHTML = `
            <p class="no-data-message">
              受賞歴はありません。
            </p>
          `;
        }
  
        return;
      }
  
      const normalizedUrlYear =
        normalizeYear(urlYear);
  
      activeYear =
        years.includes(normalizedUrlYear)
          ? normalizedUrlYear
          : years[0];
  
      activeLeague =
        getLeagueForYear(activeYear);
  
        activeStage = "ALL";

        renderPlayerPage();
        updateFavoriteButton();
        
        } catch (error) {
      console.error(
        "選手詳細読込エラー:",
        error
      );
  
      playerInfo.innerHTML = `
        <p class="no-data-message">
          選手データを読み込めませんでした。
        </p>
      `;
  
      playerMatches.innerHTML = `
        <p class="no-data-message">
          試合履歴を読み込めませんでした。
        </p>
      `;
  
      const playerAwards =
        document.getElementById("playerAwards");
  
      if (playerAwards) {
        playerAwards.innerHTML = `
          <p class="no-data-message">
            受賞歴を読み込めませんでした。
          </p>
        `;
      }
    }
  }


/* ========================================
   お気に入り
======================================== */

function getFavoritePlayers() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(
        "hldbFavoritePlayers"
      ) || "[]"
    );

    return saved
      .map(item => {
        /*
          旧形式：
          "サヴェ松田"
        */
        if (typeof item === "string") {
          return {
            id: "",
            name: item
          };
        }

        /*
          新形式：
          {
            id: "P0086",
            name: "サヴェ松田"
          }
        */
        return {
          id: String(
            item?.id || ""
          ).trim(),

          name: String(
            item?.name || ""
          ).trim()
        };
      })
      .filter(item =>
        item.id || item.name
      );

  } catch {
    return [];
  }
}


function saveFavoritePlayers(players) {
  const uniquePlayers = [];

  players.forEach(player => {
    const id =
      String(
        player?.id || ""
      ).trim();

    const name =
      String(
        player?.name || ""
      ).trim();

    const alreadyExists =
      uniquePlayers.some(item =>
        id
          ? item.id === id
          : item.name === name
      );

    if (
      !alreadyExists &&
      (id || name)
    ) {
      uniquePlayers.push({
        id,
        name
      });
    }
  });

  localStorage.setItem(
    "hldbFavoritePlayers",
    JSON.stringify(uniquePlayers)
  );
}


function isFavoritePlayer() {
  return getFavoritePlayers()
    .some(item => {
      const idMatches =
        currentPlayerId &&
        item.id &&
        item.id === currentPlayerId;

      const nameMatches =
        item.name === displayPlayerName ||
        item.name === playerName;

      return idMatches || nameMatches;
    });
}


function updateFavoriteButton() {
  if (
    !favoriteButton ||
    (!currentPlayerId && !displayPlayerName)
  ) {
    return;
  }

  const isFavorite =
    isFavoritePlayer();

  favoriteButton.innerHTML = `
    <i data-lucide="star" class="ui-icon"></i>
    ${
      isFavorite
        ? "お気に入り登録済み"
        : "お気に入りに追加"
    }
  `;

  favoriteButton.classList.toggle(
    "is-favorite",
    isFavorite
  );

  if (window.lucide) {
    window.lucide.createIcons();
  }
}


function toggleFavoritePlayer() {
  if (
    !currentPlayerId &&
    !displayPlayerName
  ) {
    return;
  }

  const favorites =
    getFavoritePlayers();

  const isFavorite =
    isFavoritePlayer();

    const updatedFavorites =
    isFavorite
      ? favorites.filter(item => {
          const idMatches =
            currentPlayerId &&
            item.id &&
            item.id === currentPlayerId;
  
          const nameMatches =
            item.name === displayPlayerName ||
            item.name === playerName;
  
          return !idMatches && !nameMatches;
        })
      : [
          ...favorites,
          {
            id: currentPlayerId,
            name: displayPlayerName
          }
        ];

  saveFavoritePlayers(
    updatedFavorites
  );

  updateFavoriteButton();
}


favoriteButton?.addEventListener(
  "click",
  toggleFavoritePlayer
);


/* ========================================
   初期実行
======================================== */

initializeMatchDetailModal();
loadPlayerDetail();
