const PLAYERS_CSV_URL =
  "data/players.csv";

const MATCHES_CSV_URL =
  "data/matches.csv";

const AWARDS_CSV_URL =
  "data/awards.csv";
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

const favoriteButton =
  document.getElementById("favoriteButton");


/* ========================================
   状態
======================================== */

let playersData = [];
let matchesData = [];
let awardsData = [];

let playerAliasData = [];
let currentPlayerId = "";
let currentPlayerAliasNames = [];

let activeYear = "";
let activeLeague = "";
let activeStage = "ALL";

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
  return matchesData.filter(row => {
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

  return playersData.find(row =>
    String(row["選手名"] || "").trim() ===
      playerName &&
    normalizeYear(row["年度"]) ===
      activeYear &&
    (
      !activeLeague ||
      normalizeLeague(row["リーグ"]) ===
        activeLeague
    ) &&
    normalizeStage(row["ステージ"]) ===
      "レギュラー"
  ) || null;
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
  if (activeYear === "ALL") {
    return `
      <section class="regular-ranking-section">

        <h2>
          レギュラーシーズン順位
        </h2>

        <p class="no-data-message">
          歴代通算には順位を設定していません。<br>
          年度を選択すると、その年度の順位を確認できます。
        </p>

      </section>
    `;
  }

  return `
    <section class="regular-ranking-section">

      <h2>
        レギュラーシーズン順位
      </h2>

      ${
        regularPlayer
          ? `
            <div class="regular-ranking-grid">

              <div>
                <span>ポイント順位</span>
                <strong>
                  ${formatRank(
                    regularPlayer["順位"]
                  )}
                </strong>
              </div>

              <div>
                <span>最高得点順位</span>
                <strong>
                  ${formatRank(
                    regularPlayer[
                      "最高得点順位"
                    ]
                  )}
                </strong>
              </div>

              <div>
                <span>最多勝利順位</span>
                <strong>
                  ${formatRank(
                    regularPlayer[
                      "最多勝利順位"
                    ]
                  )}
                </strong>
              </div>

              <div>
                <span>トップ率順位</span>
                <strong>
                  ${formatRank(
                    regularPlayer[
                      "トップ率順位"
                    ]
                  )}
                </strong>
              </div>

              <div>
                <span>ラス回避率順位</span>
                <strong>
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
            <p class="no-data-message">
              レギュラーシーズン順位がありません。
            </p>
          `
      }

      <p class="player-ranking-note">
        ※順位・各種ランキングは、
        ${escapeHtml(activeYear)}年の
        レギュラーシーズンのみを対象としています。
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

  const periodDisplay =
    activeYear === "ALL"
      ? "全年度・全リーグ・歴代通算"
      : `${escapeHtml(activeYear)}年・${escapeHtml(
          displayLeagueName(activeLeague)
        )}`;

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

        <h2>
          ${escapeHtml(teamDisplay)}
        </h2>

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

  <h2>着順分布</h2>

  <div class="placing-grid">

    <div>
      <span class="placement-label">
        <span class="placement-medal">🥇</span>
        1着
      </span>

      <strong>
        ${stats.firstCount}
      </strong>
    </div>

    <div>
      <span class="placement-label">
        <span class="placement-medal">🥈</span>
        2着
      </span>

      <strong>
        ${stats.secondCount}
      </strong>
    </div>

    <div>
      <span class="placement-label">
        <span class="placement-medal">🥉</span>
        3着
      </span>

      <strong>
        ${stats.thirdCount}
      </strong>
    </div>

    <div>
      <span class="placement-label">
        <span class="placement-medal"></span>
        4着
      </span>

      <strong>
        ${stats.fourthCount}
      </strong>
    </div>

  </div>

</section>
          `
      }

      ${renderRegularRanking(
        regularPlayer
      )}

      <p class="back-link-area">
        <a href="javascript:history.back()">
          ← 前のページへ戻る
        </a>
      </p>

    </div>
  `;

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
      return "👑";
    }
  
    if (category.includes("ラス回避率")) {
      return "🛡️";
    }
  
    if (category.includes("最多勝利")) {
      return "🥇";
    }
  
    if (category.includes("最高得点")) {
      return "🎯";
    }
  
    if (category.includes("トップ率")) {
      return "⚡";
    }
  
    return "🏅";
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
  
        ${awards.map(award => `
          <article class="player-award-card">
  
            <div class="player-award-icon">
              ${getAwardIcon(
                String(
                  award["部門"] || ""
                )
              )}
            </div>
  
            <div class="player-award-main">
  
              <strong>
                ${escapeHtml(
                  getDisplayAwardName(
                    String(
                      award["部門"] || ""
                    ).trim()
                  )
                )}
              </strong>
  
              <span>
                ${escapeHtml(
                  normalizeYear(
                    award["年度"]
                  )
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
  
          </article>
        `).join("")}
  
      </div>
    `;
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
  
        <table>
  
          <thead>
            <tr>
              <th>年度</th>
              <th>日付</th>
              <th>チーム</th>
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
  
                  <td>
                    ${escapeHtml(
                      normalizeYear(
                        match["年度"]
                      ) || "―"
                    )}
                  </td>
  
                  <td>
                    ${escapeHtml(
                      match["日付"] || "―"
                    )}
                  </td>
  
                  <td>
                    ${escapeHtml(
                      match["チーム名"] || "―"
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
  
      <p class="match-row-guide">
        ※試合をクリックすると、同卓した4選手の結果を確認できます。
      </p>
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
  
        const matchNo =
          getMatchNo(match);
  
        if (
          selectedMatchNo !== "" &&
          matchNo !== ""
        ) {
          return (
            sameYear &&
            sameLeague &&
            matchNo === selectedMatchNo
          );
        }
  
        return (
          sameYear &&
          sameLeague &&
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
  
    if (number === 1) return "🥇";
    if (number === 2) return "🥈";
    if (number === 3) return "🥉";
    if (number === 4) return "4着";
  
    return "―";
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
      body.innerHTML = `
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
    renderPlayerMatches();
  }


/* ========================================
   データ読み込み
======================================== */

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
      const currentPlayerRecords =
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
      if (currentPlayerId) {
        return item.id === currentPlayerId;
      }

      return (
        item.name === displayPlayerName ||
        item.name === playerName
      );
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

  favoriteButton.textContent =
    isFavorite
      ? "★ お気に入り登録済み"
      : "☆ お気に入りに追加";

  favoriteButton.classList.toggle(
    "is-favorite",
    isFavorite
  );
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
          if (currentPlayerId) {
            return item.id !== currentPlayerId;
          }

          return (
            item.name !== displayPlayerName &&
            item.name !== playerName
          );
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
updateFavoriteButton();
loadPlayerDetail();