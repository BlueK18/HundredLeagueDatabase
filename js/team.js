const TEAMS_CSV_URL =
  "data/teams.csv";

const MATCHES_CSV_URL =
  "data/matches.csv";

const PLAYERS_CSV_URL =
  "data/players.csv";

const params = new URLSearchParams(window.location.search);

const teamName = params.get("team") || "";
const year = params.get("year") || "2025";
const league = params.get("league") || "";
const stage = params.get("stage") || "";

const teamTitle = document.getElementById("teamTitle");
const teamInfo = document.getElementById("teamInfo");
const teamPlayers = document.getElementById("teamPlayers");
const teamMatches = document.getElementById("teamMatches");

teamTitle.textContent = teamName || "チーム詳細";


/* =========================
   CSV読み込み
========================= */

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const character = line[i];
    const nextCharacter = line[i + 1];

    if (character === '"' && insideQuotes && nextCharacter === '"') {
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
  const lines = text
    .trim()
    .split(/\r?\n/)
    .filter(line => line.trim() !== "");

  if (lines.length === 0) {
    return [];
  }

  const headers = parseCsvLine(lines.shift()).map(header =>
    header.trim()
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


/* =========================
   表記統一
========================= */

function normalizeLeague(value) {
  const text = String(value || "").trim();

  if (text.startsWith("A")) return "A";
  if (text.startsWith("B")) return "B";

  return text;
}


function normalizeStage(value) {
  const text = String(value || "").trim();

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


function displayStageName(value) {
  const normalized = normalizeStage(value);

  if (normalized === "Semi-Final") {
    return "セミファイナル";
  }

  if (normalized === "Final") {
    return "ファイナル";
  }

  return "レギュラー";
}


/* =========================
   表示用
========================= */

function formatDecimal(value, digits = 1) {
  const number = Number(
    String(value || "")
      .replace(/,/g, "")
      .replace(/pt/gi, "")
      .trim()
  );

  if (!Number.isFinite(number)) {
    return "―";
  }

  return number.toFixed(digits);
}


function formatPlacement(value) {
  const text = String(value || "").trim();

  if (text === "") {
    return "―";
  }

  return text.endsWith("着")
    ? text
    : `${text}着`;
}


/* =========================
   データ読み込み
========================= */

async function loadTeamDetail() {
  try {
    const [
  teamsData,
  matchesData,
  playersData
] = await Promise.all([
  HLDB.loadData("teams"),
  HLDB.loadData("matches"),
  HLDB.loadData("players")
]);

    const selectedTeam = teamsData.find(row =>
      row["チーム"] === teamName &&
      row["年度"] === year &&
      normalizeLeague(row["リーグ"]) === normalizeLeague(league) &&
      normalizeStage(row["ステージ"]) === normalizeStage(stage)
    );

    if (!selectedTeam) {
      teamInfo.innerHTML = `
        <p>該当するチームデータが見つかりませんでした。</p>
        <p><a href="index.html">← 順位表へ戻る</a></p>
      `;

      teamPlayers.innerHTML = "";
      teamMatches.innerHTML = "";
      return;
    }

    renderTeamInfo(selectedTeam);
    renderTeamPlayers(playersData);
    renderTeamMatches(matchesData);

  } catch (error) {
    console.error(error);

    teamInfo.innerHTML = `
      <p>チームデータを読み込めませんでした。</p>
      <p><a href="index.html">← 順位表へ戻る</a></p>
    `;

    teamPlayers.innerHTML =
      "<p>所属選手を読み込めませんでした。</p>";

    teamMatches.innerHTML =
      "<p>試合履歴を読み込めませんでした。</p>";
  }
}


/* =========================
   チーム情報
========================= */

function renderTeamInfo(team) {
  const point = formatDecimal(team["ポイント"]);

  const pointDiff = team["ポイント差"]
    ? formatDecimal(team["ポイント差"])
    : "―";

  teamTitle.textContent = team["チーム"] || teamName;

  teamInfo.innerHTML = `
    <div class="team-detail">

      <p>
        ${team["年度"]}年・
        ${normalizeLeague(team["リーグ"])}リーグ
      </p>

      <p>${displayStageName(team["ステージ"])}</p>

      <div class="team-stats">

        <div>
          <span>順位</span>
          <strong>${team["順位"]}位</strong>
        </div>

        <div>
          <span>ポイント</span>
          <strong>${point} pt</strong>
        </div>

        <div>
          <span>試合数</span>
          <strong>${team["試合数"]}</strong>
        </div>

        <div>
          <span>着順分布</span>
          <strong>${team["着順分布"]}</strong>
        </div>

        <div>
          <span>ポイント差</span>
          <strong>${pointDiff}</strong>
        </div>

      </div>

      <p>
        <a href="index.html">← 順位表へ戻る</a>
      </p>

    </div>
  `;
}


/* =========================
   所属選手一覧
========================= */

function renderTeamPlayers(playersData) {
  const selectedPlayers = playersData
    .filter(row =>
      row["年度"] === year &&
      row["チーム名"] === teamName &&
      normalizeLeague(row["リーグ"]) === normalizeLeague(league) &&
      normalizeStage(row["ステージ"]) === normalizeStage(stage)
    )
    .sort((a, b) =>
      Number(a["順位"] || 9999) -
      Number(b["順位"] || 9999)
    );

  if (selectedPlayers.length === 0) {
    teamPlayers.innerHTML = `
      <p>所属選手のデータがありません。</p>
    `;
    return;
  }

  teamPlayers.innerHTML = `
    <div class="player-list">

      ${selectedPlayers.map(player => {
        const playerUrl =
          `player.html?player=${encodeURIComponent(player["選手名"])}`
          + `&year=${encodeURIComponent(player["年度"])}`
          + `&league=${encodeURIComponent(player["リーグ"])}`
          + `&stage=${encodeURIComponent(player["ステージ"])}`;

        return `
          <a class="player-card" href="${playerUrl}">

            <div class="player-card-name">
              ${player["選手名"]}
            </div>

            <div class="player-card-stats">
              <span>${player["順位"]}位</span>
              <span>${formatDecimal(player["ポイント"])} pt</span>
              <span>${player["試合数"]}試合</span>
            </div>

          </a>
        `;
      }).join("")}

    </div>
  `;
}


/* =========================
   試合履歴
========================= */

function renderTeamMatches(matchesData) {
  const selectedMatches = matchesData.filter(row =>
    row["年度"] === year &&
    row["チーム名"] === teamName &&
    normalizeLeague(row["リーグ"]) === normalizeLeague(league) &&
    normalizeStage(row["ステージ"]) === normalizeStage(stage)
  );

  if (selectedMatches.length === 0) {
    teamMatches.innerHTML = `
      <p>このステージの試合履歴はありません。</p>
    `;
    return;
  }

  teamMatches.innerHTML = `
    <div class="matches-table-wrapper">

      <table>
        <thead>
          <tr>
            <th>日付</th>
            <th>選手</th>
            <th>着順</th>
            <th>スコア</th>
          </tr>
        </thead>

        <tbody>
          ${selectedMatches.map(match => `
            <tr>

              <td>
                ${match["日付"] || "―"}
              </td>

              <td>
                <a
                  class="team-link"
                  href="player.html?player=${encodeURIComponent(match["選手名"])}&year=${encodeURIComponent(year)}&league=${encodeURIComponent(league)}&stage=${encodeURIComponent(stage)}"
                >
                  ${match["選手名"] || "―"}
                </a>
              </td>

              <td>
                ${formatPlacement(match["着順"])}
              </td>

              <td>
                ${match["スコア"] !== ""
                  ? `${formatDecimal(match["スコア"])} pt`
                  : "―"}
              </td>

            </tr>
          `).join("")}
        </tbody>

      </table>

    </div>
  `;
}


loadTeamDetail();