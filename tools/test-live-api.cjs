// Opt-in smoke test. Never prints credentials. All calls consume the user's API quota.
const fs=require('fs'),vm=require('vm');
const key=process.env.BANDU_TEST_API_KEY;
if(!key)throw Error('Set BANDU_TEST_API_KEY in your local environment first.');
const c=vm.createContext({URL,fetch,Response,TextDecoder,AbortSignal});
for(const f of ['providers.js','stream.js','api.js','qwen.js'])vm.runInContext(fs.readFileSync('extension/'+f,'utf8'),c);
const samples=["A small reading habit can make a big difference.","This idea went viral overnight. I'm not buying the hype.","Read the original.\n\nThen compare the translation.","Try BDKEEP0END and follow BDKEEP1END for more.","We don't need more time. We need fewer distractions."];
(async()=>{
 const config=c.apiConfig({id:'qwen',baseUrl:'https://dashscope.aliyuncs.com/compatible-mode/v1',model:'qwen3.7-flash',stream:true,jsonMode:true});
 const results=[];
 for(const text of samples){const r=await c.qwenTranslate(text,key,()=>{},config);results.push({source:text,...r});}
 console.log(JSON.stringify({provider:'qwen',live:true,results},null,2));
})().catch(e=>{console.error('Live API check failed:',e.message.replaceAll(key,'[redacted]'));process.exitCode=1;});
