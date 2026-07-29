
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


/* 順位を数値化 */
function normalizeRank(value) {
  const match = String(value || "").match(/\d+/);

  return match ? Number(match[0]) : 9999;
}


/* 部門アイコン */
function getAwardIcon(category) {
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

  return `${number.toFixed(1)}${unit || "pt"}`;
}


/* 選手ページURL */
function createPlayerUrl(row) {
  return HLDB.createPlayerUrl({
    id: row["選手ID"] || "",
    year: row["年度"] || "",
    league: row["リーグ"] || "",
    stage: "レギュラー"
  });
}


/* 部門順を固定 */
const CATEGORY_ORDER = [
  "ポイント賞",
  "ラス回避率賞",
  "最多勝利賞",
  "最高得点賞",
  "トップ率賞"
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

                      <div class="award-value">
                        ${formatAwardValue(row)}
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

    awardsData =
      await HLDB.loadData("awards");

    HLDB.populateYearSelect(
      "yearSelect",
      awardsData
    );
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
