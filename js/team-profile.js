const params = new URLSearchParams(window.location.search);
const teamName = params.get("team");

const teamNameElement = document.getElementById("teamName");
const messageElement = document.getElementById("teamProfileMessage");

let teamsData = [];
let matchesData = [];
let playersData = [];

let selectedYear = "total";

if (!teamName) {
  teamNameElement.textContent = "チームが指定されていません";
  messageElement.textContent =
    "URLにチーム名が指定されていません。";
} else {
  teamNameElement.textContent = teamName;
  document.title = `${teamName}｜総合チームデータ`;
}

/* =========================
   初期処理
========================= */

async function init() {
  if (!teamName) {
    return;
  }

  try {
    await loadData();

    renderYearTabs();
    renderPage();
  } catch (error) {
    console.error(error);

    messageElement.textContent =
      "データの読み込みに失敗しました。";
  }
}

/* =========================
   データ読み込み
========================= */

async function loadData() {
  [
    teamsData,
    matchesData,
    playersData
  ] = await Promise.all([
    HLDB.loadData("teams"),
    HLDB.loadData("matches"),
    HLDB.loadData("players")
  ]);
}

/* =========================
   年度タブ
========================= */

function renderYearTabs() {
  const years = [
    ...new Set(
      teamsData
        .filter(row =>
          String(row["チーム"] || "").trim() ===
          String(teamName || "").trim()
        )
        .map(row => String(row["年度"] || "").trim())
        .filter(Boolean)
    )
  ];

  years.sort((a, b) => Number(b) - Number(a));

  const yearTabs =
    document.getElementById("yearTabs");

  yearTabs.innerHTML = "";

  ["total", ...years].forEach(year => {
    const button =
      document.createElement("button");

    button.type = "button";

    button.textContent =
      year === "total"
        ? "トータル"
        : year;

    if (year === selectedYear) {
      button.classList.add("active");
    }

    button.addEventListener("click", () => {
      selectedYear = year;

      renderYearTabs();
      renderPage();
    });

    yearTabs.appendChild(button);
  });
}

/* =========================
   ページ全体の再描画
========================= */

function renderPage() {
  const teamSummary =
    document.getElementById("teamSummary");

  const summaryTitle =
    document.getElementById("summaryTitle");

  const allTeamRows = teamsData.filter(row =>
    String(row["チーム"] || "").trim() ===
    String(teamName || "").trim()
  );

  if (allTeamRows.length === 0) {
    teamSummary.innerHTML =
      "<p>該当するチームデータが見つかりませんでした。</p>";

    messageElement.textContent = "";
    return;
  }

  const displayTeamRows =
    selectedYear === "total"
      ? allTeamRows
      : allTeamRows.filter(row =>
          String(row["年度"] || "").trim() ===
          String(selectedYear)
        );

  renderTeamSummary(
    displayTeamRows,
    summaryTitle,
    teamSummary
  );

  renderTeamHistory(displayTeamRows);
  renderTeamPlayers();
  setCurrentTeamPageLink(allTeamRows);

  messageElement.textContent = "";

  if (window.lucide) {
    lucide.createIcons();
  }
}

/* =========================
   成績カード
========================= */

