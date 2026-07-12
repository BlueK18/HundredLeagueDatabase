/* ========================================
   ハンドレッドリーグ データベース
   共通設定・共通関数
======================================== */

window.HLDB = window.HLDB || {};


/* ========================================
   公開CSVのURL
======================================== */

HLDB.DATA_URLS = {
  teams:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQOdocYk8ObQRgGJj3FCgHlECXxOJ1v0JC5etquS1xGs-j5XU__lfCW5jFOWtQXvLRKQglX_2kYPmHO/pub?gid=1681226504&single=true&output=csv",

  matches:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQOdocYk8ObQRgGJj3FCgHlECXxOJ1v0JC5etquS1xGs-j5XU__lfCW5jFOWtQXvLRKQglX_2kYPmHO/pub?gid=1561387699&single=true&output=csv",

  players:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQOdocYk8ObQRgGJj3FCgHlECXxOJ1v0JC5etquS1xGs-j5XU__lfCW5jFOWtQXvLRKQglX_2kYPmHO/pub?gid=1337045347&single=true&output=csv",

  awards:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQOdocYk8ObQRgGJj3FCgHlECXxOJ1v0JC5etquS1xGs-j5XU__lfCW5jFOWtQXvLRKQglX_2kYPmHO/pub?gid=869325336&single=true&output=csv"
};


/* ========================================
   CSV解析
======================================== */

HLDB.parseCsvLine = function (line) {
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
};


HLDB.parseCsv = function (text) {
  const lines = String(text || "")
    .trim()
    .split(/\r?\n/)
    .filter(line => line.trim() !== "");

  if (lines.length === 0) {
    return [];
  }

  const headers = HLDB
    .parseCsvLine(lines.shift())
    .map(header => header.trim());

  return lines.map(line => {
    const values = HLDB.parseCsvLine(line);
    const item = {};

    headers.forEach((header, index) => {
      item[header] = values[index]?.trim() || "";
    });

    return item;
  });
};


/* ========================================
   CSV取得
======================================== */

HLDB.fetchCsv = async function (url) {
  const response = await fetch(url, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(
      `CSVデータを取得できませんでした。Status: ${response.status}`
    );
  }

  const text = await response.text();

  return HLDB.parseCsv(text);
};


HLDB.loadData = async function (dataName) {
  const url = HLDB.DATA_URLS[dataName];

  if (!url) {
    throw new Error(
      `CSVのURLが登録されていません: ${dataName}`
    );
  }

  return HLDB.fetchCsv(url);
};


/* ========================================
   リーグ・ステージ表記統一
======================================== */

HLDB.normalizeLeague = function (value) {
  const text = String(value || "").trim();

  if (text.startsWith("A")) return "A";
  if (text.startsWith("B")) return "B";

  return text;
};


HLDB.displayLeagueName = function (value) {
  const league = HLDB.normalizeLeague(value);

  if (league === "A") return "Aリーグ";
  if (league === "B") return "Bリーグ";

  return league || "―";
};


HLDB.normalizeStage = function (value) {
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
};


HLDB.displayStageName = function (value) {
  const stage = HLDB.normalizeStage(value);

  if (stage === "Semi-Final") {
    return "セミファイナル";
  }

  if (stage === "Final") {
    return "ファイナル";
  }

  return "レギュラー";
};


/* ========================================
   数値の変換
======================================== */

HLDB.toNumber = function (value) {
  const text = String(value ?? "")
    .replace(/,/g, "")
    .replace(/pt/gi, "")
    .replace(/点/g, "")
    .replace(/勝/g, "")
    .replace(/%/g, "")
    .trim();

  if (text === "") {
    return null;
  }

  const number = Number(text);

  return Number.isFinite(number)
    ? number
    : null;
};


/* ========================================
   数値表示
======================================== */

HLDB.formatDecimal = function (value, digits = 1) {
  const number = HLDB.toNumber(value);

  if (number === null) {
    return "―";
  }

  return number.toFixed(digits);
};


HLDB.formatInteger = function (value) {
  const number = HLDB.toNumber(value);

  if (number === null) {
    return "―";
  }

  return Math.round(number).toLocaleString("ja-JP");
};


HLDB.formatPercent = function (value) {
  const originalText = String(value ?? "").trim();

  if (originalText === "") {
    return "―";
  }

  const number = HLDB.toNumber(value);

  if (number === null) {
    return "―";
  }

  const percent = originalText.includes("%")
    ? number
    : Math.abs(number) <= 1
      ? number * 100
      : number;

  return `${percent.toFixed(1)}%`;
};


HLDB.formatRank = function (value) {
  const text = String(value ?? "").trim();

  if (text === "") {
    return "―";
  }

  return text.endsWith("位")
    ? text
    : `${text}位`;
};


HLDB.formatPlacement = function (value) {
  const text = String(value ?? "").trim();

  if (text === "") {
    return "―";
  }

  return text.endsWith("着")
    ? text
    : `${text}着`;
};


