const TEAMS_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQOdocYk8ObQRgGJj3FCgHlECXxOJ1v0JC5etquS1xGs-j5XU__lfCW5jFOWtQXvLRKQglX_2kYPmHO/pub?gid=1681226504&single=true&output=csv";


/* ========================================
   データ
======================================== */

let teamsData = [];


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
    text === "2024リーグ" ||
    text === "ハンドレッドリーグ" ||
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

  const selectedLeague =
    selectedYear === "2024"
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
          <th>試合数</th>
          <th>ポイント</th>
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
            rank === "1"
              ? "🥇 1"
              : rank === "2"
                ? "🥈 2"
                : rank === "3"
                  ? "🥉 3"
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
                ${HLDB.escapeHtml(
                  row["試合数"] || "―"
                )}
              </td>

              <td>
                ${pointDisplay}
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

  if (yearSelect.value === "2024") {
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

    const response =
      await fetch(
        TEAMS_CSV_URL,
        {
          cache: "no-store"
        }
      );

    if (!response.ok) {
      throw new Error(
        `Teams CSVの取得に失敗しました：${response.status}`
      );
    }

    const text =
      await response.text();

    teamsData =
      parseCsv(text);

    console.log(
      "Teamsデータ件数:",
      teamsData.length
    );

    renderTeams();

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

function getFavoritePlayerNames() {
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
          return item;
        }

        return item?.name || "";
      })
      .filter(Boolean);

  } catch {
    return [];
  }
}


function getLatestPlayerRecord(
  allPlayers,
  name
) {
  const candidates =
    allPlayers.filter(row =>
      String(
        row["選手名"] || ""
      ).trim() === name
    );

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

  if (number === 1) {
    return "🥇 1位";
  }

  if (number === 2) {
    return "🥈 2位";
  }

  if (number === 3) {
    return "🥉 3位";
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

  const favoriteNames =
    getFavoritePlayerNames();

  if (
    favoriteNames.length === 0
  ) {
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
      favoriteNames.map(name => {
        const player =
          getLatestPlayerRecord(
            allPlayers,
            name
          );

        if (!player) {
          return `
            <div
              class="favorite-player-card favorite-player-missing"
            >
              <span>⭐</span>

              <div>
                <strong>
                  ${HLDB.escapeHtml(name)}
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
            player:
              player["選手名"],
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
            <span>⭐</span>

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
      renderTeams();
    }
  );

  leagueSelect?.addEventListener(
    "change",
    renderTeams
  );

  stageSelect?.addEventListener(
    "change",
    renderTeams
  );

  updateLeagueControl();

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