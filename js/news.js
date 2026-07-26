/* ========================================
   お知らせページ
======================================== */

document.addEventListener(
    "DOMContentLoaded",
    initializeNewsPage
  );
  
  
  /* ========================================
     初期化
  ======================================== */
  
  async function initializeNewsPage() {
    const newsContainer =
      document.getElementById(
        "newsList"
      );
  
    if (!newsContainer) {
      return;
    }
  
    try {
      const newsData =
        await HLDB.loadData(
          "news"
        );
  
      const publishedNews =
        newsData
          .filter(isPublishedNews)
          .sort(sortNewsItems);
  
      renderNews(
        publishedNews,
        newsContainer
      );
  
      if (
        typeof lucide !==
        "undefined"
      ) {
        lucide.createIcons();
      }
  
    } catch (error) {
      console.error(
        "お知らせの読み込みに失敗しました:",
        error
      );
  
      newsContainer.innerHTML = `
        <div class="news-empty">
          <i data-lucide="triangle-alert"></i>
          <p>
            お知らせを読み込めませんでした。
          </p>
        </div>
      `;
  
      if (
        typeof lucide !==
        "undefined"
      ) {
        lucide.createIcons();
      }
    }
  }
  
  
  /* ========================================
     公開判定
  ======================================== */
  
  function isPublishedNews(item) {
    const value =
      String(
        item["公開"] || ""
      )
        .trim()
        .toLowerCase();
  
    return (
      value === "公開" ||
      value === "true" ||
      value === "1" ||
      value === "yes"
    );
  }
  
  
  /* ========================================
     並び順
  ======================================== */
  
  function sortNewsItems(a, b) {
    const importantDifference =
      getImportantValue(b) -
      getImportantValue(a);
  
    if (importantDifference !== 0) {
      return importantDifference;
    }
  
    return (
      getNewsDateValue(
        b["日付"]
      ) -
      getNewsDateValue(
        a["日付"]
      )
    );
  }
  
  
  function getImportantValue(item) {
    const value =
      String(
        item["重要"] || ""
      )
        .trim()
        .toLowerCase();
  
    return (
      value === "重要" ||
      value === "true" ||
      value === "1" ||
      value === "yes"
    )
      ? 1
      : 0;
  }
  
  
  function getNewsDateValue(value) {
    const text =
      String(value || "")
        .trim()
        .replace(/[年月]/g, "/")
        .replace(/日/g, "")
        .replace(/\./g, "/")
        .replace(/-/g, "/");
  
    const date =
      new Date(text);
  
    const time =
      date.getTime();
  
    return Number.isFinite(time)
      ? time
      : 0;
  }
  
  
  /* ========================================
     描画
  ======================================== */
  
  function renderNews(
    newsData,
    newsContainer
  ) {
    if (newsData.length === 0) {
      newsContainer.innerHTML = `
        <div class="news-empty">
          <i data-lucide="bell-off"></i>
          <p>
            現在、お知らせはありません。
          </p>
        </div>
      `;
  
      return;
    }
  
    newsContainer.innerHTML =
      newsData
        .map(createNewsCard)
        .join("");
  }
  
  
  function createNewsCard(item) {
    const category =
      String(
        item["カテゴリ"] || "info"
      )
        .trim()
        .toLowerCase();
  
    const title =
      escapeHtml(
        item["タイトル"] || ""
      );
  
    const body =
      formatNewsBody(
        item["本文"] || ""
      );
  
    const date =
      escapeHtml(
        item["日付"] || ""
      );
  
    const link =
      String(
        item["リンク"] || ""
      ).trim();
  
    const buttonText =
      escapeHtml(
        item["ボタン"] ||
        item["ボタン文言"] ||
        "詳しく見る"
      );
  
    const isImportant =
      getImportantValue(item) === 1;
  
    const iconName =
      getCategoryIcon(category);
  
    const categoryName =
      getCategoryName(category);
  
    return `
      <article class="
        news-card
        news-category-${escapeHtml(category)}
        ${isImportant
          ? "is-important"
          : ""}
      ">
        <div class="news-card-header">
          <div class="news-category">
            <i
              data-lucide="${iconName}"
              aria-hidden="true"
            ></i>
  
            <span>
              ${categoryName}
            </span>
  
            ${
              isImportant
                ? `
                  <span class="news-important-badge">
                    重要
                  </span>
                `
                : ""
            }
          </div>
  
          <time class="news-date">
            ${date}
          </time>
        </div>
  
        <h2 class="news-title">
          ${title}
        </h2>
  
        <div class="news-body">
          ${body}
        </div>
  
        ${
          link
            ? `
              <div class="news-actions">
                <a
                  class="news-link-button"
                  href="${escapeHtml(link)}"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span>
                    ${buttonText}
                  </span>
  
                  <i
                    data-lucide="external-link"
                    aria-hidden="true"
                  ></i>
                </a>
              </div>
            `
            : ""
        }
      </article>
    `;
  }
  
  
  /* ========================================
     カテゴリ
  ======================================== */
  
  function getCategoryIcon(category) {
    const icons = {
      update: "sparkles",
      league: "trophy",
      youtube: "play-circle",
      note: "file-text",
      info: "bell",
      warning: "triangle-alert"
    };
  
    return icons[category] || "bell";
  }
  
  
  function getCategoryName(category) {
    const names = {
      update: "更新情報",
      league: "リーグ",
      youtube: "YouTube",
      note: "note",
      info: "お知らせ",
      warning: "重要なお知らせ"
    };
  
    return names[category] || "お知らせ";
  }
  
  
  /* ========================================
     本文整形
  ======================================== */
  
  function formatNewsBody(value) {
    return escapeHtml(value)
      .replace(
        /\r?\n/g,
        "<br>"
      );
  }
  
  
  /* ========================================
     HTMLエスケープ
  ======================================== */
  
  function escapeHtml(value) {
    return String(value ?? "")
      .replace(
        /&/g,
        "&amp;"
      )
      .replace(
        /</g,
        "&lt;"
      )
      .replace(
        />/g,
        "&gt;"
      )
      .replace(
        /"/g,
        "&quot;"
      )
      .replace(
        /'/g,
        "&#039;"
      );
  }