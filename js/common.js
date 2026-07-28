/* ========================================
   ハンドレッドリーグ データベース
   共通設定・共通関数
======================================== */

window.HLDB = window.HLDB || {};


/* ========================================
   公開CSVのURL
======================================== */

HLDB.DATA_URLS = {
  teams: "data/teams.csv",
  players: "data/players.csv",
  matches: "data/matches.csv",
  awards: "data/awards.csv",
  playerAlias: "data/playerAlias.csv",

  news: "data/news.csv",

  newsFallback:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQOdocYk8ObQRgGJj3FCgHlECXxOJ1v0JC5etquS1xGs-j5XU__lfCW5jFOWtQXvLRKQglX_2kYPmHO/pub?gid=1687688944&single=true&output=csv"
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


/* ========================================
   CSVデータキャッシュ
======================================== */

HLDB.DATA_CACHE_TIME =
  10 * 60 * 1000; // 10分


HLDB.memoryDataCache =
  HLDB.memoryDataCache || {};


/*
  データを読み込む

  通常：
  10分以内のキャッシュがあれば再利用

  強制更新：
  HLDB.loadData("players", true)
*/
HLDB.loadData = async function (
  dataName,
  forceRefresh = false
) {
  const url =
    HLDB.DATA_URLS[dataName];

  if (!url) {
    throw new Error(
      `CSVのURLが登録されていません: ${dataName}`
    );
  }

  const cacheKey =
    `hldbDataCache_${dataName}`;

  const cacheTimeKey =
    `hldbDataCacheTime_${dataName}`;

  const now =
    Date.now();


  /*
    ① 同じページ内のメモリキャッシュ
  */
  const memoryCache =
    HLDB.memoryDataCache[dataName];

  if (
    !forceRefresh &&
    memoryCache &&
    now - memoryCache.savedAt <
      HLDB.DATA_CACHE_TIME
  ) {
    console.log(
      `${dataName}: メモリキャッシュを使用`
    );

    return memoryCache.data;
  }


  /*
    ② ブラウザ保存済みキャッシュ
  */
  if (!forceRefresh) {
    try {
      const savedAt =
        Number(
          localStorage.getItem(
            cacheTimeKey
          )
        );

      const cachedText =
        localStorage.getItem(
          cacheKey
        );

      const cacheIsValid =
        cachedText &&
        Number.isFinite(savedAt) &&
        now - savedAt <
          HLDB.DATA_CACHE_TIME;

      if (cacheIsValid) {
        const cachedData =
          JSON.parse(cachedText);

        HLDB.memoryDataCache[
          dataName
        ] = {
          data: cachedData,
          savedAt
        };

        console.log(
          `${dataName}: ブラウザキャッシュを使用`
        );

        return cachedData;
      }

    } catch (error) {
      console.warn(
        `${dataName}: キャッシュ読込失敗`,
        error
      );
    }
  }


  /*
    ③ Google Sheetsから最新データ取得
  */
  try {
    console.log(
      `${dataName}: CSVを取得`
    );

    let freshData;

if (dataName === "news") {
  try {
    /*
      まずローカルCSVを取得する
    */
    freshData =
      await HLDB.fetchCsv(url);

    /*
      ファイルが空、または見出しだけなら
      スプレッドシートへ切り替える
    */
    if (
      !Array.isArray(freshData) ||
      freshData.length === 0
    ) {
      throw new Error(
        "ローカルのお知らせCSVが空です"
      );
    }

    console.log(
      "news: ローカルCSVを使用"
    );

  } catch (localNewsError) {
    const fallbackUrl =
      HLDB.DATA_URLS.newsFallback;

    if (!fallbackUrl) {
      throw localNewsError;
    }

    console.warn(
      "news: ローカルCSVを使用できないため、スプレッドシートへ切り替えます",
      localNewsError
    );

    freshData =
      await HLDB.fetchCsv(
        fallbackUrl
      );

    console.log(
      "news: スプレッドシートCSVを使用"
    );
  }

} else {
  freshData =
    await HLDB.fetchCsv(url);
}

HLDB.memoryDataCache[
  dataName
] = {
  data: freshData,
  savedAt: now
};


    /*
      データ量が大きすぎる場合は、
      localStorage保存だけ失敗することがあります。

      その場合でもCSV取得結果はそのまま使えます。
    */
    try {
      localStorage.setItem(
        cacheKey,
        JSON.stringify(freshData)
      );

      localStorage.setItem(
        cacheTimeKey,
        String(now)
      );

    } catch (storageError) {
      console.warn(
        `${dataName}: キャッシュ保存を省略しました`,
        storageError
      );
    }

    return freshData;

  } catch (fetchError) {
    console.error(
      `${dataName}: CSV取得失敗`,
      fetchError
    );


    /*
      ④ 通信失敗時は期限切れキャッシュを使う
    */
    try {
      const oldCacheText =
        localStorage.getItem(
          cacheKey
        );

      if (oldCacheText) {
        const oldData =
          JSON.parse(oldCacheText);

        console.warn(
          `${dataName}: 古いキャッシュを代用`
        );

        return oldData;
      }

    } catch (cacheError) {
      console.error(
        `${dataName}: 古いキャッシュも使用不可`,
        cacheError
      );
    }

    throw fetchError;
  }
};


/* ========================================
   選手Alias関連
======================================== */

/* 検索名を比較用に整える */
HLDB.normalizePlayerAliasName = function (value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .trim()
    .toLowerCase();
};


/* 参加名から選手IDを取得 */
HLDB.getPlayerIdFromAlias = function (
  playerName,
  playerAliasData
) {
  const normalizedName =
    HLDB.normalizePlayerAliasName(playerName);

  if (!normalizedName) {
    return "";
  }

  const matchedAlias =
    playerAliasData.find(row => {
      return (
        HLDB.normalizePlayerAliasName(
          row["検索名"]
        ) === normalizedName
      );
    });

  return String(
    matchedAlias?.["選手ID"] ?? ""
  ).trim();
};


/* 選手IDから全参加名を取得 */
HLDB.getPlayerAliasNames = function (
  playerId,
  playerAliasData
) {
  const normalizedId =
    String(playerId ?? "").trim();

  if (!normalizedId) {
    return [];
  }

  return [
    ...new Set(
      playerAliasData
        .filter(row => {
          return (
            String(
              row["選手ID"] ?? ""
            ).trim() === normalizedId
          );
        })
        .map(row => {
          return String(
            row["検索名"] ?? ""
          ).trim();
        })
        .filter(Boolean)
    )
  ];
};


/*
  保存済みキャッシュを削除する
*/
HLDB.clearDataCache = function (
  dataName = ""
) {
  if (dataName) {
    localStorage.removeItem(
      `hldbDataCache_${dataName}`
    );

    localStorage.removeItem(
      `hldbDataCacheTime_${dataName}`
    );

    delete HLDB.memoryDataCache[
      dataName
    ];

    console.log(
      `${dataName}: キャッシュ削除`
    );

    return;
  }

  Object.keys(
    HLDB.DATA_URLS
  ).forEach(name => {
    localStorage.removeItem(
      `hldbDataCache_${name}`
    );

    localStorage.removeItem(
      `hldbDataCacheTime_${name}`
    );
  });

  HLDB.memoryDataCache = {};

  console.log(
    "すべてのデータキャッシュを削除"
  );
};
/* ========================================
   年度表記統一
======================================== */

HLDB.normalizeYear = function (value) {
  return String(value || "")
    .match(/\d{4}/)?.[0] || "";
};


/* ========================================
   リーグ・ステージ表記統一
======================================== */

HLDB.normalizeLeague = function (value) {
  const text = String(value || "").trim();

  if (text.startsWith("A")) {
    return "A";
  }

  if (text.startsWith("B")) {
    return "B";
  }

  return text;
};


HLDB.displayLeagueName = function (value) {
  const league =
    HLDB.normalizeLeague(value);

  if (league === "A") {
    return "Aリーグ";
  }

  if (league === "B") {
    return "Bリーグ";
  }

  return league || "―";
};


HLDB.normalizeStage = function (value) {
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
};


HLDB.displayStageName = function (value) {
  const stage =
    HLDB.normalizeStage(value);

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
  const text =
    String(value ?? "")
      .replace(/,/g, "")
      .replace(/pt/gi, "")
      .replace(/点/g, "")
      .replace(/勝/g, "")
      .replace(/%/g, "")
      .trim();

  if (text === "") {
    return null;
  }

  const number =
    Number(text);

  return Number.isFinite(number)
    ? number
    : null;
};


/* ========================================
   数値表示
======================================== */

HLDB.formatDecimal = function (
  value,
  digits = 1
) {
  const number =
    HLDB.toNumber(value);

  if (number === null) {
    return "―";
  }

  return number.toFixed(digits);
};


HLDB.formatInteger = function (value) {
  const number =
    HLDB.toNumber(value);

  if (number === null) {
    return "―";
  }

  return Math
    .round(number)
    .toLocaleString("ja-JP");
};


HLDB.formatPercent = function (value) {
  const originalText =
    String(value ?? "").trim();

  if (originalText === "") {
    return "―";
  }

  const number =
    HLDB.toNumber(value);

  if (number === null) {
    return "―";
  }

  const percent =
    originalText.includes("%")
      ? number
      : Math.abs(number) <= 1
        ? number * 100
        : number;

  return `${percent.toFixed(1)}%`;
};


HLDB.formatRank = function (value) {
  const text =
    String(value ?? "").trim();

  if (text === "") {
    return "―";
  }

  return text.endsWith("位")
    ? text
    : `${text}位`;
};


HLDB.formatPlacement = function (value) {
  const text =
    String(value ?? "").trim();

  if (text === "") {
    return "―";
  }

  return text.endsWith("着")
    ? text
    : `${text}着`;
};


HLDB.formatScore = function (value) {
  const number =
    HLDB.toNumber(value);

  if (number === null) {
    return "―";
  }

  const sign =
    number > 0 ? "+" : "";

  return `${sign}${number.toFixed(1)} pt`;
};


HLDB.formatPoints = function (value) {
  const number =
    HLDB.toNumber(value);

  if (number === null) {
    return "―";
  }

  return `${number.toFixed(1)} pt`;
};


HLDB.formatMahjongScore = function (value) {
  const number =
    HLDB.toNumber(value);

  if (number === null) {
    return "―";
  }

  return `${Math
    .round(number)
    .toLocaleString("ja-JP")}点`;
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
  id,
  year,
  league,
  stage
}) {
  const query =
    new URLSearchParams({
      id: id || "",
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
  const query =
    new URLSearchParams({
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
  const params =
    new URLSearchParams(
      window.location.search
    );

  return {
    team:
      params.get("team") || "",

    player:
      params.get("player") || "",

    id:
      params.get("id") || "",

    year:
      params.get("year") || "2025",

    league:
      params.get("league") || "",

    stage:
      params.get("stage") || ""
  };
};


/* ========================================
   選手検索用の文字統一
======================================== */

HLDB.normalizeSearchText = function (value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .trim()
    .toLowerCase();
};


/* ========================================
   全ページ共通・選手検索データ
======================================== */

HLDB.searchPlayersData =
  HLDB.searchPlayersData || null;


HLDB.loadPlayerSearchData =
  async function () {
    if (HLDB.searchPlayersData) {
      return HLDB.searchPlayersData;
    }

    const [
      allPlayers,
      playerAliasData
    ] = await Promise.all([
      HLDB.loadData("players"),
      HLDB.loadData("playerAlias")
        .catch(() => [])
    ]);

    const playerMap =
      new Map();

    allPlayers.forEach(player => {
      const playerName =
        String(
          player["選手名"] || ""
        ).trim();

      const playerId =
        String(
          player["選手ID"] || ""
        ).trim();

      if (!playerName) {
        return;
      }

      const aliasPlayerId =
        playerId ||
        HLDB.getPlayerIdFromAlias(
          playerName,
          playerAliasData
        );

      const mapKey =
        aliasPlayerId ||
        HLDB.normalizeSearchText(
          playerName
        );

      const existing =
        playerMap.get(mapKey);

      const currentStage =
        HLDB.normalizeStage(
          player["ステージ"]
        );

      const existingStage =
        existing
          ? HLDB.normalizeStage(
              existing["ステージ"]
            )
          : "";

      const currentYear =
        Number(
          HLDB.normalizeYear(
            player["年度"]
          )
        ) || 0;

      const existingYear =
        existing
          ? Number(
              HLDB.normalizeYear(
                existing["年度"]
              )
            ) || 0
          : 0;

      const currentIsRegular =
        currentStage === "レギュラー";

      const existingIsRegular =
        existingStage === "レギュラー";

      const shouldReplace =
        !existing ||
        (
          currentYear >
          existingYear
        ) ||
        (
          currentYear === existingYear &&
          currentIsRegular &&
          !existingIsRegular
        );

      if (shouldReplace) {
        playerMap.set(
          mapKey,
          {
            ...player,
            "選手ID":
              aliasPlayerId ||
              playerId
          }
        );
      }
    });

    HLDB.searchPlayersData = [
      ...playerMap.values()
    ].sort((a, b) => {
      return String(
        a["選手名"] || ""
      ).localeCompare(
        String(
          b["選手名"] || ""
        ),
        "ja"
      );
    });

    return HLDB.searchPlayersData;
  };


/* ========================================
   選手検索結果取得
======================================== */

HLDB.findPlayerSearchMatches =
  function (
    keyword,
    limit = 15
  ) {
    const searchText =
      HLDB.normalizeSearchText(
        keyword
      );

    if (!searchText) {
      return [];
    }

    return (
      HLDB.searchPlayersData || []
    )
      .filter(player => {
        const playerName =
          HLDB.normalizeSearchText(
            player["選手名"]
          );

        const teamName =
          HLDB.normalizeSearchText(
            player["チーム名"]
          );

        return (
          playerName.includes(
            searchText
          ) ||
          teamName.includes(
            searchText
          )
        );
      })
      .slice(0, limit);
  };


/* ========================================
   上部の選手検索
======================================== */

HLDB.initializePlayerSearch =
  async function () {
    try {
      await HLDB.loadPlayerSearchData();
    } catch (error) {
      console.error(
        "選手検索データの読込エラー:",
        error
      );

      return;
    }

    const input =
      document.getElementById(
        "siteSearchInput"
      );

    const resultsArea =
      document.getElementById(
        "siteSearchResults"
      );

    if (!input || !resultsArea) {
      return;
    }

    function closeResults() {
      resultsArea.innerHTML = "";
      resultsArea.classList.remove(
        "is-open"
      );
    }

    function showResults(keyword) {
      const searchText =
        String(keyword || "").trim();

      if (!searchText) {
        closeResults();
        return;
      }

      const matches =
        HLDB.findPlayerSearchMatches(
          searchText,
          10
        );

      if (matches.length === 0) {
        resultsArea.innerHTML = `
          <div class="site-search-empty">
            該当する選手がいません
          </div>
        `;

        resultsArea.classList.add(
          "is-open"
        );

        return;
      }

      resultsArea.innerHTML =
        matches
          .map(player => {
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

            return `
              <a
                class="site-search-result"
                href="${playerUrl}"
              >
                <strong>
                  ${HLDB.escapeHtml(
                    player["選手名"]
                  )}
                </strong>

                <span>
                  ${HLDB.escapeHtml(
                    player["チーム名"] ||
                    "所属不明"
                  )}
                </span>
              </a>
            `;
          })
          .join("");

      resultsArea.classList.add(
        "is-open"
      );
    }

    input.addEventListener(
      "input",
      event => {
        showResults(
          event.target.value
        );
      }
    );

    input.addEventListener(
      "keydown",
      event => {
        if (event.key === "Escape") {
          input.value = "";
          closeResults();
          return;
        }

        if (event.key === "Enter") {
          const firstResult =
            resultsArea.querySelector(
              ".site-search-result"
            );

          if (firstResult) {
            window.location.href =
              firstResult.href;
          }
        }
      }
    );

    document.addEventListener(
      "click",
      event => {
        if (
          !event.target.closest(
            ".site-search"
          )
        ) {
          closeResults();
        }
      }
    );
  };
  /* ========================================
   全ページ共通・選手検索モーダル
======================================== */

HLDB.createPlayerSearchModal = function () {
  if (
    document.getElementById(
      "playerSearchModal"
    )
  ) {
    return;
  }

  const modal =
    document.createElement("div");

  modal.id =
    "playerSearchModal";

  modal.className =
    "player-search-modal";

  modal.setAttribute(
    "aria-hidden",
    "true"
  );

  modal.innerHTML = `
    <div
      class="player-search-modal-backdrop"
      data-close-player-search
    ></div>

    <div
      class="player-search-modal-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="playerSearchModalTitle"
    >
      <div class="player-search-modal-header">
        <h2 id="playerSearchModalTitle">
          <i
            data-lucide="user-search"
            aria-hidden="true"
          ></i>

          選手検索
        </h2>

        <button
          type="button"
          class="player-search-modal-close"
          data-close-player-search
          aria-label="選手検索を閉じる"
        >
          <i
            data-lucide="x"
            aria-hidden="true"
          ></i>
        </button>
      </div>

      <div class="player-search-modal-body">
        <div class="modal-player-search">
          <i
            data-lucide="search"
            class="modal-player-search-icon"
            aria-hidden="true"
          ></i>

          <input
            id="modalPlayerSearchInput"
            type="search"
            placeholder="選手名・チーム名を検索"
            autocomplete="off"
            enterkeyhint="search"
          >
        </div>

        <div
          id="modalPlayerSearchResults"
          class="modal-player-search-results"
          aria-live="polite"
        >
          <p class="modal-player-search-guide">
            選手名またはチーム名を入力してください。
          </p>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(
    modal
  );

  if (window.lucide) {
    window.lucide.createIcons({
      attrs: {
        "stroke-width": 2
      }
    });
  }

  const openButton =
    document.getElementById(
      "openPlayerSearchModal"
    );

  const input =
    document.getElementById(
      "modalPlayerSearchInput"
    );

  const resultsArea =
    document.getElementById(
      "modalPlayerSearchResults"
    );

    

  const closeButtons =
    modal.querySelectorAll(
      "[data-close-player-search]"
    );

  const panel =
    modal.querySelector(
      ".player-search-modal-panel"
    );

  let lastFocusedElement =
    null;


  function renderGuide() {
    resultsArea.innerHTML = `
      <p class="modal-player-search-guide">
        選手名またはチーム名を入力してください。
      </p>
    `;
  }


  function renderLoading() {
    resultsArea.innerHTML = `
      <div class="modal-player-search-empty">
        選手データを読み込んでいます
      </div>
    `;
  }


  function renderError() {
    resultsArea.innerHTML = `
      <div class="modal-player-search-empty">
        検索データを読み込めませんでした
      </div>
    `;
  }


  function openModal() {
    lastFocusedElement =
      document.activeElement;

    modal.classList.add(
      "is-open"
    );

    modal.setAttribute(
      "aria-hidden",
      "false"
    );

    document.body.classList.add(
      "player-search-modal-open"
    );

    input.value = "";

    if (!HLDB.searchPlayersData) {
      renderLoading();
    } else {
      renderGuide();
    }

    window.setTimeout(() => {
      input.focus();
    }, 50);
  }


  function closeModal() {
    modal.classList.remove(
      "is-open"
    );

    modal.setAttribute(
      "aria-hidden",
      "true"
    );

    document.body.classList.remove(
      "player-search-modal-open"
    );

    input.value = "";

    renderGuide();

    if (
      lastFocusedElement &&
      typeof lastFocusedElement.focus ===
        "function"
    ) {
      window.setTimeout(() => {
        lastFocusedElement.focus();
      }, 0);
    }
  }


  function showModalResults(
    keyword
  ) {
    const searchText =
      String(keyword || "").trim();

    if (!searchText) {
      renderGuide();
      return;
    }

    if (!HLDB.searchPlayersData) {
      renderLoading();
      return;
    }

    const matches =
      HLDB.findPlayerSearchMatches(
        searchText,
        15
      );

    if (matches.length === 0) {
      resultsArea.innerHTML = `
        <div class="modal-player-search-empty">
          該当する選手がいません
        </div>
      `;

      return;
    }

    resultsArea.innerHTML =
      matches
        .map(player => {
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

          const playerName =
            HLDB.escapeHtml(
              player["選手名"] ||
              "選手名不明"
            );

          const teamName =
            HLDB.escapeHtml(
              player["チーム名"] ||
              "所属不明"
            );

          const year =
            HLDB.escapeHtml(
              HLDB.normalizeYear(
                player["年度"]
              )
            );

          const league =
            HLDB.escapeHtml(
              HLDB.displayLeagueName(
                player["リーグ"]
              )
            );

          return `
            <a
              class="modal-player-search-result"
              href="${playerUrl}"
            >
              <span class="modal-player-search-main">
                <span class="modal-player-search-name">
                  ${playerName}
                </span>

                <span class="modal-player-search-team">
                  ${teamName}
                </span>
              </span>

              <span class="modal-player-search-meta">
                ${year}
                ${league !== "―"
                  ? ` ${league}`
                  : ""}
              </span>

              <i
                data-lucide="chevron-right"
                aria-hidden="true"
              ></i>
            </a>
          `;
        })
        .join("");

    if (window.lucide) {
      window.lucide.createIcons({
        attrs: {
          "stroke-width": 2
        }
      });
    }
  }


  if (openButton) {
    openButton.addEventListener(
      "click",
      async event => {
        event.preventDefault();

        openModal();

        try {
          await HLDB
            .loadPlayerSearchData();

          if (
            input.value.trim()
          ) {
            showModalResults(
              input.value
            );
          } else {
            renderGuide();
          }

        } catch (error) {
          console.error(
            "選手検索モーダルの読込エラー:",
            error
          );

          renderError();
        }
      }
    );
  }


  closeButtons.forEach(
    button => {
      button.addEventListener(
        "click",
        closeModal
      );
    }
  );


  input.addEventListener(
    "input",
    event => {
      showModalResults(
        event.target.value
      );
    }
  );


  input.addEventListener(
    "keydown",
    event => {
      if (
        event.key === "Escape"
      ) {
        closeModal();
        return;
      }

      if (
        event.key === "Enter"
      ) {
        const firstResult =
          resultsArea.querySelector(
            ".modal-player-search-result"
          );

        if (firstResult) {
          window.location.href =
            firstResult.href;
        }
      }

      if (
        event.key === "ArrowDown"
      ) {
        const firstResult =
          resultsArea.querySelector(
            ".modal-player-search-result"
          );

        if (firstResult) {
          event.preventDefault();
          firstResult.focus();
        }
      }
    }
  );


  resultsArea.addEventListener(
    "keydown",
    event => {
      const currentResult =
        event.target.closest(
          ".modal-player-search-result"
        );

      if (!currentResult) {
        return;
      }

      const allResults = [
        ...resultsArea.querySelectorAll(
          ".modal-player-search-result"
        )
      ];

      const currentIndex =
        allResults.indexOf(
          currentResult
        );

      if (
        event.key === "ArrowDown"
      ) {
        event.preventDefault();

        const nextResult =
          allResults[
            currentIndex + 1
          ];

        if (nextResult) {
          nextResult.focus();
        }
      }

      if (
        event.key === "ArrowUp"
      ) {
        event.preventDefault();

        const previousResult =
          allResults[
            currentIndex - 1
          ];

        if (previousResult) {
          previousResult.focus();
        } else {
          input.focus();
        }
      }

      if (
        event.key === "Escape"
      ) {
        closeModal();
      }
    }
  );


  document.addEventListener(
    "keydown",
    event => {
      if (
        event.key === "Escape" &&
        modal.classList.contains(
          "is-open"
        )
      ) {
        closeModal();
      }

      if (
        event.key === "Tab" &&
        modal.classList.contains(
          "is-open"
        ) &&
        panel
      ) {
        const focusableElements = [
          ...panel.querySelectorAll(
            `
              button:not([disabled]),
              input:not([disabled]),
              a[href]
            `
          )
        ];

        if (
          focusableElements.length === 0
        ) {
          return;
        }

        const firstElement =
          focusableElements[0];

        const lastElement =
          focusableElements[
            focusableElements.length - 1
          ];

        if (
          event.shiftKey &&
          document.activeElement ===
            firstElement
        ) {
          event.preventDefault();
          lastElement.focus();
        } else if (
          !event.shiftKey &&
          document.activeElement ===
            lastElement
        ) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    }
  );
};


/* ========================================
   年度選択肢を自動生成
======================================== */

HLDB.populateYearSelect = function (
  selectId,
  data,
  yearKey = "年度"
) {
  const yearSelect =
    document.getElementById(
      selectId
    );

  if (!yearSelect) {
    return;
  }

  const currentYear =
    HLDB.normalizeYear(
      yearSelect.value
    );

  const years = [
    ...new Set(
      data
        .map(row => {
          return HLDB.normalizeYear(
            row[yearKey]
          );
        })
        .filter(Boolean)
    )
  ].sort((a, b) => {
    return Number(b) -
      Number(a);
  });

  if (years.length === 0) {
    yearSelect.innerHTML = `
      <option value="">
        年度データなし
      </option>
    `;

    return;
  }

  yearSelect.innerHTML =
    years
      .map(year => {
        return `
          <option
            value="${HLDB.escapeHtml(
              year
            )}"
          >
            ${HLDB.escapeHtml(
              year
            )}
          </option>
        `;
      })
      .join("");

  yearSelect.value =
    years.includes(
      currentYear
    )
      ? currentYear
      : years[0];
};
/* ========================================
   現在ページ名を取得
======================================== */

HLDB.getCurrentPageName = function () {
  const path =
    window.location.pathname;

  const fileName =
    path.split("/").pop();

  return fileName || "index.html";
};


/* ========================================
   下部ナビゲーション
======================================== */

HLDB.createBottomNavigation = function () {
  if (
    document.getElementById(
      "bottomNavigation"
    )
  ) {
    return;
  }

  const currentPage =
    HLDB.getCurrentPageName();

  const navigation =
    document.createElement("nav");

  navigation.id =
    "bottomNavigation";

  navigation.className =
    "bottom-navigation";

  navigation.setAttribute(
    "aria-label",
    "下部ナビゲーション"
  );

  const isHome =
    currentPage === "index.html" ||
    currentPage === "";

  const isTeams =
    currentPage === "team.html";

  const isAwards =
    currentPage === "awards.html";

  const isNews =
    currentPage === "news.html";

  navigation.innerHTML = `
    <a
      href="index.html"
      class="bottom-navigation-item ${
        isHome ? "is-active" : ""
      }"
      aria-label="ホーム"
    >
      <i
        data-lucide="home"
        aria-hidden="true"
      ></i>

      <span>HOME</span>
    </a>

    <a
      href="index.html#teamRanking"
      class="bottom-navigation-item ${
        isTeams ? "is-active" : ""
      }"
      aria-label="チーム順位"
    >
      <i
        data-lucide="users"
        aria-hidden="true"
      ></i>

      <span>チーム順位</span>
    </a>

    <button
      type="button"
      id="openPlayerSearchModal"
      class="bottom-navigation-item bottom-navigation-button"
      aria-label="選手検索"
    >
      <i
        data-lucide="user-search"
        aria-hidden="true"
      ></i>

      <span>選手検索</span>
    </button>

    <a
      href="awards.html"
      class="bottom-navigation-item ${
        isAwards ? "is-active" : ""
      }"
      aria-label="個人賞"
    >
      <i
        data-lucide="trophy"
        aria-hidden="true"
      ></i>

      <span>個人賞</span>
    </a>

    <a
      href="news.html"
      class="bottom-navigation-item ${
        isNews ? "is-active" : ""
      }"
      aria-label="お知らせ"
    >
      <i
        data-lucide="bell"
        aria-hidden="true"
      ></i>

      <span>お知らせ</span>
    </a>
  `;

  document.body.appendChild(
    navigation
  );

  if (window.lucide) {
    window.lucide.createIcons({
      attrs: {
        "stroke-width": 2
      }
    });
  }
};


/* ========================================
   横スクロール案内
======================================== */

HLDB.initializeHorizontalScrollHints =
  function () {
    const scrollContainers =
      document.querySelectorAll(
        `
          .table-scroll,
          .table-scroll-container,
          .ranking-table-scroll,
          .horizontal-scroll
        `
      );

    scrollContainers.forEach(
      container => {
      
        const historyTable =
  container.querySelector(
    "#teamHistoryTable, #teamHistoryBody"
  );

if (historyTable) {
  return;
}
        if (
          container.dataset
            .scrollHintInitialized ===
          "true"
        ) {
          return;
        }

        container.dataset
          .scrollHintInitialized =
          "true";

        const wrapper =
          container.parentElement;

        if (!wrapper) {
          return;
        }

        wrapper.classList.add(
          "horizontal-scroll-wrapper"
        );

        let hint =
          wrapper.querySelector(
            ".horizontal-scroll-hint"
          );

        if (!hint) {
          hint =
            document.createElement(
              "div"
            );

          hint.className =
            "horizontal-scroll-hint";

          hint.innerHTML = `
            <i
              data-lucide="move-horizontal"
              aria-hidden="true"
            ></i>

            <span>
              横にスクロールできます
            </span>
          `;

          wrapper.appendChild(
            hint
          );
        }

        function updateHint() {
          const canScroll =
            container.scrollWidth >
            container.clientWidth + 2;

          const isAtEnd =
            container.scrollLeft +
              container.clientWidth >=
            container.scrollWidth - 4;

          wrapper.classList.toggle(
            "has-horizontal-scroll",
            canScroll
          );

          wrapper.classList.toggle(
            "is-scroll-end",
            isAtEnd
          );

          hint.hidden =
            !canScroll ||
            container.scrollLeft > 20;
        }

        container.addEventListener(
          "scroll",
          updateHint,
          {
            passive: true
          }
        );

        window.addEventListener(
          "resize",
          updateHint
        );

        updateHint();
      }
    );

    if (window.lucide) {
      window.lucide.createIcons({
        attrs: {
          "stroke-width": 2
        }
      });
    }
  };


/* ========================================
   戻るボタン
======================================== */

HLDB.initializeBackButtons =
  function () {
    const buttons =
      document.querySelectorAll(
        `
          [data-back-button],
          .js-back-button
        `
      );

    buttons.forEach(button => {
      if (
        button.dataset
          .backButtonInitialized ===
        "true"
      ) {
        return;
      }

      button.dataset
        .backButtonInitialized =
        "true";

      button.addEventListener(
        "click",
        event => {
          event.preventDefault();

          if (
            window.history.length > 1
          ) {
            window.history.back();
            return;
          }

          window.location.href =
            "index.html";
        }
      );
    });
  };


/* ========================================
   Lucideアイコン初期化
======================================== */

HLDB.initializeIcons = function () {
  if (!window.lucide) {
    return;
  }

  window.lucide.createIcons({
    attrs: {
      "stroke-width": 2
    }
  });
};


/* ========================================
   共通UI初期化
======================================== */

HLDB.initializeCommonUi =
  async function () {
    try {
      /*
        先に下部ナビを作成する
      */
      HLDB.createBottomNavigation();

      /*
        モーダル本体を作成する
      */
      HLDB.createPlayerSearchModal();

      /*
        選手データを先読みする
      */
      await HLDB
        .initializePlayerSearch();

      /*
        その他の共通機能
      */
      HLDB
        .initializeHorizontalScrollHints();

      HLDB
        .initializeBackButtons();

      HLDB
        .initializeIcons();

        await HLDB
  .updateNewsNavigationState();

    } catch (error) {
      console.error(
        "共通UIの初期化に失敗しました:",
        error
      );
    }
  };

/* ========================================
   YouTube応援ポップアップ
======================================== */

HLDB.initializeSupportPopup =
  function () {
    const DISPLAY_INTERVAL = 20;

    const countKey =
      "hldbSupportPopupPageCount";

    const neverShowKey =
      "hldbSupportPopupNeverShow";

    /*
      「登録してるよ」が押されていれば
      今後は表示しない
    */
    if (
      localStorage.getItem(
        neverShowKey
      ) === "true"
    ) {
      return;
    }

    let pageCount =
      Number(
        localStorage.getItem(
          countKey
        )
      );

    if (
      !Number.isFinite(pageCount)
    ) {
      pageCount = 0;
    }

    pageCount += 1;

    localStorage.setItem(
      countKey,
      String(pageCount)
    );

    if (
      pageCount <
      DISPLAY_INTERVAL
    ) {
      return;
    }

    /*
      今回表示したので0へ戻す。

      「今回は閉じる」の場合は、
      また20ページ後に表示される。
    */
    localStorage.setItem(
      countKey,
      "0"
    );

    HLDB.showSupportPopup();
  };


HLDB.showSupportPopup =
  function () {
    if (
      document.getElementById(
        "supportPopupOverlay"
      )
    ) {
      return;
    }

    const overlay =
      document.createElement(
        "div"
      );

    overlay.id =
      "supportPopupOverlay";

    overlay.className =
      "support-popup-overlay";

    overlay.innerHTML = `
      <div
        class="support-popup"
        role="dialog"
        aria-modal="true"
        aria-labelledby="supportPopupTitle"
      >

        <div class="support-popup-icon">
  <span class="support-popup-play">
    ▶
  </span>
