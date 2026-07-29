

/* ========================================
   データ
======================================== */

let teamsData = [];

const TEAM_RANKING_STATE_KEY =
  "hldbTeamRankingState";


function getTeamRankingState() {
  try {
    return JSON.parse(
      sessionStorage.getItem(
        TEAM_RANKING_STATE_KEY
      ) || "{}"
    );
  } catch {
    return {};
  }
}


function saveTeamRankingState(
  restoreOnReturn = false
) {
  const yearSelect =
    document.getElementById("yearSelect");

  const leagueSelect =
    document.getElementById("leagueSelect");

  const stageSelect =
    document.getElementById("stageSelect");

  if (
    !yearSelect ||
    !leagueSelect ||
    !stageSelect
  ) {
    return;
  }

  try {
    sessionStorage.setItem(
      TEAM_RANKING_STATE_KEY,
      JSON.stringify({
        year: yearSelect.value,
        league: leagueSelect.value,
        stage: stageSelect.value,
        scrollY: window.scrollY,
        restoreOnReturn
      })
    );
  } catch {
    /* 保存できない環境でも順位表は通常どおり表示する */
  }
}


function restoreTeamRankingScroll() {
  const state =
    getTeamRankingState();

  if (!state.restoreOnReturn) {
    return;
  }

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      window.scrollTo(
        0,
        Number(state.scrollY) || 0
      );

      saveTeamRankingState(false);
    });
  });
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

    if (
      character === "," &&
      !insideQuotes
    ) {
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

  const headers = parseCsvLine(
    lines.shift()
  ).map((header, index) => {
    const cleaned = header.trim();

    return index === 0
      ? cleaned.replace(/^\uFEFF/, "")
      : cleaned;
  });

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

function normalizeYearValue(value) {
  const match =
    String(value || "").match(/\d{4}/);

  return match ? match[0] : "";
}


function normalizeLeagueValue(value) {
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


function normalizeStage(value) {
  const text =
    String(value || "").trim();

  const stagePart =
    text.includes("1st")
      ? " 1st"
      : text.includes("2nd")
        ? " 2nd"
        : "";

  if (
    text.includes("Semi") ||
    text.includes("セミファイナル") ||
    text.includes("セミ")
  ) {
    return `Semi-Final${stagePart}`;
  }

  if (
    text.includes("Final") ||
    text.includes("ファイナル")
  ) {
    return `Final${stagePart}`;
  }

  return `レギュラー${stagePart}`;
}


/* ========================================
   チーム順位表示
======================================== */

function renderTeams() {
  const yearSelect =
    document.getElementById("yearSelect");

  const leagueSelect =
    document.getElementById("leagueSelect");

  const stageSelect =
    document.getElementById("stageSelect");

  const area =
    document.getElementById("teamTable");

  if (
    !yearSelect ||
    !leagueSelect ||
    !stageSelect ||
    !area
  ) {
    return;
  }

  const selectedYear =
    normalizeYearValue(yearSelect.value);

  const isSingleLeagueYear =
    selectedYear === "2021" ||
    selectedYear === "2022" ||
    selectedYear === "2023" ||
    selectedYear === "2024";
  
  const selectedLeague =
    isSingleLeagueYear
      ? "単一リーグ"
      : normalizeLeagueValue(
          leagueSelect.value
        );

  const selectedStage =
    normalizeStage(stageSelect.value);

  const filtered = teamsData
    .filter(row => {
      const rowYear =
        normalizeYearValue(
          row["年度"]
        );

      const rowLeague =
        normalizeLeagueValue(
          row["リーグ"]
        );

      const rowStage =
        normalizeStage(
          row["ステージ"]
        );

      return (
        rowYear === selectedYear &&
        rowLeague === selectedLeague &&
        rowStage === selectedStage
      );
    })
    .sort((a, b) => {
      return (
        Number(a["順位"] || 9999) -
        Number(b["順位"] || 9999)
      );
    });

  if (filtered.length === 0) {
    console.log("現在の選択条件:", {
      year: selectedYear,
      league: selectedLeague,
      stage: selectedStage
    });

    area.innerHTML = `
      <p class="no-data-message">
        データがありません
      </p>
    `;

    return;
  }

  area.innerHTML = `
    <table>
      <thead>
        <tr>
  <th>順位</th>
  <th>チーム</th>
  <th>ポイント</th>
  <th>試合数</th>
  <th>着順分布</th>
  <th>ポイント差</th>
</tr>
      </thead>

      <tbody>
        ${filtered.map(row => {
          const rank =
            String(
              row["順位"] || ""
            ).trim();

          const rankDisplay =
            ["1", "2", "3"].includes(rank)
              ? `<span class="rank-medal-badge rank-medal-${rank}" aria-label="${rank}位">${rank}</span>`
              : rank || "―";

          const pointNumber =
            HLDB.toNumber(
              row["ポイント"]
            );

          const pointDisplay =
            pointNumber === null
              ? "―"
              : pointNumber.toFixed(1);

          const teamUrl =
            `team.html?team=${encodeURIComponent(
              row["チーム"] || ""
            )}&year=${encodeURIComponent(
              row["年度"] || ""
            )}&league=${encodeURIComponent(
              row["リーグ"] || ""
            )}&stage=${encodeURIComponent(
              row["ステージ"] || ""
            )}`;

          return `
            <tr>
              <td>
                ${rankDisplay}
              </td>

              <td>
  <a
    class="team-link"
    href="${teamUrl}"
  >
    ${HLDB.escapeHtml(
      row["チーム"] || "―"
    )}
  </a>
</td>

<td>
  ${pointDisplay}
</td>

<td>
  ${HLDB.escapeHtml(
    row["試合数"] || "―"
  )}
</td>

              <td>
                ${HLDB.escapeHtml(
                  row["着順分布"] || "―"
                )}
              </td>

              <td>
                ${HLDB.escapeHtml(
                  row["ポイント差"] || "―"
                )}
              </td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
}


/* ========================================
   年度に応じてリーグ欄を変更
======================================== */

function updateLeagueControl() {
  const yearSelect =
    document.getElementById("yearSelect");

  const leagueSelect =
    document.getElementById("leagueSelect");

  const leagueControl =
    document.getElementById("leagueControl");

  if (
    !yearSelect ||
    !leagueSelect ||
    !leagueControl
  ) {
    return;
  }

  if (
    yearSelect.value === "2021" ||
    yearSelect.value === "2022" ||
    yearSelect.value === "2023" ||
    yearSelect.value === "2024"
  ) {
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

  const previousLeague =
    normalizeLeagueValue(
      leagueSelect.value
    );

  leagueSelect.innerHTML = `
    <option value="A">
      Aリーグ
    </option>

    <option value="B">
      Bリーグ
    </option>
  `;

  leagueSelect.value =
    previousLeague === "B"
      ? "B"
      : "A";

  leagueControl.style.display = "";
}


/* ========================================
   年度に応じてステージ欄を変更
======================================== */

function updateStageControl(
  preferLatest = false
) {
  const yearSelect =
    document.getElementById("yearSelect");

  const stageSelect =
    document.getElementById("stageSelect");

  if (!yearSelect || !stageSelect) {
    return;
  }

  const selectedYear =
    normalizeYearValue(yearSelect.value);

  const previousStage =
    normalizeStage(stageSelect.value);

  const stageOrder = [
    "レギュラー 1st",
    "レギュラー 2nd",
    "レギュラー",
    "Semi-Final 1st",
    "Semi-Final 2nd",
    "Semi-Final",
    "Final"
  ];

  const stages = [
    ...new Set(
      teamsData
        .filter(row =>
          normalizeYearValue(row["年度"]) ===
          selectedYear
        )
        .map(row =>
          normalizeStage(row["ステージ"])
        )
        .filter(Boolean)
    )
  ].sort((a, b) => {
    const aIndex = stageOrder.indexOf(a);
    const bIndex = stageOrder.indexOf(b);

    return (
      (aIndex === -1 ? 999 : aIndex) -
      (bIndex === -1 ? 999 : bIndex)
    );
  });

  const getStageLabel = stage => {
    return stage
      .replace("Semi-Final", "セミファイナル")
      .replace("Final", "ファイナル");
  };

  stageSelect.innerHTML =
    stages.map(stage => `
      <option value="${stage}">
        ${getStageLabel(stage)}
      </option>
    `).join("");

  stageSelect.value =
    preferLatest
      ? stages[stages.length - 1] || ""
      : stages.includes(previousStage)
        ? previousStage
        : stages[stages.length - 1] || "";
}


/* ========================================
   チームCSV読込
======================================== */

async function loadTeams() {
  const area =
    document.getElementById("teamTable");

  try {
    if (area) {
      area.innerHTML = `
        <p class="no-data-message">
          読み込み中...
        </p>
      `;
    }

    teamsData =
  await HLDB.loadData("teams");

console.log(
  "Teamsデータ件数:",
  teamsData.length
);

initializeYearSelect();

const savedRankingState =
  getTeamRankingState();

const shouldRestoreRankingState =
  savedRankingState.restoreOnReturn ===
  true;

if (
  shouldRestoreRankingState &&
  savedRankingState.year &&
  Array.from(
    document.getElementById("yearSelect")
      ?.options || []
  ).some(option =>
    option.value === savedRankingState.year
  )
) {
  document.getElementById("yearSelect").value =
    savedRankingState.year;
}

updateLeagueControl();

const leagueSelect =
  document.getElementById("leagueSelect");

if (
  shouldRestoreRankingState &&
  savedRankingState.league &&
  Array.from(leagueSelect?.options || [])
    .some(option =>
      option.value === savedRankingState.league
    )
) {
  leagueSelect.value =
    savedRankingState.league;
}

updateStageControl(
  !shouldRestoreRankingState
);

const stageSelect =
  document.getElementById("stageSelect");

if (
  shouldRestoreRankingState &&
  savedRankingState.stage &&
  Array.from(stageSelect?.options || [])
    .some(option =>
      option.value === savedRankingState.stage
    )
) {
  stageSelect.value =
    savedRankingState.stage;
}

renderTeams();
restoreTeamRankingScroll();

  } catch (error) {
    console.error(
      "チーム順位読込エラー:",
      error
    );

    if (area) {
      area.innerHTML = `
        <p class="no-data-message">
          チーム順位を読み込めませんでした。
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
        if (
          typeof item === "string"
        ) {
          return {
            id: "",
            name: item
          };
        }

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
}function getFavoritePlayers() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(
        "hldbFavoritePlayers"
      ) || "[]"
    );

    return saved
      .map(item => {
        if (
          typeof item === "string"
        ) {
          return {
            id: "",
            name: item
          };
        }

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


function getLatestPlayerRecord(
  allPlayers,
  favorite
) {
  const favoriteId =
    String(
      favorite?.id || ""
    ).trim();

  const favoriteName =
    String(
      favorite?.name || ""
    ).trim();

  const candidates =
    allPlayers.filter(row => {
      const rowId =
        String(
          row["選手ID"] || ""
        ).trim();

      const rowName =
        String(
          row["選手名"] || ""
        ).trim();

      if (favoriteId) {
        return rowId === favoriteId;
      }

      return rowName === favoriteName;
    });

  if (
    candidates.length === 0
  ) {
    return null;
  }

  const latestYear = Math.max(
    ...candidates.map(row => {
      const match =
        String(
          row["年度"] || ""
        ).match(/\d{4}/);

      return match
        ? Number(match[0])
        : 0;
    })
  );

  const latestCandidates =
    candidates.filter(row => {
      return (
        Number(
          normalizeYearValue(
            row["年度"]
          )
        ) === latestYear
      );
    });

  const regularSeason =
    latestCandidates.find(row =>
      HLDB.normalizeStage(
        row["ステージ"]
      ) === "レギュラー"
    );

  return (
    regularSeason ||
    latestCandidates[0]
  );
}


function getRankDisplay(rank) {
  const number =
    Number(rank);

  if (number >= 1 && number <= 3) {
    return `<span class="rank-medal-badge rank-medal-${number}" aria-label="${number}位">${number}</span>`;
  }

  return Number.isFinite(number)
    ? `${number}位`
    : "順位なし";
}


async function renderFavoritePlayers() {
  const area =
    document.getElementById(
      "favoritePlayersArea"
    );

  if (!area) {
    return;
  }

  const favorites =
  getFavoritePlayers();

  if (
    favorites.length === 0
  ){
    area.innerHTML = `
      <p class="no-data-message">
        お気に入り選手はいません
      </p>
    `;

    return;
  }

  area.innerHTML = `
    <p class="no-data-message">
      お気に入り選手を読み込み中...
    </p>
  `;

  try {
    const allPlayers =
      await HLDB.loadData(
        "players"
      );

    const cards =
    favorites.map(favorite => {
      const player =
      getLatestPlayerRecord(
        allPlayers,
        favorite
      );

        if (!player) {
          return `
            <div
              class="favorite-player-card favorite-player-missing"
            >
              <i data-lucide="star" class="favorite-card-star"></i>

              <div>
                <strong>
                ${HLDB.escapeHtml(favorite.name)}
                </strong>

                <small>
                  最新データが見つかりません
                </small>
              </div>
            </div>
          `;
        }

        const playerUrl =
          HLDB.createPlayerUrl({
            id:
              player["選手ID"],
            year:
              player["年度"],
            league:
              player["リーグ"],
            stage:
              player["ステージ"]
          });

        const pointNumber =
          HLDB.toNumber(
            player["ポイント"]
          );

        const pointText =
          pointNumber === null
            ? "―"
            : `${
                pointNumber > 0
                  ? "+"
                  : ""
              }${pointNumber.toFixed(1)} pt`;

        return `
          <a
            class="favorite-player-card favorite-player-card-detail"
            href="${playerUrl}"
          >
            <i data-lucide="star" class="favorite-card-star"></i>

            <div class="favorite-player-main">
              <strong>
                ${HLDB.escapeHtml(
                  player["選手名"]
                )}
              </strong>

              <small>
                ${HLDB.escapeHtml(
                  player["チーム名"] ||
                  "所属不明"
                )}
              </small>
            </div>

            <div class="favorite-player-meta">
              <span>
                ${HLDB.escapeHtml(
                  String(
                    player["年度"] || ""
                  )
                )}
              </span>

              <span>
                ${getRankDisplay(
                  player["順位"]
                )}
              </span>

              <span>
                ${pointText}
              </span>
            </div>
          </a>
        `;
      });

    area.innerHTML = `
      <div class="favorite-player-list">
        ${cards.join("")}
      </div>
    `;

    if (HLDB.initializeIcons) {
      HLDB.initializeIcons();
    }

  } catch (error) {
    console.error(
      "お気に入り読込エラー:",
      error
    );

    area.innerHTML = `
      <p class="no-data-message">
        お気に入り選手を読み込めませんでした
      </p>
    `;
  }
}

/* ========================================
   年度選択肢を自動生成
======================================== */

function initializeYearSelect() {
  const yearSelect =
    document.getElementById("yearSelect");

  if (!yearSelect) return;

  const current =
    yearSelect.value;

  const years = [
    ...new Set(
      teamsData
        .map(row => normalizeYearValue(row["年度"]))
        .filter(Boolean)
    )
  ].sort((a, b) => Number(b) - Number(a));

  yearSelect.innerHTML =
    years.map(year => `
      <option value="${year}">
        ${year}
      </option>
    `).join("");

  yearSelect.value =
    years.includes(current)
      ? current
      : years[0];
}

/* ========================================
   イベント登録
======================================== */

function initializeHome() {
  const yearSelect =
    document.getElementById(
      "yearSelect"
    );

  const leagueSelect =
    document.getElementById(
      "leagueSelect"
    );

  const stageSelect =
    document.getElementById(
      "stageSelect"
    );

  yearSelect?.addEventListener(
    "change",
    () => {
      updateLeagueControl();
      updateStageControl(true);
      renderTeams();
      saveTeamRankingState(false);
    }
  );

  leagueSelect?.addEventListener(
    "change",
    () => {
      renderTeams();
      saveTeamRankingState(false);
    }
  );

  stageSelect?.addEventListener(
    "change",
    () => {
      renderTeams();
      saveTeamRankingState(false);
    }
  );

  document
    .getElementById("teamTable")
    ?.addEventListener(
      "click",
      event => {
        if (
          event.target.closest(
            ".team-link"
          )
        ) {
          saveTeamRankingState(true);
        }
      }
    );

  loadTeams();
  renderFavoritePlayers();
}


/* ========================================
   初期実行
======================================== */

document.addEventListener(
  "DOMContentLoaded",
  initializeHome
);
