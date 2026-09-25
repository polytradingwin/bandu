const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function context(fetch) {
 const ctx=vm.createContext({URL,AbortSignal,Response,TextDecoder,fetch,console});
 for(const file of ['providers.js','stream.js','api.js','qwen.js']) vm.runInContext(fs.readFileSync('extension/'+file,'utf8'),ctx);
 return ctx;
}
const response=text=>new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({translation:text})}}]}));
test('all 24 presets normalize with user-provided model and endpoint',()=>{
 const c=context();
 const presets=vm.runInContext('API_PROVIDERS',c);assert.equal(presets.length,24);
 for(const p of presets){const conf=c.apiConfig({...p,model:p.model||'test-model',baseUrl:p.baseUrl||'https://example.com/v1'});assert.ok(conf.baseUrl);assert.equal(conf.id,p.id);}
});
test('endpoint validation rejects cleartext remote, URL credentials, key query, unknown provider',()=>{
 const c=context();
 for(const baseUrl of ['http://example.com/v1','https://user:secret@example.com/v1','https://example.com/v1?key=secret','file:///a','https://example.com/#token']) assert.throws(()=>c.apiConfig({id:'custom',baseUrl,model:'test'}));
 assert.throws(()=>c.apiConfig({id:'other',baseUrl:'https://example.com',model:'test'}));
 assert.equal(c.apiConfig({id:'custom',baseUrl:'https://example.com/v1/chat/completions/',model:'test'}).baseUrl,'https://example.com/v1');
 assert.equal(c.apiOrigin(c.apiConfig({id:'ollama',baseUrl:'http://localhost:11434/v1',model:'test'})),'http://localhost:11434/*');
});
test('OpenAI-compatible request uses only selected endpoint/key/model and does not send cookies',async()=>{
 const calls=[];const c=context(async(url,options)=>{calls.push({url,options});return response('你好');});
 const cfg=c.apiConfig({id:'openai',baseUrl:'https://api.openai.com/v1',model:'gpt-4.1-mini'});
 assert.equal((await c.qwenTranslate('Hello','test-only-key',undefined,cfg)).text,'你好');
 assert.equal(calls.length,1);assert.equal(calls[0].url,'https://api.openai.com/v1/chat/completions');
 assert.equal(calls[0].options.headers.Authorization,'Bearer test-only-key');assert.equal(calls[0].options.credentials,'omit');assert.equal(calls[0].options.redirect,'error');
 const body=JSON.parse(calls[0].options.body);assert.equal(body.model,'gpt-4.1-mini');assert.equal(body.enable_thinking,undefined);assert.equal(body.response_format,undefined);
});
test('Claude uses Messages headers and extracts only text',async()=>{
 let call;const c=context(async(url,options)=>{call={url,options};return new Response(JSON.stringify({stop_reason:'end_turn',content:[{type:'thinking',thinking:'private'},{type:'text',text:'{"translation":"你好"}'}],usage:{input_tokens:5,output_tokens:4}}));});
 const cfg=c.apiConfig({id:'claude',baseUrl:'https://api.anthropic.com/v1',model:'claude-haiku-4-5'});
 const r=await c.qwenTranslate('Hello','test-only-key',()=>{},cfg);assert.equal(r.text,'你好');assert.equal(r.inputTokens,5);
 assert.equal(call.url,'https://api.anthropic.com/v1/messages');assert.equal(call.options.headers['x-api-key'],'test-only-key');assert.equal(call.options.headers.Authorization,undefined);assert.equal(JSON.parse(call.options.body).stream,undefined);
});
test('provider failure never exposes upstream secret or switches endpoint',async()=>{
 for(const status of [400,401,402,403,404,429,500]){
  let count=0;const c=context(async()=>{count++;return new Response('echoed SECRET key',{status});});
  await assert.rejects(c.qwenTranslate('Hello','test-key'),e=>!e.message.includes('SECRET')&&e.status===status);
  assert.equal(count,1);
 }
});
test('truncated output, missing protected token and merged plain fallback never pass',async()=>{
 const c=context(async()=>response('合并的中文'));let n=0;
 c.fetch=async()=>{n++;return n<3?response('合并的中文'):new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:'合并的中文'}}]}));};
 await assert.rejects(c.qwenTranslate('First.\nBDKEEP0END Second.','test-key'),e=>e.recoverable);assert.equal(n,3);
});
test('Gemini compatible endpoint and local no-key requests remain user selected',async()=>{
 const calls=[];const c=context(async(url,options)=>{calls.push({url,options});return response('你好');});
 for(const config of [{id:'gemini',baseUrl:'https://generativelanguage.googleapis.com/v1beta/openai',model:'gemini-2.5-flash'},{id:'ollama',baseUrl:'http://localhost:11434/v1',model:'local-model'}]) await c.qwenTranslate('Hello',config.id==='ollama'?'':'test-key',undefined,c.apiConfig(config));
 assert.equal(calls[0].url,'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');assert.equal(calls[1].options.headers.Authorization,undefined);
});
test('MiniMax separates reasoning from translated content',async()=>{
 let body;const c=context(async(url,options)=>{body=JSON.parse(options.body);return response('你好');});
 await c.qwenTranslate('Hello','test-key',undefined,c.apiConfig({id:'minimax',baseUrl:'https://api.minimax.io/v1',model:'MiniMax-M2.5'}));
 assert.equal(body.reasoning_split,true);
});