HLDB.formatScore = function (value) {
  const number = HLDB.toNumber(value);

  if (number === null) {
    return "―";
  }

  const sign = number > 0 ? "+" : "";

  return `${sign}${number.toFixed(1)} pt`;
};


HLDB.formatPoints = function (value) {
  const number = HLDB.toNumber(value);

  if (number === null) {
    return "―";
  }

  return `${number.toFixed(1)} pt`;
};


HLDB.formatMahjongScore = function (value) {
  const number = HLDB.toNumber(value);

  if (number === null) {
    return "―";
  }

  return `${Math.round(number).toLocaleString("ja-JP")}点`;
};


/* ========================================
   HTML安全対策
======================================== */

HLDB.escapeHtml = function (value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
};


/* ========================================
   URL作成
======================================== */

HLDB.createPlayerUrl = function ({
  player,
  year,
  league,
  stage
}) {
  const query = new URLSearchParams({
    player: player || "",
    year: year || "",
    league: league || "",
    stage: stage || ""
  });

  return `player.html?${query.toString()}`;
};


HLDB.createTeamUrl = function ({
  team,
  year,
  league,
  stage
}) {
  const query = new URLSearchParams({
    team: team || "",
    year: year || "",
    league: league || "",
    stage: stage || ""
  });

  return `team.html?${query.toString()}`;
};


/* ========================================
   URLパラメータ取得
======================================== */

HLDB.getUrlParams = function () {
  const params = new URLSearchParams(
    window.location.search
  );

  return {
    team: params.get("team") || "",
    player: params.get("player") || "",
    year: params.get("year") || "2025",
    league: params.get("league") || "",
    stage: params.get("stage") || ""
  };
};
/* ========================================
   全ページ共通・選手検索
======================================== */

HLDB.searchPlayersData = null;

HLDB.initializePlayerSearch = async function () {
  const input = document.getElementById("siteSearchInput");
  const resultsArea =
    document.getElementById("siteSearchResults");

  if (!input || !resultsArea) {
    return;
  }

  try {
    if (!HLDB.searchPlayersData) {
      const allPlayers = await HLDB.loadData("players");

      /*
        同じ選手が複数ステージにいる場合は、
        レギュラーシーズンを優先して1名1件にまとめる
      */
      const playerMap = new Map();

      allPlayers.forEach(player => {
        const playerName =
          String(player["選手名"] || "").trim();

        if (!playerName) {
          return;
        }

        const existing = playerMap.get(playerName);

        const isRegular =
          HLDB.normalizeStage(player["ステージ"]) ===
          "レギュラー";

        if (!existing || isRegular) {
          playerMap.set(playerName, player);
        }
      });

      HLDB.searchPlayersData = [
        ...playerMap.values()
      ].sort((a, b) =>
        String(a["選手名"]).localeCompare(
          String(b["選手名"]),
          "ja"
        )
      );
    }

    function closeResults() {
      resultsArea.innerHTML = "";
      resultsArea.classList.remove("is-open");
    }

    function showResults(keyword) {
      const searchText =
        String(keyword || "").trim().toLowerCase();

      if (!searchText) {
        closeResults();
        return;
      }

      const matches = HLDB.searchPlayersData
        .filter(player => {
          const playerName =
            String(player["選手名"] || "")
              .toLowerCase();

          const teamName =
            String(player["チーム名"] || "")
              .toLowerCase();

          return (
            playerName.includes(searchText) ||
            teamName.includes(searchText)
          );
        })
        .slice(0, 10);

      if (matches.length === 0) {
        resultsArea.innerHTML = `
          <div class="site-search-empty">
            該当する選手がいません
          </div>
        `;

        resultsArea.classList.add("is-open");
        return;
      }

      resultsArea.innerHTML = matches
        .map(player => {
          const playerUrl = HLDB.createPlayerUrl({
            player: player["選手名"],
            year: player["年度"],
            league: player["リーグ"],
            stage: player["ステージ"]
          });

          return `
            <a
              class="site-search-result"
              href="${playerUrl}"
            >
              <strong>
                ${HLDB.escapeHtml(player["選手名"])}
              </strong>

              <span>
                ${HLDB.escapeHtml(
                  player["チーム名"] || "所属不明"
                )}
              </span>
            </a>
          `;
        })
        .join("");

      resultsArea.classList.add("is-open");
    }

    input.addEventListener("input", event => {
      showResults(event.target.value);
    });

    input.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        input.value = "";
        closeResults();
      }

      if (event.key === "Enter") {
        const firstResult =
          resultsArea.querySelector(
            ".site-search-result"
          );

        if (firstResult) {
          window.location.href = firstResult.href;
        }
      }
    });

    document.addEventListener("click", event => {
      if (!event.target.closest(".site-search")) {
        closeResults();
      }
    });

  } catch (error) {
    console.error("選手検索の読込エラー:", error);

    resultsArea.innerHTML = `
      <div class="site-search-empty">
        検索データを読み込めませんでした
      </div>
    `;

    resultsArea.classList.add("is-open");
  }
};

document.addEventListener(
  "DOMContentLoaded",
  HLDB.initializePlayerSearch
);