importScripts('credentials.js', 'stream.js', 'providers.js', 'api.js', 'qwen.js', 'engbetter.js');

let active = false;
let paused = false;
let pauseMessage = '';
let nextRequestAt = 0;
const apiReady = migrateApi();
async function migrateApi() {
  const stored = await chrome.storage.local.get(['provider', 'apiSettings']);
  if (!stored.apiSettings && stored.provider === 'qwen') {
    const key = await credential(undefined, 'qwen-key');
    if (key) {
      const preset = API_PROVIDERS[0];
      const config = apiConfig({...preset,jsonMode:true});
      await credential({config, key}, 'api-profile');
      await chrome.storage.local.set({apiSettings:config});
    }
  }
  if (stored.provider !== 'api') await chrome.storage.local.set({provider:'api',providerRevision:Date.now()});
  await credential('', 'member-session');
  await credential('', 'key');
  await credential('', 'qwen-key');
  await chrome.storage.local.remove(['qwenTestResults','lastTranslation']);
}

async function handle(message, sender) {
  await apiReady;
  if (message.type === 'bd:open-settings') {
    await chrome.tabs.create({url:chrome.runtime.getURL('api-setup.html')});
    return {};
  }
  if (message.type.startsWith('bd:api-')) {
    if (sender.url !== chrome.runtime.getURL('api-setup.html')) throw new Error('请在扩展的 API 设置页操作。');
    if (message.type === 'bd:api-state') {
      const profile = await credential(undefined, 'api-profile');
      return {config:profile?.config || null,hasKey:Boolean(profile?.key)};
    }
    if (message.type === 'bd:api-remove') {
      await credential('', 'api-profile');
      await chrome.storage.local.remove('apiSettings');
      await chrome.storage.local.set({providerRevision:Date.now()});
      paused = false; pauseMessage = ''; nextRequestAt = 0;
      return {};
    }
    if (message.type !== 'bd:api-save') throw new Error('未知 API 操作。');
    if (message.consent !== true) throw new Error('请确认数据发送和 API 费用说明。');
    const config = apiConfig(message.config);
    const preset = API_PROVIDERS.find(item => item.id === config.id);
    const old = await credential(undefined, 'api-profile');
    let key = typeof message.key === 'string' ? message.key.trim() : '';
    // A saved key is reusable only for the exact provider and endpoint.
    if (!key && old?.config.id === config.id && old?.config.baseUrl === config.baseUrl) key = old.key;
    const local = ['localhost','127.0.0.1','[::1]'].includes(new URL(config.baseUrl).hostname);
    if ((!key && !(preset.optionalKey && local)) || (key && !/^[\x21-\x7e]{4,4096}$/.test(key))) throw new Error('请填写此服务商的 API Key。');
    if (!await chrome.permissions.contains({origins:[apiOrigin(config)]})) throw new Error('请先允许访问所选 API 地址。');
    if (active) throw new Error('正在翻译，请稍后再保存设置。');
    active = true;
    try {
      const result = await qwenTranslate('A small reading habit can make a big difference.',key,undefined,config);
      await credential({config,key},'api-profile');
      await chrome.storage.local.set({provider:'api',apiSettings:config,providerRevision:Date.now()});
      paused=false;pauseMessage='';nextRequestAt=0;
      return {text:result.text};
    } finally {active=false;}
  }
  if (message.type === 'bd:translate') {
    if (typeof message.text !== 'string' || !message.text.trim() || message.text.length > 18000) throw new Error('待翻译文字无效或过长。');
    if (active) return {busy:true};
    if (Date.now() < nextRequestAt) return {busy:true,waitMs:nextRequestAt-Date.now()};
    if (message.retry === true) paused=false;
    if (paused) throw Object.assign(new Error(pauseMessage),{fatal:true,status:428});
    const profile=await credential(undefined,'api-profile');
    if (!profile) throw Object.assign(new Error('请先在伴读 API 设置中填写自己的密钥并测试启用。'),{fatal:true,status:428});
    if (!await chrome.permissions.contains({origins:[apiOrigin(profile.config)]})) throw Object.assign(new Error('API 访问权限已撤销，请在设置页重新授权。'),{fatal:true,status:428});
    if (active) return {busy:true};
    if (Date.now() < nextRequestAt) return {busy:true,waitMs:nextRequestAt-Date.now()};
    active=true;nextRequestAt=Date.now()+2100;
    const progress=message.requestId&&sender.tab?text=>{
      chrome.tabs.sendMessage(sender.tab.id,{type:'bd:partial',requestId:message.requestId,text},{frameId:sender.frameId||0}).catch(()=>{});
    }:undefined;
    try {return await qwenTranslate(message.text,profile.key,progress,profile.config);}
    catch(error){paused=error.fatal===true;pauseMessage=error.message;nextRequestAt=Math.max(nextRequestAt,Date.now()+(error.retryAfterMs||0));throw error;}
    finally {active=false;}
  }
}
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if (!['bd:open-settings','bd:api-state','bd:api-save','bd:api-remove','bd:translate'].includes(message?.type)) return;
  handle(message,sender).then(result=>reply({ok:true,...result}),error=>reply({ok:false,error:error.message,status:error.status,recoverable:error.fatal!==true,retryable:error.retryable===true}));
  return true;
});