</div>

        <h2 id="supportPopupTitle">
          いつもご利用いただき<br>
  ありがとうございます！
        </h2>

        <p class="support-popup-message">
  ハンドレッドリーグ データバンクを<br>
  ご利用いただきありがとうございます。
</p>

<p class="support-popup-sub-message">
  このサイトが役に立った、<br>
  また利用したいと思っていただけましたら、<br><br>

  YouTubeチャンネル登録で<br>
  応援していただけると、<br>
  今後もより良いサイト作りの励みになります！
</p>

        <div class="support-popup-actions">
          <a
  class="support-popup-youtube"
  href="https://www.youtube.com/@Blue-K18%E3%81%AE%E6%88%90%E9%95%B7%E6%97%A5%E8%A8%98"
  target="_blank"
  rel="noopener noreferrer"
>
  <span class="support-popup-button-play">
    ▶
  </span>
  YouTubeチャンネルを見る
</a>

          <button
            type="button"
            class="support-popup-thanks"
            id="supportPopupNeverShow"
          >
            <i data-lucide="check"></i>
            登録してるよ。いつもありがとう
          </button>

          <button
            type="button"
            class="support-popup-later"
            id="supportPopupCloseButton"
          >
            今回は閉じる
          </button>
        </div>
        <div class="support-popup-actions">
  …
