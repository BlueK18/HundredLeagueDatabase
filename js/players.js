const playersArea = document.getElementById("playersArea");
const rankingTitle = document.getElementById("rankingTitle");

const yearSelect = document.getElementById("yearSelect");
const leagueSelect = document.getElementById("leagueSelect");
const stageSelect = document.getElementById("stageSelect");

let playersData = [];


/* 年度を2025形式に統一 */
function normalizeYear(value) {
  const match = String(value ?? "").match(/\d{4}/);

  return match ? match[0] : "";
}


/* 数字の順位をメダル表示 */
function displayRank(rank) {
  const number = Number(rank);

  if (number === 1) return "🥇 1";
  if (number === 2) return "🥈 2";
  if (number === 3) return "🥉 3";

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
  const selectedYear = normalizeYear(yearSelect.value);
  const selectedLeague = HLDB.normalizeLeague(
    leagueSelect.value
  );
  const selectedStage = HLDB.normalizeStage(
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

  rankingTitle.textContent =
    `${selectedYear}年 `
    + `${HLDB.displayLeagueName(selectedLeague)} `
    + `${HLDB.displayStageName(selectedStage)}`;

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
              player: player["選手名"],
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
    const selectedYear = yearSelect.value;
  
    if (selectedYear === "2024") {
      leagueSelect.innerHTML = `
        <option value="単一リーグ">
          2024リーグ
        </option>
      `;
  
      leagueSelect.value = "単一リーグ";
      return;
    }
  
    leagueSelect.innerHTML = `
      <option value="A">Aリーグ</option>
      <option value="B">Bリーグ</option>
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
  
      /*
        初期年度に合わせてリーグ選択肢を整えてから表示
      */
      updateLeagueOptions();
      renderPlayers();
  
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
  });
  
  
  /* リーグ・ステージを変更したとき */
  leagueSelect.addEventListener(
    "change",
    renderPlayers
  );
  
  stageSelect.addEventListener(
    "change",
    renderPlayers
  );
  
  
  /* 初期実行 */
  loadPlayers();