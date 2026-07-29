const playersArea = document.getElementById("playersArea");
const rankingTitle = document.getElementById("rankingTitle");

const yearSelect = document.getElementById("yearSelect");
const leagueSelect = document.getElementById("leagueSelect");
const stageSelect = document.getElementById("stageSelect");

let playersData = [];

const PLAYER_RANKING_STATE_KEY =
  "hldbPlayerRankingState";


function getPlayerRankingState() {
  try {
    return JSON.parse(
      sessionStorage.getItem(
        PLAYER_RANKING_STATE_KEY
      ) || "{}"
    );
  } catch {
    return {};
  }
}


function savePlayerRankingState(
  restoreOnReturn = false
) {
  try {
    sessionStorage.setItem(
      PLAYER_RANKING_STATE_KEY,
      JSON.stringify({
        year: yearSelect.value,
        league: leagueSelect.value,
        stage: stageSelect.value,
        scrollY: window.scrollY,
        restoreOnReturn
      })
    );
  } catch {
    /* 保存できない環境でも通常どおり表示する */
  }
}


function restorePlayerRankingScroll() {
  const state =
    getPlayerRankingState();

  if (!state.restoreOnReturn) {
    return;
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.scrollTo(
        0,
        Number(state.scrollY) || 0
      );

      savePlayerRankingState(false);
    });
  });
}


/* 年度を2025形式に統一 */
function normalizeYear(value) {
  const match = String(value ?? "").match(/\d{4}/);

  return match ? match[0] : "";
}


/* 数字の順位をメダル表示 */
function displayRank(rank) {
  const number = Number(rank);

  if (number >= 1 && number <= 3) {
    return `<span class="rank-medal-badge rank-medal-${number}" aria-label="${number}位">${number}</span>`;
  }

  return String(rank || "―");
}


/* 1〜3位の行用クラス */
function getRankClass(rank) {
  const number = Number(rank);

  if (number === 1) return "player-rank-first";
  if (number === 2) return "player-rank-second";
  if (number === 3) return "player-rank-third";

  return "";
}


/* ポイントにプラス記号を付ける */
function formatPlayerPoint(value) {
  const number = HLDB.toNumber(value);

  if (number === null) {
    return "―";
  }

  const sign = number > 0 ? "+" : "";

  return `${sign}${number.toFixed(1)} pt`;
}


/* 選手一覧を表示 */
function renderPlayers() {
  const selectedYear =
    normalizeYear(yearSelect.value);

  const isSingleLeagueYear =
    selectedYear === "2021" ||
    selectedYear === "2022" ||
    selectedYear === "2023" ||
    selectedYear === "2024";

  const selectedLeague =
    isSingleLeagueYear
      ? HLDB.normalizeLeague("単一リーグ")
      : HLDB.normalizeLeague(
          leagueSelect.value
        );

  const selectedStage =
    HLDB.normalizeStage(
      stageSelect.value
    );

  const filtered = playersData
    .filter(row => {
      return (
        normalizeYear(row["年度"]) === selectedYear &&
        HLDB.normalizeLeague(row["リーグ"]) ===
          selectedLeague &&
        HLDB.normalizeStage(row["ステージ"]) ===
          selectedStage &&
        String(row["選手名"] || "").trim() !== ""
      );
    })
    .sort((a, b) => {
      return (
        Number(a["順位"] || 9999) -
        Number(b["順位"] || 9999)
      );
    });

    const leagueDisplay =
  HLDB.displayLeagueName(selectedLeague);

const hideSingleLeague =
  leagueDisplay === "単一リーグ";

rankingTitle.innerHTML = `
  <span class="ranking-title-line">
    <span>${selectedYear}年</span>

    ${
      hideSingleLeague
        ? ""
        : `<span>${leagueDisplay}</span>`
    }
  </span>

  <span class="ranking-title-stage">
    ${HLDB.displayStageName(selectedStage)}
  </span>
`;

  if (filtered.length === 0) {
    playersArea.innerHTML = `
      <p class="no-data-message">
        該当する選手データがありません。
      </p>
    `;
    return;
  }

  playersArea.innerHTML = `
    <div class="players-table-wrapper">

      <table class="players-ranking-table">

        <thead>
          <tr>
            <th>順位</th>
            <th>選手</th>
            <th>チーム</th>
            <th>試合数</th>
            <th>ポイント</th>
            <th>平均順位</th>
            <th>トップ率</th>
            <th>ラス回避率</th>
          </tr>
        </thead>

        <tbody>

          ${filtered.map(player => {
            const playerUrl = HLDB.createPlayerUrl({
              id: player["選手ID"],
              year: player["年度"],
              league: player["リーグ"],
              stage: player["ステージ"]
            });

            return `
              <tr class="${getRankClass(player["順位"])}">

                <td class="players-rank-cell">
                  ${displayRank(player["順位"])}
                </td>

                <td class="players-name-cell">
                  <a
                    class="player-ranking-link"
                    href="${playerUrl}"
                  >
                    ${HLDB.escapeHtml(player["選手名"])}
                  </a>
                </td>

                <td>
                  ${HLDB.escapeHtml(
                    player["チーム名"] || "―"
                  )}
                </td>

                <td>
                  ${HLDB.escapeHtml(
                    player["試合数"] || "―"
                  )}
                </td>

                <td class="players-point-cell">
                  ${formatPlayerPoint(player["ポイント"])}
                </td>

                <td>
                  ${HLDB.formatDecimal(
                    player["平均順位"],
                    2
                  )}
                </td>

                <td>
                  ${HLDB.formatPercent(
                    player["トップ率"]
                  )}
                </td>

                <td>
                  ${HLDB.formatPercent(
                    player["ラス回避率"]
                  )}
                </td>

              </tr>
            `;
          }).join("")}

        </tbody>

      </table>

    </div>
  `;
}