function renderTeamSummary(
  teamRows,
  summaryTitle,
  teamSummary
) {
  if (selectedYear === "total") {
    summaryTitle.innerHTML = `
      <i data-lucide="trophy"></i>
      通算成績
    `;
  } else {
    summaryTitle.innerHTML = `
      <i data-lucide="trophy"></i>
      ${escapeHtml(selectedYear)}年 成績
    `;
  }

  if (teamRows.length === 0) {
    teamSummary.innerHTML =
      "<p>該当年度のチームデータがありません。</p>";

    return;
  }

  const totalMatches = teamRows.reduce(
    (sum, row) =>
      sum + toNumber(row["試合数"]),
    0
  );

  const totalPoints = teamRows.reduce(
    (sum, row) =>
      sum + toNumber(row["ポイント"]),
    0
  );

  const ranks = teamRows
    .map(row => toNullableNumber(row["順位"]))
    .filter(rank =>
      rank !== null &&
      Number.isFinite(rank) &&
      rank > 0
    );

  const bestRank =
    ranks.length > 0
      ? Math.min(...ranks)
      : null;

  const participationYears =
    new Set(
      teamRows
        .map(row =>
          String(row["年度"] || "").trim()
        )
        .filter(Boolean)
    ).size;

  const stageCount =
    new Set(
      teamRows
        .map(row =>
          HLDB.normalizeStage(row["ステージ"])
        )
        .filter(Boolean)
    ).size;

  const fourthLabel =
    selectedYear === "total"
      ? "参加年度"
      : "参加ステージ";

  const fourthValue =
    selectedYear === "total"
      ? `${participationYears}年`
      : `${stageCount}ステージ`;

  teamSummary.innerHTML = `
    <div class="team-summary-card">
      <div class="summary-icon">
        <i data-lucide="trophy"></i>
      </div>

      <span class="summary-label">
        最高順位
      </span>

      <strong class="summary-value">
        ${
          bestRank !== null
            ? `${bestRank}位`
            : "－"
        }
      </strong>
    </div>

    <div class="team-summary-card">
      <div class="summary-icon">
        <i data-lucide="gamepad-2"></i>
      </div>

      <span class="summary-label">
        ${
          selectedYear === "total"
            ? "総試合数"
            : "試合数"
        }
      </span>

      <strong class="summary-value">
        ${totalMatches}試合
      </strong>
    </div>

    <div class="team-summary-card">
      <div class="summary-icon">
        <i data-lucide="star"></i>
      </div>

      <span class="summary-label">
        ${
          selectedYear === "total"
            ? "総ポイント"
            : "ポイント"
        }
      </span>

      <strong class="summary-value">
        ${formatPoint(totalPoints)}
      </strong>
    </div>

    <div class="team-summary-card">
      <div class="summary-icon">
        <i data-lucide="calendar-days"></i>
      </div>

      <span class="summary-label">
        ${fourthLabel}
      </span>

      <strong class="summary-value">
        ${fourthValue}
      </strong>
    </div>
  `;
}

/* =========================
   年度別成績
========================= */

function renderTeamHistory(teamRows) {
  const teamHistoryBody =
    document.getElementById("teamHistoryBody");

  if (!teamHistoryBody) {
    return;
  }

  if (teamRows.length === 0) {
    teamHistoryBody.innerHTML = `
      <tr>
        <td colspan="5">
          該当する成績データがありません。
        </td>
      </tr>
    `;

    return;
  }

  const stageOrder = {
    Regular: 1,
    レギュラー: 1,
    "Semi-Final": 2,
    Final: 3
  };

  const historyRows =
    [...teamRows].sort((a, b) => {
      const yearDiff =
        Number(b["年度"]) -
        Number(a["年度"]);

      if (yearDiff !== 0) {
        return yearDiff;
      }

      const stageA =
        HLDB.normalizeStage(a["ステージ"]);

      const stageB =
        HLDB.normalizeStage(b["ステージ"]);

      return (
        (stageOrder[stageA] || 99) -
        (stageOrder[stageB] || 99)
      );
    });

  teamHistoryBody.innerHTML =
    historyRows
      .map(row => {
        const year =
          row["年度"] || "－";

        const league =
          HLDB.normalizeLeague(
            row["リーグ"]
          ) || "－";

        const stage =
          HLDB.normalizeStage(
            row["ステージ"]
          ) || "－";

        const rank =
          toNullableNumber(row["順位"]);

        const matches =
          toNumber(row["試合数"]);

        const points =
          toNumber(row["ポイント"]);

        const leagueStage = [
          league,
          stage
        ]
          .filter(value =>
            value &&
            value !== "－"
          )
          .join(" / ");

        return `
          <tr>
            <td>
              ${escapeHtml(year)}
            </td>

            <td>
              ${escapeHtml(leagueStage || "－")}
            </td>

            <td>
              ${
                rank !== null && rank > 0
                  ? `${rank}位`
                  : "－"
              }
            </td>

            <td>
              ${matches}試合
            </td>

            <td>
              ${formatPoint(points)}
            </td>
          </tr>
        `;
      })
      .join("");
}

/* =========================
   選手一覧
========================= */

