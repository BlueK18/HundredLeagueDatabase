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
  playerAlias: "data/playerAlias.csv"
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

    const freshData =
      await HLDB.fetchCsv(url);

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

    } catch (error) {
      console.error(
        "共通UIの初期化に失敗しました:",
        error
      );
    }
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
    }
  );

} else {
  HLDB.initializeCommonUi();
}