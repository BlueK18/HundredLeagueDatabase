(function(){
  "use strict";

  const ADMIN_PLAYER_ID="P0018";
  const PASSWORD_HASH="d732d6fe703eb37cc4b8b60acc9dbecf181db0ff2309958c5c3e853a16945860";
  const params=new URLSearchParams(window.location.search);
  const button=document.getElementById("detailedAdminButton");
  const logoutButton=document.getElementById("detailedAdminLogoutButton");
  const dialog=document.getElementById("detailedAdminDialog");
  const form=document.getElementById("detailedAdminForm");
  const password=document.getElementById("detailedAdminPassword");
  const error=document.getElementById("detailedAdminError");
  const detailedStatsButton=document.getElementById("playerDetailedStatsButton");
  const requestedPlayerId=params.get("id")||"";
  const detailedStatsPublic=true;
  const adminChannel="BroadcastChannel" in window?new BroadcastChannel("hldbAdminNavigation"):null;

  function isAdminUnlocked(){return sessionStorage.getItem("hldbDetailedStatsUnlocked")==="1"}
  function publishAdminStatus(unlocked){adminChannel?.postMessage({type:"admin-status",unlocked})}

  adminChannel?.addEventListener("message",event=>{if(event.data?.type==="admin-status-request"&&isAdminUnlocked())publishAdminStatus(true)});

  if(!button||!logoutButton||!dialog||!form||!password||!detailedStatsButton){return}

  function showDetailedStatsButton(){
    if(!requestedPlayerId){return}
    const detailParams=new URLSearchParams();
    detailParams.set("id",requestedPlayerId);
    const playerName=params.get("player");
    if(playerName){detailParams.set("player",playerName)}
    detailedStatsButton.href=`player-stats.html?${detailParams.toString()}`;
    detailedStatsButton.hidden=false;
    button.hidden=requestedPlayerId!==ADMIN_PLAYER_ID||isAdminUnlocked();
    logoutButton.hidden=requestedPlayerId!==ADMIN_PLAYER_ID||!isAdminUnlocked();
  }

  if((detailedStatsPublic||isAdminUnlocked())&&requestedPlayerId){
    showDetailedStatsButton();
  }else{
    detailedStatsButton.hidden=true;
    button.hidden=requestedPlayerId!==ADMIN_PLAYER_ID;
    logoutButton.hidden=true;
  }

  async function sha256(value){
    const bytes=new TextEncoder().encode(value);
    const digest=await crypto.subtle.digest("SHA-256",bytes);
    return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,"0")).join("");
  }

  button.addEventListener("click",()=>{
    error.hidden=true;
    dialog.showModal();
    requestAnimationFrame(()=>password.focus());
  });

  document.getElementById("detailedAdminClose")?.addEventListener("click",()=>dialog.close());

  logoutButton.addEventListener("click",()=>{
    sessionStorage.removeItem("hldbDetailedStatsUnlocked");
    publishAdminStatus(false);
    showDetailedStatsButton();
  });

  form.addEventListener("submit",async event=>{
    event.preventDefault();
    const isCorrect=(await sha256(password.value))===PASSWORD_HASH;
    error.hidden=isCorrect;
    if(!isCorrect){password.select();return}
    sessionStorage.setItem("hldbDetailedStatsUnlocked","1");
    publishAdminStatus(true);
    dialog.close();
    password.value="";
    showDetailedStatsButton();
  });
})();
