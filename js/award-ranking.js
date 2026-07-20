/* ========================================
   個人賞・全ランキング
======================================== */

const params =
  new URLSearchParams(window.location.search);

const selectedYear =
  HLDB.normalizeYear(
    params.get("year") || ""
  );

const selectedLeague =
  HLDB.normalizeLeague(
    params.get("league") || ""
  );

const selectedCategory =
  String(
    params.get("category") || ""
  ).trim();

const awardRankingTitle =
  document.getElementById(
    "awardRankingTitle"
  );

const awardRankingSeason =
  document.getElementById(
    "awardRankingSeason"
  );

const awardRankingArea =
  document.getElementById(
    "awardRankingArea"
  );

let playersData = [];
let matchesData = [];


/* ========================================
   数値変換
======================================== */

function toNumber(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const normalized =
    String(value)
      .replace(/,/g, "")
      .replace(/%/g, "")
      .replace(/pt/gi, "")
      .replace(/点/g, "")
      .replace(/勝/g, "")
      .trim();

  const number = Number(normalized);

  return Number.isFinite(number)
    ? number
    : null;
}


/* ========================================
   部門名を判定
======================================== */

function getCategoryType(category) {
  const name = String(category || "");

  if (
    name.includes("MVP") ||
    name.includes("ポイント")
  ) {
    return "point";
  }

  if (name.includes("ラス回避")) {
    return "avoid";
  }

  if (name.includes("最多勝利")) {
    return "wins";
  }

  if (name.includes("最高得点")) {
    return "high-score";
  }

  if (name.includes("トップ率")) {
    return "top-rate";
  }

  return "";
}


/* ========================================
   表示用部門名
======================================== */

function getCategoryTitle(type) {
  switch (type) {
    case "point":
      return "MVPランキング";

    case "avoid":
      return "ラス回避率ランキング";

    case "wins":
      return "最多勝利ランキング";

    case "high-score":
      return "最高得点ランキング";

    case "top-rate":
      return "トップ率ランキング";

    default:
      return "個人賞ランキング";
  }
}


/* ========================================
   メダル
======================================== */

function getRankDisplay(rank) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";

  return `${rank}位`;
}


/* ========================================
   選手URL
======================================== */

function createPlayerUrl(player) {
  return HLDB.createPlayerUrl({
    id: player["選手ID"],
    year: player["年度"],
    league: player["リーグ"],
    stage: player["ステージ"]
  });
}


/* ========================================
   数値表示
======================================== */

function formatRankingValue(
  player,
  categoryType
) {
  switch (categoryType) {
    case "point":
      return `${
        HLDB.formatDecimal(
          toNumber(player["ポイント"]) ?? 0
        )
      } pt`;

    case "top-rate":
      return HLDB.formatPercent(
        player["トップ率"]
      );

    case "avoid":
      return HLDB.formatPercent(
        player["ラス回避率"]
      );

      case "wins": {
        const wins =
          toNumber(
            player["トップ数"]
          ) ?? 0;
      
        return `${wins}勝`;
      }

    case "high-score": {
      const score =
        toNumber(
          player["最高得点"]
        ) ?? 0;

      return `${Math.round(
        score
      ).toLocaleString()}点`;
    }

    default:
      return "―";
  }
}


/* ========================================
   対象年度・リーグの選手を取得
======================================== */

function getFilteredPlayers() {
  return playersData.filter(player => {
    const rowYear =
      HLDB.normalizeYear(
        player["年度"]
      );

    const rowLeague =
      HLDB.normalizeLeague(
        player["リーグ"]
      );

    const rowStage =
      HLDB.normalizeStage(
        player["ステージ"]
      );

    const playerName =
      String(
        player["選手名"] || ""
      ).trim();

    return (
      rowYear === selectedYear &&
      rowLeague === selectedLeague &&
      rowStage === "レギュラー" &&
      playerName !== ""
    );
  });
}


/* ========================================
   ランキング並び替え
======================================== */

