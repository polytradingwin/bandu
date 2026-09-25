const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const source=fs.readFileSync(process.argv[2]||'extension/engbetter.js','utf8');
function setup(response={ok:true,status:200,body:{saved:true}}){
 const storage={ebAccount:{id:'user-a'},ebJobs:{old:{id:'old',tab:4,kind:'connect',created:Date.now()}}};
 let token='test-token',internal,external;const calls=[];
 const chrome={runtime:{id:'pljhomjbmonehfhfflicdhbbimpnpdho',onMessage:{addListener:fn=>internal=fn},onMessageExternal:{addListener:fn=>external=fn}},storage:{local:{get:async()=>storage,set:async v=>Object.assign(storage,v),remove:async keys=>{for(const k of [].concat(keys))delete storage[k];}}},tabs:{create:async v=>{calls.push(v);return{id:5};}}};
 const context=vm.createContext({chrome,crypto:require('node:crypto').webcrypto,URL,AbortSignal,Date,credential:async value=>{if(value!==undefined)token=value;return token;},fetch:async(url,options)=>{calls.push({url,options});if(response instanceof Error)throw response;if(typeof response==='function')return response();return{...response,json:async()=>response.body};}});
 vm.runInContext(source,context);
 return{storage,calls,token:()=>token,send:m=>new Promise(resolve=>internal(m,{url:'https://x.com/test/status/1',tab:{id:2}},resolve)),external:m=>new Promise(resolve=>external(m,{url:'https://engbetter.com/daily',tab:{id:4}},resolve))};
}
(async()=>{
 let h=setup({ok:false,status:403,body:{code:'ORIGIN_FORBIDDEN'}});
 let r=await h.send({type:'eb:save',clip:{text:'A useful sentence.'}});
 assert.match(r.error,/版本.*允许/);assert(h.storage.ebAccount);console.log('PASS forbidden origin explains cause');
 h=setup({ok:false,status:401,body:{code:'TOKEN_INVALID'}});r=await h.send({type:'eb:save',clip:{text:'A useful sentence.'}});
 assert.match(r.error,/重新连接/);assert.equal(h.token(),null);assert.equal(h.storage.ebAccount,undefined);console.log('PASS expired token clears stale connection');
 h=setup({ok:false,status:401,body:{code:'TOKEN_INVALID'}});r=await h.send({type:'eb:disconnect'});
 assert(r.ok);assert(!r.warning);assert.equal(h.storage.ebJobs,undefined);console.log('PASS disconnect succeeds with revoked token and invalidates pending grants');
 for(const response of [new TypeError('Failed to fetch'),{ok:false,status:403,body:{code:'ORIGIN_FORBIDDEN'}}]){
  h=setup(response);r=await h.send({type:'eb:disconnect'});assert(r.ok);assert.match(r.warning,/本机已断开/);assert.equal(h.storage.ebAccount,undefined);assert.equal(h.token(),null);
 }
 console.log('PASS offline and forbidden disconnect clear local connection with honest warning');
 let resolve;h=setup(()=>new Promise(r=>resolve=r));const disconnect=h.send({type:'eb:disconnect'});await new Promise(r=>setImmediate(r));
 assert.equal(h.storage.ebAccount,undefined);assert.equal(h.token(),null);resolve({ok:true,status:200,json:async()=>({})});assert((await disconnect).ok);console.log('PASS local disconnect does not wait for server');
 h=setup();r=await h.send({type:'eb:connect'});assert(r.ok);assert.match(h.calls[0].url,/bandu_ext=pljhomjbmonehfhfflicdhbbimpnpdho/);console.log('PASS connection carries actual extension ID');
 h=setup();r=await h.external({type:'eb:cancel',id:'old'});assert(r.ok);assert.equal(h.storage.ebJobs.old,undefined);r=await h.external({type:'eb:authorize',id:'old',token:'new',userId:'user-a'});assert(!r.ok);console.log('PASS cancelled job cannot reconnect');
 h=setup({ok:false,status:429,body:{code:'COLLECT_LIMIT_REACHED'}});r=await h.send({type:'eb:save',clip:{text:'A useful sentence.'}});assert.match(r.error,/今日.*已用完/);assert(h.storage.ebAccount);console.log('PASS collection limit preserves valid connection');
 h=setup();r=await h.send({type:'eb:save',clip:{text:'A useful sentence.'}});assert(r.ok&&r.saved);console.log('PASS successful save preserved');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
