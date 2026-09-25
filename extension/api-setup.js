const $ = id => document.getElementById(id);
let saved = null;
for (const preset of API_PROVIDERS) $('provider').add(new Option(preset.name,preset.id));
function presetDetails(reset) {
  const preset = API_PROVIDERS.find(item => item.id === $('provider').value);
  if (reset) {
    $('base-url').value=preset.baseUrl; $('model').value=preset.model;
    $('api-key').value=''; $('consent').checked=false; $('result').textContent='';
  }
  $('provider-hint').textContent=preset.hint || '使用此服务商的 API Key，模型和地址可以按你的账户修改。';
  $('provider-docs').hidden=!preset.docs; $('provider-docs').href=preset.docs || '#';
  keyState();
}
function keyState() {
  const same=saved?.hasKey && saved.config.id===$('provider').value && saved.config.baseUrl===$('base-url').value.trim().replace(/\/+$/,'');
  $('api-key').placeholder=same?'已保存密钥；留空继续使用，填写新密钥可替换':'粘贴此服务商的 API Key';
  $('key-state').textContent=same?'已有密钥，仅保存在此浏览器。更换服务商或地址时，必须重新输入密钥。':'密钥仅保存在此浏览器的扩展私有存储，不上传伴读服务器，不参与浏览器同步。';
}
async function send(message) {
  const result=await chrome.runtime.sendMessage(message);
  if(!result?.ok) throw new Error(result?.error||'扩展未就绪，请重新打开设置页。');
  return result;
}
async function load() {
  saved=await send({type:'bd:api-state'});
  if(saved.config) {
    $('provider').value=saved.config.id; $('base-url').value=saved.config.baseUrl; $('model').value=saved.config.model;
    $('stream').checked=saved.config.stream; $('json-mode').checked=saved.config.jsonMode;
    presetDetails(false);
  } else presetDetails(true);
}
$('provider').addEventListener('change',()=>presetDetails(true));
$('base-url').addEventListener('input',()=>{$('api-key').value='';$('consent').checked=false;keyState();});
$('api-form').addEventListener('submit',async event=>{
  event.preventDefault();
  try {
    const config=apiConfig({id:$('provider').value,baseUrl:$('base-url').value,model:$('model').value,stream:$('stream').checked,jsonMode:$('json-mode').checked});
    const granted=chrome.permissions.request({origins:[apiOrigin(config)]});
    $('save').disabled=true; $('remove').disabled=true; $('result').textContent='正在申请 API 访问权限…';
    if(!await granted) throw new Error('未授予 API 访问权限，原配置没有改变。');
    $('result').textContent='正在测试翻译，成功后保存启用…';
    const result=await send({type:'bd:api-save',config,key:$('api-key').value,consent:$('consent').checked});
    $('api-key').value=''; await load();
    $('result').textContent='已保存并启用。测试译文：'+result.text;
  } catch(error) {$('result').textContent=error.message;}
  finally {$('save').disabled=false;$('remove').disabled=false;}
});
$('remove').addEventListener('click',async()=>{
  if(!confirm('删除此浏览器已保存的 API 配置与密钥？翻译将停止。')) return;
  try {
    await send({type:'bd:api-remove'});$('api-key').value='';await load();$('result').textContent='已删除配置与密钥。重新配置后才能翻译。';
  } catch(error) {$('result').textContent=error.message;}
});
load().catch(error=>{$('result').textContent=error.message;});
