const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./gssk-CObvSkgl.js","./rolldown-runtime-XKyaHtl9.js","./index-BNdfiT4w.js","./index-0hCd5HGt.css"])))=>i.map(i=>d[i]);
import{a as e,i as t,n,r,t as i}from"./index-BNdfiT4w.js";import{a,d as o,f as s,i as c,l,m as u,o as d,p as f,s as p}from"./metrics-CGSTutjD.js";import{a as m,n as h,r as g,s as _,t as v}from"./format-Cx1wN9EF.js";import"./doomsday-clock-Brqt63rM.js";import"./velocity-gauge-BKI318t8.js";import"./trend-chart-CY7eOAL5.js";import"./doom-loop-C1MqTXZ5.js";import"./queue-compare-nMZPk00V.js";import"./closure-evidence-DIYUr3KU.js";import{WeightSliderComponent as y}from"./weight-slider-DQhVH3P2.js";import"./practice-list-C8r4Gnuz.js";import"./replay-control-BWqwjn8-.js";function ee(e){if(!e.closures)return null;let t=Object.values(e.closures).reduce((e,t)=>e+t,0);return{total:t,byEvidence:e.closures,referencedShare:t>0?e.closures.fix_referenced/t:0}}function b(e,t){let n=[];for(let r of e){let e=t(r);if(!e)return null;n.push({date:r.date,open:e.created-e.closed,agentClosed:0,humanClosed:e.closed})}return f(n)}function te(e,t=7,n){let r=e=>e?d(u(e,t,n)):void 0;return{referenced:r(b(e,e=>e.closures?{created:e.created,closed:e.closures.fix_referenced}:null)),behavior:r(b(e,e=>e.behavior??null))}}function ne(e,t=7,n){let[r=``,...i]=e.trim().split(/\r?\n/),a=r.split(`,`).map(e=>e.trim()),s=e=>a.indexOf(e),[l,p,m]=[`date`,`open`,`resolved`].map(s),h=s(`resolved_by_human`);if(l===-1||p===-1||m===-1||i.length===0)return null;let g=i.map(e=>{let t=e.split(`,`).map(e=>e.trim()),n=h===-1?0:Number(t[h])||0,r=Number(t[m])-n;return`${t[l]},${t[p]},${r},${n}`}),_=f(o([`date,open,agent_closed,human_closed`,...g].join(`
`))),v=_[_.length-1],y=u(_,t,n);return{date:v.date,open:v.open,resolved:v.totalClosed,points:_,velocity:y,ratio:d(y),loop:c(_,t,n)}}async function re(e,t=fetch,n=`data/agent_queue.csv`){try{let r=await t(n,{cache:`no-cache`});return r.ok?ne(await r.text(),7,e):null}catch{return null}}var x=.5;function S(e){return e.latest.totalClosed>0?e.latest.agentShare:null}var C=(e,t,n)=>n*e+(1-n)*t;function w(e,t,n){let r=S(e),i=t?S(t):null;return r===null?i??0:i===null?r:C(r,i,n)}function ie(e,t,n){return(1-w(e,t,n))*24}function T(e,t,n){if(!t)return e.velocity;let r=e.velocity,i=t.velocity;return{agent:C(r.agent,i.agent,n),human:C(r.human,i.human,n),arrivals:C(r.arrivals,i.arrivals,n),netBacklog:C(r.netBacklog,i.netBacklog,n),days:Math.max(r.days,i.days),since:r.since<i.since?r.since:i.since}}function E(e,t,n){return e===null||n===0?n===1?e:t:t===null||n===1?e:!Number.isFinite(e)||!Number.isFinite(t)?1/0:e<=0||t<=0?0:Math.exp(C(Math.log(e),Math.log(t),n))}function ae(e,t,n){if(!t)return e.loop;let r=E(e.loop.ratio,t.loop.ratio,n),i=new Map(t.loop.history.map(e=>[e.date,e.ratio]));return{ratio:r,level:a(r),history:e.loop.history.filter(e=>i.has(e.date)).map(e=>({date:e.date,ratio:E(e.ratio,i.get(e.date),n)})),doublingDays:null,clearDays:null}}var D=e=>e.velocity.agent+e.velocity.human;function O(e,t){let n=e.latest.open+t.latest.open;return n>0?e.latest.open/n:0}function k(e,t){let n=D(e)+D(t);return n>0?D(e)/n:0}function oe(e,t){let n=O(e,t);return n>0?k(e,t)/n:null}function se(e,t,n=x){return[{id:`agents`,label:`Agents' queue only`,weight:0},{id:`effort`,label:`By actual effort`,weight:k(e,t)},{id:`backlog`,label:`By backlog size`,weight:O(e,t)},{id:`equal`,label:`Equal per queue (default)`,weight:n},{id:`public`,label:`Public issues only (v1)`,weight:1}]}var ce=[`pass`,`improve`,`missing`,`unknown`];function A(e){let t=e??{},n=e=>typeof e==`number`&&Number.isFinite(e)?e:null;return{count:Number(t.count)||0,medianHours:n(t.medianHours),p90Hours:n(t.p90Hours)}}function le(e){let t=e?.responses;return t?{windowDays:Number(t.windowDays)||30,firstResponse:A(t.firstResponse),resolution:A(t.resolution),awaitingResponse:Number(t.awaitingResponse)||0}:null}function ue(e){let t=e?.practices;return Array.isArray(t)?t.filter(e=>e&&typeof e.id==`string`&&typeof e.title==`string`).map(e=>({id:e.id,title:e.title,status:ce.includes(e.status)?e.status:`unknown`,evidence:String(e.evidence??``),recommendation:String(e.recommendation??``),docs:typeof e.docs==`string`&&e.docs.startsWith(`https://`)?e.docs:``})):[]}function j(e){if(e===null)return`—`;if(e<1)return`${Math.max(1,Math.round(e*60))} min`;if(e<48)return`${e<10?e.toFixed(1):Math.round(e)} h`;let t=e/24;return`${t<10?t.toFixed(1):Math.round(t)} days`}var M=864e5;function N(e,t,n,r){let i=e.filter(e=>e.date<=t);if(i.length===0)return null;let a=i.length===e.length?r:void 0;return{latest:i[i.length-1],velocity:u(i,n,a),loop:c(i,n,a)}}function de(e,t,n=7,r){let i=[...e,...t].map(e=>e.date);if(i.length===0)return[];let a=i.reduce((e,t)=>e<t?e:t),o=i.reduce((e,t)=>e>t?e:t),s=[];for(let i=Date.parse(a);i<=Date.parse(o);i+=M){let a=new Date(i).toISOString().slice(0,10);s.push({date:a,publicQueue:N(e,a,n,r),agents:N(t,a,n,r)})}return s}var P=(e,t,n)=>e+(t-e)*n;function fe(e,t,n){let r=e=>e!==null&&Number.isFinite(e)&&e>0;return r(e)&&r(t)?Math.exp(P(Math.log(e),Math.log(t),n)):n<.5?e:t}function pe(e,t,n){return{agent:P(e.agent,t.agent,n),human:P(e.human,t.human,n),arrivals:P(e.arrivals,t.arrivals,n),netBacklog:P(e.netBacklog,t.netBacklog,n),days:P(e.days,t.days,n),since:n<.5?e.since:t.since}}function me(e,t,n){let r=P(e.agentClosed,t.agentClosed,n),i=P(e.humanClosed,t.humanClosed,n),a=r+i,o=P(e.open,t.open,n),s=a>0?r/a:0;return{date:n<1?e.date:t.date,open:o,agentClosed:r,humanClosed:i,totalClosed:a,created:o+a,agentShare:s,hoursToMidnight:P(e.hoursToMidnight,t.hoursToMidnight,n)}}function he(e,t,n){let r=fe(e.ratio,t.ratio,n),i=n<.5?e:t;return{ratio:r,level:a(r),history:e.history,doublingDays:i.doublingDays,clearDays:i.clearDays}}function F(e,t,n){return!e||!t?n<1?e:t:{latest:me(e.latest,t.latest,n),velocity:pe(e.velocity,t.velocity,n),loop:he(e.loop,t.loop,n)}}function ge(e,t){let n=Math.min(Math.max(t,0),e.length-1),r=Math.floor(n),i=e[r],a=e[Math.min(r+1,e.length-1)],o=n-r;return o===0||i===a?i:{date:i.date,publicQueue:F(i.publicQueue,a.publicQueue,o),agents:F(i.agents,a.agents,o),...a.forecast?{forecast:_e(i.forecast,a.forecast,o)}:{}}}function I(e,t,n){return{low:P(e.low,t.low,n),mid:P(e.mid,t.mid,n),high:P(e.high,t.high,n)}}function _e(e,t,n){let r=e=>({low:e.mid,mid:e.mid,high:e.mid}),i=e??{day:0,fade:0,clock:r(t.clock),resolved:{public:r(t.resolved.public),agents:r(t.resolved.agents),combined:r(t.resolved.combined)}};return{day:P(i.day,t.day,n),fade:P(i.fade,t.fade,n),clock:I(i.clock,t.clock,n),resolved:{public:I(i.resolved.public,t.resolved.public,n),agents:I(i.resolved.agents,t.resolved.agents,n),combined:I(i.resolved.combined,t.resolved.combined,n)}}}var L=e=>({low:e.p5,mid:e.p50,high:e.p95});function R(e,t,n){let r=t.open.p50,i=t.byAgents.p50,o=t.byHumans.p50,s=i+o,c=s>0?i/s:0,l=t.arrivals.p50,u=t.agents.p50+t.humans.p50,d=l-u,f=u>0?l/u:l>0?1/0:null;return{latest:{date:e,open:r,agentClosed:i,humanClosed:o,totalClosed:s,created:r+s,agentShare:c,hoursToMidnight:(1-c)*24},velocity:{agent:t.agents.p50,human:t.humans.p50,arrivals:l,netBacklog:d,days:1,since:``},loop:{ratio:f,level:a(f),history:n,doublingDays:d>0&&r>0?r/d:null,clearDays:d<0?r/-d:null}}}function ve(e,t,n,r){let i=Date.parse(n);return e.slice(0,t).map(e=>{let n=new Date(i+e.day*M).toISOString().slice(0,10);return{date:n,publicQueue:R(n,e.queues.public,r.public),agents:R(n,e.queues.agents,r.agents),forecast:{day:e.day,fade:e.day/t,clock:L(e.clockHours),resolved:{public:L(e.resolved.public),agents:L(e.resolved.agents),combined:L(e.combined.resolved)}}}})}function z(e,t){let n=0;for(let r of e){let e=t(r);e&&(n=Math.max(n,e.agent,e.human,e.arrivals))}return n}var B=[`public`,`agents`],ye=[`open`,`byAgents`,`byHumans`],be=[`arrive`,`agents`,`humans`],V=4;function xe(e){let t=[],n=[];for(let r of B){let i=e[r];t.push({id:`${r}.filing`,type:`source`,value:1},{id:`${r}.open`,type:`storage`,value:i.open},{id:`${r}.byAgents`,type:`storage`,value:i.byAgents},{id:`${r}.byHumans`,type:`storage`,value:i.byHumans});let a=(e,t,n)=>({id:`${r}.${e}`,origin:`${r}.${t}`,target:`${r}.${n}`,logic:`linear`,params:{k:0}});n.push(a(`arrive`,`filing`,`open`),a(`agents`,`open`,`byAgents`),a(`humans`,`open`,`byHumans`))}return JSON.stringify({metadata:{schema_version:4,name:`Issue queues`,description:`Public GitHub issues and the agents’ own queue: issues arrive, and agents and humans resolve a share of the open backlog each day.`,kernel_version:`6.0.2`},nodes:t,edges:n,config:{t_start:0,t_end:1e5,dt:1/V,method:`rk4`}})}function Se(e,t){let n=(t,n)=>{let r=e.lengthBytesUTF8(t)+1,i=e._malloc(r);try{return e.stringToUTF8(t,i,r),n(i)}finally{e._free(i)}},r=e._malloc(4),i=n(xe(t),t=>e._GSSK_Init(t,r)),a=e.HEAPU32[r>>2];if(e._free(r),i!==0||!a){let t=a?e.UTF8ToString(e._GSSK_GetErrorDescription(a)):`status ${i}`;throw Error(`GSSK could not load the forecast model: ${t}`)}let o=new Map,s=new Map;for(let t of B){for(let r of ye){let i=`${t}.${r}`;o.set(i,n(i,t=>e._GSSK_FindNodeIdx(a,t)))}for(let r of be){let i=`${t}.${r}`;s.set(i,n(i,t=>e._GSSK_FindEdgeIdx(a,t)))}}let c=1/V;return{reset:()=>e._GSSK_Reset(a),setRate:(t,n,r)=>e._GSSK_SetEdgeK(a,s.get(`${t}.${n}`),r),step:t=>{for(let n=0;n<t*V;n++)e._GSSK_Step(a,c)},value:(t,n)=>{let r=e._GSSK_GetState(a)>>3;return e.HEAPF64[r+o.get(`${t}.${n}`)]},dispose:()=>e._GSSK_Free(a)}}async function Ce(t){let{default:n}=await e(async()=>{let{default:e}=await import(`./gssk-CObvSkgl.js`);return{default:e}},__vite__mapDeps([0,1,2,3]),import.meta.url);return Se(await n({print:()=>{},printErr:()=>{}}),t)}var H=.03,we=.3,Te=.15,Ee=(e,t,n)=>Math.min(n,Math.max(t,e));function De(e){let t=e.slice(0,-1),n=e=>t.slice(1).map((n,r)=>Math.max(0,e(n)-e(t[r]))),r=e=>e.map((t,n)=>n<6?null:e.slice(n-6,n+1)).filter(e=>e!==null).map(e=>e.reduce((e,t)=>e+t,0)/e.length),i=e=>e.slice(1).map((t,n)=>Math.log((t+1)/(e[n]+1))),a=e=>{let t=e.reduce((e,t)=>e+t,0)/e.length;return Math.sqrt(e.reduce((e,n)=>e+(n-t)**2,0)/e.length)},o=i(r(n(e=>e.totalClosed))),s=i(r(n(e=>e.created)));return o.length<7||s.length<7?null:(a(o)+a(s))/2}function U(e,t,n=Te){let r=e[e.length-1],i=t.days,a=e=>Math.max(0,e*i);return{start:{open:r.open,byAgents:r.agentClosed,byHumans:r.humanClosed},arrivals:{count:a(t.arrivals),days:i},agents:{count:a(t.agent),days:i},humans:{count:a(t.human),days:i},volatility:Ee(De(e)??n,H,we)}}function Oe(e){let t=e>>>0;return()=>{t=t+1831565813>>>0;let e=t;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}}function W(e){let t=Math.max(e(),2**-52);return Math.sqrt(-2*Math.log(t))*Math.cos(2*Math.PI*e())}function G(e,t){if(e<1)return G(e+1,t)*t()**(1/e);let n=e-1/3,r=1/Math.sqrt(9*n);for(;;){let e=W(t),i=(1+r*e)**3;if(i<=0)continue;let a=t();if(Math.log(a)<.5*e*e+n-n*i+n*Math.log(i))return n*i}}function K(e,t){return e.days<=0?0:G(e.count+.5,t)/e.days}var q=[`open`,`byAgents`,`byHumans`,`arrivals`,`agents`,`humans`];function ke(e,t,n,r,i){return e.data[((t*e.days+(n-1))*B.length+r)*q.length+i]}function Ae(e,t,{runs:n=200,days:r=365,seed:i=1}={}){let a=Oe(i),o=new Float32Array(n*r*B.length*q.length),s=0;for(let i=0;i<n;i++){e.reset();let n=B.map(e=>{let n=t[e],r=Math.max(n.start.open,1);return[Math.log(K(n.arrivals,a)+1e-9),Math.log(K(n.agents,a)/r+1e-12),Math.log(K(n.humans,a)/r+1e-12)]}),i=B.map(e=>({...t[e].start}));for(let c=1;c<=r;c++)B.forEach((r,i)=>{let o=t[r].volatility;for(let e=0;e<3;e++)n[i][e]+=o*W(a)-o*o/2;e.setRate(r,`arrive`,Math.exp(n[i][0])),e.setRate(r,`agents`,Math.exp(n[i][1])),e.setRate(r,`humans`,Math.exp(n[i][2]))}),e.step(1),i=B.map((t,r)=>{let a={open:e.value(t,`open`),byAgents:e.value(t,`byAgents`),byHumans:e.value(t,`byHumans`)};return o[s++]=a.open,o[s++]=a.byAgents,o[s++]=a.byHumans,o[s++]=Math.exp(n[r][0]),o[s++]=a.byAgents-i[r].byAgents,o[s++]=a.byHumans-i[r].byHumans,a})}return{runs:n,days:r,data:o}}function J(e){e.sort();let t=t=>{let n=t*(e.length-1),r=Math.floor(n),i=Math.min(r+1,e.length-1);return e[r]+(e[i]-e[r])*(n-r)};return{p5:t(.05),p25:t(.25),p50:t(.5),p75:t(.75),p95:t(.95)}}var Y=e=>{let t=e.byAgents+e.byHumans;return t>0?e.byAgents/t:null};function je(e,t){let{runs:n}=e,r=[],i=()=>new Float64Array(n);for(let a=1;a<=e.days;a++){let o=B.map(()=>q.map(i)),s=B.map(i),c=i(),l={arrivals:i(),agents:i(),humans:i()};for(let r=0;r<n;r++){let n={};B.forEach((t,i)=>{let c={};q.forEach((t,n)=>{c[t]=ke(e,r,a,i,n),o[i][n][r]=c[t]}),s[i][r]=c.agents+c.humans,n[t]=c});let i=t(n),u=Y(n.public),d=Y(n.agents),f=u===null?d??0:d===null?u:i*u+(1-i)*d;c[r]=(1-f)*24,l.arrivals[r]=i*n.public.arrivals+(1-i)*n.agents.arrivals,l.agents[r]=i*n.public.agents+(1-i)*n.agents.agents,l.humans[r]=i*n.public.humans+(1-i)*n.agents.humans}let u=i();for(let e=0;e<n;e++)u[e]=l.agents[e]+l.humans[e];r.push({day:a,queues:Object.fromEntries(B.map((e,t)=>[e,Object.fromEntries(q.map((e,n)=>[e,J(o[t][n])]))])),resolved:Object.fromEntries(B.map((e,t)=>[e,J(s[t])])),clockHours:J(c),combined:{arrivals:J(l.arrivals),agents:J(l.agents),humans:J(l.humans),resolved:J(u)}})}return r}var Me=12;function Ne(e){for(let t of e){let e=e=>(e.p95+1)/(e.p5+1);if(B.some(n=>e(t.resolved[n])>=10))return{day:t.day,reason:`rates`};if(t.clockHours.p95-t.clockHours.p5>=Me)return{day:t.day,reason:`clock`}}return{day:e.length,reason:`limit`}}var Pe=`<main class="page">
  <header class="hero">
    <div>
      <p class="eyebrow">
        AI replacement index ·
        <a
          data-tracked-link
          class="hero-link"
          target="_blank"
          rel="noopener noreferrer"
        ></a>
      </p>
      <h1>Developer Doomsday Clock</h1>
      <p class="lede">
        How close are AI agents to resolving every issue in
        <span data-repo-name></span>? The clock reads midnight when they resolve
        all of them. <span data-why hidden></span>
      </p>
    </div>
    <div class="hero-meta">
      <p class="status" data-status hidden>
        <span class="status-icon" data-status-icon aria-hidden="true"></span>
        <span data-status-label></span>
      </p>
      <p class="as-of" data-as-of role="status">Loading the latest numbers…</p>
    </div>
  </header>

  <section class="grid-top" data-content aria-busy="true">
    <div class="clock-column">
      <article class="card panel">
        <header class="panel-head">
          <h2>Developer Doomsday Clock</h2>
          <p>
            Hours to midnight = (1 −
            <span data-combined-word>combined </span>agent resolution share) ×
            24.
            <span data-clock-note></span>
          </p>
        </header>
        <doomsday-clock data-size="large"></doomsday-clock>
        <p class="version-note">
          Version 2 combines the public issues with the agents' own queue.
          Version 1 counted the public issues only.
          <a href="/methodology">What changed</a>
        </p>
      </article>
      <weight-slider></weight-slider>
    </div>

    <article class="card panel">
      <header class="panel-head">
        <h2>Resolution velocity</h2>
        <p>
          Issues resolved per day by agents (orange) and humans (purple). The
          blue mark is new issues; the outer arc is the gap.
        </p>
      </header>
      <div class="dials">
        <velocity-gauge data-dial="combined" data-size="large"></velocity-gauge>
        <velocity-gauge data-dial="agents" data-size="small"></velocity-gauge>
        <velocity-gauge data-dial="public" data-size="small"></velocity-gauge>
      </div>
      <replay-control></replay-control>
      <p class="forecast-note" data-forecast-note></p>
    </article>
  </section>

  <section
    class="loops"
    aria-label="Bug doom loop: combined and for each queue"
  >
    <doom-loop data-queue-loop="combined" class="loop-combined"></doom-loop>
    <doom-loop data-queue-loop="agents"></doom-loop>
    <doom-loop data-queue-loop="public"></doom-loop>
  </section>

  <section class="tiles" aria-label="Indices">
    <div class="card tile">
      <p class="tile-label">Agent resolution share</p>
      <p class="tile-value tabular" data-stat="share">—</p>
      <p class="tile-delta" data-stat="share-note"></p>
    </div>
    <div class="card tile">
      <p class="tile-label">Time to first response</p>
      <p class="tile-value tabular" data-stat="first-response">—</p>
      <p class="tile-delta" data-stat="first-response-note"></p>
    </div>
    <div class="card tile">
      <p class="tile-label">Time to resolution</p>
      <p class="tile-value tabular" data-stat="resolution">—</p>
      <p class="tile-delta" data-stat="resolution-note"></p>
    </div>
    <div class="card tile" data-tile="attention">
      <p class="tile-label">Public attention index</p>
      <p class="tile-value tabular" data-stat="attention">—</p>
      <p class="tile-delta" data-stat="attention-note"></p>
    </div>
    <div class="card tile">
      <p class="tile-label">Verified closure rate</p>
      <p class="tile-value tabular" data-stat="verified">—</p>
      <p class="tile-delta" data-stat="verified-note"></p>
    </div>
    <div class="card tile">
      <p class="tile-label">Reopen rate</p>
      <p class="tile-value tabular" data-stat="reopen">—</p>
      <p class="tile-delta" data-stat="reopen-note"></p>
    </div>
    <div class="card tile">
      <p class="tile-label">Open backlog</p>
      <p class="tile-value tabular" data-stat="open">—</p>
      <p class="tile-delta" data-stat="open-note"></p>
    </div>
  </section>

  <queue-compare></queue-compare>

  <closure-evidence></closure-evidence>

  <practice-list></practice-list>

  <article class="card panel">
    <header class="panel-head">
      <h2><span data-issues-name>Issues</span> over time</h2>
      <p>Running totals for <span data-tracked-name></span>, by day (UTC)</p>
    </header>
    <trend-chart data-trend="public"></trend-chart>
  </article>

  <article class="card panel" data-queue-trend hidden>
    <header class="panel-head">
      <h2>Agents' own queue over time</h2>
      <p>
        Files in the repository's two issue folders at the end of each day
        (UTC), from the first commit
      </p>
    </header>
    <trend-chart data-trend="agents"></trend-chart>
  </article>

  <footer class="foot">
    <p>
      <span data-schedule>Updated</span> by GitHub Actions from the repository's
      issue tracker and repository. Raw data:
      <a data-csv-link target="_blank" rel="noopener noreferrer">data.csv</a> ·
      <a data-project-link target="_blank" rel="noopener noreferrer"
        >Repo SRE Dashboard</a
      >
      ·
      <a href="/methodology">How it is calculated</a>
    </p>
  </footer>
</main>
`,Fe=`:host {
  display: block;
}
:host .page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2.5rem 1rem 3rem;
  display: grid;
  gap: 1.25rem;
}
@media (min-width: 640px) {
  :host .page {
    padding: 3rem 1.5rem 4rem;
  }
}
:host .hero {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1.5rem;
  margin-bottom: 0.75rem;
}
:host h1 {
  margin: 0.5rem 0 0.75rem;
  font-size: clamp(2rem, 5vw, 3.25rem);
  font-weight: 800;
  letter-spacing: -0.035em;
  line-height: 1.05;
}
:host .lede {
  margin: 0;
  max-width: 56ch;
  color: var(--ink-2);
  font-size: 1.0625rem;
  line-height: 1.55;
}
:host .hero-link {
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 3px;
}
:host .hero-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
}
:host .status {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  padding: 0.375rem 0.875rem 0.375rem 0.5rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  font-size: 0.875rem;
  font-weight: 600;
}
:host .status-icon {
  display: inline-grid;
  place-items: center;
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 999px;
  color: #fff;
  font-size: 0.75rem;
  font-weight: 800;
  line-height: 1;
}
:host .status[data-level='safe'] .status-icon {
  background: var(--good);
}
:host .status[data-level='elevated'] .status-icon {
  background: var(--warning);
  color: #0b0b0b;
}
:host .status[data-level='severe'] .status-icon {
  background: var(--serious);
}
:host .status[data-level='critical'] .status-icon {
  background: var(--critical);
}
:host .as-of {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--ink-muted);
}
:host .as-of.error {
  color: var(--critical-ink);
  font-weight: 600;
}
:host .grid-top {
  display: grid;
  gap: 1.25rem;
}
@media (min-width: 900px) {
  :host .grid-top {
    grid-template-columns: 1fr 1fr;
  }
}
:host .panel {
  padding: 1.25rem;
  min-width: 0;
}
@media (min-width: 640px) {
  :host .panel {
    padding: 1.5rem 1.75rem 1.75rem;
  }
}
:host .panel-head {
  margin-bottom: 1.25rem;
}
:host .panel-head h2 {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
}
:host .panel-head p {
  margin: 0.25rem 0 0;
  font-size: 0.8125rem;
  color: var(--ink-muted);
}
:host [aria-busy='true'] doomsday-clock,
:host [aria-busy='true'] velocity-gauge {
  opacity: 0.4;
}
:host .tiles {
  display: grid;
  gap: clamp(0.75rem, 2vw, 1.25rem);
  grid-template-columns: repeat(auto-fit, minmax(min(150px, 40vw), 1fr));
}
:host .tile {
  padding: 1.125rem 1.25rem;
}
:host .tile p {
  margin: 0;
}
:host .tile-label {
  font-size: 0.8125rem;
  color: var(--ink-2);
}
:host .tile-value {
  margin-top: 0.375rem !important;
  font-size: 1.875rem;
  font-weight: 650;
  letter-spacing: -0.02em;
  line-height: 1.15;
}
:host .tile-delta {
  margin-top: 0.25rem !important;
  min-height: 1.2em;
  font-size: 0.8125rem;
  color: var(--ink-muted);
}
:host .tile-delta.good {
  color: var(--good-ink);
}
:host .tile-delta.bad {
  color: var(--critical-ink);
}
:host .foot {
  margin-top: 0.5rem;
  font-size: 0.8125rem;
  color: var(--ink-muted);
}
:host .foot a {
  color: var(--ink-2);
  text-decoration: underline;
  text-underline-offset: 3px;
}
:host .loops {
  display: grid;
  gap: 1.25rem;
}
@media (min-width: 900px) {
  :host .loops {
    grid-template-columns: 1fr 1fr;
  }
}
:host .version-note {
  margin: 1.25rem 0 0;
  padding-top: 0.875rem;
  border-top: 1px solid var(--grid);
  font-size: 0.8125rem;
  color: var(--ink-muted);
}
:host .version-note a {
  color: var(--ink-2);
  text-decoration: underline;
  text-underline-offset: 3px;
}
/* Rally cluster: one large dial with two smaller ones beneath it. */
:host .dials {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem 1rem;
  align-items: start;
}
:host .dials [data-dial='combined'] {
  grid-column: 1 / -1;
}
@media (max-width: 480px) {
  :host .dials {
    grid-template-columns: 1fr;
  }
}
@media (min-width: 900px) {
  :host .loops .loop-combined {
    grid-column: 1 / -1;
  }
}
:host .clock-column {
  display: grid;
  gap: 1.25rem;
  align-content: start;
  min-width: 0;
}
:host replay-control {
  margin-top: 1.25rem;
}
:host .forecast-note {
  margin: 0.5rem 0 0;
  font-size: 0.8125rem;
  color: var(--ink-muted);
}
:host .forecast-note:empty {
  display: none;
}
/* One queue (no file-based queue configured): nothing to combine, so the
   issues' own dial and doom loop stand alone. */
:host[data-queues='one'] [data-dial='combined'],
:host[data-queues='one'] [data-dial='agents'],
:host[data-queues='one'] [data-queue-loop='combined'],
:host[data-queues='one'] [data-queue-loop='agents'],
:host[data-queues='one'] queue-compare,
:host[data-queues='one'] weight-slider,
:host[data-queues='one'] .version-note,
:host[data-queues='one'] [data-clock-note],
:host[data-queues='one'] [data-tile='attention'],
:host[data-queues='one'] [data-combined-word] {
  display: none;
}
:host[data-queues='one'] .dials {
  grid-template-columns: 1fr;
}
:host[data-queues='one'] .loops {
  grid-template-columns: 1fr;
}
`,Ie=200,Le=180,Re={start:{open:0,byAgents:0,byHumans:0},arrivals:{count:0,days:0},agents:{count:0,days:0},humans:{count:0,days:0},volatility:H},X={ratio:null,level:`unknown`,history:[],doublingDays:null,clearDays:null},Z={agent:0,human:0,arrivals:0,netBacklog:0,days:0,since:``},Q={safe:{icon:`✓`,label:`Humans hold the line`},elevated:{icon:`!`,label:`Elevated: agents gaining ground`},severe:{icon:`!`,label:`Severe: agents resolving most issues`},critical:{icon:`✕`,label:`Critical: midnight is near`}},$=class extends t{static tagName=`dashboard-page`;config=null;get queueName(){return this.config?.queue?.name??`Agents' own queue`}get issuesName(){return this.config?.queue?`Public GitHub issues`:`Issues`}constructor(){super(Pe,Fe)}async init(){let e=await r();this.config=e;let t=this.querySelector(`[data-tracked-link]`);if(t.href=e.issuesUrl||e.repositoryUrl,t.textContent=e.repository,this.querySelector(`[data-tracked-name]`).textContent=e.repository,this.querySelector(`[data-repo-name]`).textContent=e.repository,this.querySelector(`[data-issues-name]`).textContent=e.queue?`Public GitHub issues`:`Issues`,this.querySelector(`h1`).textContent=e.title,e.why){let e=this.querySelector(`[data-why]`);e.hidden=!1;let t=document.createElement(`a`);t.href=`/methodology`,t.className=`hero-link`,t.textContent=`Why this repository?`,e.replaceChildren(t)}this.querySelector(`[data-csv-link]`).href=i,this.querySelector(`[data-project-link]`).href=n,this.dataset.queues=e.queue?`two`:`one`,e.queue||(this.querySelector(`[data-dial="public"]`).dataset.size=`large`);let a=this.querySelector(`[data-as-of]`);try{this.render(await p())}catch(e){a.classList.add(`error`),a.textContent=`Could not load the data: ${e.message}`}}render(e){let{latest:t,velocity:n}=e,r=e.status?.updatedAt,i=e.status,a=i&&l(i);this.querySelector(`[data-as-of]`).textContent=i?`Data as of ${g(i.updatedAt)} · updated ${i.schedule.description}`+(a?` · next around ${_(a)}`:``):`Data as of ${h(t.date)} (UTC)`,this.querySelector(`[data-schedule]`).textContent=i?`Updated ${i.schedule.description}`:`Updated`;let o={latest:t,velocity:n,loop:e.doomLoop},s=ee(t),c=this.querySelector(`closure-evidence`);c.closures=s,c.issues=i?.issues,c.update(),this.querySelector(`[data-trend="public"]`).points=e.history,this.querySelector(`[data-content]`).setAttribute(`aria-busy`,`false`),this.stat(`verified`,s?m(s.referencedShare):`—`),this.stat(`verified-note`,s?`${v(s.byEvidence.fix_referenced)} of ${v(s.total)} closures reference a fix`:`available after the next tracker run`);let u=i?.issues,d=u?.reopened,f=u?.everClosed??0;this.stat(`reopen`,d!==void 0&&f>0?m(d/f):`—`),this.stat(`reopen-note`,d===void 0?`available after the next tracker run`:`${v(d)} of ${v(f)} closed issues were reopened`),this.renderHealth(i?.raw),(this.config?.queue?re(r):Promise.resolve(null)).then(t=>{let n=de(e.history,t?.points??[],7,r),a=t&&{latest:t.points[t.points.length-1],velocity:t.velocity,loop:t.loop};this.frames=n,this.publicStart=e.history[0].date,this.live={publicQueue:o,agents:a,strict:te(e.history,7,r)},this.renderAgentTrend(t),this.renderQueues(o,a);let s=this.querySelector(`weight-slider`),c=i?.defaultPublicWeight??.5;if(s.hidden=!a,a){let e=se(o,a,c);s.marks=e;let t=y.savedMark(),r=e.find(e=>e.id===t);s.mark=r?.id??null,s.weight=r?.weight??y.saved()??c,this.weight=s.weight,this.mark=s.mark,s.addEventListener(`weight-change`,e=>{this.weight=e.detail,this.mark=s.mark,this.peaks=this.scalePeaks(n),this.showDials(),window.clearTimeout(this.reforecast),this.reforecast=window.setTimeout(()=>this.refreshForecast(),200)})}let l=this.querySelector(`replay-control`);l.setDays(n.map(e=>e.date)),l.addEventListener(`replay-position`,e=>{let t=e.detail;this.replaying=t===null?null:ge(this.frames,t),this.showDials()}),this.peaks=this.scalePeaks(n),this.showDials(),this.history=n,window.setTimeout(()=>this.startForecast(e,t).catch(e=>{console.warn(`Forecast unavailable:`,e),this.querySelector(`[data-forecast-note]`).textContent=`The forecast could not be run in this browser.`}),50)})}frames=[];history=[];ensemble=null;reforecast=0;async startForecast(e,t){let n=t?U(t.points,t.velocity):Re,r=U(e.history,e.velocity,t?n.volatility:void 0),i=await Ce({public:r.start,agents:n.start});try{let t=Number(e.latest.date.replaceAll(`-`,``));this.ensemble=Ae(i,{public:r,agents:n},{runs:Ie,days:Le,seed:t})}finally{i.dispose()}this.refreshForecast()}refreshForecast(){if(!this.ensemble||!this.live)return;let e=!this.live.agents,t=je(this.ensemble,t=>{if(e)return 1;if(this.mark===`backlog`){let e=t.public.open+t.agents.open;return e>0?t.public.open/e:0}if(this.mark===`effort`){let e=e=>e.agents+e.humans,n=e(t.public)+e(t.agents);return n>0?e(t.public)/n:0}return this.weight}),n=Ne(t),r=this.history[this.history.length-1],i=ve(t,n.day,r.date,{public:this.live.publicQueue.loop.history,agents:this.live.agents?.loop.history??[]});this.frames=[...this.history,...i],this.querySelector(`replay-control`).setDays(this.frames.map(e=>e.date),this.history.length-1);let a=i[i.length-1]?.date;this.querySelector(`[data-forecast-note]`).textContent=a?`The forecast runs ${n.day} days, to ${h(a)}: `+(n.reason===`limit`?`it stays informative at least that far.`:`after that it is no better than a guess.`):``}live=null;replaying=null;weight=x;mark=null;peaks=null;weightFor(e,t){return t?this.mark===`backlog`?O(e,t):this.mark===`effort`?k(e,t):this.weight:1}scalePeaks(e){return{public:z(e,e=>e.publicQueue?.velocity??null),agents:z(e,e=>e.agents?.velocity??null),combined:z(e,e=>e.publicQueue?T(e.publicQueue,e.agents,this.weightFor(e.publicQueue,e.agents)):e.agents?.velocity??null)}}showDials(){if(!this.live)return;let e=this.replaying===null,t=e?this.live.publicQueue:this.replaying.publicQueue,n=e?this.live.agents:this.replaying.agents,r=e?void 0:this.replaying.forecast;for(let e of[`public`,`agents`,`combined`]){let t=this.dial(e);t.scalePeak=this.peaks?.[e]??null,t.range=r?r.resolved[e]:null,t.fade=r?.fade??0}let i=this.dial(`public`);i.heading=this.issuesName,i.open=t?t.latest.open:null,i.velocity=t?.velocity??Z;let a=this.loop(`public`);a.queue=this.issuesName,a.open=Math.round(t?.latest.open??0),a.windowDays=t?.velocity.days??0,a.strict=e?this.live.strict:{},a.loop=t?.loop??X;let o=this.dial(`agents`);o.heading=this.queueName,o.hidden=!this.live.agents,o.open=n?n.latest.open:null,o.velocity=n?.velocity??Z;let s=this.loop(`agents`);if(s.queue=this.queueName,s.caption=`issues filed per issue resolved`,s.open=Math.round(n?.latest.open??0),s.windowDays=n?.velocity.days??0,s.loop=n?.loop??X,t)this.renderCombined(t,n,this.weightFor(t,n),`public issues only`,r);else if(n){this.renderCombined(n,null,1,`agents' queue only`);let e=h(this.publicStart);this.querySelector(`doomsday-clock`).show({hours:null,note:`No reading yet: the public issue tracker starts on ${e}.`}),this.querySelector(`[data-status]`).hidden=!0,this.querySelector(`[data-clock-note]`).textContent=`The clock compares both queues, so it starts when the public issues do.`}}publicStart=``;renderHealth(e){let t=le(e),n=(e,n,r)=>{this.stat(e,j(n?.medianHours??null)),this.stat(`${e}-note`,t?n&&n.count>0?`median of ${v(n.count)} ${r} in ${t.windowDays} days · 90% within ${j(n.p90Hours)}`:`no ${r} in the last ${t.windowDays} days`:`available after the next tracker run`)};n(`first-response`,t?.firstResponse,`issues answered`),n(`resolution`,t?.resolution,`issues resolved`),t&&t.awaitingResponse>0&&this.stat(`first-response-note`,`${this.querySelector(`[data-stat="first-response-note"]`).textContent} · ${v(t.awaitingResponse)} open with no response`),this.querySelector(`practice-list`).practices=ue(e)}renderAgentTrend(e){let t=this.querySelector(`[data-queue-trend]`);if(t.hidden=!e,e){let t=this.querySelector(`[data-trend="agents"]`);t.labels={open:`Open issues`,agentClosed:`Resolved by AI agents`,humanClosed:`Resolved by humans`,totalClosed:`Total resolved`},t.points=e.points}}renderQueues(e,t){let n=e=>({open:e.latest.open,resolved:e.latest.totalClosed,resolvedByAgents:e.latest.agentClosed,resolvedByHumans:e.latest.humanClosed,arrivals:e.velocity.arrivals,agentResolved:e.velocity.agent,humanResolved:e.velocity.human,days:e.velocity.days});this.querySelector(`queue-compare`).comparison={agents:t&&n(t),publicIssues:n(e)},this.stat(`open`,v(e.latest.open+(t?.latest.open??0))),this.stat(`open-note`,t?`${v(e.latest.open)} public issues · ${v(t.latest.open)} in the agents' queue`:`GitHub issues`);let r=t?oe(e,t):null;this.stat(`attention`,r===null?`—`:r.toFixed(2)),this.stat(`attention-note`,t?`public issues get ${m(k(e,t))} of resolutions and hold ${m(O(e,t))} of the backlog`:`needs the agents' own queue`)}renderCombined(e,t,n,r=`public issues only`,i){let a=this.querySelector(`doomsday-clock`),o=i?i.clock.mid:ie(e,t,n);a.show({hours:o,range:i?{low:i.clock.low,high:i.clock.high}:null,fade:i?.fade??0});let c=s(o),l=this.querySelector(`[data-status]`);l.dataset.level=c,this.querySelector(`[data-status-icon]`).textContent=Q[c].icon,this.querySelector(`[data-status-label]`).textContent=Q[c].label,l.hidden=!1;let u=t?`public issues ${Math.round(n*100)}%, agents' queue ${Math.round((1-n)*100)}%`:r;this.querySelector(`[data-clock-note]`).textContent=`Weighted: ${u}.`;let d=w(e,t,n),f=e=>{let t=e&&S(e);return t===null?`n/a`:m(t)};this.stat(`share`,m(d)),this.config?.queue?this.stat(`share-note`,`combined · public issues ${f(e)} · agents' queue ${f(t)}`):this.stat(`share-note`,`of ${v(e.latest.totalClosed)} closed issues`);let p=this.dial(`combined`);p.heading=t?`Both queues, weighted`:`Combined: ${r}`,p.open=Math.round(e.latest.open+(t?.latest.open??0)),p.velocity=T(e,t,n);let h=this.loop(`combined`);h.queue=t?`Both queues, weighted`:`Combined: ${r}`,h.caption=`issues opened per issue resolved, weighted across queues`,h.note=t?`Weighted geometric mean of the two queues' ratios: ${u}.`:``,h.open=Math.round(e.latest.open),h.windowDays=e.velocity.days,h.loop=ae(e,t,n)}dial(e){return this.querySelector(`[data-dial="${e}"]`)}loop(e){return this.querySelector(`[data-queue-loop="${e}"]`)}stat(e,t,n=``){let r=this.querySelector(`[data-stat="${e}"]`);r.textContent=t,r.classList.remove(`good`,`bad`),n&&r.classList.add(n)}};customElements.get($.tagName)||customElements.define($.tagName,$);export{$ as DashboardPageComponent};