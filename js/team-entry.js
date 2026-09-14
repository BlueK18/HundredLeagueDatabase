(function(){
"use strict";
const $=id=>document.getElementById(id);
const API_URL="https://script.google.com/macros/s/AKfycbxRurjs6VukY8BUswjK4uFx_20zpo5Ar5ZZxNVeKEJHSZCKceAx_vUHge9tb0JgkJ7B/exec";
const DRAFT_KEY="hldbTeamEntry2027DraftV1";
const steps=["チーム情報","選手登録","運営メンバー","確認・送信"];
const blankPerson=()=>({mjName:"",xName:"",xId:""});
const blankEntry=()=>({teamName:"",teamXName:"",teamXId:"",players:Array.from({length:6},blankPerson),director:"",deputy:"",message:"",sourceTeam:""});
let entry=readDraft()||blankEntry(),step=0;

function esc(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]))}
function readDraft(){try{return JSON.parse(localStorage.getItem(DRAFT_KEY)||"null")}catch{return null}}
function saveDraft(){localStorage.setItem(DRAFT_KEY,JSON.stringify(entry))}
function field(label,key,value,required=false,hint="",type="input"){return `<label class="field"><span class="field-head">${label}${required?'<b class="required">必須</b>':""}</span>${type==="textarea"?`<textarea data-key="${key}" maxlength="500" placeholder="チームの目標や意気込みをご記入ください">${esc(value)}</textarea><small class="counter">${String(value).length} / 500</small>`:`<input data-key="${key}" value="${esc(value)}" ${required?"required":""}>`}${hint?`<small class="hint">${hint}</small>`:""}</label>`}
function title(n,name,text){return `<div class="section-title"><span>${n}</span><div><h2>${name}</h2><p>${text}</p></div></div>`}
function showStart(){$("startView").hidden=false;$("entryView").hidden=true;$("successView").hidden=true;window.scrollTo(0,0)}
function showEntry(){$("startView").hidden=true;$("entryView").hidden=false;$("successView").hidden=true;render();window.scrollTo(0,0)}
function beginNew(){entry=blankEntry();step=0;saveDraft();showEntry()}
function importSelected(){
 const source=window.LEGACY_TEAMS.find(team=>team.teamName===$("legacyTeam").value);if(!source)return;
 const players=source.players.map(person=>({...person}));while(players.length<6)players.push(blankPerson());
 entry={...source,players,message:"",sourceTeam:source.teamName};step=0;saveDraft();showEntry()
}
function renderStepper(){
 $("stepper").innerHTML=steps.map((name,i)=>`<button type="button" data-step="${i}" class="${i===step?"active":i<step?"complete":""}"><span>${i<step?"✓":i+1}</span><em>${name}</em></button>`).join("");
 $("progressBar").style.width=`${(step+1)*25}%`;
 document.querySelectorAll("[data-step]").forEach(button=>button.onclick=()=>{const target=Number(button.dataset.step);if(target<step){capture();step=target;render()}})
}
function render(){
 renderStepper();$("formError").hidden=true;
 if(step===0)renderTeam();else if(step===1)renderPlayers();else if(step===2)renderManagement();else renderReview();
 $("backStep").disabled=step===0;$("nextStep").textContent=step===3?"この内容で送信":"次へ ›";
 bindFields()
}
function renderTeam(){
 $("formBody").innerHTML=`<div class="section">${title("01","チーム情報","チームの基本情報を入力してください。")}<div class="field-grid">${field("チーム名","teamName",entry.teamName,true)}${field("チーム X アカウント名","teamXName",entry.teamXName,false,"チーム公式アカウントがある場合")}${field("チーム X ID","teamXId",entry.teamXId,false,"@から入力してください")}</div></div>`
}
function renderPlayers(){
 $("formBody").innerHTML=`<div class="section">${title("02","選手登録","6名は必須です。削除すると3項目をまとめて消し、後ろの選手を自動で前詰めします。")}<div class="players">${entry.players.map((p,i)=>`<article class="player-card"><div class="player-head"><div><span class="player-no">${String(i+1).padStart(2,"0")}</span><strong>選手 ${i+1}</strong>${i<6?'<b class="required">必須</b>':""}</div>${entry.players.length>6?`<button class="delete-player" type="button" data-delete="${i}" aria-label="選手${i+1}のMJ・X・X IDをまとめて削除">削除</button>`:""}</div><div class="player-fields">${playerField("MJアカウント名","mjName",p.mjName,i,i<6)}${playerField("X アカウント名","xName",p.xName,i)}${playerField("X ID","xId",p.xId,i)}</div></article>`).join("")}${entry.players.length<10?`<button class="add-player" id="addPlayer" type="button">＋ 選手を追加（あと${10-entry.players.length}名）</button>`:""}</div></div>`;
 document.querySelectorAll("[data-delete]").forEach(button=>button.onclick=()=>{capture();entry.players.splice(Number(button.dataset.delete),1);saveDraft();render()});
 if($("addPlayer"))$("addPlayer").onclick=()=>{capture();entry.players.push(blankPerson());saveDraft();render()}
}
function playerField(label,key,value,index,required=false){return `<label class="field"><span class="field-head">${label}${required?'<b class="required">必須</b>':""}</span><input data-player="${index}" data-player-key="${key}" value="${esc(value)}" ${required?"required":""}></label>`}
function renderManagement(){
 $("formBody").innerHTML=`<div class="section">${title("03","運営メンバー・意気込み","監督、副監督と来季への意気込みを入力してください。")}<div class="field-grid">${field("監督（MJアカウント名）","director",entry.director,true)}${field("副監督（MJアカウント名）","deputy",entry.deputy)}${field("来季への意気込み","message",entry.message,true,"","textarea")}</div></div>`
}
function reviewBlock(name,editStep,rows){return `<section class="review-block"><header><h3>${name}</h3><button type="button" data-edit="${editStep}">編集する</button></header><dl>${rows.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v||"—")}</dd></div>`).join("")}</dl></section>`}
function renderReview(){
 $("formBody").innerHTML=`<div class="section">${title("04","入力内容の確認","送信前に内容をご確認ください。")}<div class="review">${reviewBlock("チーム情報",0,[["チーム名",entry.teamName],["X アカウント",entry.teamXName],["X ID",entry.teamXId]])}${reviewBlock(`登録選手（${entry.players.filter(p=>p.mjName).length}名）`,1,entry.players.filter(p=>p.mjName).map((p,i)=>[`選手 ${i+1}`,`${p.mjName}${p.xId?" ／ "+p.xId:""}`]))}${reviewBlock("運営メンバー",2,[["監督",entry.director],["副監督",entry.deputy],["意気込み",entry.message]])}</div></div>`;
 document.querySelectorAll("[data-edit]").forEach(button=>button.onclick=()=>{step=Number(button.dataset.edit);render();window.scrollTo(0,0)})
}
function bindFields(){
 document.querySelectorAll("[data-key]").forEach(input=>input.addEventListener("input",()=>{entry[input.dataset.key]=input.value;saveDraft();if(input.tagName==="TEXTAREA")input.nextElementSibling.textContent=`${input.value.length} / 500`}));
 document.querySelectorAll("[data-player]").forEach(input=>input.addEventListener("input",()=>{entry.players[Number(input.dataset.player)][input.dataset.playerKey]=input.value;saveDraft()}))
}
function capture(){document.querySelectorAll("[data-key]").forEach(input=>entry[input.dataset.key]=input.value);document.querySelectorAll("[data-player]").forEach(input=>entry.players[Number(input.dataset.player)][input.dataset.playerKey]=input.value)}
function validate(){
 if(step===0&&!entry.teamName.trim())return"チーム名を入力してください。";
 if(step===1&&entry.players.slice(0,6).some(p=>!p.mjName.trim()))return"選手6名のMJアカウント名を入力してください。";
 if(step===2&&!entry.director.trim())return"監督のMJアカウント名を入力してください。";
 if(step===2&&!entry.message.trim())return"来季への意気込みを入力してください。";
 return""
}
function error(message){$("formError").textContent=message;$("formError").hidden=false;$("formError").scrollIntoView({behavior:"smooth",block:"center"})}
async function submit(){
 const button=$("nextStep");button.disabled=true;button.textContent="送信中…";
 try{
  const response=await fetch(API_URL,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({action:"teamEntry",data:entry})});
  if(!response.ok)throw new Error("送信できませんでした。");const result=await response.json();if(!result.ok)throw new Error(result.error||"送信できませんでした。");
  localStorage.removeItem(DRAFT_KEY);$("entryView").hidden=true;$("successView").hidden=false;window.scrollTo(0,0)
 }catch(e){error(e.message||"送信できませんでした。入力内容は保存されています。")}finally{button.disabled=false;button.textContent="この内容で送信"}
}
$("startNew").onclick=beginNew;$("changeMode").onclick=showStart;$("restartEntry").onclick=()=>{entry=blankEntry();showStart()};
$("legacyTeam").innerHTML+=[...window.LEGACY_TEAMS].sort((a,b)=>a.teamName.localeCompare(b.teamName,"ja")).map(team=>`<option value="${esc(team.teamName)}">${esc(team.teamName)}</option>`).join("");
$("legacyCount").textContent=window.LEGACY_TEAMS.length;$("legacyTeam").onchange=()=>$("importTeam").disabled=!$("legacyTeam").value;$("importTeam").onclick=importSelected;
$("backStep").onclick=()=>{capture();if(step>0){step--;render();window.scrollTo(0,0)}};
$("nextStep").onclick=()=>{capture();const message=validate();if(message)return error(message);if(step<3){step++;render();window.scrollTo(0,0)}else submit()};
if(entry&&entry.teamName){showEntry()}else showStart();
})();
