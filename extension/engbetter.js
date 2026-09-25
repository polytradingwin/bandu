let ebChain=Promise.resolve();
function ebRun(fn){const task=ebChain.then(fn);ebChain=task.catch(()=>{});return task;}
const EB_ORIGIN = 'https://engbetter.com';
async function ebRequest(path, token, options = {}) {
  const response = await fetch(EB_ORIGIN+path, {signal:AbortSignal.timeout(20000), ...options, headers:{'Content-Type':'application/json','X-Bandu-Token':token}});
  const data = await response.json().catch(()=>({}));
  if(!response.ok){
    const messages={TOKEN_INVALID:'EngBetter 连接已失效，请重新连接后再收藏。',ORIGIN_FORBIDDEN:'当前伴读版本尚未获 EngBetter 允许，请更新插件后重试。',TEXT_TOO_LONG:'请选择单句收藏（不超过 300 个字符）',TEXT_EMPTY:'请先选中英文句子。',RATE_LIMITED:'操作太频繁，请稍后重试。',COLLECT_LIMIT_REACHED:'今日 EngBetter 收藏次数已用完，请明天再试。',STORAGE_UNAVAILABLE:'EngBetter 暂时无法保存，请稍后重试。'};
    throw Object.assign(Error(data.message||messages[data.code]||data.error||`EngBetter 请求失败（${response.status}），请稍后重试。`),{code:data.code,status:response.status});
  }
  return data;
}
async function ebClearConnection(){
  await credential(null,'engbetter');
  await chrome.storage.local.remove(['ebAccount','ebJobs']);
}
async function ebJob(kind, clip, sourceTab) {
  const { ebAccount, ebJobs = {} } = await chrome.storage.local.get(['ebAccount','ebJobs']);
  const id = crypto.randomUUID();
  const job = { id, kind, clip, sourceTab, account: ebAccount?.id, state:'pending', created:Date.now() };
  for (const [key,value] of Object.entries(ebJobs)) if(Date.now()-value.created>7*86400000)delete ebJobs[key];
  if(Object.keys(ebJobs).length>=100)throw Error('待同步内容过多，请先连接 EngBetter。');
  ebJobs[id]=job;await chrome.storage.local.set({ebJobs});
  const tab=await chrome.tabs.create({url:EB_ORIGIN+'/daily?bandu='+id+'&bandu_ext='+chrome.runtime.id,active:kind==='connect'||!ebAccount});
  job.tab=tab.id;ebJobs[id]=job;await chrome.storage.local.set({ebJobs});
  return {id};
}
chrome.runtime.onMessage.addListener((m,s,reply)=>{
 if(!['eb:connect','eb:save','eb:status','eb:disconnect'].includes(m?.type))return;
 ebRun(async()=>{
  if(m.type==='eb:connect')return ebJob('connect',null,s.tab?.id);
  if(m.type==='eb:disconnect'){
    const token=await credential(undefined,'engbetter');
    await ebClearConnection();
    if(token){
      try{await ebRequest('/api/bandu/connection',token,{method:'DELETE',signal:AbortSignal.timeout(8000)});}
      catch(e){if(e.code!=='TOKEN_INVALID')return {warning:'本机已断开，网站中的收藏仍保留。服务器撤销连接暂未成功；重新连接会使旧凭证失效。'};}
    }
    return {};
  }
  if(m.type==='eb:status'){const {ebJobs={}}=await chrome.storage.local.get('ebJobs');const j=ebJobs[m.id];if(j?.sourceTab!==s.tab?.id)throw Error('无权读取');return {state:j.state,error:j.error};}
  if(!/^https?:\/\//.test(s.url||'') || typeof m.clip?.text!=='string' || m.clip.text.length>1000 || m.clip.context?.length>18000)throw Error('收藏内容无效');
  const token=await credential(undefined,'engbetter');
  if(!token)throw Error('请先点击伴读图标，连接 EngBetter 后再收藏');
  let result;
  try{result=await ebRequest('/api/bandu/clip',token,{method:'POST',body:JSON.stringify(m.clip)});}
  catch(e){if(e.code==='TOKEN_INVALID')await ebClearConnection();throw e;}
  return {saved:result.saved};
 }).then(r=>reply({ok:true,...r}),e=>reply({ok:false,error:e.message}));return true;
});
chrome.runtime.onMessageExternal.addListener((m,s,reply)=>{
 ebRun(async()=>{
  if(new URL(s.url).origin!==EB_ORIGIN)throw Error('来源无效');
  const {ebJobs={},ebAccount}=await chrome.storage.local.get(['ebJobs','ebAccount']);const j=ebJobs[m.id];
  if(!j||j.tab!==s.tab?.id)throw Error('连接请求已失效，请从伴读重新打开');
  if(m.type==='eb:job')return {job:j,account:ebAccount};
  if(m.type==='eb:cancel'){delete ebJobs[m.id];await chrome.storage.local.set({ebJobs});return {};}
  if(m.type==='eb:attention'){await chrome.tabs.update(j.tab,{active:true});return {};}
  if(m.type==='eb:authorize'){
    if(!m.userId||!m.token)throw Error('请刷新连接页面后重试');
    const verified=await ebRequest('/api/ext/status',m.token,{method:'POST'});
    if(verified.userId!==m.userId)throw Error('账号不匹配');
    const old=await credential(undefined,'engbetter');
    if(old&&old!==m.token)await ebRequest('/api/bandu/connection',old,{method:'DELETE'}).catch(()=>{});
    await credential(m.token,'engbetter');await chrome.storage.local.set({ebAccount:{id:m.userId}});j.account=m.userId;if(j.kind==='connect')j.state='saved';ebJobs[j.id]=j;await chrome.storage.local.set({ebJobs});return {};
  }
  if(m.type!=='eb:complete')throw Error('未知操作');
  if(!m.userId)throw Error('请先登录');
  if(j.kind==='connect'){await chrome.storage.local.set({ebAccount:{id:m.userId}});j.state='saved';}
  else {if(!ebAccount||ebAccount.id!==m.userId||j.account!==m.userId)throw Error('账号不匹配，请重新连接');j.state=m.saved?'saved':'failed';j.error=m.error||'';}
  ebJobs[j.id]=j;await chrome.storage.local.set({ebJobs});return {};
 }).then(r=>reply({ok:true,...r}),e=>reply({ok:false,error:e.message}));return true;
});
