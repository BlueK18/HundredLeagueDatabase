(function(){
  "use strict";
  const $=id=>document.getElementById(id);
  const VIEWS=["inputView","confirmView","listView","urlView","editView"];
  const MATCHES=["第一試合","第二試合"];
  const SCHEDULE_CSV_URL="data/score-schedule.csv";
  const PLAYERS_CSV_URL="data/score-players.csv";
  const SCORE_API_URL="https://script.google.com/macros/s/AKfycbxRurjs6VukY8BUswjK4uFx_20zpo5Ar5ZZxNVeKEJHSZCKceAx_vUHge9tb0JgkJ7B/exec";
  const STORE_KEY="hldbScoreEntryDemoV2";
  const PREF_KEY="hldbScoreEntryPreferences";
  const ADMIN_HASH="d732d6fe703eb37cc4b8b60acc9dbecf181db0ff2309958c5c3e853a16945860";
  const fallbackTeams={
    "Aリーグ":["武装","MJ東京","ZOO","SILVER WOLVES","最強位ズ","電光石火"],
    "Bリーグ":["さわやかMJ野郎の会","Team MJ lovers","教室生☆KSC","チートイズ","おたまーず","Brave Revengers"]
  };
  const fallbackPlayers={
    "武装":["ツナマヨ","年賀状","乙子","しんじゃうツモ"],"MJ東京":["Blue-K18","aimoni","選手A","選手B"],
    "ZOO":["かじ","選手C","選手D"],"SILVER WOLVES":["田口淳之介","店長倍損の上司","選手E"]
  };
  let schedule=[],playerMap={...fallbackPlayers},pending=null,selectedKey="",activeScoreInput=null,pendingAdminKey="",calendarMonth=null,adminPassword="";
  const today=()=>new Date().toLocaleDateString("sv-SE");
  const readStore=()=>{try{return JSON.parse(localStorage.getItem(STORE_KEY)||"{}")}catch{return{}}};
  const writeStore=data=>localStorage.setItem(STORE_KEY,JSON.stringify(data));
  const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
  const teamKey=value=>String(value||"").normalize("NFKC").trim();

  function parseCsvLine(line){const out=[];let value="",quoted=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'&&quoted&&line[i+1]==='"'){value+='"';i++}else if(c==='"')quoted=!quoted;else if(c===","&&!quoted){out.push(value);value=""}else value+=c}out.push(value);return out}
  function parseCsv(text){const lines=String(text).trim().split(/\r?\n/).filter(Boolean);if(!lines.length)return[];const headers=parseCsvLine(lines.shift()).map((h,i)=>i?h.trim():h.trim().replace(/^\uFEFF/,""));return lines.map(line=>{const values=parseCsvLine(line),row={};headers.forEach((h,i)=>row[h]=(values[i]||"").trim());return row})}
  async function loadCsv(url){const response=await fetch(url,{cache:"no-store"});if(!response.ok)throw new Error(url);return parseCsv(await response.text())}
  async function apiRequest(payload){const options=payload?{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(payload)}:{cache:"no-store"},response=await fetch(SCORE_API_URL,options);if(!response.ok)throw new Error("スプレッドシートに接続できませんでした。");const result=await response.json();if(!result.ok)throw new Error(result.error||"スプレッドシートの更新に失敗しました。");return result}
  async function loadServerEntries(){const result=await apiRequest(),data={};result.entries.forEach(item=>data[item.id]=item);writeStore(data)}
  async function loadReferenceData(){
    try{schedule=await loadCsv(SCHEDULE_CSV_URL)}catch{schedule=[]}
    try{const players=await loadCsv(PLAYERS_CSV_URL),map={};players.forEach(row=>{const team=teamKey(row["チーム"]),name=row["選手"];if(!team||!name)return;(map[team]??=[]).push(name)});Object.keys(map).forEach(team=>map[team]=[...new Set(map[team])].sort((a,b)=>a.localeCompare(b,"ja")));playerMap={...fallbackPlayers,...map}}catch{/* 仮選手で継続 */}
  }

  function show(id){VIEWS.forEach(view=>$(view).hidden=view!==id);$("navInput").classList.toggle("active",id==="inputView");$("navList").classList.toggle("active",["listView","urlView","editView"].includes(id));window.scrollTo(0,0)}
  function normalizeScore(value){return String(value).trim().replace(/[０-９]/g,c=>String.fromCharCode(c.charCodeAt(0)-65248)).replace(/[＋]/g,"+").replace(/[－−―ー]/g,"-").replace(/[，,．]/g,".").replace(/\s/g,"")}
  function unique(values){return[...new Set(values.filter(Boolean))]}
  function savedPrefs(){try{return JSON.parse(localStorage.getItem(PREF_KEY)||"{}")}catch{return{}}}
  function savePrefs(){localStorage.setItem(PREF_KEY,JSON.stringify({league:$("leagueInput").value,table:$("tableInput").value}))}
  function phaseForDate(date){return schedule.find(row=>row["対局日"]===date)?.["開催区分"]||"レギュラー"}
  function phaseUsesLeague(phase){return phase!=="予選"}
  function phaseUsesTable(phase){return phase==="レギュラー"||phase==="予選"}
  function matchLabel(row){return phaseUsesTable(row.phase)?`${row.table}・${row.match}`:row.match}
  function fallbackRows(date,phase,league){
    const all=fallbackTeams[league]||fallbackTeams["Aリーグ"],tables=phase==="レギュラー"?["A卓","B卓","C卓"]:["本卓"];
    return tables.flatMap((table,tableIndex)=>MATCHES.map(match=>{const teams=Array.from({length:4},(_,i)=>all[(tableIndex*2+i)%all.length]);return{date,phase,league,table,match,teams,requiresUrl:phase!=="予選"}}));
  }
  function scheduleRows(date,league){
    const phase=phaseForDate(date),usesLeague=phaseUsesLeague(phase),rows=schedule.filter(row=>row["対局日"]===date&&row["開催区分"]===phase&&(!usesLeague||row["リーグ"]===league)).flatMap(row=>MATCHES.map(match=>({date,phase,league:usesLeague?row["リーグ"]:"",table:row["卓"],match,teams:[1,2,3,4].map(i=>row[`チーム${i}`]).filter(Boolean),requiresUrl:row["URL対象"]!=="0"})));
    return rows.length?rows:(schedule.length?[]:fallbackRows(date,phase,league));
  }
  function rowKey(row){return[row.date,row.phase,row.league||"-",row.table,row.match].join("|")}
  function currentScheduleRow(){const rows=scheduleRows(today(),$("leagueInput").value);return rows.find(row=>row.table===$("tableInput").value&&row.match===$("matchInput").value)||rows[0]}
  function setOptions(select,values,preferred){select.innerHTML=values.map(v=>`<option${v===preferred?" selected":""}>${esc(v)}</option>`).join("")}
  function playerOptions(team,selected){const names=playerMap[teamKey(team)]||["選手A","選手B","選手C","選手D"];return`<option value="" disabled${selected?"":" selected"}>選手を選んでください</option>`+unique(names).map(name=>`<option${name===selected?" selected":""}>${esc(name)}</option>`).join("")}
  function allKnownTeams(){return unique([...Object.keys(playerMap),...Object.values(fallbackTeams).flat()])}

  function refreshInputSelectors(rebuild=true){
    const hasSchedule=schedule.some(row=>row["対局日"]===today());
    $("noScheduleMessage").hidden=hasSchedule;$("inputInfoBanner").hidden=!hasSchedule;$("scoreForm").hidden=!hasSchedule;
    if(!hasSchedule){$("playerInputs").innerHTML="";$("formMessage").hidden=true;return}
    const phase=phaseForDate(today()),league=$("leagueInput").value;
    $("leagueInputField").hidden=!phaseUsesLeague(phase);
    $("tableInputField").hidden=!phaseUsesTable(phase);
    const rows=scheduleRows(today(),league),oldTable=$("tableInput").value,oldMatch=$("matchInput").value;
    setOptions($("tableInput"),unique(rows.map(r=>r.table)),oldTable);const table=$("tableInput").value;setOptions($("matchInput"),unique(rows.filter(r=>r.table===table).map(r=>r.match)),oldMatch);
    const row=currentScheduleRow();$("scheduleNote").innerHTML=row?`<strong>${esc(phase)}｜${esc(matchLabel(row))}</strong><span>${row.requiresUrl?"公式データバンク対象":"予選データ（公式データバンク対象外）"}</span>`:"予定が見つかりません";
    savePrefs();if(rebuild)buildPlayerInputs(row);
  }
  function buildPlayerInputs(row,values=[]){
    const host=$("playerInputs");host.innerHTML="";(row?.teams||[]).forEach((team,i)=>{const old=values[i]||{},selectedTeam=old.team||team,card=document.createElement("section");card.className="panel player-card";card.innerHTML=`<h2><span>入力${i+1}</span><small>予定：${esc(team)}</small></h2><label>チーム<select class="team-select">${editTeamOptions(selectedTeam)}</select></label><label>選手<select class="player-select">${playerOptions(selectedTeam,old.player||"")}</select></label><label>スコア<input class="score-input" inputmode="none" readonly placeholder="タップして入力" value="${esc(old.raw??old.score??"")}"></label>`;host.appendChild(card);const teamSelect=card.querySelector(".team-select");teamSelect.onchange=()=>card.querySelector(".player-select").innerHTML=playerOptions(teamSelect.value,"")});bindScoreInputs(host)
  }
  function getRows(container){return[...container.querySelectorAll(".player-card")].map(card=>{const raw=normalizeScore(card.querySelector(".score-input").value);return{team:card.querySelector(".team-select")?.value||card.querySelector(".fixed-team").value,player:card.querySelector(".player-select").value,raw,score:Number(raw)}})}
  function validateRows(rows){if(rows.some(r=>!r.player))return"4人全員の選手を選んでください。";if(rows.length!==4||rows.some(r=>r.raw===""||!Number.isFinite(r.score)))return"4人全員のスコアを数字で入力してください。";if(rows.some(r=>Math.abs(r.score)>200))return"スコアが±200を超えています。数字を確認してください。";if(new Set(rows.map(r=>r.player)).size!==4)return"同じ選手が重複しています。";const total=rows.reduce((n,r)=>n+r.score,0);if(Math.abs(total)>.051)return`スコア合計が ${total>0?"+":""}${total.toFixed(1)} ptです。入力内容を確認してください。`;return""}
  function getInput(){const scheduled=currentScheduleRow(),rows=getRows($("playerInputs"));return{...scheduled,rows,date:today()}}
  function renderConfirm(data){data.rows.sort((a,b)=>b.score-a.score);$("confirmMatch").innerHTML=`${data.league?`<span><strong>${esc(data.league)}</strong></span>`:""}<span>${esc(matchLabel(data))}</span>`;$("confirmPlayers").innerHTML=data.rows.map((r,i)=>`<div class="confirm-row"><b>${i+1}位</b><span>${esc(r.team)}</span><span>${esc(r.player)}</span><strong class="${r.score<0?"score-negative":"score-positive"}">${r.score>0?"+":""}${r.score.toFixed(1)}</strong></div>`).join("");$("totalPanel").className="panel total-panel total-valid";$("totalPanel").innerHTML=`<span>合計</span><strong>${data.rows.reduce((n,r)=>n+r.score,0).toFixed(1)} pt</strong>`}

  function listRows(){return scheduleRows($("listDate").value||today(),$("listLeague").value)}
  function refreshListFilters(){const date=$("listDate").value||today(),phase=phaseForDate(date);$("listLeagueField").hidden=!phaseUsesLeague(phase);$("listPhaseDisplay").textContent=phase;updateSectionNavigation();renderList()}
  function scoreSummary(item){return item?.rows?.length?`<div class="match-player-preview">${item.rows.map(r=>`<span>${esc(r.player)} <strong class="${r.score<0?"score-negative":"score-positive"}">${r.score>0?"+":""}${Number(r.score).toFixed(1)}</strong></span>`).join("")}</div>`:""}
  function renderList(){
    const date=$("listDate").value||today(),phase=phaseForDate(date),league=$("listLeague").value,data=readStore();
    const items=Object.entries(data).filter(([,item])=>item.date===date&&item.phase===phase&&(!phaseUsesLeague(phase)||item.league===league)).map(([key,item])=>({key,item})).sort((a,b)=>`${a.item.table}|${a.item.match}`.localeCompare(`${b.item.table}|${b.item.match}`,"ja"));
    const urlTargets=items.filter(x=>x.item.requiresUrl),urlDone=urlTargets.filter(x=>x.item.url).length;
    $("listSummary").style.gridTemplateColumns=urlTargets.length?"repeat(3,1fr)":"1fr";
    $("listSummary").innerHTML=`<div>入力済み<span class="summary-number">${items.length}</span>試合</div>${urlTargets.length?`<div>URL記載済み<span class="summary-number">${urlDone}</span>試合</div><div class="summary-missing">URL未入力<span class="summary-number">${urlTargets.length-urlDone}</span>試合</div>`:""}`;
    $("matchList").innerHTML=items.length?items.map(({key,item})=>{const urlMissing=item.requiresUrl&&!item.url,status=item.requiresUrl?`<span class="status ${urlMissing?"status-warning":"status-done"}">✓ ${urlMissing?"URL未入力":"URL入力済み"}</span>`:"";return`<article class="match-card ${urlMissing?"needs-action":""}" data-card-key="${esc(key)}"><div class="match-card-main"><div><div class="match-name">${esc(matchLabel(item))}</div><div class="match-time">送信 ${esc(item.time)}</div></div>${status}</div>${scoreSummary(item)}<div class="match-card-actions">${item.requiresUrl?`<button class="url-action" data-key="${esc(key)}">${item.url?"URLを確認・変更":"URLを記入してください"}</button>`:""}</div></article>`}).join(""):`<div class="panel empty-list">この日に入力された試合はまだありません。</div>`;
    document.querySelectorAll(".match-card").forEach(card=>card.addEventListener("click",event=>{if(event.target.closest("button"))return;const item=data[card.dataset.cardKey];if(item&&isAdminMode())openEdit(card.dataset.cardKey)}));document.querySelectorAll(".url-action").forEach(button=>button.onclick=()=>openUrl(button.dataset.key));
  }

  function detailRows(item){return`<div class="detail-rows">${item.rows.map((r,i)=>`<div><b>${i+1}位</b><span>${esc(r.team)}</span><span>${esc(r.player)}</span><strong class="${r.score<0?"score-negative":"score-positive"}">${r.score>0?"+":""}${Number(r.score).toFixed(1)}</strong></div>`).join("")}</div>`}
  function openUrl(key){selectedKey=key;const item=readStore()[key];$("urlTitle").textContent=matchLabel(item);$("urlMatchInfo").innerHTML=`<div class="match-summary">${item.league?`<strong>${esc(item.league)}</strong>`:""}<span>送信 ${esc(item.time)}</span></div>${detailRows(item)}`;$("matchUrl").value=item.url||"";$("urlMessage").hidden=true;show("urlView")}
  function isReplayUrl(value){try{const url=new URL(value);return url.protocol==="https:"&&url.hostname==="pl.sega-mj.com"&&url.pathname==="/mj_viewer/replayMatch"&&["matching_server_id","game_id","kyoku_select","target_user_id","share_type"].every(name=>url.searchParams.has(name)&&url.searchParams.get(name))}catch{return false}}
  function isAdminMode(){return sessionStorage.getItem("hldbScoreAdminMode")==="1"}
  async function sha256(value){const bytes=new TextEncoder().encode(value),digest=await crypto.subtle.digest("SHA-256",bytes);return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,"0")).join("")}
  function updateAdminButton(){const active=isAdminMode();$("adminModeButton").classList.toggle("active",active);$("adminModeButton").textContent=active?"✎":"🔒";$("adminModeButton").title=active?"管理者ログイン済み":"管理者ログイン"}
  function openAdminLogin(key=""){pendingAdminKey=key;$("adminModePassword").value="";$("adminModeError").hidden=true;$("adminModeModal").hidden=false;requestAnimationFrame(()=>$("adminModePassword").focus())}
  function requestAdminEdit(key){if(isAdminMode()){openEdit(key);return}openAdminLogin(key)}

  function editTeamOptions(selected){return allKnownTeams().map(team=>`<option${team===selected?" selected":""}>${esc(team)}</option>`).join("")}
  function openEdit(key){selectedKey=key;const item=readStore()[key];$("editMatchInfo").innerHTML=`<div class="match-summary">${item.league?`<strong>${esc(item.league)}</strong>`:""}<span>${esc(matchLabel(item))}</span></div>`;$("editRows").innerHTML=item.rows.map((r,i)=>`<section class="panel player-card"><h2>編集${i+1}</h2><label>チーム<select class="team-select">${editTeamOptions(r.team)}</select></label><label>選手<select class="player-select">${playerOptions(r.team,r.player)}</select></label><label>スコア<input class="score-input" inputmode="none" readonly value="${esc(r.score)}"></label></section>`).join("");$("editRows").querySelectorAll(".team-select").forEach(select=>select.onchange=()=>select.closest(".player-card").querySelector(".player-select").innerHTML=playerOptions(select.value,""));bindScoreInputs($("editRows"));$("editUrlSection").hidden=!item.requiresUrl;$("editMatchUrl").value=item.url||"";$("editMessage").hidden=true;show("editView")}

  function bindScoreInputs(root){root.querySelectorAll(".score-input").forEach(input=>input.addEventListener("click",()=>openKeypad(input)))}
  function openKeypad(input){activeScoreInput=input;$("keypadLabel").textContent=`${input.closest(".player-card")?.querySelector("h2")?.textContent.trim()||""} スコア`;renderKeypad();$("scoreKeypad").hidden=false}
  function renderKeypad(){const value=normalizeScore(activeScoreInput?.value||"");$("keypadValue").textContent=value||"0";const hasDigit=/\d/.test(value),hasDot=value.includes(".");const buttons=["7","8","9","4","5","6","1","2","3",hasDigit?".":"−","0","⌫"];$("keypadButtons").innerHTML=buttons.map(key=>`<button type="button" data-key="${key}"${key==="."&&hasDot?" disabled":""}>${key}</button>`).join("");$("keypadButtons").querySelectorAll("button").forEach(button=>button.onclick=()=>handleKey(button.dataset.key))}
  function handleKey(key){let value=normalizeScore(activeScoreInput.value);if(key==="⌫")value=value.slice(0,-1);else if(key==="−"){if(!value)value="-"}else if(key==="."){if(/\d/.test(value)&&!value.includes("."))value+="."}else if(value.length<7)value+=key;activeScoreInput.value=value;renderKeypad()}

  function setupInputPreferences(){const prefs=savedPrefs();if(["Aリーグ","Bリーグ"].includes(prefs.league))$("leagueInput").value=prefs.league;refreshInputSelectors();if(prefs.table&&[...$("tableInput").options].some(o=>o.value===prefs.table)){$("tableInput").value=prefs.table;refreshInputSelectors()}}
  function scheduledDates(){return unique(schedule.map(row=>row["対局日"])).sort()}
  function adjacentSection(direction){const dates=scheduledDates(),current=$("listDate").value||today();return direction<0?[...dates].reverse().find(date=>date<current):dates.find(date=>date>current)}
  function updateSectionNavigation(){$("previousDate").disabled=!adjacentSection(-1);$("nextDate").disabled=!adjacentSection(1)}
  function moveSection(direction){const date=adjacentSection(direction);if(!date)return;$("listDate").value=date;refreshListFilters()}
  function renderCalendar(){const host=$("scheduleCalendar"),selected=$("listDate").value||today(),scheduled=new Set(scheduledDates()),base=calendarMonth||new Date(`${selected}T12:00:00`),year=base.getFullYear(),month=base.getMonth(),first=new Date(year,month,1),last=new Date(year,month+1,0),cells=[];for(let i=0;i<first.getDay();i++)cells.push("<span></span>");for(let day=1;day<=last.getDate();day++){const date=`${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`,classes=[date===selected?"selected":"",scheduled.has(date)?"scheduled":""].filter(Boolean).join(" ");cells.push(`<button type="button" class="${classes}" data-date="${date}">${day}</button>`)}host.innerHTML=`<div class="calendar-head"><button type="button" data-month="-1" aria-label="前の月">‹</button><strong>${year}年${month+1}月</strong><button type="button" data-month="1" aria-label="次の月">›</button></div><div class="calendar-week"><span>日</span><span>月</span><span>火</span><span>水</span><span>木</span><span>金</span><span>土</span></div><div class="calendar-days">${cells.join("")}</div><p><i></i> 開催予定日</p>`;host.querySelectorAll("[data-month]").forEach(button=>button.onclick=event=>{event.stopPropagation();calendarMonth=new Date(year,month+Number(button.dataset.month),1);renderCalendar()});host.querySelectorAll("[data-date]").forEach(button=>button.onclick=()=>{$("listDate").value=button.dataset.date;host.hidden=true;refreshListFilters()})}
  function openCalendar(){const current=$("listDate").value||today();calendarMonth=new Date(`${current}T12:00:00`);renderCalendar();$("scheduleCalendar").hidden=false}

  $("scoreForm").onsubmit=event=>{event.preventDefault();const data=getInput(),error=validateRows(data.rows);$("formMessage").hidden=!error;$("formMessage").textContent=error;if(error)return;pending=data;renderConfirm(data);show("confirmView")};
  $("backToInput").onclick=()=>show("inputView");$("submitScores").onclick=async()=>{const button=$("submitScores"),key=rowKey(pending);button.disabled=true;try{const result=await apiRequest({action:"submit",id:key,data:pending}),data=readStore();data[key]=result.entry;writeStore(data);$("successModal").hidden=false}catch(error){alert(error.message)}finally{button.disabled=false}};$("closeSuccess").onclick=()=>{$("successModal").hidden=true;$("listDate").value=pending.date;if(pending.league)$("listLeague").value=pending.league;refreshListFilters();show("listView")};
  $("leagueInput").onchange=()=>refreshInputSelectors();$("tableInput").onchange=()=>refreshInputSelectors();$("matchInput").onchange=()=>{savePrefs();buildPlayerInputs(currentScheduleRow())};
  $("navInput").onclick=()=>show("inputView");$("navList").onclick=()=>{refreshListFilters();show("listView")};$("listDate").onclick=openCalendar;$("listLeague").onchange=renderList;$("previousDate").onclick=()=>moveSection(-1);$("nextDate").onclick=()=>moveSection(1);$("todayButton").onclick=()=>{$("listDate").value=today();refreshListFilters()};document.addEventListener("click",event=>{if(!event.target.closest(".date-picker")&&!event.target.closest("#scheduleCalendar"))$("scheduleCalendar").hidden=true});
  $("saveUrl").onclick=async()=>{const value=$("matchUrl").value.trim();if(!isReplayUrl(value)){$("urlMessage").textContent="試合リプレイのURLではありません。";$("urlMessage").hidden=false;return}try{await apiRequest({action:"url",id:selectedKey,url:value});const data=readStore();data[selectedKey].url=value;writeStore(data);$("urlMessage").hidden=true;refreshListFilters();show("listView")}catch(error){$("urlMessage").textContent=error.message;$("urlMessage").hidden=false}};$("backToListTop").onclick=$("backToListBottom").onclick=()=>{refreshListFilters();show("listView")};
  $("saveEdit").onclick=async()=>{const rows=getRows($("editRows")),url=$("editMatchUrl").value.trim(),error=validateRows(rows)||(!$("editUrlSection").hidden&&url&&!isReplayUrl(url)?"試合リプレイのURLではありません。":"");$("editMessage").hidden=!error;$("editMessage").textContent=error;if(error)return;const data=readStore(),item={...data[selectedKey],rows:rows.sort((a,b)=>b.score-a.score),url:$("editUrlSection").hidden?data[selectedKey].url:url};try{const result=await apiRequest({action:"edit",id:selectedKey,password:adminPassword,data:item});data[selectedKey]=result.entry;writeStore(data);refreshListFilters();show("listView")}catch(apiError){$("editMessage").textContent=apiError.message;$("editMessage").hidden=false}};$("deleteEntry").onclick=async()=>{if(!confirm("この試合の送信データを消去しますか？"))return;try{await apiRequest({action:"delete",id:selectedKey,password:adminPassword});const data=readStore();delete data[selectedKey];writeStore(data);refreshListFilters();show("listView")}catch(error){alert(error.message)}};$("backFromEdit").onclick=()=>{refreshListFilters();show("listView")};
  $("closeKeypad").onclick=()=>{$("scoreKeypad").hidden=true;activeScoreInput=null};$("scoreKeypad").onclick=event=>{if(event.target===$("scoreKeypad"))$("closeKeypad").click()};$("openUrlHelp").onclick=$("openEditUrlHelp").onclick=()=>$("urlHelpModal").hidden=false;$("closeUrlHelp").onclick=()=>$("urlHelpModal").hidden=true;
  $("adminModeButton").onclick=()=>{if(isAdminMode()){sessionStorage.removeItem("hldbScoreAdminMode");adminPassword="";updateAdminButton();if(!$("editView").hidden){refreshListFilters();show("listView")}else if(!$("listView").hidden)renderList();return}openAdminLogin()};$("closeAdminMode").onclick=()=>{$("adminModeModal").hidden=true;pendingAdminKey=""};$("adminModeForm").onsubmit=async event=>{event.preventDefault();const entered=$("adminModePassword").value,correct=(await sha256(entered))===ADMIN_HASH;$("adminModeError").hidden=correct;if(!correct){$("adminModePassword").select();return}adminPassword=entered;sessionStorage.setItem("hldbScoreAdminMode","1");$("adminModeModal").hidden=true;updateAdminButton();renderList();if(pendingAdminKey){const key=pendingAdminKey;pendingAdminKey="";openEdit(key)}};

  async function init(){sessionStorage.removeItem("hldbScoreAdminMode");await loadReferenceData();try{await loadServerEntries()}catch(error){console.warn(error)}$("listDate").value=today();updateAdminButton();setupInputPreferences()}
  init();
})();