</div>

<div class="support-popup-footer">
  Presented by Blue
</div>
      </div>
    `;

    document.body.appendChild(
      overlay
    );

    document.body.classList.add(
      "support-popup-open"
    );

    if (
      typeof lucide !==
      "undefined"
    ) {
      lucide.createIcons();
    }

    const closePopup =
      function () {
        overlay.remove();

        document.body.classList.remove(
          "support-popup-open"
        );
      };
      const youtubeButton =
  overlay.querySelector(
    ".support-popup-youtube"
  );

youtubeButton?.addEventListener(
  "click",
  function () {
    localStorage.setItem(
      "hldbSupportPopupNeverShow",
      "true"
    );

    localStorage.removeItem(
      "hldbSupportPopupPageCount"
    );

    closePopup();
  }
);


    document
      .getElementById(
        "supportPopupCloseButton"
      )
      ?.addEventListener(
        "click",
        closePopup
      );

    document
      .getElementById(
        "supportPopupNeverShow"
      )
      ?.addEventListener(
        "click",
        function () {
          localStorage.setItem(
            "hldbSupportPopupNeverShow",
            "true"
          );

          localStorage.removeItem(
            "hldbSupportPopupPageCount"
          );

          closePopup();
        }
      );

    overlay.addEventListener(
      "click",
      function (event) {
        if (
          event.target ===
          overlay
        ) {
          closePopup();
        }
      }
    );

    const escapeHandler =
      function (event) {
        if (
          event.key !==
          "Escape"
        ) {
          return;
        }

        closePopup();

        document.removeEventListener(
          "keydown",
          escapeHandler
        );
      };

    document.addEventListener(
      "keydown",
      escapeHandler
    );
  };

/* ========================================
   DOM読込後に共通処理を実行
======================================== */

if (
  document.readyState ===
  "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    () => {
      HLDB.initializeCommonUi();
      HLDB.initializeSupportPopup();
    }
  );

} else {
  HLDB.initializeCommonUi();
  HLDB.initializeSupportPopup();
}
/* ========================================
   お知らせ未読管理
======================================== */

HLDB.NEWS_READ_STORAGE_KEY =
  "hldbLastReadNewsKey";


HLDB.createNewsKey = function (newsItem) {
  if (!newsItem) {
    return "";
  }

  return [
    String(
      newsItem["日付"] || ""
    ).trim(),

    String(
      newsItem["タイトル"] || ""
    ).trim(),

    String(
      newsItem["カテゴリ"] || ""
    ).trim()
  ].join("|");
};


HLDB.isPublishedNews = function (newsItem) {
  const value =
    String(
      newsItem?.["公開"] || ""
    )
      .trim()
      .toLowerCase();

  return (
    value === "true" ||
    value === "1" ||
    value === "yes" ||
    value === "公開"
  );
};


HLDB.getNewsDateNumber = function (value) {
  const text =
    String(value || "").trim();

  if (!text) {
    return 0;
  }

  const normalized =
    text
      .replace(/[年月]/g, "/")
      .replace(/日/g, "")
      .replace(/\./g, "/")
      .replace(/-/g, "/");

  const date =
    new Date(normalized);

  const time =
    date.getTime();

  return Number.isFinite(time)
    ? time
    : 0;
};


HLDB.getLatestPublishedNews =
  function (newsData) {
    return [...newsData]
      .filter(
        HLDB.isPublishedNews
      )
      .sort((a, b) => {
        return (
          HLDB.getNewsDateNumber(
            b["日付"]
          ) -
          HLDB.getNewsDateNumber(
            a["日付"]
          )
        );
      })[0] || null;
  };


HLDB.markLatestNewsAsRead =
  function (newsItem) {
    const newsKey =
      HLDB.createNewsKey(
        newsItem
      );

    if (!newsKey) {
      return;
    }

    localStorage.setItem(
      HLDB.NEWS_READ_STORAGE_KEY,
      newsKey
    );
  };


HLDB.updateNewsNavigationState =
  async function () {
    const newsLinks =
      document.querySelectorAll(
        'a[href*="news.html"]'
      );

    if (
      newsLinks.length === 0
    ) {
      return;
    }

    try {
      const newsData =
        await HLDB.loadData(
          "news"
        );

      const latestNews =
        HLDB.getLatestPublishedNews(
          newsData
        );

      if (!latestNews) {
        return;
      }

      const latestNewsKey =
        HLDB.createNewsKey(
          latestNews
        );

      const lastReadNewsKey =
        localStorage.getItem(
          HLDB.NEWS_READ_STORAGE_KEY
        ) || "";

      const isNewsPage =
        window.location.pathname
          .toLowerCase()
          .endsWith(
            "/news.html"
          ) ||
        window.location.pathname
          .toLowerCase()
          .endsWith(
            "news.html"
          );

      if (isNewsPage) {
        HLDB.markLatestNewsAsRead(
          latestNews
        );
      }

      const hasUnreadNews =
        !isNewsPage &&
        latestNewsKey !==
          lastReadNewsKey;

          newsLinks.forEach(link => {
            link.classList.toggle(
              "has-unread-news",
              hasUnreadNews
            );
          });

    } catch (error) {
      console.error(
        "お知らせ未読判定エラー:",
        error
      );
    }
  };
/* ========================================
   Screenshot Mode
======================================== */

/*
  iPhone・iPadを判定する
*/
HLDB.isIOSDevice = function () {

  return (
    /iPad|iPhone|iPod/.test(
      navigator.userAgent
    ) ||
    (
      navigator.platform === "MacIntel" &&
      navigator.maxTouchPoints > 1
    )
  );

};


/*
  iPhone判定だけに依存せず、
  タッチ端末で共有機能が使える場合も
  モバイル用保存画面を使用する
*/
HLDB.shouldUseMobileScreenshotSave =
  function () {

    return (
      HLDB.isIOSDevice() ||
      window.innerWidth <= 900 ||
      window.matchMedia?.(
        "(pointer: coarse)"
      )?.matches ||
      (
        navigator.maxTouchPoints > 0 &&
        typeof navigator.share === "function"
      )
    );

  };


/*
  Webフォント待ちが終わらない場合でも
  保存処理を継続できるようにする
*/
HLDB.waitForScreenshotFonts =
  async function () {

    if (!document.fonts?.ready) {
      return;
    }

    await Promise.race([

      document.fonts.ready,

      new Promise(resolve => {
        window.setTimeout(resolve, 5000);
      })

    ]);

  };


/*
  iPhone Safariで処理が止まり続けないように
  制限時間を設ける
*/
HLDB.withScreenshotTimeout =
  function (
    promise,
    timeoutMs,
    processName
  ) {

    return Promise.race([

      promise,

      new Promise((
        resolve,
        reject
      ) => {

        window.setTimeout(
          () => {
            reject(
              new Error(
                `${processName}が時間内に完了しませんでした。`
              )
            );
          },
          timeoutMs
        );

      })

    ]);

  };


/*
  html2canvas 1.4.1はiOS Safariで
  loading="lazy"の画像がページ内にあると
  DOM複製が止まる場合があるため解除する
*/
HLDB.prepareIOSImagesForScreenshot =
  async function () {

    if (!HLDB.shouldUseMobileScreenshotSave()) {
      return;
    }

    document
      .querySelectorAll(
        'img[loading="lazy"]'
      )
      .forEach(image => {

        image.loading = "eager";
        image.removeAttribute("loading");

      });

    await new Promise(resolve => {

      requestAnimationFrame(() => {

        requestAnimationFrame(resolve);

      });

    });

  };


/*
  CanvasをPNGのBlobへ変換する
*/
HLDB.createScreenshotBlob =
  function (canvas) {

    return new Promise((
      resolve,
      reject
    ) => {

      canvas.toBlob(
        blob => {

          if (!blob) {
            reject(
              new Error(
                "PNGデータを作成できませんでした。"
              )
            );
            return;
          }

          resolve(blob);

        },
        "image/png"
      );

    });

  };


/*
  iPhone用の保存・共有画面を表示する
*/
HLDB.showIOSScreenshotSaveDialog =
  function ({
    blob,
    fileName
  }) {

    document
      .getElementById(
        "screenshot-ios-save-overlay"
      )
      ?.remove();

    const imageUrl =
      URL.createObjectURL(blob);

    const file =
      new File(
        [blob],
        fileName,
        { type: "image/png" }
      );

    const canShareFile =
      typeof navigator.share === "function" &&
      (
        typeof navigator.canShare !== "function" ||
        navigator.canShare({ files: [file] })
      );

    const saveOverlay =
      document.createElement("div");

    saveOverlay.id =
      "screenshot-ios-save-overlay";

    saveOverlay.innerHTML = `
      <div class="screenshot-ios-save-dialog">

        <h3>画像を保存</h3>

        <p>
          下のボタンを押し、共有画面から<br>
          「画像を保存」を選んでください。
        </p>

        <img
          src="${imageUrl}"
          alt="作成した画像">

        <button
          type="button"
          class="screenshot-ios-share-button">
          写真へ保存する
        </button>

        <button
          type="button"
          class="screenshot-ios-open-button">
          画像だけを開く
        </button>

        <button
          type="button"
          class="screenshot-ios-close-button">
          閉じる
        </button>

      </div>
    `;

    Object.assign(
      saveOverlay.style,
      {
        position: "fixed",
        inset: "0",
        zIndex: "2147483647",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "18px",
        background: "rgba(0,0,0,.82)",
        overflow: "auto"
      }
    );

    const dialog =
      saveOverlay.querySelector(
        ".screenshot-ios-save-dialog"
      );

    Object.assign(
      dialog.style,
      {
        width: "min(520px, 100%)",
        padding: "22px",
        color: "#fff",
        textAlign: "center",
        background: "#181818",
        border: "1px solid rgba(212,175,55,.5)",
        borderRadius: "18px"
      }
    );

    const previewImage =
      dialog.querySelector("img");

    Object.assign(
      previewImage.style,
      {
        display: "block",
        width: "100%",
        height: "auto",
        margin: "18px 0",
        borderRadius: "10px"
      }
    );

    dialog
      .querySelectorAll("button")
      .forEach(button => {

        Object.assign(
          button.style,
          {
            width: "100%",
            marginTop: "10px",
            padding: "14px",
            color: "#fff",
            fontSize: "16px",
            fontWeight: "800",
            background: "#2a2a2a",
            border: "1px solid rgba(255,255,255,.15)",
            borderRadius: "11px"
          }
        );

      });

    const shareButton =
      dialog.querySelector(
        ".screenshot-ios-share-button"
      );

    shareButton.style.color = "#111";
    shareButton.style.background = "#d4af37";

    if (!canShareFile) {
      shareButton.textContent =
        "画像だけを開いて保存する";
    }

    const closeDialog = () => {

      saveOverlay.remove();

      window.setTimeout(
        () => URL.revokeObjectURL(imageUrl),
        1000
      );

    };

    shareButton.addEventListener(
      "click",
      async () => {

        if (!canShareFile) {
          window.open(imageUrl, "_blank");
          return;
        }

        try {

          await navigator.share({
            files: [file],
            title: fileName
          });

        } catch (error) {

          if (error?.name !== "AbortError") {
            console.error(
              "画像の共有に失敗しました。",
              error
            );
          }

        }

      }
    );

    dialog
      .querySelector(
        ".screenshot-ios-open-button"
      )
      .addEventListener(
        "click",
        () => {
          window.open(imageUrl, "_blank");
        }
      );

    dialog
      .querySelector(
        ".screenshot-ios-close-button"
      )
      .addEventListener(
        "click",
        closeDialog
      );

    saveOverlay.addEventListener(
      "click",
      event => {

        if (event.target === saveOverlay) {
          closeDialog();
        }

      }
    );

    document.body.appendChild(
      saveOverlay
    );

  };


/*
  PCはダウンロード、iPhoneは共有画面へ渡す
*/
HLDB.saveScreenshotCanvas =
  async function ({
    canvas,
    fileName
  }) {

    const blob =
      await HLDB.withScreenshotTimeout(

        HLDB.createScreenshotBlob(
          canvas
        ),

        15000,
        "PNGファイルの変換"

      );

    if (HLDB.shouldUseMobileScreenshotSave()) {

      HLDB.showIOSScreenshotSaveDialog({
        blob,
        fileName
      });

      return;

    }

    const imageUrl =
      URL.createObjectURL(blob);

    const downloadLink =
      document.createElement("a");

    downloadLink.download =
      fileName;

    downloadLink.href =
      imageUrl;

    document.body.appendChild(
      downloadLink
    );

    downloadLink.click();
    downloadLink.remove();

    window.setTimeout(
      () => URL.revokeObjectURL(imageUrl),
      1000
    );

  };

HLDB.openScreenshotMode = function () {

  /*
    以前開いた画像メーカーで登録した
    resizeイベントを解除する
  */
  if (typeof HLDB.screenshotResizeHandler === "function") {

    window.removeEventListener(
      "resize",
      HLDB.screenshotResizeHandler
    );

    HLDB.screenshotResizeHandler = null;

  }

  /*
    HTML内へ表示する文字を安全な形へ変換する
  */
  const escapeHtml = value => {

    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  };

  /*
    ファイル名に使えない文字を削除する
  */
  const createSafeFileName = value => {

    return String(value ?? "")
      .replace(/[\\/:*?"<>|]/g, "")
      .replace(/\s+/g, "_")
      .trim();

  };

  /*
    画像メーカー用フォントを読み込む
  */
  if (!document.getElementById("screenshot-fonts")) {

    const fontLink =
      document.createElement("link");

    fontLink.id =
      "screenshot-fonts";

    fontLink.rel =
      "stylesheet";

    fontLink.href =
      "https://fonts.googleapis.com/css2?" +
      "family=BIZ+UDPGothic:wght@400;700&" +
      "family=Dela+Gothic+One&" +
      "family=DotGothic16&" +
      "family=Hachi+Maru+Pop&" +
      "family=Kaisei+Decol:wght@400;700&" +
      "family=Kiwi+Maru:wght@400;500&" +
      "family=Kosugi+Maru&" +
      "family=M+PLUS+Rounded+1c:wght@400;700;800&" +
      "family=Mochiy+Pop+One&" +
      "family=Noto+Sans+JP:wght@400;700;900&" +
      "family=Rampart+One&" +
      "family=Reggae+One&" +
      "family=RocknRoll+One&" +
      "family=Shippori+Mincho:wght@400;700;800&" +
      "family=Stick&" +
      "family=Train+One&" +
      "family=Yusei+Magic&" +
      "family=Zen+Kaku+Gothic+New:wght@400;500;700&" +
      "family=Zen+Maru+Gothic:wght@400;700;900&" +
      "family=Zen+Old+Mincho:wght@400;700&" +
      "display=swap";

    document.head.appendChild(
      fontLink
    );

  }

  const data =
    HLDB.screenshotData || {};

  const rawTeamName =
    data.teamName || "チーム名";

  const rawYear =
    data.year ?? "―";

  const rawLeague =
    data.league || "";

  const rawStage =
    data.stage || "";

  const rawRank =
    data.rank;

  const rawPoint =
    data.point;

  const teamName =
    escapeHtml(rawTeamName);

  const year =
    escapeHtml(rawYear);

  const league =
    escapeHtml(rawLeague);

  const stage =
    escapeHtml(rawStage);

  const rank =
    rawRank !== undefined &&
    rawRank !== null &&
    rawRank !== ""
      ? `${escapeHtml(rawRank)}位`
      : "―";

  const point =
    rawPoint !== undefined &&
    rawPoint !== null &&
    rawPoint !== ""
      ? `${escapeHtml(rawPoint)}pt`
      : "―";

  const leagueText =
    rawLeague === "単一リーグ"
      ? ""
      : (
          rawLeague &&
          String(rawLeague).endsWith("リーグ")
            ? league
            : rawLeague
              ? `${league}リーグ`
              : ""
        );

  const subtitle = [

    rawYear !== undefined &&
    rawYear !== null &&
    rawYear !== ""
      ? `${year}年`
      : "",

    leagueText,

    stage

  ]
    .filter(Boolean)
    .join(" ");

  /*
    着順分布を4つへ分割する

    対応例：
    12-10-8-6
    12－10－8－6
    12 / 10 / 8 / 6
  */
  const placements =
    String(data.placements || "")
      .split(/[-－–—/／,\s]+/)
      .map(value => value.trim())
      .filter(Boolean);

  const placementValues = [

    escapeHtml(
      placements[0] || "0"
    ),

    escapeHtml(
      placements[1] || "0"
    ),

    escapeHtml(
      placements[2] || "0"
    ),

    escapeHtml(
      placements[3] || "0"
    )

  ];

  /*
    準備画面と完成画面で共通使用するカード
  */
  const createScreenshotCard = () => `

    <div class="screenshot-card-stage">

      <div class="screenshot-card">

        <div class="screenshot-card-header">

          <div class="screenshot-card-title">
            ${teamName}
          </div>

          <div class="screenshot-card-subtitle">
            ${subtitle}
          </div>

        </div>

        <div class="screenshot-card-stats">

          <div class="screenshot-card-stat">

            <span class="screenshot-card-label">
              順位
            </span>

            <strong>
              ${rank}
            </strong>

          </div>

          <div
            class="screenshot-card-divider"
            aria-hidden="true">
          </div>

          <div class="screenshot-card-stat">

            <span class="screenshot-card-label">
              ポイント
            </span>

            <strong>
              ${point}
            </strong>

          </div>

        </div>

        <div class="screenshot-card-placements">

          <div class="screenshot-card-placement">

            <span>
              1着
            </span>

            <strong>
              ${placementValues[0]}
            </strong>

          </div>

          <div class="screenshot-card-placement">

            <span>
              2着
            </span>

            <strong>
              ${placementValues[1]}
            </strong>

          </div>

          <div class="screenshot-card-placement">

            <span>
              3着
            </span>

            <strong>
              ${placementValues[2]}
            </strong>

          </div>

          <div class="screenshot-card-placement">

            <span>
              4着
            </span>

            <strong>
              ${placementValues[3]}
            </strong>

          </div>

        </div>

        <img
          src="apple-touch-icon.png"
          class="screenshot-card-logo"
          alt="Hundred League">

      </div>

    </div>

  `;

  /*
    すでに画像メーカーが存在する場合は削除する
  */
  const existingOverlay =
    document.getElementById(
      "screenshot-overlay"
    );

  if (existingOverlay) {

    existingOverlay.remove();

  }

  const overlay =
    document.createElement("div");

  overlay.id =
    "screenshot-overlay";
    overlay.innerHTML = `

    <div class="screenshot-builder">

      <div class="screenshot-panel">

        <div class="screenshot-header">

          <h2>
            画像メーカー
          </h2>

          <p>
            標準の黒金デザインで画像を作成します
          </p>

        </div>

        <div class="screenshot-builder-preview">

          ${createScreenshotCard()}

        </div>

        <details class="screenshot-detail-setting">

          <summary class="screenshot-detail-summary">
            詳細設定
          </summary>

          <div class="screenshot-detail-content">

            <div class="screenshot-setting-group">

              <div class="screenshot-setting-group-title">
                🎨 デザイン
              </div>

              <details class="screenshot-theme-setting">

                <summary class="screenshot-theme-summary">
                  背景
                </summary>

                <div class="screenshot-theme-content">

                  <div class="screenshot-theme-list">

                    ${Array.from(
                      { length: 12 },
                      (_, index) => {

                        const themeNo =
                          String(index + 1)
                            .padStart(3, "0");

                        return `

                          <button
                            type="button"
                            class="screenshot-theme-item"
                            data-theme="${themeNo}"
                            aria-label="背景 ${themeNo}">

                            <img
                              src="assets/themes/${themeNo}.png"
                              alt="背景 ${themeNo}"
                              loading="eager">

                          </button>

                        `;

                      }
                    ).join("")}

                  </div>

                </div>

              </details>

              <div class="screenshot-setting">

                <label
                  for="screenshot-font-select"
                  class="screenshot-detail-label">

                  フォント

                </label>

                <select
                  id="screenshot-font-select"
                  class="screenshot-font-select">

                  <option value='"Noto Sans JP", sans-serif'>
                    Noto Sans JP
                  </option>

                  <option value='"BIZ UDPGothic", sans-serif'>
                    BIZ UDPゴシック
                  </option>

                  <option value='"M PLUS Rounded 1c", sans-serif'>
                    M PLUS Rounded
                  </option>

                  <option value='"Zen Kaku Gothic New", sans-serif'>
                    Zen角ゴシック
                  </option>

                  <option value='"Kosugi Maru", sans-serif'>
                    小杉丸ゴシック
                  </option>

                  <option value='"Zen Maru Gothic", sans-serif'>
                    Zen丸ゴシック
                  </option>

                  <option value='"Kiwi Maru", serif'>
                    Kiwi Maru
                  </option>

                  <option value='"Hachi Maru Pop", cursive'>
                    はちまるポップ
                  </option>

                  <option value='"Mochiy Pop One", sans-serif'>
                    モッチーポップ
                  </option>

                  <option value='"Yusei Magic", sans-serif'>
                    油性マジック
                  </option>

                  <option value='"RocknRoll One", sans-serif'>
                    ロックンロール
                  </option>

                  <option value='"Dela Gothic One", sans-serif'>
                    デラゴシック
                  </option>

                  <option value='"Reggae One", sans-serif'>
                    レゲエ
                  </option>

                  <option value='"Rampart One", sans-serif'>
                    ランパート
                  </option>

                  <option value='"Train One", sans-serif'>
                    トレイン
                  </option>

                  <option value='"Stick", sans-serif'>
                    スティック
                  </option>

                  <option value='"DotGothic16", sans-serif'>
                    ドットゴシック
                  </option>

                  <option value='"Kaisei Decol", serif'>
                    解星デコール
                  </option>

                  <option value='"Shippori Mincho", serif'>
                    しっぽり明朝
                  </option>

                  <option value='"Zen Old Mincho", serif'>
                    Zenオールド明朝
                  </option>

                </select>

              </div>

            </div>

            <div class="screenshot-setting-group">

              <div class="screenshot-setting-group-title">
                📝 文字色
              </div>
              <div class="screenshot-setting-card">

              <p class="screenshot-color-guide">
                テンプレートの色はプルダウンから選択できます。
                テンプレート以外の色は、色の四角から変更できます。
              </p>

              <div class="screenshot-color-control">

                <label
                  for="screenshot-all-text-color"
                  class="screenshot-detail-label">

                  文字色一括編集

                </label>

                <div
                  class="
                    screenshot-color-control-row
                    screenshot-all-color-row
                  ">

                  <span class="screenshot-custom-color-guide">
                    すべて同じ色に変更 →
                  </span>

                  <input
                    type="color"
                    id="screenshot-all-text-color"
                    class="screenshot-color-picker"
                    value="#ffffff"
                    aria-label="文字色を一括変更">

                </div>

              </div>

              <div class="screenshot-color-control">

                <label
                  for="screenshot-title-color-select"
                  class="screenshot-detail-label">

                  チーム名文字色

                </label>

                <div class="screenshot-color-control-row">

                  <select
                    id="screenshot-title-color-select"
                    class="
                      screenshot-title-color-select
                      screenshot-color-select
                    ">

                    <option value="#ffffff">
                      白（標準）
                    </option>

                    <option value="#d4af37">
                      金
                    </option>

                    <option value="#4aa3ff">
                      青
                    </option>

                    <option value="#ff4d4d">
                      赤
                    </option>

                    <option value="#39d98a">
                      緑
                    </option>

                    <option value="#111111">
                      黒
                    </option>

                    <option
                      value="#ffffff"
                      class="screenshot-custom-color-option">

                      カスタム

                    </option>

                  </select>

                  <span class="screenshot-custom-color-guide">
                    テンプレート以外に変えるならここ →
                  </span>

                  <input
                    type="color"
                    id="screenshot-title-color-picker"
                    class="screenshot-color-picker"
                    value="#ffffff"
                    aria-label="チーム名のカスタムカラー">

                </div>

              </div>

              <div class="screenshot-color-control">

                <label
                  for="screenshot-subtitle-color-select"
                  class="screenshot-detail-label">

                  年度・リーグ文字色

                </label>

                <div class="screenshot-color-control-row">

                  <select
                    id="screenshot-subtitle-color-select"
                    class="
                      screenshot-subtitle-color-select
                      screenshot-color-select
                    ">

                    <option value="#ffffff">
                      白（標準）
                    </option>

                    <option value="#d4af37">
                      金
                    </option>

                    <option value="#4aa3ff">
                      青
                    </option>

                    <option value="#ff4d4d">
                      赤
                    </option>

                    <option value="#39d98a">
                      緑
                    </option>

                    <option value="#111111">
                      黒
                    </option>

                    <option
                      value="#ffffff"
                      class="screenshot-custom-color-option">

                      カスタム

                    </option>

                  </select>

                  <span class="screenshot-custom-color-guide">
                    テンプレート以外に変えるならここ →
                  </span>

                  <input
                    type="color"
                    id="screenshot-subtitle-color-picker"
                    class="screenshot-color-picker"
                    value="#ffffff"
                    aria-label="年度・リーグのカスタムカラー">

                </div>

              </div>
                            <div class="screenshot-color-control">

                <label
                  for="screenshot-stats-color-select"
                  class="screenshot-detail-label">

                  順位・ポイント色

                </label>

                <div class="screenshot-color-control-row">

                  <select
                    id="screenshot-stats-color-select"
                    class="
                      screenshot-stats-color-select
                      screenshot-color-select
                    ">

                    <option value="#ffffff">
                      白（標準）
                    </option>

                    <option value="#d4af37">
                      金
                    </option>

                    <option value="#4aa3ff">
                      青
                    </option>

                    <option value="#ff4d4d">
                      赤
                    </option>

                    <option value="#39d98a">
                      緑
                    </option>

                    <option value="#111111">
                      黒
                    </option>

                    <option
                      value="#ffffff"
                      class="screenshot-custom-color-option">

                      カスタム

                    </option>

                  </select>

                  <span class="screenshot-custom-color-guide">
                    テンプレート以外に変えるならここ →
                  </span>

                  <input
                    type="color"
                    id="screenshot-stats-color-picker"
                    class="screenshot-color-picker"
                    value="#ffffff"
                    aria-label="順位・ポイントのカスタムカラー">

                </div>

              </div>

              <div class="screenshot-color-control">

                <label
                  for="screenshot-placements-color-select"
                  class="screenshot-detail-label">

                  着順色

                </label>

                <div class="screenshot-color-control-row">

                  <select
                    id="screenshot-placements-color-select"
                    class="
                      screenshot-placements-color-select
                      screenshot-color-select
                    ">

                    <option value="#ffffff">
                      白（標準）
                    </option>

                    <option value="#d4af37">
                      金
                    </option>

                    <option value="#4aa3ff">
                      青
                    </option>

                    <option value="#ff4d4d">
                      赤
                    </option>

                    <option value="#39d98a">
                      緑
                    </option>

                    <option value="#111111">
                      黒
                    </option>

                    <option
                      value="#ffffff"
                      class="screenshot-custom-color-option">

                      カスタム

                    </option>

                  </select>

                  <span class="screenshot-custom-color-guide">
                    テンプレート以外に変えるならここ →
                  </span>

                  <input
                    type="color"
                    id="screenshot-placements-color-picker"
                    class="screenshot-color-picker"
                    value="#ffffff"
                    aria-label="着順のカスタムカラー">

                    </div>

                </div>

              </div>

            </div>

          </div>

        </details>

        <div class="screenshot-actions">

          <button
            type="button"
            class="screenshot-cancel-button">

            閉じる

          </button>

          <button
            type="button"
            class="screenshot-create-button">

            画像を作成

          </button>

        </div>

      </div>

    </div>

    <div class="screenshot-preview">

      <div class="screenshot-card-stage-final">
      </div>

      <div class="screenshot-preview-actions">

        <button
          type="button"
          class="screenshot-back-button">

          戻る

        </button>

        <button
          type="button"
          class="screenshot-save-button">

          PNGで保存

        </button>

      </div>

    </div>

  `;

  const builder =
    overlay.querySelector(
      ".screenshot-builder"
    );

  const preview =
    overlay.querySelector(
      ".screenshot-preview"
    );

  const builderPreview =
    overlay.querySelector(
      ".screenshot-builder-preview"
    );

  const previewStage =
    overlay.querySelector(
      ".screenshot-card-stage-final"
    );

  const screenshotCardStage =
    overlay.querySelector(
      ".screenshot-builder-preview .screenshot-card-stage"
    );

  const screenshotCard =
    screenshotCardStage
      ? screenshotCardStage.querySelector(
          ".screenshot-card"
        )
      : null;

  const cancelButton =
    overlay.querySelector(
      ".screenshot-cancel-button"
    );

  const createButton =
    overlay.querySelector(
      ".screenshot-create-button"
    );

  const backButton =
    overlay.querySelector(
      ".screenshot-back-button"
    );

  const saveButton =
    overlay.querySelector(
      ".screenshot-save-button"
    );

  const themeItems =
    overlay.querySelectorAll(
      ".screenshot-theme-item"
    );

  const fontSelect =
    overlay.querySelector(
      "#screenshot-font-select"
    );

  const allTextColorPicker =
    overlay.querySelector(
      "#screenshot-all-text-color"
    );

  const titleColorSelect =
    overlay.querySelector(
      "#screenshot-title-color-select"
    );

  const titleColorPicker =
    overlay.querySelector(
      "#screenshot-title-color-picker"
    );

  const subtitleColorSelect =
    overlay.querySelector(
      "#screenshot-subtitle-color-select"
    );

  const subtitleColorPicker =
    overlay.querySelector(
      "#screenshot-subtitle-color-picker"
    );

  const statsColorSelect =
    overlay.querySelector(
      "#screenshot-stats-color-select"
    );

  const statsColorPicker =
    overlay.querySelector(
      "#screenshot-stats-color-picker"
    );

  const placementsColorSelect =
    overlay.querySelector(
      "#screenshot-placements-color-select"
    );

  const placementsColorPicker =
    overlay.querySelector(
      "#screenshot-placements-color-picker"
    );

  let currentTheme =
    "001";

  let currentFont =
    '"Noto Sans JP", sans-serif';

  let currentTitleColor =
    "#ffffff";

  let currentSubtitleColor =
    "#ffffff";

  let currentStatsColor =
    "#ffffff";

  let currentPlacementsColor =
    "#ffffff";

  const getScreenshotCards = () => {

    return overlay.querySelectorAll(
      ".screenshot-card"
    );

  };

  const applyTheme = themeNo => {

    currentTheme =
      String(themeNo || "001");

    getScreenshotCards().forEach(card => {

      card.style.backgroundImage =
        `url("assets/themes/${currentTheme}.png")`;

      card.style.backgroundSize =
        "cover";

      card.style.backgroundPosition =
        "center";

      card.style.backgroundRepeat =
        "no-repeat";

    });

    themeItems.forEach(item => {

      item.classList.toggle(
        "active",
        item.dataset.theme === currentTheme
      );

    });

  };

  const applyFont = fontFamily => {

    currentFont =
      fontFamily || currentFont;

    getScreenshotCards().forEach(card => {

      card.style.fontFamily =
        currentFont;

    });

  };

  const applyTitleColor = color => {

    currentTitleColor =
      color || currentTitleColor;

    getScreenshotCards().forEach(card => {

      const title =
        card.querySelector(
          ".screenshot-card-title"
        );

      if (title) {

        title.style.color =
          currentTitleColor;

      }

    });

  };

  const applySubtitleColor = color => {

    currentSubtitleColor =
      color || currentSubtitleColor;

    getScreenshotCards().forEach(card => {

      const subtitleElement =
        card.querySelector(
          ".screenshot-card-subtitle"
        );

      if (subtitleElement) {

        subtitleElement.style.color =
          currentSubtitleColor;

      }

    });

  };

  const applyStatsColor = color => {

    currentStatsColor =
      color || currentStatsColor;

    getScreenshotCards().forEach(card => {

      card
        .querySelectorAll(
          ".screenshot-card-stats " +
          ".screenshot-card-label, " +
          ".screenshot-card-stats strong"
        )
        .forEach(element => {

          element.style.color =
            currentStatsColor;

        });

    });

  };

  const applyPlacementsColor = color => {

    currentPlacementsColor =
      color || currentPlacementsColor;

    getScreenshotCards().forEach(card => {

      card
        .querySelectorAll(
          ".screenshot-card-placement span, " +
          ".screenshot-card-placement strong"
        )
        .forEach(element => {

          element.style.color =
            currentPlacementsColor;

        });

    });

  };
  const setCustomColorOption = (
    select,
    color
  ) => {

    if (!select || !color) {
      return;
    }

    const customOption =
      select.querySelector(
        ".screenshot-custom-color-option"
      );

    if (!customOption) {
      return;
    }

    customOption.value =
      color;

    customOption.textContent =
      `カスタム（${color.toUpperCase()}）`;

    select.value =
      color;

  };

  const syncColorControl = (
    select,
    picker,
    color
  ) => {

    if (!color) {
      return;
    }

    if (picker) {

      picker.value =
        color;

    }

    if (!select) {
      return;
    }

    const presetOption =
      Array.from(select.options).find(
        option => {

          return (
            !option.classList.contains(
              "screenshot-custom-color-option"
            ) &&
            option.value.toLowerCase() ===
              color.toLowerCase()
          );

        }
      );

    if (presetOption) {

      select.value =
        presetOption.value;

      return;

    }

    setCustomColorOption(
      select,
      color
    );

  };

  const applyAllTextColor = color => {

    if (!color) {
      return;
    }

    applyTitleColor(color);
    applySubtitleColor(color);
    applyStatsColor(color);
    applyPlacementsColor(color);

    syncColorControl(
      titleColorSelect,
      titleColorPicker,
      color
    );

    syncColorControl(
      subtitleColorSelect,
      subtitleColorPicker,
      color
    );

    syncColorControl(
      statsColorSelect,
      statsColorPicker,
      color
    );

    syncColorControl(
      placementsColorSelect,
      placementsColorPicker,
      color
    );

  };

  const bindColorControl = ({
    select,
    picker,
    applyColor
  }) => {

    if (select) {

      select.addEventListener(
        "change",
        () => {

          const color =
            select.value;

          applyColor(color);

          if (picker) {

            picker.value =
              color;

          }

        }
      );

    }

    if (picker) {

      picker.addEventListener(
        "input",
        () => {

          const color =
            picker.value;

          setCustomColorOption(
            select,
            color
          );

          applyColor(color);

        }
      );

    }

  };

  /*
    初期デザインを反映
  */
  applyTheme(
    currentTheme
  );

  applyFont(
    currentFont
  );

  applyTitleColor(
    currentTitleColor
  );

  applySubtitleColor(
    currentSubtitleColor
  );

  applyStatsColor(
    currentStatsColor
  );

  applyPlacementsColor(
    currentPlacementsColor
  );

  /*
    背景選択
  */
  themeItems.forEach(item => {

    item.addEventListener(
      "click",
      () => {

        const themeNo =
          item.dataset.theme;

        if (!themeNo) {
          return;
        }

        applyTheme(
          themeNo
        );

      }
    );

  });

  /*
    フォント選択
  */
  if (fontSelect) {

    fontSelect.addEventListener(
      "change",
      () => {

        applyFont(
          fontSelect.value
        );

      }
    );

  }

  /*
    各文字色の選択
  */
  bindColorControl({

    select:
      titleColorSelect,

    picker:
      titleColorPicker,

    applyColor:
      applyTitleColor

  });

  bindColorControl({

    select:
      subtitleColorSelect,

    picker:
      subtitleColorPicker,

    applyColor:
      applySubtitleColor

  });

  bindColorControl({

    select:
      statsColorSelect,

    picker:
      statsColorPicker,

    applyColor:
      applyStatsColor

  });

  bindColorControl({

    select:
      placementsColorSelect,

    picker:
      placementsColorPicker,

    applyColor:
      applyPlacementsColor

  });

  /*
    文字色一括変更
  */
  if (allTextColorPicker) {

    allTextColorPicker.addEventListener(
      "input",
      () => {

        applyAllTextColor(
          allTextColorPicker.value
        );

      }
    );

  }

  /*
    カードをコンテナ幅へ合わせて縮小する
  */
    const resizeScreenshotCard = (
      container
    ) => {
    
      if (
        !container ||
        !screenshotCardStage
      ) {
        return;
      }
    
      const baseWidth =
        960;
    
      const baseHeight =
        540;
    
      /*
        コンテナのpaddingを除いた
        実際にカードを置ける横幅を取得
      */
      const containerStyle =
        window.getComputedStyle(
          container
        );
    
      const paddingLeft =
        parseFloat(
          containerStyle.paddingLeft
        ) || 0;
    
      const paddingRight =
        parseFloat(
          containerStyle.paddingRight
        ) || 0;
    
      const paddingTop =
        parseFloat(
          containerStyle.paddingTop
        ) || 0;
    
      const paddingBottom =
        parseFloat(
          containerStyle.paddingBottom
        ) || 0;
    
      const availableWidth =
        container.clientWidth -
        paddingLeft -
        paddingRight;
    
      if (availableWidth <= 0) {
        return;
      }
    
      const scale =
        Math.min(
          1,
          availableWidth / baseWidth
        );
    
      const scaledWidth =
        baseWidth * scale;
    
      const scaledHeight =
        baseHeight * scale;
    
      const leftMargin =
        Math.max(
          0,
          (availableWidth - scaledWidth) / 2
        );
    
      screenshotCardStage.style.transform =
        `translateX(${leftMargin}px) scale(${scale})`;
    
      screenshotCardStage.style.transformOrigin =
        "top left";
    
      screenshotCardStage.style.marginLeft =
        "0";
    
      screenshotCardStage.style.marginRight =
        "0";
    
      /*
        カード高さに上下paddingを加える
      */
      container.style.height =
        `${
          scaledHeight +
          paddingTop +
          paddingBottom
        }px`;
    
    };

  const resizeBuilderPreview = () => {

    resizeScreenshotCard(
      builderPreview
    );

  };

  const resizeFinalPreview = () => {

    resizeScreenshotCard(
      previewStage
    );

  };

  /*
    編集画面へ戻す
  */
  const resetScreenshotMode = () => {

    if (
      builderPreview &&
      screenshotCardStage
    ) {

      builderPreview.appendChild(
        screenshotCardStage
      );

    }

    if (preview) {

      preview.classList.remove(
        "show"
      );

    }

    if (builder) {

      builder.style.display =
        "";

    }

    requestAnimationFrame(
      resizeBuilderPreview
    );

  };

  /*
    画像メーカーを閉じる
  */
  const closeScreenshotMode = () => {

    resetScreenshotMode();

    overlay.classList.remove(
      "show"
    );

    if (
      typeof HLDB.screenshotResizeHandler ===
      "function"
    ) {

      window.removeEventListener(
        "resize",
        HLDB.screenshotResizeHandler
      );

      HLDB.screenshotResizeHandler =
        null;

    }

    window.setTimeout(
      () => {

        if (overlay.isConnected) {

          overlay.remove();

        }

      },
      200
    );

  };

  if (cancelButton) {

    cancelButton.addEventListener(
      "click",
      closeScreenshotMode
    );

  }

  if (createButton) {

    createButton.addEventListener(
      "click",
      () => {

        if (
          !previewStage ||
          !screenshotCardStage
        ) {
          return;
        }

        previewStage.appendChild(
          screenshotCardStage
        );

        if (builder) {

          builder.style.display =
            "none";

        }

        if (preview) {

          preview.classList.add(
            "show"
          );

        }

        requestAnimationFrame(
          resizeFinalPreview
        );

      }
    );

  }

  if (backButton) {

    backButton.addEventListener(
      "click",
      resetScreenshotMode
    );

  }
    /*
    PNG画像として保存する
  */
    if (saveButton) {

      saveButton.addEventListener(
        "click",
        async () => {
  
          if (!screenshotCard) {
  
            console.error(
              "保存対象のカードが見つかりません。"
            );
  
            alert(
              "保存対象の画像が見つかりませんでした。"
            );
  
            return;
  
          }
  
          if (
            typeof window.html2canvas !==
            "function"
          ) {
  
            console.error(
              "html2canvasが読み込まれていません。"
            );
  
            alert(
              "画像保存機能を読み込めませんでした。"
            );
  
            return;
  
          }
  
          saveButton.disabled =
            true;
  
          saveButton.textContent =
            "保存中...";
  
          try {
  
            /*
              Webフォントの読み込み完了を待つ
            */
            saveButton.textContent =
              "フォント読込中...";

            await HLDB.prepareIOSImagesForScreenshot();

            await HLDB.waitForScreenshotFonts();
  
            /*
              カード内画像の読み込み完了を待つ
            */
            saveButton.textContent =
              "画像読込中...";

            const images =
              Array.from(
                screenshotCard.querySelectorAll(
                  "img"
                )
              );
  
            await HLDB.withScreenshotTimeout(

              Promise.all(
  
              images.map(image => {
  
                if (image.complete) {
  
                  return Promise.resolve();
  
                }
  
                return new Promise(resolve => {
  
                  image.addEventListener(
                    "load",
                    resolve,
                    { once: true }
                  );
  
                  image.addEventListener(
                    "error",
                    resolve,
                    { once: true }
                  );
  
                });
  
              })
  
              ),

              8000,
              "カード内画像の読み込み"

            );
  
            /*
              保存前に現在の設定を再反映する
            */
            applyTheme(
              currentTheme
            );
  
            applyFont(
              currentFont
            );
  
            applyTitleColor(
              currentTitleColor
            );
  
            applySubtitleColor(
              currentSubtitleColor
            );
  
            applyStatsColor(
              currentStatsColor
            );
  
            applyPlacementsColor(
              currentPlacementsColor
            );
  
            /*
              表示用の縮小transformは
              html2canvasの保存サイズへ影響するため、
              保存時だけ一時的に解除する
            */
            const originalStageTransform =
              screenshotCardStage.style.transform;
  
            const originalStageTransformOrigin =
              screenshotCardStage.style.transformOrigin;
  
            const originalStageMarginLeft =
              screenshotCardStage.style.marginLeft;
  
            const originalStageMarginRight =
              screenshotCardStage.style.marginRight;
  
            screenshotCardStage.style.transform =
              "none";
  
            screenshotCardStage.style.transformOrigin =
              "top left";
  
            screenshotCardStage.style.marginLeft =
              "0";
  
            screenshotCardStage.style.marginRight =
              "0";
  
            try {
  
              const cardWidth =
                Math.round(
                  screenshotCard.offsetWidth
                );
  
              const cardHeight =
                Math.round(
                  screenshotCard.offsetHeight
                );
  
              if (
                cardWidth <= 0 ||
                cardHeight <= 0
              ) {
  
                throw new Error(
                  `カードサイズが不正です: ${cardWidth} × ${cardHeight}`
                );
  
              }
  
              saveButton.textContent =
                "PNG作成中...";

              const canvas =
                await HLDB.withScreenshotTimeout(

                  window.html2canvas(
                  screenshotCard,
                  {
  
                    backgroundColor:
                      "#090909",
  
                    scale:
                      HLDB.shouldUseMobileScreenshotSave()
                        ? 1
                        : 2,
  
                    useCORS:
                      true,
  
                    allowTaint:
                      false,
  
                    logging:
                      false,
  
                    removeContainer:
                      true,
  
                    width:
                      cardWidth,
  
                    height:
                      cardHeight,
  
                    windowWidth:
                      cardWidth,
  
                    windowHeight:
                      cardHeight,
  
                    onclone:
                      clonedDocument => {
  
                        const clonedCard =
                          clonedDocument.querySelector(
                            ".screenshot-preview.show " +
                            ".screenshot-card"
                          ) ||
                          clonedDocument.querySelector(
                            ".screenshot-card"
                          );
  
                        if (!clonedCard) {
  
                          console.error(
                            "複製した保存用カードが見つかりません。"
                          );
  
                          return;
  
                        }
  
                        clonedCard.style.width =
                          `${cardWidth}px`;
  
                        clonedCard.style.height =
                          `${cardHeight}px`;
  
                        clonedCard.style.transform =
                          "none";
  
                        clonedCard.style.margin =
                          "0";
  
                        clonedCard.style.fontFamily =
                          currentFont;
  
                        clonedCard.style.backgroundImage =
                          `url("assets/themes/${currentTheme}.png")`;
  
                        clonedCard.style.backgroundSize =
                          "cover";
  
                        clonedCard.style.backgroundPosition =
                          "center";
  
                        clonedCard.style.backgroundRepeat =
                          "no-repeat";
  
                        const clonedTitle =
                          clonedCard.querySelector(
                            ".screenshot-card-title"
                          );
  
                        if (clonedTitle) {
  
                          clonedTitle.style.color =
                            currentTitleColor;
  
                        }
  
                        const clonedSubtitle =
                          clonedCard.querySelector(
                            ".screenshot-card-subtitle"
                          );
  
                        if (clonedSubtitle) {
  
                          clonedSubtitle.style.color =
                            currentSubtitleColor;
  
                        }
  
                        clonedCard
                          .querySelectorAll(
                            ".screenshot-card-stats " +
                            ".screenshot-card-label, " +
                            ".screenshot-card-stats strong"
                          )
                          .forEach(element => {
  
                            element.style.color =
                              currentStatsColor;
  
                          });
  
                        clonedCard
                          .querySelectorAll(
                            ".screenshot-card-placement span, " +
                            ".screenshot-card-placement strong"
                          )
                          .forEach(element => {
  
                            element.style.color =
                              currentPlacementsColor;
  
                          });
  
                        /*
                          html2canvasで一部の装飾が
                          createPatternエラーを起こす場合があるため、
                          保存用の複製画面だけ不要な背景画像を除去する
                        */
                        const exportStyle =
                          clonedDocument.createElement(
                            "style"
                          );
  
                        exportStyle.textContent = `
  
                          .screenshot-card{
                            width:${cardWidth}px !important;
                            height:${cardHeight}px !important;
                            transform:none !important;
                            margin:0 !important;
                            background-size:cover !important;
                            background-position:center !important;
                            background-repeat:no-repeat !important;
                          }
  
                          .screenshot-card *::before,
                          .screenshot-card *::after{
                            background-image:none !important;
                          }
  
                          .screenshot-card-divider{
                            background:#6f5a18 !important;
                          }
  
                        `;
  
                        clonedDocument.head.appendChild(
                          exportStyle
                        );
  
                      }
  
                  }
                ),

                30000,
                "PNG画像の作成"

              );
  
              const safeTeamName =
                createSafeFileName(
                  rawTeamName
                ) || "team";
  
              const safeYear =
                createSafeFileName(
                  rawYear
                );
  
              const safeStage =
                createSafeFileName(
                  rawStage
                );
  
              const fileNameParts = [
  
                safeTeamName,
                safeYear,
                safeStage
  
              ].filter(Boolean);
  
              saveButton.textContent =
                "共有準備中...";

              await HLDB.saveScreenshotCanvas({
                canvas,
                fileName:
                  `${fileNameParts.join("_")}.png`
              });
  
            } finally {
  
              /*
                保存後に表示用の縮小状態へ戻す
              */
              screenshotCardStage.style.transform =
                originalStageTransform;
  
              screenshotCardStage.style.transformOrigin =
                originalStageTransformOrigin;
  
              screenshotCardStage.style.marginLeft =
                originalStageMarginLeft;
  
              screenshotCardStage.style.marginRight =
                originalStageMarginRight;
  
            }
  
          } catch (error) {
  
            console.error(
              "画像の保存に失敗しました。",
              error
            );
  
            alert(
              "画像の保存に失敗しました。\n" +
              (error?.message || "原因不明のエラー")
            );
  
          } finally {
  
            saveButton.disabled =
              false;
  
            saveButton.textContent =
              "PNGで保存";
  
          }
  
        }
      );
  
    }
  
    /*
      オーバーレイ外側をクリックした場合は閉じる
    */
    overlay.addEventListener(
      "click",
      event => {
  
        if (event.target !== overlay) {
          return;
        }
  
        closeScreenshotMode();
  
      }
    );
  
    /*
      Escapeキーで閉じる
    */
    overlay.addEventListener(
      "keydown",
      event => {
  
        if (event.key !== "Escape") {
          return;
        }
  
        closeScreenshotMode();
  
      }
    );
  
    /*
      画面幅変更時のサイズ調整
    */
    HLDB.screenshotResizeHandler = () => {
  
      if (
        preview &&
        preview.classList.contains(
          "show"
        )
      ) {
  
        resizeFinalPreview();
  
        return;
  
      }
  
      resizeBuilderPreview();
  
    };
  
    window.addEventListener(
      "resize",
      HLDB.screenshotResizeHandler
    );
  
    /*
      画像メーカーを画面へ表示する
    */
    document.body.appendChild(
      overlay
    );
  
    overlay.setAttribute(
      "tabindex",
      "-1"
    );
  
    overlay.classList.add(
      "show"
    );
  
    overlay.focus();
  
    requestAnimationFrame(
      () => {
  
        resizeBuilderPreview();
  
      }
    );
  
  };
  
 /* ========================================
   Screenshot Mode　player ver
======================================== */

HLDB.openPlayerScreenshotMode= function () {

  /*
    Player版の文字色コントロールを共通生成する
  */
  const createPlayerColorControl = ({
    id,
    label,
    ariaLabel
  }) => `

    <div class="screenshot-color-control">

      <label
        for="${id}-select"
        class="screenshot-detail-label">

        ${label}

      </label>

      <div class="screenshot-color-control-row">

        <select
          id="${id}-select"
          class="screenshot-color-select">

          <option value="#ffffff">白（標準）</option>
          <option value="#d4af37">金</option>
          <option value="#4aa3ff">青</option>
          <option value="#ff4d4d">赤</option>
          <option value="#39d98a">緑</option>
          <option value="#111111">黒</option>

          <option
            value="#ffffff"
            class="screenshot-custom-color-option">
            カスタム
          </option>

        </select>

        <span class="screenshot-custom-color-guide">
          テンプレート以外に変えるならここ →
        </span>

        <input
          type="color"
          id="${id}-picker"
          class="screenshot-color-picker"
          value="#ffffff"
          aria-label="${ariaLabel}">

      </div>

    </div>

  `;

  /*
    以前開いた画像メーカーで登録した
    resizeイベントを解除する
  */
  if (typeof HLDB.screenshotResizeHandler === "function") {

    window.removeEventListener(
      "resize",
      HLDB.screenshotResizeHandler
    );

    HLDB.screenshotResizeHandler = null;

  }

  /*
    HTML内へ表示する文字を安全な形へ変換する
  */
  const escapeHtml = value => {

    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  };

  /*
    ファイル名に使えない文字を削除する
  */
  const createSafeFileName = value => {

    return String(value ?? "")
      .replace(/[\\/:*?"<>|]/g, "")
      .replace(/\s+/g, "_")
      .trim();

  };

  /*
    画像メーカー用フォントを読み込む
  */
  if (!document.getElementById("screenshot-fonts")) {

    const fontLink =
      document.createElement("link");

    fontLink.id =
      "screenshot-fonts";

    fontLink.rel =
      "stylesheet";

    fontLink.href =
      "https://fonts.googleapis.com/css2?" +
      "family=BIZ+UDPGothic:wght@400;700&" +
      "family=Dela+Gothic+One&" +
      "family=DotGothic16&" +
      "family=Hachi+Maru+Pop&" +
      "family=Kaisei+Decol:wght@400;700&" +
      "family=Kiwi+Maru:wght@400;500&" +
      "family=Kosugi+Maru&" +
      "family=M+PLUS+Rounded+1c:wght@400;700;800&" +
      "family=Mochiy+Pop+One&" +
      "family=Noto+Sans+JP:wght@400;700;900&" +
      "family=Rampart+One&" +
      "family=Reggae+One&" +
      "family=RocknRoll+One&" +
      "family=Shippori+Mincho:wght@400;700;800&" +
      "family=Stick&" +
      "family=Train+One&" +
      "family=Yusei+Magic&" +
      "family=Zen+Kaku+Gothic+New:wght@400;500;700&" +
      "family=Zen+Maru+Gothic:wght@400;700;900&" +
      "family=Zen+Old+Mincho:wght@400;700&" +
      "display=swap";

    document.head.appendChild(
      fontLink
    );

  }

  const data =
  HLDB.playerScreenshotData || {};

  const rawTeamName =
    data.teamName || "チーム名";

  const rawYear =
    data.year ?? "―";

  const rawLeague =
    data.league || "";

  const rawStage =
    data.stage || "";

  const rawRank =
    data.rank;

  const rawPoint =
    data.point;

  const teamName =
    escapeHtml(rawTeamName);

  const year =
    escapeHtml(rawYear);

  const league =
    escapeHtml(rawLeague);

  const stage =
    escapeHtml(rawStage);

  const rank =
    rawRank !== undefined &&
    rawRank !== null &&
    rawRank !== ""
      ? `${escapeHtml(rawRank)}位`
      : "―";

  const point =
    rawPoint !== undefined &&
    rawPoint !== null &&
    rawPoint !== ""
      ? `${escapeHtml(rawPoint)}pt`
      : "―";

  const leagueText =
    rawLeague === "単一リーグ"
      ? ""
      : (
          rawLeague &&
          String(rawLeague).endsWith("リーグ")
            ? league
            : rawLeague
              ? `${league}リーグ`
              : ""
        );

  const subtitle = [

    rawYear !== undefined &&
    rawYear !== null &&
    rawYear !== ""
      ? `${year}年`
      : "",

    leagueText,

    stage

  ]
    .filter(Boolean)
    .join(" ");

  /*
    着順分布を4つへ分割する

    対応例：
    12-10-8-6
    12－10－8－6
    12 / 10 / 8 / 6
  */
  const placements =
    String(data.placements || "")
      .split(/[-－–—/／,\s]+/)
      .map(value => value.trim())
      .filter(Boolean);

  const placementValues = [

    escapeHtml(
      placements[0] || "0"
    ),

    escapeHtml(
      placements[1] || "0"
    ),

    escapeHtml(
      placements[2] || "0"
    ),

    escapeHtml(
      placements[3] || "0"
    )

  ];

  const playerName =
  data.playerName || "";

  const playerNameLength =
  Array.from(playerName).length;

const playerNameClass =
  playerNameLength >= 7
    ? "is-seven"
    : playerNameLength === 6
    ? "is-six"
    : "";

    const getBestHighlightKey = () => {

      const bestRanks =
        data.bestRanks || {};
    
      const candidates = [
        {
          key: "mvp",
          rank: Number(
            bestRanks.mvp?.rank
          )
        },
        {
          key: "topRate",
          rank: Number(
            bestRanks.topRate?.rank
          )
        },
        {
          key: "avoidRate",
          rank: Number(
            bestRanks.avoidRate?.rank
          )
        },
        {
          key: "mostWins",
          rank: Number(
            bestRanks.mostWins?.rank
          )
        },
        {
          key: "highestScore",
          rank: Number(
            bestRanks.highestScore?.rank
          )
        }
      ];
    
      const validCandidates =
        candidates
          .filter(item =>
            Number.isFinite(item.rank) &&
            item.rank > 0
          )
          .sort((a, b) =>
            a.rank - b.rank
          );
    
      return (
        validCandidates[0]?.key ||
        "mvp"
      );
    
    };
    
    let selectedHighlight =
      String(data.year) === "ALL"
        ? getBestHighlightKey()
        : "mvp";

  const getHighlightData = () => {

    const highlightMap = {
  
      mvp: {
        label: "MVP順位",
        currentRank:
          data.mvpRank,
        best:
          data.bestRanks?.mvp
      },
  
      topRate: {
        label: "トップ率順位",
        currentRank:
          data.topRateRank,
        best:
          data.bestRanks?.topRate
      },
  
      avoidRate: {
        label: "ラス回避率順位",
        currentRank:
          data.avoidRateRank,
        best:
          data.bestRanks?.avoidRate
      },
  
      mostWins: {
        label: "最多勝利順位",
        currentRank:
          data.mostWinsRank,
        best:
          data.bestRanks?.mostWins
      },
  
      highestScore: {
        label: "最高得点順位",
        currentRank:
          data.highestScoreRank,
        best:
          data.bestRanks?.highestScore
      }
  
    };
  
    const selected =
      highlightMap[selectedHighlight] ||
      highlightMap.mvp;
  
    const isAllMode =
      String(data.year) === "ALL";
  
    const rank =
      isAllMode
        ? selected.best?.rank
        : selected.currentRank;
  
    const year =
      isAllMode
        ? selected.best?.year
        : null;
  
    return {
  
      label:
        selected.label,
  
      value:
        rank
          ? isAllMode && year
            ? `${rank}位（${year}年）`
            : `${rank}位 / ${data.playerCount}人中`
          : "―"
  
    };
  
  };

  const getDisplayStats = () => {

    const formatRate = value => {
  
      const number =
        Number(value);
  
      if (!Number.isFinite(number)) {
        return "―";
      }
  
      return `${(
        number <= 1
          ? number * 100
          : number
      ).toFixed(1)}%`;
  
    };
  
    const formatHighestScore = value => {
  
      const number =
        Number(
          String(value ?? "")
            .replace(/[^\d.-]/g, "")
        );
  
      if (!Number.isFinite(number)) {
        return "―";
      }
  
      return `${Math.round(
        number
      ).toLocaleString()}点`;
  
    };
  
    const statMap = {
  
      averagePlacement: {
        key:
          "averagePlacement",
  
        label:
          "平均順位",
  
        value:
          Number.isFinite(
            Number(data.averagePlacement)
          )
            ? Number(
                data.averagePlacement
              ).toFixed(2)
            : "―"
      },
  
      topRate: {
        key:
          "topRate",
  
        label:
          "トップ率",
  
        value:
          formatRate(
            data.topRate
          )
      },
  
      avoidRate: {
        key:
          "avoidRate",
  
        label:
          "ラス回避率",
  
        value:
          formatRate(
            data.avoidRate
          )
      },
  
      highestScore: {
        key:
          "highestScore",
  
        label:
          "最高得点",
  
        value:
          formatHighestScore(
            data.highestScore
          )
      }
  
    };
  
    /*
      強調順位に対応する右上の成績
      MVP・最多勝利は平均順位を表示
    */
    const highlightToStatKey = {
  
      mvp:
        "averagePlacement",
  
      topRate:
        "topRate",
  
      avoidRate:
        "avoidRate",
  
      mostWins:
        "averagePlacement",
  
      highestScore:
        "highestScore"
  
    };
  
    const selectedStatKey =
      highlightToStatKey[selectedHighlight] ||
      "averagePlacement";
  
    /*
      残り3つは必ずこの順番
      平均順位 → トップ率 → ラス回避率 → 最高得点
    */
    const statOrder = [
      "averagePlacement",
      "topRate",
      "avoidRate",
      "highestScore"
    ];
  
    return {
  
      selected:
        statMap[selectedStatKey],
  
      remaining:
        statOrder
          .filter(key =>
            key !== selectedStatKey
          )
          .map(key =>
            statMap[key]
          )
  
    };
  
  };

/*
  選手画像カード
  準備画面と完成画面で共通使用
*/
const createScreenshotCard = () => {

  const displayStats =
    getDisplayStats();

  const highlight =
    getHighlightData();

  return `
    <div class="screenshot-card-stage">

      <div class="screenshot-card player-screenshot-card">

        <!-- 上部：選手名・所属情報 -->
        <div class="player-screenshot-header">

          <div class="player-screenshot-name-area">

            <div class="player-screenshot-name ${playerNameClass}">
              ${data.playerName || ""}
            </div>

            <div
              class="player-screenshot-name-line"
              aria-hidden="true">
            </div>

          </div>

          <div class="player-screenshot-meta-area">

            <div class="player-screenshot-team">
              ${data.teamName || ""}
            </div>

            ${
              Array.isArray(data.pastTeams) &&
              data.pastTeams.length
                ? `
                  <div
                    class="
                      player-screenshot-past-teams
                      ${
                        data.pastTeams.length >= 3
                          ? "is-many"
                          : ""
                      }
                    "
                  >
                    <span>
                      歴代参加チーム
                    </span>

                    ${data.pastTeams.join(" / ")}
                  </div>
                `
                : ""
            }

            <div
              class="player-screenshot-team-line"
              aria-hidden="true">
            </div>

            <div class="player-screenshot-period">
              ${
                data.year === "ALL"
                  ? "全年度・歴代通算"
                  : `
                    ${data.year || ""}
                    ${data.league ? ` / ${data.league}` : ""}
                    ${data.stage ? ` / ${data.stage}` : ""}
                  `
              }
            </div>

          </div>

        </div>

        <!-- ポイント・試合数・選択した成績 -->
        <div class="player-screenshot-main-stats">

          <div class="player-screenshot-main-stat">

            <span class="player-screenshot-main-label">
              ポイント
            </span>

            <strong class="player-screenshot-main-value">
              ${Number(
                data.totalPoint || 0
              ).toFixed(1)}pt
            </strong>

          </div>

          <div
            class="player-screenshot-main-divider"
            aria-hidden="true">
          </div>

          <div class="player-screenshot-main-stat">

            <span class="player-screenshot-main-label">
              試合数
            </span>

            <strong class="player-screenshot-main-value">
              ${data.gameCount || 0}試合
            </strong>

          </div>

          <div
            class="player-screenshot-main-divider"
            aria-hidden="true">
          </div>

          <div
            class="
              player-screenshot-main-stat
              player-screenshot-selected-stat
            "
          >

            <span
              class="
                player-screenshot-main-label
                player-screenshot-selected-label
              "
            >
              ${displayStats.selected.label}
            </span>

            <strong
              class="
                player-screenshot-main-value
                player-screenshot-selected-value
              "
            >
              ${displayStats.selected.value}
            </strong>

          </div>

        </div>

        <!-- 着順分布 -->
        <div class="player-screenshot-placements">

          <div class="player-screenshot-placement">
            <span>1着</span>
            <strong>${data.firstCount || 0}</strong>
          </div>

          <div class="player-screenshot-placement">
            <span>2着</span>
            <strong>${data.secondCount || 0}</strong>
          </div>

          <div class="player-screenshot-placement">
            <span>3着</span>
            <strong>${data.thirdCount || 0}</strong>
          </div>

          <div class="player-screenshot-placement">
            <span>4着</span>
            <strong>${data.fourthCount || 0}</strong>
          </div>

        </div>

        <!-- 強調順位 -->
        <div class="player-screenshot-highlight">

          <span class="player-screenshot-highlight-label">
            ${highlight.label}
          </span>

          <strong class="player-screenshot-highlight-value">
            ${highlight.value}
          </strong>

        </div>

        <!-- 残り3項目 -->
        <div class="player-screenshot-bottom-stats">

          ${displayStats.remaining.map(
            (stat, index) => `
              <div
                class="player-screenshot-bottom-stat"
                data-stat-index="${index}"
              >

                <span
                  class="
                    player-screenshot-bottom-label
                    player-screenshot-dynamic-label
                  "
                >
                  ${stat.label}
                </span>

                <strong
                  class="
                    player-screenshot-bottom-value
                    player-screenshot-dynamic-value
                  "
                >
                  ${stat.value}
                </strong>

              </div>
            `
          ).join("")}

        </div>

        <!-- ロゴ -->
        <img
          src="apple-touch-icon.png"
          class="screenshot-card-logo"
          alt="Hundred League">

      </div>

    </div>
  `;

};
  /*
    すでに画像メーカーが存在する場合は削除する
  */
  const existingOverlay =
    document.getElementById(
      "screenshot-overlay"
    );

  if (existingOverlay) {

    existingOverlay.remove();

  }

  const overlay =
    document.createElement("div");

  overlay.id =
    "screenshot-overlay";
    overlay.innerHTML = `

    <div class="screenshot-builder">

      <div class="screenshot-panel">

        <div class="screenshot-header">

          <h2>
            画像メーカー
          </h2>

          <p>
            標準の黒金デザインで画像を作成します
          </p>

        </div>

        <div class="screenshot-builder-preview">

          ${createScreenshotCard()}

        </div>

        <details class="screenshot-detail-setting">

          <summary class="screenshot-detail-summary">
            詳細設定
          </summary>

          <div class="screenshot-detail-content">

          <div class="screenshot-setting-group">

  <div class="screenshot-setting-group-title">
    強調する項目
  </div>

  <select
    id="playerHighlightSelect"
    class="screenshot-setting-select"
  >
    <option value="mvp">
      MVP順位
    </option>

    <option value="topRate">
      トップ率順位
    </option>

    <option value="avoidRate">
      ラス回避率順位
    </option>

    <option value="mostWins">
      最多勝利順位
    </option>

    <option value="highestScore">
      最高得点
    </option>

  </select>

