(()=>{
 if(globalThis.__banduSelection?.alive())return;
 document.dispatchEvent(new Event('bandu:selection-dispose'));
 let disposed=false,button,clip;
 globalThis.__banduSelection={alive:()=>!disposed&&Boolean(chrome.runtime.id)};
 const clear=()=>{button?.remove();button=null;};
 function select(event){
  if(event?.target?.closest?.("[data-bd-ui]"))return;
  if(disposed||button?.dataset.saving)return;
  const selection=getSelection();const text=selection?.toString().trim();
  if(!text||!/[a-z]/i.test(text)||!selection.rangeCount){clear();return;}
  const node=selection.anchorNode?.parentElement;
  if(node?.closest('input,textarea,[contenteditable]:not([contenteditable="false"]),[data-bd-ui],.bd-translation')){clear();return;}
  const isX=/(^|\.)(x\.com|twitter\.com)$/.test(location.hostname);
  const tweet=node?.closest('[data-testid="tweetText"]');
  if(isX){
    if(!tweet||!tweet.contains(selection.focusNode)){clear();return;}
    const article=tweet.closest('article');const link=tweet.closest('a[href*="/status/"]')||article?.querySelector('a[href*="/status/"]');
    const path=link?.getAttribute('href')?.match(/^\/[A-Za-z0-9_]+\/status\/\d+/)?.[0];
    if(!path){clear();return;}
    clip={text,context:tweet.innerText.slice(0,18000),url:'https://x.com'+path};
  }else{
    if(!['http:','https:'].includes(location.protocol)){clear();return;}
    clip={text,context:(node?.closest('p,article')?.innerText||text).slice(0,18000),url:location.origin+location.pathname};
  }
  clear();button=document.createElement('button');button.dataset.bdUi='';button.dataset.bdOwned='1';button.textContent='收藏到EngBetter[我记的日常]';
  const rect=selection.getRangeAt(0).getBoundingClientRect();
  button.style.cssText=`position:fixed;z-index:2147483647;top:${Math.min(innerHeight-45,rect.bottom+7)}px;left:${Math.max(8,Math.min(innerWidth-330,rect.left))}px;padding:9px 14px;border:0;border-radius:7px;background:#236846;color:white;font:14px system-ui;cursor:pointer`;
  button.onmousedown=e=>e.preventDefault();button.onclick=save;document.body.append(button);
 }
 async function save(){
  const target=button;target.dataset.saving='1';target.disabled=true;
  try{
   if([...clip.text.trim().replace(/\s+/g,' ')].length>300)throw Error('请选择单句收藏（不超过 300 个字符）');
   target.textContent='正在同步…';const result=await chrome.runtime.sendMessage({type:'eb:save',clip});if(!result.ok)throw Error(result.error);
   if(result.saved){target.textContent='已收藏到[我记的日常]';setTimeout(clear,2000);return;}
   for(let i=0;i<90&&!disposed;i++){
    await new Promise(r=>setTimeout(r,1000));const state=await chrome.runtime.sendMessage({type:'eb:status',id:result.id});
    if(state.state==='saved'){target.textContent='已收藏到[我记的日常]';setTimeout(clear,3000);return;}
    if(state.state==='failed')throw Error(state.error||'保存失败');
   }
   target.textContent='待同步，请在 EngBetter 登录或确认';
  }catch(e){target.textContent=e.message;}
  target.disabled=false;delete target.dataset.saving;
 }
 document.addEventListener('mouseup',select);document.addEventListener('keyup',select);
 document.addEventListener('bandu:selection-dispose',()=>{disposed=true;clear();document.removeEventListener('mouseup',select);document.removeEventListener('keyup',select);},{once:true});
})();