/* 年度に合わせてリーグ選択肢を変更 */
function updateLeagueOptions() {
  const selectedYear =
    normalizeYear(yearSelect.value);

  const isSingleLeagueYear =
    selectedYear === "2021" ||
    selectedYear === "2022" ||
    selectedYear === "2023" ||
    selectedYear === "2024";

  if (isSingleLeagueYear) {

    // リーグ選択を非表示
    leagueControl.style.display = "none";

    leagueSelect.innerHTML = `
      <option value="単一リーグ">
        単一リーグ
      </option>
    `;

    leagueSelect.value =
      "単一リーグ";

    return;
  }

  // 通常年度は表示
  leagueControl.style.display = "block";

  leagueSelect.innerHTML = `
    <option value="A">
      Aリーグ
    </option>

    <option value="B">
      Bリーグ
    </option>
  `;

  leagueSelect.value = "A";
}
  
  
  /* CSVを読み込む */
async function loadPlayers() {
  try {
    playersArea.innerHTML = `
      <p class="no-data-message">
        読み込み中...
      </p>
    `;

    playersData = await HLDB.loadData("players");
    console.log(
      "Playersの列名:",
      Object.keys(playersData[0] || {})
    );

    // 年度を自動生成（最新年度が先頭）
    HLDB.populateYearSelect(
      "yearSelect",
      playersData
    );

    const savedState =
      getPlayerRankingState();

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

    // 年度に応じてリーグを切り替え
    updateLeagueOptions();

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

    if (
      shouldRestoreState &&
      savedState.stage &&
      Array.from(stageSelect.options)
        .some(option =>
          option.value === savedState.stage
        )
    ) {
      stageSelect.value = savedState.stage;
    }

    // ランキング表示
    renderPlayers();
    restorePlayerRankingScroll();

  } catch (error) {
    console.error(
      "選手ランキング読込エラー:",
      error
    );

    playersArea.innerHTML = `
      <p class="no-data-message">
        選手ランキングを読み込めませんでした。
      </p>
    `;
  }
}
  
  
  /* 年度を変更したとき */
  yearSelect.addEventListener("change", () => {
    updateLeagueOptions();
    renderPlayers();
    savePlayerRankingState(false);
  });
  
  
  /* リーグ・ステージを変更したとき */
  leagueSelect.addEventListener(
    "change",
    () => {
      renderPlayers();
      savePlayerRankingState(false);
    }
  );
  
  stageSelect.addEventListener(
    "change",
    () => {
      renderPlayers();
      savePlayerRankingState(false);
    }
  );

  playersArea.addEventListener(
    "click",
    event => {
      if (
        event.target.closest(
          ".player-ranking-link"
        )
      ) {
        savePlayerRankingState(true);
      }
    }
  );
  
  
  /* 初期実行 */
  loadPlayers();