</div>

            <div class="screenshot-setting-group">

              <div class="screenshot-setting-group-title">
                🎨 デザイン
              </div>

              <details class="screenshot-theme-setting">

                <summary class="screenshot-theme-summary">
                  背景
                </summary>

                <div class="screenshot-theme-content">

                  <div class="screenshot-theme-list">

                    ${Array.from(
                      { length: 12 },
                      (_, index) => {

                        const themeNo =
                          String(index + 1)
                            .padStart(3, "0");

                        return `

                          <button
                            type="button"
                            class="screenshot-theme-item"
                            data-theme="${themeNo}"
                            aria-label="背景 ${themeNo}">

                            <img
                              src="assets/themes/${themeNo}.png"
                              alt="背景 ${themeNo}"
                              loading="eager">

                          </button>

                        `;

                      }
                    ).join("")}

                  </div>

                </div>

              </details>

              <div class="screenshot-setting">

                <label
                  for="screenshot-font-select"
                  class="screenshot-detail-label">

                  フォント

                </label>

                <select
                  id="screenshot-font-select"
                  class="screenshot-font-select">

                  <option value='"Noto Sans JP", sans-serif'>
                    Noto Sans JP
                  </option>

                  <option value='"BIZ UDPGothic", sans-serif'>
                    BIZ UDPゴシック
                  </option>

                  <option value='"M PLUS Rounded 1c", sans-serif'>
                    M PLUS Rounded
                  </option>

                  <option value='"Zen Kaku Gothic New", sans-serif'>
                    Zen角ゴシック
                  </option>

                  <option value='"Kosugi Maru", sans-serif'>
                    小杉丸ゴシック
                  </option>

                  <option value='"Zen Maru Gothic", sans-serif'>
                    Zen丸ゴシック
                  </option>

                  <option value='"Kiwi Maru", serif'>
                    Kiwi Maru
                  </option>

                  <option value='"Hachi Maru Pop", cursive'>
                    はちまるポップ
                  </option>

                  <option value='"Mochiy Pop One", sans-serif'>
                    モッチーポップ
                  </option>

                  <option value='"Yusei Magic", sans-serif'>
                    油性マジック
                  </option>

                  <option value='"RocknRoll One", sans-serif'>
                    ロックンロール
                  </option>

                  <option value='"Dela Gothic One", sans-serif'>
                    デラゴシック
                  </option>

                  <option value='"Reggae One", sans-serif'>
                    レゲエ
                  </option>

                  <option value='"Rampart One", sans-serif'>
                    ランパート
                  </option>

                  <option value='"Train One", sans-serif'>
                    トレイン
                  </option>

                  <option value='"Stick", sans-serif'>
                    スティック
                  </option>

                  <option value='"DotGothic16", sans-serif'>
                    ドットゴシック
                  </option>

                  <option value='"Kaisei Decol", serif'>
                    解星デコール
                  </option>

                  <option value='"Shippori Mincho", serif'>
                    しっぽり明朝
                  </option>

                  <option value='"Zen Old Mincho", serif'>
                    Zenオールド明朝
                  </option>

                </select>

              </div>

            </div>

            <div class="screenshot-setting-group">

              <div class="screenshot-setting-group-title">
                📝 文字色
              </div>

              <p class="screenshot-color-guide">
                テンプレートの色はプルダウンから選択できます。
                テンプレート以外の色は、色の四角から変更できます。
              </p>

              <div class="screenshot-color-control">

                <label
                  for="screenshot-all-text-color"
                  class="screenshot-detail-label">

                  文字色一括編集

                </label>

                <div
                  class="
                    screenshot-color-control-row
                    screenshot-all-color-row
                  ">

                  <span class="screenshot-custom-color-guide">
                    すべて同じ色に変更 →
                  </span>

                  <input
                    type="color"
                    id="screenshot-all-text-color"
                    class="screenshot-color-picker"
                    value="#ffffff"
                    aria-label="文字色を一括変更">

                </div>

              </div>

              <div class="screenshot-setting-group-title">
                基本情報
              </div>

              <div class="screenshot-color-control">

                <label
                  for="screenshot-title-color-select"
                  class="screenshot-detail-label">

                  選手名文字色

                </label>

                <div class="screenshot-color-control-row">

                  <select
                    id="screenshot-title-color-select"
                    class="
                      screenshot-title-color-select
                      screenshot-color-select
                    ">

                    <option value="#ffffff">
                      白（標準）
                    </option>

                    <option value="#d4af37">
                      金
                    </option>

                    <option value="#4aa3ff">
                      青
                    </option>

                    <option value="#ff4d4d">
                      赤
                    </option>

                    <option value="#39d98a">
                      緑
                    </option>

                    <option value="#111111">
                      黒
                    </option>

                    <option
                      value="#ffffff"
                      class="screenshot-custom-color-option">

                      カスタム

                    </option>

                  </select>

                  <span class="screenshot-custom-color-guide">
                    テンプレート以外に変えるならここ →
                  </span>

                  <input
                    type="color"
                    id="screenshot-title-color-picker"
                    class="screenshot-color-picker"
                    value="#ffffff"
                    aria-label="選手名のカスタムカラー">

                </div>

              </div>

              ${createPlayerColorControl({
                id: "screenshot-team-color",
                label: "所属チーム文字色",
                ariaLabel: "所属チームのカスタムカラー"
              })}

              <div class="screenshot-color-control">

                <label
                  for="screenshot-subtitle-color-select"
                  class="screenshot-detail-label">

                  年度・リーグ文字色

                </label>

                <div class="screenshot-color-control-row">

                  <select
                    id="screenshot-subtitle-color-select"
                    class="
                      screenshot-subtitle-color-select
                      screenshot-color-select
                    ">

                    <option value="#ffffff">
                      白（標準）
                    </option>

                    <option value="#d4af37">
                      金
                    </option>

                    <option value="#4aa3ff">
                      青
                    </option>

                    <option value="#ff4d4d">
                      赤
                    </option>

                    <option value="#39d98a">
                      緑
                    </option>

                    <option value="#111111">
                      黒
                    </option>

                    <option
                      value="#ffffff"
                      class="screenshot-custom-color-option">

                      カスタム

                    </option>

                  </select>

                  <span class="screenshot-custom-color-guide">
                    テンプレート以外に変えるならここ →
                  </span>

                  <input
                    type="color"
                    id="screenshot-subtitle-color-picker"
                    class="screenshot-color-picker"
                    value="#ffffff"
                    aria-label="年度・リーグのカスタムカラー">

                </div>

              </div>
              <div class="screenshot-setting-group-title">
                成績
              </div>

              <div class="screenshot-color-control">

                <label
                  for="screenshot-stats-color-select"
                  class="screenshot-detail-label">

                  ポイント・試合数・メイン成績色

                </label>

                <div class="screenshot-color-control-row">

                  <select
                    id="screenshot-stats-color-select"
                    class="
                      screenshot-stats-color-select
                      screenshot-color-select
                    ">

                    <option value="#ffffff">
                      白（標準）
                    </option>

                    <option value="#d4af37">
                      金
                    </option>

                    <option value="#4aa3ff">
                      青
                    </option>

                    <option value="#ff4d4d">
                      赤
                    </option>

                    <option value="#39d98a">
                      緑
                    </option>

                    <option value="#111111">
                      黒
                    </option>

                    <option
                      value="#ffffff"
                      class="screenshot-custom-color-option">

                      カスタム

                    </option>

                  </select>

                  <span class="screenshot-custom-color-guide">
                    テンプレート以外に変えるならここ →
                  </span>

                  <input
                    type="color"
                    id="screenshot-stats-color-picker"
                    class="screenshot-color-picker"
                    value="#ffffff"
                    aria-label="ポイント・試合数・メイン成績のカスタムカラー">

                </div>

              </div>

              <div class="screenshot-color-control">

                <label
                  for="screenshot-placements-color-select"
                  class="screenshot-detail-label">

                  着順分布色

                </label>

                <div class="screenshot-color-control-row">

                  <select
                    id="screenshot-placements-color-select"
                    class="
                      screenshot-placements-color-select
                      screenshot-color-select
                    ">

                    <option value="#ffffff">
                      白（標準）
                    </option>

                    <option value="#d4af37">
                      金
                    </option>

                    <option value="#4aa3ff">
                      青
                    </option>

                    <option value="#ff4d4d">
                      赤
                    </option>

                    <option value="#39d98a">
                      緑
                    </option>

                    <option value="#111111">
                      黒
                    </option>

                    <option
                      value="#ffffff"
                      class="screenshot-custom-color-option">

                      カスタム

                    </option>

                  </select>

                  <span class="screenshot-custom-color-guide">
                    テンプレート以外に変えるならここ →
                  </span>

                  <input
                    type="color"
                    id="screenshot-placements-color-picker"
                    class="screenshot-color-picker"
                    value="#ffffff"
                    aria-label="着順分布のカスタムカラー">

                </div>

              </div>

              ${createPlayerColorControl({
                id: "screenshot-highlight-color",
                label: "強調順位色",
                ariaLabel: "強調順位のカスタムカラー"
              })}

              ${createPlayerColorControl({
                id: "screenshot-bottom-color",
                label: "下段成績色",
                ariaLabel: "下段成績のカスタムカラー"
              })}

            </div>

          </div>

        </details>

        <div class="screenshot-actions">

          <button
            type="button"
            class="screenshot-cancel-button">

            閉じる

          </button>

          <button
            type="button"
            class="screenshot-create-button">

            画像を作成

          </button>

        </div>

      </div>

    </div>

    <div class="screenshot-preview">

      <div class="screenshot-card-stage-final">
      </div>

      <div class="screenshot-preview-actions">

        <button
          type="button"
          class="screenshot-back-button">

          戻る

        </button>

        <button
          type="button"
          class="screenshot-save-button">

          PNGで保存

        </button>

      </div>

    </div>

  `;

  const builder =
    overlay.querySelector(
      ".screenshot-builder"
    );

  const preview =
    overlay.querySelector(
      ".screenshot-preview"
    );

  const builderPreview =
    overlay.querySelector(
      ".screenshot-builder-preview"
    );

  const previewStage =
    overlay.querySelector(
      ".screenshot-card-stage-final"
    );

  const screenshotCardStage =
    overlay.querySelector(
      ".screenshot-builder-preview .screenshot-card-stage"
    );

  const screenshotCard =
    screenshotCardStage
      ? screenshotCardStage.querySelector(
          ".screenshot-card"
        )
      : null;

  const cancelButton =
    overlay.querySelector(
      ".screenshot-cancel-button"
    );

  const createButton =
    overlay.querySelector(
      ".screenshot-create-button"
    );

  const backButton =
    overlay.querySelector(
      ".screenshot-back-button"
    );

  const saveButton =
    overlay.querySelector(
      ".screenshot-save-button"
    );

  const themeItems =
    overlay.querySelectorAll(
      ".screenshot-theme-item"
    );

  const fontSelect =
    overlay.querySelector(
      "#screenshot-font-select"
    );

  const allTextColorPicker =
    overlay.querySelector(
      "#screenshot-all-text-color"
    );

  const titleColorSelect =
    overlay.querySelector(
      "#screenshot-title-color-select"
    );

  const titleColorPicker =
    overlay.querySelector(
      "#screenshot-title-color-picker"
    );

  const subtitleColorSelect =
    overlay.querySelector(
      "#screenshot-subtitle-color-select"
    );

  const subtitleColorPicker =
    overlay.querySelector(
      "#screenshot-subtitle-color-picker"
    );

  const statsColorSelect =
    overlay.querySelector(
      "#screenshot-stats-color-select"
    );

  const statsColorPicker =
    overlay.querySelector(
      "#screenshot-stats-color-picker"
    );

  const placementsColorSelect =
    overlay.querySelector(
      "#screenshot-placements-color-select"
    );

  const placementsColorPicker =
    overlay.querySelector(
      "#screenshot-placements-color-picker"
    );

  const teamColorSelect =
    overlay.querySelector(
      "#screenshot-team-color-select"
    );

  const teamColorPicker =
    overlay.querySelector(
      "#screenshot-team-color-picker"
    );

  const highlightColorSelect =
    overlay.querySelector(
      "#screenshot-highlight-color-select"
    );

  const highlightColorPicker =
    overlay.querySelector(
      "#screenshot-highlight-color-picker"
    );

  const bottomColorSelect =
    overlay.querySelector(
      "#screenshot-bottom-color-select"
    );

  const bottomColorPicker =
    overlay.querySelector(
      "#screenshot-bottom-color-picker"
    );

  let currentTheme =
    "001";

  let currentFont =
    '"Noto Sans JP", sans-serif';

  let currentTitleColor =
    "#ffffff";

  let currentSubtitleColor =
    "#ffffff";

  let currentStatsColor =
    "#ffffff";

  let currentPlacementsColor =
    "#ffffff";

  let currentTeamColor =
    "#ffffff";

  let currentHighlightColor =
    "#ffffff";

  let currentBottomColor =
    "#ffffff";

  const getScreenshotCards = () => {

    return overlay.querySelectorAll(
      ".screenshot-card"
    );

  };
  const applyTheme = themeNo => {

    currentTheme =
      String(themeNo || "001");

    getScreenshotCards().forEach(card => {

      card.style.backgroundImage =
        `url("assets/themes/${currentTheme}.png")`;

      card.style.backgroundSize =
        "cover";

      card.style.backgroundPosition =
        "center";

      card.style.backgroundRepeat =
        "no-repeat";

    });

    themeItems.forEach(item => {

      item.classList.toggle(
        "active",
        item.dataset.theme === currentTheme
      );

    });

  };

  const applyFont = fontFamily => {

    currentFont =
      fontFamily || currentFont;

    getScreenshotCards().forEach(card => {

      card.style.fontFamily =
        currentFont;

    });

  };

  const applyTitleColor = color => {

    currentTitleColor =
      color || currentTitleColor;

    getScreenshotCards().forEach(card => {

      const playerNameElement =
        card.querySelector(
          ".player-screenshot-name"
        );

      if (playerNameElement) {

        playerNameElement.style.color =
          currentTitleColor;

      }

    });

  };

  const applySubtitleColor = color => {

    currentSubtitleColor =
      color || currentSubtitleColor;

    getScreenshotCards().forEach(card => {

      const subtitleElement =
        card.querySelector(
          ".player-screenshot-period"
        );

      if (subtitleElement) {

        subtitleElement.style.color =
          currentSubtitleColor;

      }

    });

  };

  const applyStatsColor = color => {

    currentStatsColor =
      color || currentStatsColor;

    getScreenshotCards().forEach(card => {

      card
        .querySelectorAll(
          ".player-screenshot-main-label, " +
          ".player-screenshot-main-value"
        )
        .forEach(element => {

          element.style.color =
            currentStatsColor;

        });

    });

  };

  const applyPlacementsColor = color => {

    currentPlacementsColor =
      color || currentPlacementsColor;

    getScreenshotCards().forEach(card => {

      card
        .querySelectorAll(
          ".player-screenshot-placement span, " +
          ".player-screenshot-placement strong"
        )
        .forEach(element => {

          element.style.color =
            currentPlacementsColor;

        });

    });

  };

  const applyTeamColor = color => {

    currentTeamColor =
      color || currentTeamColor;

    getScreenshotCards().forEach(card => {

      card
        .querySelectorAll(
          ".player-screenshot-team, " +
          ".player-screenshot-past-teams"
        )
        .forEach(element => {

          element.style.color =
            currentTeamColor;

        });

    });

  };

  const applyHighlightColor = color => {

    currentHighlightColor =
      color || currentHighlightColor;

    getScreenshotCards().forEach(card => {

      card
        .querySelectorAll(
          ".player-screenshot-highlight-label, " +
          ".player-screenshot-highlight-value"
        )
        .forEach(element => {

          element.style.color =
            currentHighlightColor;

        });

    });

  };

  const applyBottomColor = color => {

    currentBottomColor =
      color || currentBottomColor;

    getScreenshotCards().forEach(card => {

      card
        .querySelectorAll(
          ".player-screenshot-bottom-label, " +
          ".player-screenshot-bottom-value"
        )
        .forEach(element => {

          element.style.color =
            currentBottomColor;

        });

    });

  };
  const setCustomColorOption = (
    select,
    color
  ) => {

    if (!select || !color) {
      return;
    }

    const customOption =
      select.querySelector(
        ".screenshot-custom-color-option"
      );

    if (!customOption) {
      return;
    }

    customOption.value =
      color;

    customOption.textContent =
      `カスタム（${color.toUpperCase()}）`;

    select.value =
      color;

  };

  const syncColorControl = (
    select,
    picker,
    color
  ) => {

    if (!color) {
      return;
    }

    if (picker) {

      picker.value =
        color;

    }

    if (!select) {
      return;
    }

    const presetOption =
      Array.from(select.options).find(
        option => {

          return (
            !option.classList.contains(
              "screenshot-custom-color-option"
            ) &&
            option.value.toLowerCase() ===
              color.toLowerCase()
          );

        }
      );

    if (presetOption) {

      select.value =
        presetOption.value;

      return;

    }

    setCustomColorOption(
      select,
      color
    );

  };

  const applyAllTextColor = color => {

    if (!color) {
      return;
    }

    applyTitleColor(color);
    applyTeamColor(color);
    applySubtitleColor(color);
    applyStatsColor(color);
    applyPlacementsColor(color);
    applyHighlightColor(color);
    applyBottomColor(color);

    syncColorControl(
      titleColorSelect,
      titleColorPicker,
      color
    );

    syncColorControl(
      teamColorSelect,
      teamColorPicker,
      color
    );

    syncColorControl(
      subtitleColorSelect,
      subtitleColorPicker,
      color
    );

    syncColorControl(
      statsColorSelect,
      statsColorPicker,
      color
    );

    syncColorControl(
      placementsColorSelect,
      placementsColorPicker,
      color
    );

    syncColorControl(
      highlightColorSelect,
      highlightColorPicker,
      color
    );

    syncColorControl(
      bottomColorSelect,
      bottomColorPicker,
      color
    );

  };

  const bindColorControl = ({
    select,
    picker,
    applyColor
  }) => {

    if (select) {

      select.addEventListener(
        "change",
        () => {

          const color =
            select.value;

          applyColor(color);

          if (picker) {

            picker.value =
              color;

          }

        }
      );

    }

    if (picker) {

      picker.addEventListener(
        "input",
        () => {

          const color =
            picker.value;

          setCustomColorOption(
            select,
            color
          );

          applyColor(color);

        }
      );

    }

  };

  /*
    初期デザインを反映
  */
  applyTheme(
    currentTheme
  );

  applyFont(
    currentFont
  );

  applyTitleColor(
    currentTitleColor
  );

  applySubtitleColor(
    currentSubtitleColor
  );

  applyStatsColor(
    currentStatsColor
  );

  applyPlacementsColor(
    currentPlacementsColor
  );

  applyTeamColor(
    currentTeamColor
  );

  applyHighlightColor(
    currentHighlightColor
  );

  applyBottomColor(
    currentBottomColor
  );

  /*
    背景選択
  */
  themeItems.forEach(item => {

    item.addEventListener(
      "click",
      () => {

        const themeNo =
          item.dataset.theme;

        if (!themeNo) {
          return;
        }

        applyTheme(
          themeNo
        );

      }
    );

  });

  /*
    フォント選択
  */
  if (fontSelect) {

    fontSelect.addEventListener(
      "change",
      () => {

        applyFont(
          fontSelect.value
        );

      }
    );

  }

  /*
    各文字色の選択
  */
  bindColorControl({

    select:
      titleColorSelect,

    picker:
      titleColorPicker,

    applyColor:
      applyTitleColor

  });

  bindColorControl({

    select:
      teamColorSelect,

    picker:
      teamColorPicker,

    applyColor:
      applyTeamColor

  });

  bindColorControl({

    select:
      subtitleColorSelect,

    picker:
      subtitleColorPicker,

    applyColor:
      applySubtitleColor

  });

  bindColorControl({

    select:
      statsColorSelect,

    picker:
      statsColorPicker,

    applyColor:
      applyStatsColor

  });

  bindColorControl({

    select:
      placementsColorSelect,

    picker:
      placementsColorPicker,

    applyColor:
      applyPlacementsColor

  });

  bindColorControl({

    select:
      highlightColorSelect,

    picker:
      highlightColorPicker,

    applyColor:
      applyHighlightColor

  });

  bindColorControl({

    select:
      bottomColorSelect,

    picker:
      bottomColorPicker,

    applyColor:
      applyBottomColor

  });

  /*
    文字色一括変更
  */
  if (allTextColorPicker) {

    allTextColorPicker.addEventListener(
      "input",
      () => {

        applyAllTextColor(
          allTextColorPicker.value
        );

      }
    );

  }

  /*
    カードをコンテナ幅へ合わせて縮小する
  */
    const resizeScreenshotCard = (
      container
    ) => {
    
      if (
        !container ||
        !screenshotCardStage
      ) {
        return;
      }
    
      const baseWidth =
        960;
    
      const baseHeight =
        540;
    
      /*
        コンテナのpaddingを除いた
        実際にカードを置ける横幅を取得
      */
      const containerStyle =
        window.getComputedStyle(
          container
        );
    
      const paddingLeft =
        parseFloat(
          containerStyle.paddingLeft
        ) || 0;
    
      const paddingRight =
        parseFloat(
          containerStyle.paddingRight
        ) || 0;
    
      const paddingTop =
        parseFloat(
          containerStyle.paddingTop
        ) || 0;
    
      const paddingBottom =
        parseFloat(
          containerStyle.paddingBottom
        ) || 0;
    
      const availableWidth =
        container.clientWidth -
        paddingLeft -
        paddingRight;
    
      if (availableWidth <= 0) {
        return;
      }
    
      const scale =
        Math.min(
          1,
          availableWidth / baseWidth
        );
    
      const scaledWidth =
        baseWidth * scale;
    
      const scaledHeight =
        baseHeight * scale;
    
      const leftMargin =
        Math.max(
          0,
          (availableWidth - scaledWidth) / 2
        );
    
      screenshotCardStage.style.transform =
        `translateX(${leftMargin}px) scale(${scale})`;
    
      screenshotCardStage.style.transformOrigin =
        "top left";
    
      screenshotCardStage.style.marginLeft =
        "0";
    
      screenshotCardStage.style.marginRight =
        "0";
    
      /*
        カード高さに上下paddingを加える
      */
      container.style.height =
        `${
          scaledHeight +
          paddingTop +
          paddingBottom
        }px`;
    
    };

  const resizeBuilderPreview = () => {

    resizeScreenshotCard(
      builderPreview
    );

  };

  const resizeFinalPreview = () => {

    resizeScreenshotCard(
      previewStage
    );

  };

  /*
    編集画面へ戻す
  */
  const resetScreenshotMode = () => {

    if (
      builderPreview &&
      screenshotCardStage
    ) {

      builderPreview.appendChild(
        screenshotCardStage
      );

    }

    if (preview) {

      preview.classList.remove(
        "show"
      );

    }

    if (builder) {

      builder.style.display =
        "";

    }

    requestAnimationFrame(
      resizeBuilderPreview
    );

  };

  /*
    画像メーカーを閉じる
  */
  const closeScreenshotMode = () => {

    resetScreenshotMode();

    overlay.classList.remove(
      "show"
    );

    if (
      typeof HLDB.screenshotResizeHandler ===
      "function"
    ) {

      window.removeEventListener(
        "resize",
        HLDB.screenshotResizeHandler
      );

      HLDB.screenshotResizeHandler =
        null;

    }

    window.setTimeout(
      () => {

        if (overlay.isConnected) {

          overlay.remove();

        }

      },
      200
    );

  };

  if (cancelButton) {

    cancelButton.addEventListener(
      "click",
      closeScreenshotMode
    );

  }

  if (createButton) {

    createButton.addEventListener(
      "click",
      () => {

        if (
          !previewStage ||
          !screenshotCardStage
        ) {
          return;
        }

        previewStage.appendChild(
          screenshotCardStage
        );

        if (builder) {

          builder.style.display =
            "none";

        }

        if (preview) {

          preview.classList.add(
            "show"
          );

        }

        requestAnimationFrame(
          resizeFinalPreview
        );

      }
    );

  }

  if (backButton) {

    backButton.addEventListener(
      "click",
      resetScreenshotMode
    );

  }
    /*
    PNG画像として保存する
  */
    if (saveButton) {

      saveButton.addEventListener(
        "click",
        async () => {
  
          if (!screenshotCard) {
  
            console.error(
              "保存対象のカードが見つかりません。"
            );
  
            alert(
              "保存対象の画像が見つかりませんでした。"
            );
  
            return;
  
          }
  
          if (
            typeof window.html2canvas !==
            "function"
          ) {
  
            console.error(
              "html2canvasが読み込まれていません。"
            );
  
            alert(
              "画像保存機能を読み込めませんでした。"
            );
  
            return;
  
          }
  
          saveButton.disabled =
            true;
  
          saveButton.textContent =
            "保存中...";
  
          try {
  
            /*
              Webフォントの読み込み完了を待つ
            */
            saveButton.textContent =
              "フォント読込中...";

            await HLDB.prepareIOSImagesForScreenshot();

            await HLDB.waitForScreenshotFonts();
  
            /*
              カード内画像の読み込み完了を待つ
            */
            saveButton.textContent =
              "画像読込中...";

            const images =
              Array.from(
                screenshotCard.querySelectorAll(
                  "img"
                )
              );
  
            await HLDB.withScreenshotTimeout(

              Promise.all(
  
              images.map(image => {
  
                if (image.complete) {
  
                  return Promise.resolve();
  
                }
  
                return new Promise(resolve => {
  
                  image.addEventListener(
                    "load",
                    resolve,
                    { once: true }
                  );
  
                  image.addEventListener(
                    "error",
                    resolve,
                    { once: true }
                  );
  
                });
  
              })
  
              ),

              8000,
              "カード内画像の読み込み"

            );
  
            /*
              保存前に現在の設定を再反映する
            */
            applyTheme(
              currentTheme
            );
  
            applyFont(
              currentFont
            );
  
            applyTitleColor(
              currentTitleColor
            );
  
            applySubtitleColor(
              currentSubtitleColor
            );
  
            applyStatsColor(
              currentStatsColor
            );
  
            applyPlacementsColor(
              currentPlacementsColor
            );

            applyTeamColor(
              currentTeamColor
            );

            applyHighlightColor(
              currentHighlightColor
            );

            applyBottomColor(
              currentBottomColor
            );
  
            /*
              表示用の縮小transformは
              html2canvasの保存サイズへ影響するため、
              保存時だけ一時的に解除する
            */
            const originalStageTransform =
              screenshotCardStage.style.transform;
  
            const originalStageTransformOrigin =
              screenshotCardStage.style.transformOrigin;
  
            const originalStageMarginLeft =
              screenshotCardStage.style.marginLeft;
  
            const originalStageMarginRight =
              screenshotCardStage.style.marginRight;
  
            screenshotCardStage.style.transform =
              "none";
  
            screenshotCardStage.style.transformOrigin =
              "top left";
  
            screenshotCardStage.style.marginLeft =
              "0";
  
            screenshotCardStage.style.marginRight =
              "0";
  
            try {
  
              const cardWidth =
                Math.round(
                  screenshotCard.offsetWidth
                );
  
              const cardHeight =
                Math.round(
                  screenshotCard.offsetHeight
                );
  
              if (
                cardWidth <= 0 ||
                cardHeight <= 0
              ) {
  
                throw new Error(
                  `カードサイズが不正です: ${cardWidth} × ${cardHeight}`
                );
  
              }
  
              saveButton.textContent =
                "PNG作成中...";

              const canvas =
                await HLDB.withScreenshotTimeout(

                  window.html2canvas(
                  screenshotCard,
                  {
  
                    backgroundColor:
                      "#090909",
  
                    scale:
                      HLDB.shouldUseMobileScreenshotSave()
                        ? 1
                        : 2,
  
                    useCORS:
                      true,
  
                    allowTaint:
                      false,
  
                    logging:
                      false,
  
                    removeContainer:
                      true,
  
                    width:
                      cardWidth,
  
                    height:
                      cardHeight,
  
                    windowWidth:
                      cardWidth,
  
                    windowHeight:
                      cardHeight,
  
                    onclone:
                      clonedDocument => {
  
                        const clonedCard =
                          clonedDocument.querySelector(
                            ".screenshot-preview.show " +
                            ".screenshot-card"
                          ) ||
                          clonedDocument.querySelector(
                            ".screenshot-card"
                          );
  
                        if (!clonedCard) {
  
                          console.error(
                            "複製した保存用カードが見つかりません。"
                          );
  
                          return;
  
                        }
  
                        clonedCard.style.width =
                          `${cardWidth}px`;
  
                        clonedCard.style.height =
                          `${cardHeight}px`;
  
                        clonedCard.style.transform =
                          "none";
  
                        clonedCard.style.margin =
                          "0";
  
                        clonedCard.style.fontFamily =
                          currentFont;
  
                        clonedCard.style.backgroundImage =
                          `url("assets/themes/${currentTheme}.png")`;
  
                        clonedCard.style.backgroundSize =
                          "cover";
  
                        clonedCard.style.backgroundPosition =
                          "center";
  
                        clonedCard.style.backgroundRepeat =
                          "no-repeat";
  
                        const applyClonedColor = (
                          selector,
                          color
                        ) => {

                          clonedCard
                            .querySelectorAll(selector)
                            .forEach(element => {

                              element.style.color =
                                color;

                            });

                        };

                        applyClonedColor(
                          ".player-screenshot-name",
                          currentTitleColor
                        );

                        applyClonedColor(
                          ".player-screenshot-team, " +
                          ".player-screenshot-past-teams",
                          currentTeamColor
                        );

                        applyClonedColor(
                          ".player-screenshot-period",
                          currentSubtitleColor
                        );

                        applyClonedColor(
                          ".player-screenshot-main-label, " +
                          ".player-screenshot-main-value",
                          currentStatsColor
                        );

                        applyClonedColor(
                          ".player-screenshot-placement span, " +
                          ".player-screenshot-placement strong",
                          currentPlacementsColor
                        );

                        applyClonedColor(
                          ".player-screenshot-highlight-label, " +
                          ".player-screenshot-highlight-value",
                          currentHighlightColor
                        );

                        applyClonedColor(
                          ".player-screenshot-bottom-label, " +
                          ".player-screenshot-bottom-value",
                          currentBottomColor
                        );
  
                        /*
                          html2canvasで一部の装飾が
                          createPatternエラーを起こす場合があるため、
                          保存用の複製画面だけ不要な背景画像を除去する
                        */
                        const exportStyle =
                          clonedDocument.createElement(
                            "style"
                          );
  
                        exportStyle.textContent = `
  
                          .screenshot-card{
                            width:${cardWidth}px !important;
                            height:${cardHeight}px !important;
                            transform:none !important;
                            margin:0 !important;
                            background-size:cover !important;
                            background-position:center !important;
                            background-repeat:no-repeat !important;
                          }
  
                          .screenshot-card *::before,
                          .screenshot-card *::after{
                            background-image:none !important;
                          }
  
                          .screenshot-card-divider{
                            background:#6f5a18 !important;
                          }
  
                        `;
  
                        clonedDocument.head.appendChild(
                          exportStyle
                        );
  
                      }
  
                  }
                ),

                30000,
                "PNG画像の作成"

              );
  
              const safeTeamName =
                createSafeFileName(
                  rawTeamName
                ) || "team";
  
              const safeYear =
                createSafeFileName(
                  rawYear
                );
  
              const safeStage =
                createSafeFileName(
                  rawStage
                );
  
              const fileNameParts = [
  
                safeTeamName,
                safeYear,
                safeStage
  
              ].filter(Boolean);
  
              saveButton.textContent =
                "共有準備中...";

              await HLDB.saveScreenshotCanvas({
                canvas,
                fileName:
                  `${fileNameParts.join("_")}.png`
              });
  
            } finally {
  
              /*
                保存後に表示用の縮小状態へ戻す
              */
              screenshotCardStage.style.transform =
                originalStageTransform;
  
              screenshotCardStage.style.transformOrigin =
                originalStageTransformOrigin;
  
              screenshotCardStage.style.marginLeft =
                originalStageMarginLeft;
  
              screenshotCardStage.style.marginRight =
                originalStageMarginRight;
  
            }
  
          } catch (error) {
  
            console.error(
              "画像の保存に失敗しました。",
              error
            );
  
            alert(
              "画像の保存に失敗しました。\n" +
              (error?.message || "原因不明のエラー")
            );
  
          } finally {
  
            saveButton.disabled =
              false;
  
            saveButton.textContent =
              "PNGで保存";
  
          }
  
        }
      );
  
    }
  
    /*
      オーバーレイ外側をクリックした場合は閉じる
    */
    overlay.addEventListener(
      "click",
      event => {
  
        if (event.target !== overlay) {
          return;
        }
  
        closeScreenshotMode();
  
      }
    );
  
    /*
      Escapeキーで閉じる
    */
    overlay.addEventListener(
      "keydown",
      event => {
  
        if (event.key !== "Escape") {
          return;
        }
  
        closeScreenshotMode();
  
      }
    );
  
    /*
      画面幅変更時のサイズ調整
    */
    HLDB.screenshotResizeHandler = () => {
  
      if (
        preview &&
        preview.classList.contains(
          "show"
        )
      ) {
  
        resizeFinalPreview();
  
        return;
  
      }
  
      resizeBuilderPreview();
  
    };
  
    window.addEventListener(
      "resize",
      HLDB.screenshotResizeHandler
    );
  
    /*
      画像メーカーを画面へ表示する
    */
    document.body.appendChild(
      overlay
    );
    const playerHighlightSelect =
  overlay.querySelector(
    "#playerHighlightSelect"
  );

  if (playerHighlightSelect) {

    playerHighlightSelect.value =
      selectedHighlight;
  
  }

  playerHighlightSelect?.addEventListener(
    "change",
    event => {
  
      selectedHighlight =
      playerHighlightSelect.value;
  
      /*
        強調順位を更新
      */
      const highlight =
        getHighlightData();
  
      const highlightLabel =
        overlay.querySelector(
          ".player-screenshot-highlight-label"
        );
  
      const highlightValue =
        overlay.querySelector(
          ".player-screenshot-highlight-value"
        );
  
      if (highlightLabel) {
        highlightLabel.textContent =
          highlight.label;
      }
  
      if (highlightValue) {
        highlightValue.textContent =
          highlight.value;
      }
  
      /*
        上段右と下段3項目を更新
      */
      const displayStats =
        getDisplayStats();
  
      const selectedLabel =
        overlay.querySelector(
          ".player-screenshot-selected-label"
        );
  
      const selectedValue =
        overlay.querySelector(
          ".player-screenshot-selected-value"
        );
  
      if (selectedLabel) {
        selectedLabel.textContent =
          displayStats.selected.label;
      }
  
      if (selectedValue) {
        selectedValue.textContent =
          displayStats.selected.value;
      }
  
      const bottomStats =
        overlay.querySelectorAll(
          ".player-screenshot-bottom-stat"
        );
  
      bottomStats.forEach(
        (element, index) => {
  
          const stat =
            displayStats.remaining[index];
  
          if (!stat) {
            return;
          }
  
          const label =
            element.querySelector(
              ".player-screenshot-dynamic-label"
            );
  
          const value =
            element.querySelector(
              ".player-screenshot-dynamic-value"
            );
  
          if (label) {
            label.textContent =
              stat.label;
          }
  
          if (value) {
            value.textContent =
              stat.value;
          }
  
        }
      );
  
    }
  );
  
    overlay.setAttribute(
      "tabindex",
      "-1"
    );
  
    overlay.classList.add(
      "show"
    );
  
    overlay.focus();
  
    requestAnimationFrame(
      () => {
  
        resizeBuilderPreview();
  
      }
    );
  
  };
