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
  id,
  year,
  league,
  stage
}) {
  const query = new URLSearchParams({
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
            id: player["選手ID"],
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
/* ========================================
   年度選択肢を自動生成
======================================== */

HLDB.populateYearSelect = function (
  selectId,
  data,
  yearKey = "年度"
) {
  const yearSelect =
    document.getElementById(selectId);

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
        .map(row =>
          HLDB.normalizeYear(
            row[yearKey]
          )
        )
        .filter(Boolean)
    )
  ].sort(
    (a, b) =>
      Number(b) - Number(a)
  );

  if (years.length === 0) {
    yearSelect.innerHTML = `
      <option value="">
        年度データなし
      </option>
    `;

    return;
  }

  yearSelect.innerHTML =
    years.map(year => `
      <option value="${HLDB.escapeHtml(year)}">
        ${HLDB.escapeHtml(year)}
      </option>
    `).join("");

  yearSelect.value =
    years.includes(currentYear)
      ? currentYear
      : years[0];
};
/* ========================================
   共通：スマホ下部ナビ
======================================== */

function createBottomNavigation() {
  // 二重表示を防止
  if (document.querySelector(".bottom-nav")) {
    return;
  }

  const currentPage =
    window.location.pathname.split("/").pop() || "index.html";

  const bottomNav = document.createElement("nav");
  bottomNav.className = "bottom-nav";
  bottomNav.setAttribute("aria-label", "メインナビゲーション");

  bottomNav.innerHTML = `
  <a
    href="index.html"
    class="bottom-nav-item"
    data-page="home"
  >
    <i
      data-lucide="house"
      class="bottom-nav-icon"
      aria-hidden="true"
    ></i>

    <span class="bottom-nav-label">
      HOME
    </span>
  </a>

  <a
    href="index.html#teamRanking"
    class="bottom-nav-item"
    data-page="team"
  >
    <i
      data-lucide="users"
      class="bottom-nav-icon"
      aria-hidden="true"
    ></i>

    <span class="bottom-nav-label">
      チーム
    </span>
  </a>

  <a
    href="players.html"
    class="bottom-nav-item"
    data-page="players"
  >
    <i
      data-lucide="user-search"
      class="bottom-nav-icon"
      aria-hidden="true"
    ></i>

    <span class="bottom-nav-label">
      選手検索
    </span>
  </a>

  <a
    href="awards.html"
    class="bottom-nav-item"
    data-page="awards"
  >
    <i
      data-lucide="trophy"
      class="bottom-nav-icon"
      aria-hidden="true"
    ></i>

    <span class="bottom-nav-label">
      個人賞
    </span>
  </a>

  <a
    href="news.html"
    class="bottom-nav-item"
    data-page="news"
  >
    <i
      data-lucide="megaphone"
      class="bottom-nav-icon"
      aria-hidden="true"
    ></i>

    <span class="bottom-nav-label">
      お知らせ
    </span>
  </a>
`;
document.body.appendChild(bottomNav);

if (window.lucide) {
  window.lucide.createIcons({
    attrs: {
      "stroke-width": 2
    }
  });
}

  document.body.appendChild(bottomNav);

  // 現在開いているページを金色にする
  let activePage = "";

  if (
    currentPage === "index.html" ||
    currentPage === ""
  ) {
    activePage =
      window.location.hash === "#teamRanking"
        ? "team"
        : "home";
  } else if (
    currentPage === "players.html" ||
    currentPage === "player.html"
  ) {
    activePage = "players";
  } else if (currentPage === "awards.html") {
    activePage = "awards";
  } else if (currentPage === "news.html") {
    activePage = "news";
  }

  const activeItem = bottomNav.querySelector(
    `[data-page="${activePage}"]`
  );

  if (activeItem) {
    activeItem.classList.add("is-active");
    activeItem.setAttribute("aria-current", "page");
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", createBottomNavigation);
} else {
  createBottomNavigation();
}
/* ========================================
   スマホ：横スクロール案内を自動表示
======================================== */

let horizontalScrollHintShown = false;

function setupHorizontalScrollHints(){

    const isMobile =
        window.matchMedia("(max-width: 768px)").matches;

    if(!isMobile){
        document
            .querySelectorAll(".horizontal-scroll-hint")
            .forEach(hint => hint.remove());

        return;
    }

    if(horizontalScrollHintShown){
        return;
    }

    const allElements =
        document.querySelectorAll("body *");

    allElements.forEach(element => {

        const style =
            window.getComputedStyle(element);

        const canScrollHorizontally =
            style.overflowX === "auto" ||
            style.overflowX === "scroll";

        const actuallyOverflows =
            element.scrollWidth >
            element.clientWidth + 5;

        if(
            !canScrollHorizontally ||
            !actuallyOverflows
        ){
            return;
        }

        if(
            element.dataset.scrollHintAttached === "true"
        ){
            return;
        }

        element.dataset.scrollHintAttached = "true";

        const hint =
            document.createElement("div");

        hint.className =
            "horizontal-scroll-hint";

        hint.innerHTML = `
            <span class="horizontal-scroll-hint-icon horizontal-scroll-hint-icon-left">
                <i data-lucide="chevrons-left"></i>
            </span>

            <span class="horizontal-scroll-hint-text">
                横にスワイプできます
            </span>

            <span class="horizontal-scroll-hint-icon horizontal-scroll-hint-icon-right">
                <i data-lucide="chevrons-right"></i>
            </span>
        `;

        element.parentNode.insertBefore(
            hint,
            element
        );

        if(window.lucide){
            lucide.createIcons();
        }

        const removeHint = () => {

            hint.classList.add(
                "is-hidden"
            );

            setTimeout(() => {
                hint.remove();
            }, 350);
        };

        element.addEventListener(
            "scroll",
            removeHint,
            {
                once:true,
                passive:true
            }
        );
    });

    horizontalScrollHintShown = true;
}


/* 通常の読み込み・更新 */
document.addEventListener(
    "DOMContentLoaded",
    () => {

        setTimeout(
            setupHorizontalScrollHints,
            300
        );
    }
);


/* ブラウザの戻る・進む */
window.addEventListener(
    "pageshow",
    event => {

        if(event.persisted){

            document
                .querySelectorAll(".horizontal-scroll-hint")
                .forEach(hint => hint.remove());

            horizontalScrollHintShown = true;

            return;
        }
    }
);


/* 画面幅変更 */
window.addEventListener(
    "resize",
    () => {

        clearTimeout(
            window.horizontalScrollHintTimer
        );

        window.horizontalScrollHintTimer =
            setTimeout(() => {

                if(
                    window.matchMedia(
                        "(max-width: 768px)"
                    ).matches
                ){
                    setupHorizontalScrollHints();
                }else{
                    document
                        .querySelectorAll(
                            ".horizontal-scroll-hint"
                        )
                        .forEach(hint => hint.remove());
                }

            }, 250);
    }
);
/* ========================================
   共通：戻るボタン
======================================== */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    const backButton =
      document.getElementById(
        "backButton"
      );

    if(!backButton){
      return;
    }

    backButton.addEventListener(
      "click",
      event => {

        event.preventDefault();

        history.back();

      }
    );

  }
);