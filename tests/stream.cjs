const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const context=vm.createContext({TextDecoder,TextEncoder,Response,ReadableStream,AbortSignal,console});
for(const f of ['stream.js','providers.js','api.js','qwen.js'])vm.runInContext(fs.readFileSync('extension/'+f,'utf8'),context);
function response(events){
 const bytes=new TextEncoder().encode(events.map(e=>'data: '+(typeof e==='string'?e:JSON.stringify(e))+'\r\n\r\n').join(''));
 return new Response(new ReadableStream({start(c){for(const b of bytes)c.enqueue(Uint8Array.of(b));c.close();}}),{headers:{'Content-Type':'text/event-stream'}});
}
(async()=>{
 assert.equal(context.partialTranslation('{"translation":"你好\\n\\u4e16\\u'),'你好\n世');
 const packets=[{choices:[{delta:{reasoning_content:'SECRET REASONING'}}]},
 {choices:[{delta:{content:'{"translation":"你'}}]},
 {choices:[{delta:{content:'好"}'},finish_reason:'stop'}]},
 {choices:[],usage:{prompt_tokens:12,completion_tokens:4}},'[DONE]'];
 const previews=[];
 let result=await context.readQwenStream(response(packets),t=>previews.push(t));
 assert.deepEqual(previews,['你','你好']);
 assert.equal(result.usage.prompt_tokens,12);
 await assert.rejects(context.readQwenStream(response(packets.slice(0,2)),()=>{}));
 context.fetch=async(url,opts)=>{const body=JSON.parse(opts.body);assert.equal(body.stream,true);assert.equal(body.enable_thinking,false);return response(packets);};
 result=await context.qwenTranslate('Hello','fake-key',()=>{});
 assert.equal(result.text,'你好');assert.equal(result.inputTokens,12);
 let attempt=0;const resets=[];
 context.fetch=async()=>{
   if(attempt++===0)return response([{choices:[{delta:{content:JSON.stringify({translation:'错误\n分段'})},finish_reason:'stop'}]},
     {choices:[],usage:{prompt_tokens:12,completion_tokens:4}},'[DONE]']);
   return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({translations:{0:'正确译文'}})}}],usage:{prompt_tokens:10,completion_tokens:5}}));
 };
 result=await context.qwenTranslate('Hello','fake-key',t=>resets.push(t));
 assert.equal(result.text,'正确译文');assert.equal(attempt,2);
 assert.equal(resets.filter(t=>t==='').length,2);
 assert.equal(result.inputTokens,22);
 result=await context.readQwenStream(response(packets.filter(p=>!p.usage)),()=>{});
 assert.equal(result.choices[0].message.content,'{"translation":"你好"}');
 console.log('Stream checks passed: UTF8 boundaries, previews, reasoning excluded, optional usage, EOF');
})().catch(e=>{console.error(e);process.exitCode=1;});
