(function(){
  "use strict";

  const ADMIN_PLAYER_ID="P0018";
  const PASSWORD_HASH="31ed5189ae9533ba7beb9dc823db86b0f70ffe2920ffacc2021044b99c6ec828";
  const params=new URLSearchParams(window.location.search);
  const button=document.getElementById("adminEntryButton");
  const dialog=document.getElementById("adminEntryDialog");
  const form=document.getElementById("adminEntryForm");
  const password=document.getElementById("adminEntryPassword");
  const error=document.getElementById("adminEntryError");

  if(!button||!dialog||!form||!password||params.get("id")!==ADMIN_PLAYER_ID){return}

  button.hidden=false;

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

  document.getElementById("adminEntryClose")?.addEventListener("click",()=>dialog.close());

  form.addEventListener("submit",async event=>{
    event.preventDefault();
    const isCorrect=(await sha256(password.value))===PASSWORD_HASH;
    error.hidden=isCorrect;
    if(!isCorrect){password.select();return}
    sessionStorage.setItem("hldbAdminUnlocked","1");
    localStorage.setItem("hldbAdminNavigationUnlocked","1");
    window.location.href="score-entry.html";
  });
})();
