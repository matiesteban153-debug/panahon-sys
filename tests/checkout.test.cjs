const {test}=require('node:test');
const assert=require('node:assert/strict');
const load=require('./helpers/load-typescript.cjs');
function setup({allowed=true,result,invoke}={}){
 const state=[],refs=[];let cursor=0,refCursor=0,calls=0;
 const response=result??{data:{success:true,subscription_id:'abc',init_point:'https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=abc'},error:null};
 const react={useRef(initial){const i=refCursor++;refs[i]??={current:initial};return refs[i]},useState(initial){const i=cursor++;if(!(i in state))state[i]=initial;return[state[i],v=>{state[i]=v}]}};
 const {useCheckout}=load('src/app/lib/use-checkout.ts',{react,'src/app/lib/supabase.ts':{loadClient:async()=>({functions:{invoke:async(name,args)=>{calls++;assert.equal(name,'mp-crear-suscripcion');assert.deepEqual(args.body,{empresa_id:'empresa',plan:'base'});return invoke?invoke():response}}})}});
 const api=useCheckout('empresa',allowed);return {api,state,count:()=>calls,render(id){cursor=0;refCursor=0;return useCheckout(id,allowed)}};
}
test('double click shares in-flight guard',async()=>{
 let finish;const pending=new Promise(resolve=>finish=resolve);const h=setup({invoke:()=>pending});
 const navigations=[];global.window={location:{assign:url=>navigations.push(url)}};
 const first=h.api.openCheckout();await h.api.openCheckout();
 finish({data:{success:true,subscription_id:'abc',init_point:'https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=abc'}});
 await first;assert.equal(h.count(),1);assert.equal(navigations.length,1);delete global.window;
});
test('blocked UI cannot invoke server',async()=>{const h=setup({allowed:false});await h.api.openCheckout();assert.equal(h.count(),0);});
for(const url of ['https://evil.test/subscriptions/checkout?preapproval_id=abc','https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=abc','https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=other']){
 test('rejects invalid checkout '+url,async()=>{const h=setup({result:{data:{success:true,subscription_id:'abc',init_point:url}}});await h.api.openCheckout();assert.match(h.state[1],/validar/);});
}
test('server error visible without generic checkout fallback',async()=>{
 const h=setup({result:{error:{context:{json:async()=>({error:'Pendiente de revisión'})}}}});await h.api.openCheckout();assert.equal(h.state[1],'Pendiente de revisión');
});
test('network exception leaves a retryable UI and no navigation',async()=>{
 const h=setup({invoke:()=>{throw new Error('Sin conexión')}});await h.api.openCheckout();assert.equal(h.state[0],false);assert.equal(h.state[1],'Sin conexión');
});

test('response for previous company cannot navigate after company changes',async()=>{
 let finish;const pending=new Promise(resolve=>finish=resolve);const h=setup({invoke:()=>pending});
 const navigations=[];global.window={location:{assign:url=>navigations.push(url)}};
 const first=h.api.openCheckout();await new Promise(resolve=>setImmediate(resolve));
 h.render('otra-empresa');
 finish({data:{success:true,subscription_id:'abc',init_point:'https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=abc'}});
 await first;assert.equal(navigations.length,0);delete global.window;
});