function renderTeamPlayers() {
  const teamPlayerBody =
    document.getElementById("teamPlayerBody");

  const playerListTitle =
    document.getElementById("playerListTitle");

  if (!teamPlayerBody) {
    return;
  }

  const targetRows =
    playersData.filter(row => {
      const rowTeamName =
        String(
          row["チーム名"] ??
          row["チーム"] ??
          ""
        ).trim();

      const rowYear =
        String(
          row["年度"] ??
          ""
        ).trim();

      const sameTeam =
        rowTeamName ===
        String(teamName).trim();

      const sameYear =
        selectedYear === "total" ||
        rowYear === String(selectedYear);

      return sameTeam && sameYear;
    });

  if (selectedYear === "total") {
    playerListTitle.innerHTML = `
      <i data-lucide="users"></i>
      歴代選手一覧
    `;
  } else {
    playerListTitle.innerHTML = `
      <i data-lucide="users"></i>
      ${escapeHtml(selectedYear)}年 所属選手
    `;
  }

  if (targetRows.length === 0) {
    teamPlayerBody.innerHTML = `
      <tr>
        <td colspan="8">
          該当する選手データがありません。
        </td>
      </tr>
    `;

    return;
  }

  const playerMap = new Map();

  targetRows.forEach(row => {
    const playerName =
      String(
        row["選手名"] ??
        row["選手"] ??
        row["名前"] ??
        ""
      ).trim();

    if (!playerName) {
      return;
    }

    if (!playerMap.has(playerName)) {
      playerMap.set(playerName, {
        name: playerName,
        years: new Set(),
        matches: 0,
        points: 0,
        tops: 0,
        topRateWeightedTotal: 0,
        lastAvoidWeightedTotal: 0,
        highestScore: null,
        latestYear: "",
        latestLeague: "",
        latestStage: ""
      });
    }

    const player =
      playerMap.get(playerName);

    const year =
      String(row["年度"] || "").trim();

    const matches =
      toNumber(row["試合数"]);

    const points =
      toNumber(
        row["ポイント"] ??
        row["合計ポイント"] ??
        row["スコア"]
      );

    const tops =
      toNumber(
        row["トップ数"] ??
        row["トップ"] ??
        row["1位回数"] ??
        row["最多勝利"]
      );

    const topRate =
      toPercentNumber(
        row["トップ率"]
      );

    const lastAvoidRate =
      toPercentNumber(
        row["ラス回避率"] ??
        row["4着回避率"]
      );

    const highestScore =
      toNullableNumber(
        row["最高得点"] ??
        row["最高スコア"]
      );

    if (year) {
      player.years.add(year);
    }

    player.matches += matches;
    player.points += points;
    player.tops += tops;

    player.topRateWeightedTotal +=
      topRate * matches;

    player.lastAvoidWeightedTotal +=
      lastAvoidRate * matches;

    if (
      highestScore !== null &&
      (
        player.highestScore === null ||
        highestScore > player.highestScore
      )
    ) {
      player.highestScore =
        highestScore;
    }

    if (
      !player.latestYear ||
      Number(year) >
      Number(player.latestYear)
    ) {
      player.latestYear = year;

      player.latestLeague =
        HLDB.normalizeLeague(
          row["リーグ"]
        );

      player.latestStage =
        HLDB.normalizeStage(
          row["ステージ"]
        );
    }
  });

  const players =
    [...playerMap.values()]
      .map(player => {
        const years =
          [...player.years].sort(
            (a, b) =>
              Number(a) - Number(b)
          );

        const topRate =
          player.matches > 0
            ? (
                player.topRateWeightedTotal /
                player.matches
              )
            : 0;

        const lastAvoidRate =
          player.matches > 0
            ? (
                player.lastAvoidWeightedTotal /
                player.matches
              )
            : 0;

        return {
          ...player,
          years,
          topRate,
          lastAvoidRate
        };
      })
      .sort((a, b) => {
        const pointDiff =
          b.points - a.points;

        if (pointDiff !== 0) {
          return pointDiff;
        }

        return b.matches - a.matches;
      });

  const highestPoints =
    Math.max(
      ...players.map(
        player => player.points
      )
    );

  const highestMatches =
    Math.max(
      ...players.map(
        player => player.matches
      )
    );

  teamPlayerBody.innerHTML =
    players
      .map(player => {
        const isTeamMvp =
          player.points === highestPoints;

        const isMostPlayed =
          player.matches === highestMatches;

        const yearText =
          formatPlayerYears(player.years);

        const playerUrl =
          createPlayerUrl(player);

        const badges = [];

        if (isTeamMvp) {
          badges.push(`
            <span class="team-player-badge team-mvp-badge">
              <i data-lucide="crown"></i>
              チームMVP
            </span>
          `);
        }

        if (isMostPlayed) {
          badges.push(`
            <span class="team-player-badge most-played-badge">
              <i data-lucide="flame"></i>
              最多出場
            </span>
          `);
        }

        return `
          <tr>
            <td>
              <a
                class="team-player-link"
                href="${playerUrl}"
              >
                ${escapeHtml(player.name)}
              </a>

              <div class="team-player-badges">
                ${badges.join("")}
              </div>
            </td>

            <td>
              ${escapeHtml(yearText)}
            </td>

            <td>
              ${player.matches}試合
            </td>

            <td>
              ${formatPoint(player.points)}
            </td>

            <td>
              ${player.tops}勝
            </td>

            <td>
              ${formatPercent(player.topRate)}
            </td>

            <td>
              ${formatPercent(player.lastAvoidRate)}
            </td>

            <td>
              ${
                player.highestScore !== null
                  ? `${Math.round(
                      player.highestScore
                    ).toLocaleString()}点`
                  : "－"
              }
            </td>
          </tr>
        `;
      })
      .join("");
}

