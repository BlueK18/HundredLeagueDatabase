
  const awardsArea =
  document.getElementById("awardsArea");

const yearSelect =
  document.getElementById("yearSelect");

const leagueSelect =
  document.getElementById("leagueSelect");

const leagueControl =
  document.getElementById("leagueControl");

const awardsSeasonTitle =
  document.getElementById("awardsSeasonTitle");

let awardsData = [];


/* CSVの1行を分割 */
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


/* CSV全体をデータ化 */
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
      item[header] = values[index]?.trim() || "";
    });

    return item;
  });
}


/* 年度を2025形式に統一 */
function normalizeYear(value) {
  const match = String(value || "").match(/\d{4}/);

  return match ? match[0] : "";
}


/* リーグ表記をA/Bに統一 */
function normalizeLeague(value) {
  const text = String(value || "").trim();

  if (text.startsWith("A")) return "A";
  if (text.startsWith("B")) return "B";

  return text;
}


/* 順位を数値化 */
function normalizeRank(value) {
  const match = String(value || "").match(/\d+/);

  return match ? Number(match[0]) : 9999;
}


/* 部門アイコン */
function getAwardIcon(category) {
    if (category.includes("ポイント")) return "👑";
    if (category.includes("ラス回避率")) return "🛡️";
    if (category.includes("最多勝利")) return "🥇";
    if (category.includes("最高得点")) return "🎯";
    if (category.includes("トップ率")) return "⚡";
  
    return "🏅";
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

  if (number === 1) return "🥇";
  if (number === 2) return "🥈";
  if (number === 3) return "🥉";

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


/* HTML安全対策 */
function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


/* 数値化 */
function toNumber(value) {
  const text = String(value || "")
    .replace(/,/g, "")
    .replace(/%/g, "")
    .replace(/点/g, "")
    .replace(/pt/gi, "")
    .replace(/勝/g, "")
    .trim();

  if (text === "") {
    return null;
  }

  const number = Number(text);

  return Number.isFinite(number)
    ? number
    : null;
}


/* 部門別の数値表示 */
function formatAwardValue(row) {
  const category = String(row["部門"] || "").trim();
  const unit = String(row["単位"] || "").trim();
  const number = toNumber(row["数値"]);

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
  const query = new URLSearchParams({
    id: row["選手ID"] || "",
    year: normalizeYear(row["年度"]),
    league: row["リーグ"] || "",
    stage: "レギュラー"
  });

  return `player.html?${query.toString()}`;
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
    normalizeYear(yearSelect.value);

  const isSingleLeagueYear =
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
  const selectedYear =
    normalizeYear(yearSelect.value);

  const isSingleLeagueYear =
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
        normalizeYear(
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
                ${escapeHtml(
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
                      🏅 該当者なし
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
                          ${escapeHtml(
                            row["選手名"]
                          )}
                        </strong>

                        <span>
                          ${escapeHtml(
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

          </article>
        `;
      }).join("")}

    </div>
  `;
}
/* CSV読込 */
async function loadAwards() {
  try {
    awardsArea.innerHTML = `
      <p class="no-data-message">
        読み込み中...
      </p>
    `;

    awardsData =
  await HLDB.loadData("awards");

    renderAwards();

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
  }
);

leagueSelect.addEventListener(
  "change",
  renderAwards
);


/* ========================================
   初期表示
======================================== */

updateLeagueControl();
loadAwards();