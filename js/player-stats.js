/* 個人成績（局解析データ） */
(function () {
  const area = document.getElementById("playerDetailedStatsBody");
  if (!area) return;

  const supportedPlayerIds =
    new Set(["P0018"]);

  const requestedPlayerId =
    new URLSearchParams(location.search)
      .get("id") || "";

  if (!supportedPlayerIds.has(requestedPlayerId)) {
    const title = document.getElementById(
      "playerDetailedTitle"
    );

    if (title) {
      title.textContent = "詳細成績";
    }

    area.innerHTML = `
      <p class="detailed-empty">
        詳細成績は現在準備中です。
      </p>
    `;

    return;
  }

  let summaryRows = [];
  let roleRows = [];
  let selectedType = "全期間";
  let selectedYear = "";
  let selectedSeason = "";

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
    HLDB.initializeIcons();
  }

  Promise.all([
    HLDB.loadData("detailedPlayersMain"),
    HLDB.loadData("detailedPlayersCurrent"),
    HLDB.loadData("detailedRolesMain"),
    HLDB.loadData("detailedRolesCurrent")
  ]).then(([
    playersMain,
    playersCurrent,
    rolesMain,
    rolesCurrent
  ]) => {
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