/* =========================
   現在のチーム詳細へのリンク
========================= */

function setCurrentTeamPageLink(teamRows) {
  const currentTeamPageLink =
    document.getElementById(
      "currentTeamPageLink"
    );

  if (!currentTeamPageLink) {
    return;
  }

  const latestRow =
    [...teamRows].sort((a, b) => {
      const yearDiff =
        Number(b["年度"]) -
        Number(a["年度"]);

      if (yearDiff !== 0) {
        return yearDiff;
      }

      const stageOrder = {
        Regular: 1,
        レギュラー: 1,
        "Semi-Final": 2,
        Final: 3
      };

      const stageA =
        HLDB.normalizeStage(
          a["ステージ"]
        );

      const stageB =
        HLDB.normalizeStage(
          b["ステージ"]
        );

      return (
        (stageOrder[stageB] || 0) -
        (stageOrder[stageA] || 0)
      );
    })[0];

  if (!latestRow) {
    currentTeamPageLink.style.display =
      "none";

    return;
  }

  const linkParams =
    new URLSearchParams({
      team: teamName,
      year:
        latestRow["年度"] || "",
      league:
        HLDB.normalizeLeague(
          latestRow["リーグ"]
        ) || "",
      stage:
        HLDB.normalizeStage(
          latestRow["ステージ"]
        ) || ""
    });

  currentTeamPageLink.href =
    `team.html?${linkParams.toString()}`;

  currentTeamPageLink.style.display =
    "inline-flex";
}

/* =========================
   共通関数
========================= */

function formatPlayerYears(years) {
  if (!years.length) {
    return "－";
  }

  if (years.length === 1) {
    return years[0];
  }

  const firstYear = years[0];
  const lastYear =
    years[years.length - 1];

  const isContinuous =
    years.every((year, index) =>
      Number(year) ===
      Number(firstYear) + index
    );

  return isContinuous
    ? `${firstYear}〜${lastYear}`
    : years.join("・");
}

function createPlayerUrl(player) {
  const playerParams =
    new URLSearchParams();

  playerParams.set(
    "player",
    player.name
  );

  if (player.latestYear) {
    playerParams.set(
      "year",
      player.latestYear
    );
  }

  if (player.latestLeague) {
    playerParams.set(
      "league",
      player.latestLeague
    );
  }

  if (player.latestStage) {
    playerParams.set(
      "stage",
      player.latestStage
    );
  }

  return `player.html?${playerParams.toString()}`;
}

function toNumber(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  const number = Number(
    String(value)
      .replace(/,/g, "")
      .replace(/pt/gi, "")
      .replace(/試合/g, "")
      .replace(/勝/g, "")
      .trim()
  );

  return Number.isFinite(number)
    ? number
    : 0;
}

function toNullableNumber(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number = Number(
    String(value)
      .replace(/,/g, "")
      .replace(/点/g, "")
      .trim()
  );

  return Number.isFinite(number)
    ? number
    : null;
}

function toPercentNumber(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  const text =
    String(value).trim();

  const number =
    Number(text.replace("%", ""));

  if (!Number.isFinite(number)) {
    return 0;
  }

  return (
    text.includes("%") ||
    number > 1
  )
    ? number
    : number * 100;
}

function formatPercent(value) {
  return `${value.toFixed(1)}%`;
}

function formatPoint(value) {
  const sign =
    value > 0 ? "+" : "";

  return `${sign}${value.toFixed(1)}pt`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

init();