// Optional host permissions: the permissions.request() confirmation dialog
// blurs and closes the action popup, killing its async continuation. This
// listener lives in the worker, so it finishes enabling the site after the
// user clicks "允许" even when the popup is already gone.
function siteScriptId(origin) {
  const url = new URL(origin);
  return `site-${url.protocol.replace(':', '')}-${url.hostname}`;
}

async function ensureSiteContentScript(origin) {
  const id = siteScriptId(origin);
  try {
    const registered = await chrome.scripting.getRegisteredContentScripts({ ids: [id] });
    if (registered.length) return;
  } catch { /* Query failed; attempt registration below. */ }
  try {
    await chrome.scripting.registerContentScripts([{
      id,
      matches: [origin],
      js: ['content.js', 'selection.js'],
      runAt: 'document_idle',
      persistAcrossSessions: true
    }]);
  } catch (error) {
    // The popup's own continuation can register the same script concurrently.
    if (!/duplicate/i.test(String(error && error.message))) throw error;
  }
}

async function enableGrantedSite(origin) {
  await ensureSiteContentScript(origin);
  const hostname = new URL(origin).hostname;
  await chrome.storage.local.set({ [`site:${hostname}`]: true });
  let tabs = [];
  try {
    tabs = await chrome.tabs.query({ url: [origin] });
  } catch { return; }
  await Promise.all(tabs.filter(tab => !tab.discarded).map(async tab => {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js', 'selection.js']
      });
      await chrome.tabs.sendMessage(tab.id, { type: 'bd:refresh' });
    } catch { /* Navigating/closed tabs get the registered script on next load. */ }
  }));
}

chrome.permissions.onAdded.addListener((permissions) => {
  for (const origin of permissions?.origins || []) {
    chrome.storage.session.get('pendingSite').then(({pendingSite}) => {
      if (pendingSite?.origin === origin && Date.now() - pendingSite.at < 120000) {
        chrome.storage.session.remove('pendingSite');
        return enableGrantedSite(origin);
      }
    }).catch(() => {});
  }
});

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  await apiReady;
  if (reason === 'install') chrome.tabs.create({ url: chrome.runtime.getURL('api-setup.html') });
});

// A manifest content script covers new documents only. Reattach to existing X tabs
// whenever this worker starts after an extension update/reload; live scripts no-op.
async function restoreXTab(tabId) {
  try {
    const [state] = await chrome.scripting.executeScript({ target: { tabId }, func: () => ({
      managed: document.documentElement.dataset.banduLifecycle === '1',
      legacy: Boolean(document.querySelector('.bd-translation,[data-bd-ui]')) || [...document.querySelectorAll('style')].some(style => style.textContent.includes('.bd-pair.bd-columns'))
    }) });
    // One-time migration: pre-lifecycle releases cannot dispose their observers.
    if (!state.result.managed && state.result.legacy) {
      await chrome.tabs.reload(tabId);
      return;
    }
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js', 'selection.js'] });
  } catch { /* Closed, discarded or navigating tabs get the manifest script on load. */ }
}
chrome.tabs.query({ url: ['https://x.com/*', 'https://*.x.com/*', 'https://twitter.com/*', 'https://*.twitter.com/*'] })
  .then(tabs => Promise.all(tabs.filter(tab => !tab.discarded).map(tab => restoreXTab(tab.id))));
const xURL = url => /^https:\/\/([^/]+\.)?(x\.com|twitter\.com)\//.test(url || '');
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (tab && xURL(tab.url)) restoreXTab(tabId);
});
chrome.tabs.onUpdated.addListener((tabId, change, tab) => {
  if ((change.status === 'complete' || change.url) && xURL(tab.url)) restoreXTab(tabId);
});
chrome.runtime.onStartup.addListener(() => {});

// Upgrade permissions already granted to ordinary websites without requesting new sites.
chrome.scripting.getRegisteredContentScripts().then(scripts => {
  const updates=scripts.filter(s=>s.id.startsWith('site-')&&!s.js.includes('selection.js')).map(s=>({id:s.id,js:[...s.js,'selection.js']}));
  if(updates.length)return chrome.scripting.updateContentScripts(updates);
}).catch(()=>{});
