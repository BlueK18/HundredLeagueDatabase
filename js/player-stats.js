/* 個人成績（局解析データ） */
(function () {
  const area = document.getElementById("playerDetailedStatsBody");
  if (!area) return;

  const requestedPlayerId =
    new URLSearchParams(location.search)
      .get("id") || "";
  const pageParams = new URLSearchParams(location.search);
  const requestedYear = pageParams.get("year") || "";
  const requestedLeague = pageParams.get("league") || "";
  const requestedStage = pageParams.get("stage") || "";

  const isAdminUnlocked =
    sessionStorage.getItem(
      "hldbDetailedStatsUnlocked"
    ) === "1";

  if (
    !requestedPlayerId ||
    !isAdminUnlocked
  ) {
    const title = document.getElementById(
      "playerDetailedTitle"
    );

    if (title) {
      title.textContent = "詳細成績";
    }

    area.innerHTML = `
      <p class="detailed-empty">
        この詳細成績は管理者専用です。
      </p>
    `;

    return;
  }

  let summaryRows = [];
  let roleRows = [];
  let profileRows = [];
  let selectedType = "全期間";
  let selectedYear = "";
  let selectedSeason = "";

  function ensureHtml2Canvas() {
    if (window.html2canvas) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
      script.onload = resolve;
      script.onerror = () => reject(new Error("html2canvasを読み込めませんでした。"));
      document.head.appendChild(script);
    });
  }

  function statsPeriodText() {
    if (selectedType === "年度") return `${selectedYear}年度`;
    if (selectedType === "シーズン") return `${selectedYear}年度　${selectedSeason}`;
    return "全期間";
  }

  function currentTeamName() {
    const playerRows = profileRows.filter(row =>
      String(row["選手ID"] || "").trim() === requestedPlayerId
    );
    const exact = playerRows.find(row =>
      (!requestedYear || String(row["年度"] || "").trim() === requestedYear) &&
      (!requestedLeague || String(row["リーグ"] || "").trim() === requestedLeague) &&
      (!requestedStage || String(row["ステージ"] || "").trim() === requestedStage)
    );
    return String((exact || playerRows[0])?.["チーム名"] || "").trim();
  }

  function showStatsImagePreview(canvas, fileName) {
    document.querySelector(".match-image-preview")?.remove();
    const overlay = document.createElement("div");
    overlay.className = "match-image-preview";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "作成画像の確認");
    overlay.innerHTML = `
      <div class="match-image-preview-dialog">
        <div class="match-image-preview-head">
          <strong>作成画像の確認</strong>
          <button type="button" data-close-preview aria-label="確認画面を閉じる">×</button>
        </div>
        <div class="match-image-preview-canvas">
          <img src="${canvas.toDataURL("image/png")}" alt="保存する詳細成績画像の確認">
        </div>
        <div class="match-image-preview-actions">
          <button type="button" class="is-save" data-save-preview>この画像を保存する</button>
          <button type="button" class="is-back" data-close-preview>戻る</button>
        </div>
      </div>`;

    const close = () => overlay.remove();
    overlay.querySelectorAll("[data-close-preview]").forEach(button => button.addEventListener("click", close));
    overlay.addEventListener("click", event => { if (event.target === overlay) close(); });
    overlay.querySelector("[data-save-preview]")?.addEventListener("click", async event => {
      const button = event.currentTarget;
      button.disabled = true;
      button.textContent = "保存準備中...";
      try {
        await HLDB.saveScreenshotCanvas({ canvas, fileName });
        close();
      } catch (error) {
        console.error("詳細成績画像を保存できませんでした。", error);
        button.disabled = false;
        button.textContent = "この画像を保存する";
        alert("画像を保存できませんでした。もう一度お試しください。");
      }
    });
    document.body.appendChild(overlay);
  }

  async function saveDetailedStatsImage() {
    const source = document.querySelector(".detailed-stats-section");
    const row = currentSummary();
    if (!source || !row) return;

    const button = document.getElementById("detailedStatsImageButton");
    const original = button?.innerHTML;
    let card;
    try {
      if (button) {
        button.disabled = true;
        button.textContent = "画像を作成中...";
      }
      await ensureHtml2Canvas();
      await window.HLDB?.waitForScreenshotFonts?.();

      card = document.createElement("div");
      card.className = "detailed-stats-share-card";
      const content = source.cloneNode(true);
      content.querySelector(".detailed-stats-image-button")?.remove();
      content.querySelector(".detailed-filter")?.remove();
      content.querySelector("#detailedStatsTitle").innerHTML = `
        <span>ハンドレッドリーグ データベース</span>
        <strong>${HLDB.escapeHtml(String(row["選手名"] || "詳細成績"))}</strong>
        ${currentTeamName() ? `<small>${HLDB.escapeHtml(currentTeamName())}</small>` : ""}
        <b>${HLDB.escapeHtml(statsPeriodText())}</b>`;
      card.appendChild(content);

      const watermark = document.createElement("img");
      watermark.className = "detailed-stats-share-watermark";
      watermark.src = "apple-touch-icon.png";
      watermark.alt = "";
      watermark.setAttribute("aria-hidden", "true");
      card.appendChild(watermark);
      document.body.appendChild(card);

      if (typeof watermark.decode === "function") {
        await watermark.decode().catch(() => {});
      }

      const canvas = await window.html2canvas(card, {
        backgroundColor: "#0d0f10",
        scale: 2,
        width: card.scrollWidth,
        height: card.scrollHeight,
        useCORS: true,
        logging: false
      });
      const safeName = String(row["選手名"] || "player").replace(/[\\/:*?"<>|]/g, "_");
      const safePeriod = statsPeriodText().replace(/[\\/:*?"<>|　 ]/g, "_");
      showStatsImagePreview(canvas, `${safeName}_${safePeriod}_詳細成績.png`);
    } catch (error) {
      console.error("詳細成績画像を作成できませんでした。", error);
      alert("画像を作成できませんでした。通信状態を確認して、もう一度お試しください。");
    } finally {
      card?.remove();
      if (button) {
        button.disabled = false;
        button.innerHTML = original;
        HLDB.initializeIcons();
      }
    }
  }

  const value = (row, key, suffix = "") => {
    const raw = String(row?.[key] ?? "").trim();
    return raw ? `${HLDB.escapeHtml(raw)}${suffix}` : "―";
  };

  const numberText = (row, key, suffix = "") => {
    const number = HLDB.toNumber(row?.[key]);
    return number === null
      ? "―"
      : `${number.toLocaleString("ja-JP", { maximumFractionDigits: 2 })}${suffix}`;
  };

  const signed = (row, key, suffix = "") => {
    const number = HLDB.toNumber(row?.[key]);
    if (number === null) return "―";
    const sign = number > 0 ? "+" : "";
    return `<span class="${number > 0 ? "is-positive" : number < 0 ? "is-negative" : ""}">${sign}${number.toLocaleString("ja-JP", { maximumFractionDigits: 2 })}${suffix}</span>`;
  };

  function playerId() {
    return new URLSearchParams(location.search).get("id") || "";
  }

  function rowsForPlayer(rows) {
    return rows.filter(row => String(row["選手ID"] || "").trim() === playerId());
  }

  function mergeUniqueRows(
    mainRows,
    currentRows,
    keyColumns
  ) {
    const merged = new Map();

    const addRows = rows => {
      rows.forEach(row => {
        const playerId =
          String(row["選手ID"] || "").trim();

        if (!playerId) return;

        const key = keyColumns
          .map(column =>
            String(row[column] || "").trim()
          )
          .join("\u001f");

        merged.set(key, row);
      });
    };

    /* 同じ集計行がある場合は後から入るcurrentを優先する */
    addRows(mainRows);
    addRows(currentRows);

    return [...merged.values()];
  }

  function availableYears() {
    return [...new Set(rowsForPlayer(summaryRows)
      .map(row => String(row["年度"] || "").trim())
      .filter(Boolean))].sort((a, b) => Number(b) - Number(a));
  }

  function availableSeasons(year) {
    return [...new Set(rowsForPlayer(summaryRows)
      .filter(row => String(row["年度"] || "").trim() === year)
      .map(row => String(row["シーズン"] || "").trim())
      .filter(Boolean))];
  }

  function currentSummary() {
    return rowsForPlayer(summaryRows).find(row => {
      if (String(row["集計区分"] || "").trim() !== selectedType) return false;
      if (selectedType === "年度") return String(row["年度"] || "").trim() === selectedYear;
      if (selectedType === "シーズン") {
        return String(row["年度"] || "").trim() === selectedYear &&
          String(row["シーズン"] || "").trim() === selectedSeason;
      }
      return true;
    });
  }

  function currentRoles() {
    return rowsForPlayer(roleRows).filter(row => {
      if (String(row["集計区分"] || "").trim() !== selectedType) return false;
      if (selectedType === "年度") return String(row["年度"] || "").trim() === selectedYear;
      if (selectedType === "シーズン") {
        return String(row["年度"] || "").trim() === selectedYear &&
          String(row["シーズン"] || "").trim() === selectedSeason;
      }
      return true;
    }).sort((a, b) => (HLDB.toNumber(b["出現回数"]) || 0) - (HLDB.toNumber(a["出現回数"]) || 0));
  }

  function metric(label, content) {
    return `<div class="detailed-metric"><span>${label}</span><strong>${content}</strong></div>`;
  }

  function panel(title, icon, metrics) {
    return `<article class="detailed-panel"><h3><i data-lucide="${icon}"></i>${title}</h3><div class="detailed-panel-list">${metrics.join("")}</div></article>`;
  }

  function render() {
    const years = availableYears();
    if (!selectedYear) selectedYear = years[0] || "";
    const seasons = availableSeasons(selectedYear);
    if (!seasons.includes(selectedSeason)) selectedSeason = seasons[0] || "";
    const row = currentSummary();

    const title = document.getElementById(
      "playerDetailedTitle"
    );

    if (title) {
      title.textContent = row?.["選手名"]
        ? `${row["選手名"]}｜詳細成績`
        : "詳細成績";

      if (row?.["選手名"]) {
        document.title =
          `${row["選手名"]}｜詳細成績｜ハンドレッドリーグ データベース`;
      }
    }

    area.innerHTML = `
      <div class="detailed-filter" role="group" aria-label="集計期間">
        ${["全期間", "年度", "シーズン"].map(type => `<button type="button" data-stats-type="${type}" class="${selectedType === type ? "is-active" : ""}">${type}</button>`).join("")}
        ${selectedType !== "全期間" ? `<select id="detailedYearSelect" aria-label="年度">${years.map(year => `<option value="${year}" ${year === selectedYear ? "selected" : ""}>${year}年度</option>`).join("")}</select>` : ""}
        ${selectedType === "シーズン" ? `<select id="detailedSeasonSelect" aria-label="シーズン">${seasons.map(season => `<option value="${HLDB.escapeHtml(season)}" ${season === selectedSeason ? "selected" : ""}>${HLDB.escapeHtml(season)}</option>`).join("")}</select>` : ""}
      </div>
      ${row ? `
        <div class="detailed-block"><h3 class="detailed-block-title">順位成績</h3>
          <div class="placement-grid">${[1,2,3,4].map(rank => `<div class="placement-card rank-${rank}"><strong>${rank}着</strong><span>${numberText(row, `${rank}着数`, "回")}</span><b>${value(row, rank === 1 ? "トップ率" : `${rank}着率`)}</b></div>`).join("")}</div>
          <div class="summary-grid">
            ${metric("対局数", numberText(row, "対局数", "回"))}${metric("総局数", numberText(row, "総局数", "局"))}${metric("平均順位", numberText(row, "平均順位"))}${metric("総合ポイント", signed(row, "総合ポイント", " pt"))}${metric("平均ポイント", signed(row, "平均ポイント", " pt"))}${metric("トップ率", value(row, "トップ率"))}${metric("連対率", value(row, "連対率"))}${metric("ラス回避率", value(row, "ラス回避率"))}${metric("最高得点", numberText(row, "最高得点", "点"))}${metric("最低得点", numberText(row, "最低得点", "点"))}
          </div>
        </div>
        <div class="detailed-block"><h3 class="detailed-block-title">局成績</h3><div class="detailed-panels">
          ${panel("1. 和了", "hand", [metric("和了数", numberText(row,"和了数","回")),metric("和了率",value(row,"和了率")),metric("ツモ和了数",numberText(row,"ツモ和了数","回")),metric("ロン和了数",numberText(row,"ロン和了数","回")),metric("ツモ和了率",value(row,"ツモ和了率")),metric("平均和了点",numberText(row,"平均和了点","点")),metric("最高和了点",numberText(row,"最高和了点","点")),metric("平均翻",numberText(row,"平均翻","翻")),metric("平均符",numberText(row,"平均符","符"))])}
          ${panel("2. 守備", "shield", [metric("放銃数",numberText(row,"放銃数","回")),metric("放銃率",value(row,"放銃率")),metric("平均放銃点",numberText(row,"平均放銃点","点")),metric("最大放銃点",numberText(row,"最大放銃点","点")),metric("放銃回避率",value(row,"放銃回避率"))])}
          ${panel("3. 立直・副露", "panel-top", [metric("立直数",numberText(row,"立直局数","回")),metric("立直率",value(row,"立直率")),metric("立直和了率",value(row,"立直和了率")),metric("副露数",numberText(row,"副露局数","回")),metric("副露率",value(row,"副露率")),metric("副露和了率",value(row,"副露和了率")),metric("ダマ和了率",value(row,"ダマ和了率"))])}
          ${panel("4. 親番・局収支", "circle-dot", [metric("親局数",numberText(row,"親局数","回")),metric("親番和了率",value(row,"親番和了率")),metric("親番放銃率",value(row,"親番放銃率")),metric("親平均収支",signed(row,"親平均収支","点")),metric("子平均収支",signed(row,"子平均収支","点")),metric("総局収支",signed(row,"総局収支","点")),metric("平均局収支",signed(row,"平均局収支","点")),metric("最大局収支",signed(row,"最大局収支","点")),metric("最小局収支",signed(row,"最小局収支","点")),metric("流局率",value(row,"流局率"))])}
        </div></div>
        <div class="detailed-block"><h3 class="detailed-block-title">役別成績</h3>${currentRoles().length ? `<div class="role-table-wrap"><table class="role-table"><thead><tr><th>役名</th><th>出現回数</th><th>和了時の出現率</th><th>和了時の平均翻</th><th>和了時の平均点</th></tr></thead><tbody>${currentRoles().map(role => `<tr><td>${value(role,"役名")}</td><td>${numberText(role,"出現回数","回")}</td><td>${value(role,"和了時出現率")}</td><td>${numberText(role,"和了時平均翻","翻")}</td><td>${numberText(role,"和了時平均点","点")}</td></tr>`).join("")}</tbody></table></div>` : `<p class="detailed-empty">この期間の役別成績はありません。</p>`}</div>
      ` : `<p class="detailed-empty">この選手の局解析データはまだありません。</p>`}`;

    area.querySelectorAll("[data-stats-type]").forEach(button => button.addEventListener("click", () => { selectedType = button.dataset.statsType; render(); }));
    area.querySelector("#detailedYearSelect")?.addEventListener("change", event => { selectedYear = event.target.value; selectedSeason = ""; render(); });
    area.querySelector("#detailedSeasonSelect")?.addEventListener("change", event => { selectedSeason = event.target.value; render(); });
    const imageButton = document.getElementById("detailedStatsImageButton");
    if (imageButton) imageButton.hidden = !row;
    HLDB.initializeIcons();
  }

  document.getElementById("detailedStatsImageButton")
    ?.addEventListener("click", saveDetailedStatsImage);

  Promise.all([
    HLDB.loadData("detailedPlayersMain"),
    HLDB.loadData("detailedPlayersCurrent"),
    HLDB.loadData("detailedRolesMain"),
    HLDB.loadData("detailedRolesCurrent"),
    HLDB.loadData("players")
  ]).then(([
    playersMain,
    playersCurrent,
    rolesMain,
    rolesCurrent,
    players
  ]) => {
    profileRows = players;
    summaryRows = mergeUniqueRows(
      playersMain,
      playersCurrent,
      [
        "選手ID",
        "集計区分",
        "年度",
        "シーズン"
      ]
    );

    roleRows = mergeUniqueRows(
      rolesMain,
      rolesCurrent,
      [
        "選手ID",
        "集計区分",
        "年度",
        "シーズン",
        "役名"
      ]
    );

    render();
  }).catch(error => {
    console.error(error);
    area.innerHTML = `<p class="detailed-empty">個人成績データを読み込めませんでした。</p>`;
  });
})();