function sortPlayers(
  players,
  categoryType
) {
  return [...players].sort((a, b) => {
    const aGames =
      toNumber(a["試合数"]) ?? 0;

    const bGames =
      toNumber(b["試合数"]) ?? 0;

    const aPoint =
      toNumber(a["ポイント"]) ?? 0;

    const bPoint =
      toNumber(b["ポイント"]) ?? 0;

    if (categoryType === "point") {
      return (
        bPoint - aPoint ||
        bGames - aGames
      );
    }

    if (categoryType === "top-rate") {
      const aValue =
        toNumber(a["トップ率"]) ?? 0;

      const bValue =
        toNumber(b["トップ率"]) ?? 0;

      return (
        bValue - aValue ||
        bGames - aGames ||
        bPoint - aPoint
      );
    }

    if (categoryType === "avoid") {
      const aValue =
        toNumber(a["ラス回避率"]) ?? 0;

      const bValue =
        toNumber(b["ラス回避率"]) ?? 0;

      return (
        bValue - aValue ||
        bGames - aGames ||
        bPoint - aPoint
      );
    }

    if (categoryType === "wins") {
        const aWins =
          toNumber(
            a["トップ数"]
          ) ?? 0;
      
        const bWins =
          toNumber(
            b["トップ数"]
          ) ?? 0;
      
        return (
          bWins - aWins ||   // トップ数が多い方が上
          aGames - bGames || // 同数なら試合数が少ない方が上
          bPoint - aPoint    // それも同じならポイント順
        );
      }

    if (categoryType === "high-score") {
      const aScore =
        toNumber(a["最高得点"]) ?? 0;

      const bScore =
        toNumber(b["最高得点"]) ?? 0;

      return (
        bScore - aScore ||
        bPoint - aPoint
      );
    }

    return 0;
  });
}


/* ========================================
   ランキング表示
======================================== */

function renderRanking() {
  const categoryType =
    getCategoryType(
      selectedCategory
    );

  awardRankingTitle.textContent =
    getCategoryTitle(
      categoryType
    );

  awardRankingSeason.textContent =
    `${selectedYear}年 `
    + `${HLDB.displayLeagueName(
      selectedLeague
    )} `
    + `レギュラーシーズン`;

  if (!categoryType) {
    awardRankingArea.innerHTML = `
      <p class="no-data-message">
        部門が指定されていません。
      </p>
    `;

    return;
  }

  const filteredPlayers =
    getFilteredPlayers();
    
  let rankingPlayers =
    sortPlayers(
      filteredPlayers,
      categoryType
    );


  /*
    最高得点はTOP10のみ表示
  */
  if (categoryType === "high-score") {
    rankingPlayers =
      rankingPlayers.slice(0, 10);
  }

  if (rankingPlayers.length === 0) {
    awardRankingArea.innerHTML = `
      <p class="no-data-message">
        該当するランキングデータがありません。
      </p>
    `;

    return;
  }

  awardRankingArea.innerHTML = `
    <div class="award-full-ranking">

      ${rankingPlayers.map(
        (player, index) => {
          const rank = index + 1;

          const games =
            toNumber(
              player["試合数"]
            ) ?? 0;

          const isEligible =
            categoryType === "high-score" ||
            games >= 7;

          return `
            <a
              class="
                award-full-ranking-row
                ${rank <= 3
                  ? `award-full-rank-${rank}`
                  : ""
                }
                ${isEligible
                  ? ""
                  : "award-not-eligible"
                }
              "
              href="${createPlayerUrl(
                player
              )}"
            >

              <div class="award-full-rank">
                ${getRankDisplay(rank)}
              </div>

              <div class="award-full-player">

                <strong>
                  ${HLDB.escapeHtml(
                    player["選手名"]
                  )}
                </strong>

                <span>
                  ${HLDB.escapeHtml(
                    player["チーム名"] || "―"
                  )}
                </span>

                <small>
                  ${games}試合
                </small>

                ${
                  !isEligible
  ? `
      <em>
        <span class="not-eligible-title">
          🔒 受賞条件未達
        </span>
        <span class="not-eligible-detail">
          あと${7 - games}試合で対象
        </span>
      </em>
    `
  : ""
                }

              </div>

              <div class="award-full-value">
                ${formatRankingValue(
                  player,
                  categoryType
                )}
              </div>

              <i
                data-lucide="chevron-right"
                aria-hidden="true"
              ></i>

            </a>
          `;
        }
      ).join("")}

    </div>
  `;

  if (window.lucide) {
    lucide.createIcons();
  }
}


/* ========================================
   データ読み込み
======================================== */

async function loadAwardRanking() {
  try {
    awardRankingArea.innerHTML = `
      <p class="no-data-message">
        読み込み中...
      </p>
    `;

    [
      playersData,
      matchesData
    ] = await Promise.all([
      HLDB.loadData("players"),
      HLDB.loadData("matches")
    ]);

    renderRanking();

  } catch (error) {
    console.error(
      "個人賞ランキング読込エラー:",
      error
    );

    awardRankingArea.innerHTML = `
      <p class="no-data-message">
        ランキングデータを読み込めませんでした。
      </p>
    `;
  }
}


/* ========================================
   初期表示
======================================== */

loadAwardRanking();