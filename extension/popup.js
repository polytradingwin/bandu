const $ = (id) => document.getElementById(id);
let tab;
let hostname;
let enabled = false;
const isX = (host) => /(^|\.)(x\.com|twitter\.com)$/.test(host);
const settingKey = () => `site:${hostname}`;

async function connect() {
  await chrome.scripting.executeScript({target:{tabId:tab.id},files:["selection.js"]});
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'bd:status' });
  } catch {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js', 'selection.js'] });
  }
}

function render() {
  $('toggle-title').textContent = enabled ? '双语已开启' : '双语已关闭';
  $('toggle-action').textContent = enabled ? '点击关闭此网站的双语' : '点击开启此网站的双语';
  $('toggle').classList.toggle('is-on', enabled);
  $('toggle').setAttribute('aria-checked', String(enabled));
  $('toggle').disabled = false;
  $('status').textContent = enabled ? '自动翻译此网站的英文内容。' : '已关闭，保留网页原貌。';
}

async function init() {
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) throw new Error('请在要翻译的网页上，点击浏览器工具栏中的伴读图标。');
  const url = new URL(tab.url);
  if (!['http:', 'https:'].includes(url.protocol) || url.hostname === 'chromewebstore.google.com' || (url.hostname === 'microsoftedge.microsoft.com' && url.pathname.startsWith('/addons'))) {
    throw new Error('请先打开 X 或普通英文网页，再点击伴读。');
  }
  hostname = url.hostname;
  $('site').textContent = hostname;
  const settings = await chrome.storage.local.get([settingKey(), 'layout']);
  enabled = settings[settingKey()] ?? isX(hostname);
  $('layout').value = settings.layout || 'auto';
  render();
}

$('toggle').addEventListener('click', async () => {
  $('toggle').disabled = true;
  try {
    const next = !enabled;
    if (next && !isX(hostname)) {
      const origin = `${new URL(tab.url).protocol}//${hostname}/*`;
      // Request only this site, during the user's click gesture. On some
      // Chrome versions the confirmation dialog closes this popup and the
      // rest of this handler never runs; background.js then completes the
      // enable flow via chrome.permissions.onAdded. Keep this continuation
      // as the fast path when the popup survives.
      chrome.storage.session.set({pendingSite:{origin,at:Date.now()}});
      if (!await chrome.permissions.request({ origins: [origin] })) {
        render();
        $('status').textContent = '未授予此网站权限，暂未开启。';
        return;
      }
      const id = `site-${new URL(tab.url).protocol.replace(':', '')}-${hostname}`;
      try {
        if (!(await chrome.scripting.getRegisteredContentScripts({ ids: [id] })).length) {
          await chrome.scripting.registerContentScripts([{
            id, matches: [origin], js: ['content.js', 'selection.js'], runAt: 'document_idle', persistAcrossSessions: true
          }]);
        }
      } catch (error) {
        // The background worker may have registered the same script already.
        if (!/duplicate/i.test(String(error && error.message))) throw error;
      }
    }
    await chrome.storage.local.set({ [settingKey()]: next });
    enabled = next;
    await connect();
    await chrome.tabs.sendMessage(tab.id, { type: 'bd:refresh' });
    render();
  } catch (error) {
    render();
    $('status').textContent = `未能连接页面，请刷新网页后再试。${error.message}`;
  }
});
$('layout').addEventListener('change', () => chrome.storage.local.set({ layout: $('layout').value }));
$('help').addEventListener('click', () => chrome.runtime.openOptionsPage());
init().catch((error) => {
  $('site').textContent = '此页面暂不支持';
  $('toggle-title').textContent = '请打开英文网页';
  $('status').textContent = error.message;
});



$('settings').addEventListener('click', () => chrome.tabs.create({url:chrome.runtime.getURL('api-setup.html')}));

async function showConnection() {
 const {ebAccount}=await chrome.storage.local.get('ebAccount');
 $('engbetter').textContent=ebAccount?'已连接 EngBetter ↗':'连接到 EngBetter ↗';
 $('eb-disconnect').hidden=!ebAccount;
}
$('engbetter').onclick=async()=>{
 const {ebAccount}=await chrome.storage.local.get('ebAccount');
 if(ebAccount)await chrome.tabs.create({url:'https://engbetter.com/daily'});
 else {try{const r=await chrome.runtime.sendMessage({type:'eb:connect'});if(!r?.ok)throw Error(r?.error||'连接失败，请重试。');}catch(e){$('eb-status').hidden=false;$('eb-status').textContent=e.message;}}
};
$('eb-disconnect').onclick=async()=>{
 $('eb-disconnect').disabled=true;
 $('eb-disconnect').textContent='断开中…';$('eb-status').hidden=false;$('eb-status').textContent='正在断开 EngBetter…';
 try {const r=await chrome.runtime.sendMessage({type:'eb:disconnect'});if(!r?.ok)throw Error(r?.error||'断开失败，请重试。');await showConnection();$('eb-status').textContent=r.warning||'已断开连接，网站中的收藏仍保留。';}
 catch(e){$('eb-status').textContent=e.message;}
 finally{$('eb-disconnect').disabled=false;$('eb-disconnect').textContent='断开';}
};
async function showApiSource() {
 const {apiSettings} = await chrome.storage.local.get('apiSettings');
 const preset = API_PROVIDERS.find(item => item.id === apiSettings?.id);
 $('provider-label').textContent = preset ? `${preset.name} · ${apiSettings.model}` : '尚未配置，请打开 API 设置。';
}
showApiSource(); showConnection();
chrome.storage.onChanged.addListener(changes => {
 if(changes.apiSettings) showApiSource();
 if(changes.ebAccount) showConnection();
});
