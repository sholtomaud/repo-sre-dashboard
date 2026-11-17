import{a as e,c as t,d as n,f as r,h as i,l as a,m as o,n as s,o as c,p as l,r as u,s as d,t as f,u as p}from"./index-Cze6PZ7Z.js";import{a as m,d as h,f as ee,i as g,l as te,m as _,o as v,p as y,s as ne}from"./metrics-CGSTutjD.js";import{a as b,n as x,r as re,s as ie,t as S}from"./format-Cx1wN9EF.js";import"./doomsday-clock-Dh-1cfLo.js";import"./velocity-gauge-CyW94ted.js";import"./trend-chart-3Dfyl9Rd.js";import"./doom-loop-laJb9mQw.js";import"./queue-compare-FhHlDwIk.js";import"./closure-evidence-D0WkYnKp.js";import{WeightSliderComponent as C}from"./weight-slider-DcdBlECH.js";import"./practice-list-QOAF26Fb.js";import"./outlook-panel-BioFkSQJ.js";import"./replay-control-5YJxDeGd.js";function ae(e){if(!e.closures)return null;let t=Object.values(e.closures).reduce((e,t)=>e+t,0);return{total:t,byEvidence:e.closures,referencedShare:t>0?e.closures.fix_referenced/t:0}}function w(e,t){let n=[];for(let r of e){let e=t(r);if(!e)return null;n.push({date:r.date,open:e.created-e.closed,agentClosed:0,humanClosed:e.closed})}return y(n)}function T(e,t=7,n){let r=e=>e?v(_(e,t,n)):void 0;return{referenced:r(w(e,e=>e.closures?{created:e.created,closed:e.closures.fix_referenced}:null)),behavior:r(w(e,e=>e.behavior??null))}}function E(e,t=7,n){let[r=``,...i]=e.trim().split(/\r?\n/),a=r.split(`,`).map(e=>e.trim()),o=e=>a.indexOf(e),[s,c,l]=[`date`,`open`,`resolved`].map(o),u=o(`resolved_by_human`);if(s===-1||c===-1||l===-1||i.length===0)return null;let d=i.map(e=>{let t=e.split(`,`).map(e=>e.trim()),n=u===-1?0:Number(t[u])||0,r=Number(t[l])-n;return`${t[s]},${t[c]},${r},${n}`}),f=y(h([`date,open,agent_closed,human_closed`,...d].join(`
`))),p=f[f.length-1],m=_(f,t,n);return{date:p.date,open:p.open,resolved:p.totalClosed,points:f,velocity:m,ratio:v(m),loop:g(f,t,n)}}async function D(e,t=fetch,n=`data/agent_queue.csv`){try{let r=await t(n,{cache:`no-cache`});return r.ok?E(await r.text(),7,e):null}catch{return null}}var O=.5;function k(e){return e.latest.totalClosed>0?e.latest.agentShare:null}var A=(e,t,n)=>n*e+(1-n)*t;function j(e,t,n){let r=k(e),i=t?k(t):null;return r===null?i??0:i===null?r:A(r,i,n)}function M(e,t,n){return(1-j(e,t,n))*24}function N(e,t,n){if(!t)return e.velocity;let r=e.velocity,i=t.velocity;return{agent:A(r.agent,i.agent,n),human:A(r.human,i.human,n),arrivals:A(r.arrivals,i.arrivals,n),netBacklog:A(r.netBacklog,i.netBacklog,n),days:Math.max(r.days,i.days),since:r.since<i.since?r.since:i.since}}function P(e,t,n){return e===null||n===0?n===1?e:t:t===null||n===1?e:!Number.isFinite(e)||!Number.isFinite(t)?1/0:e<=0||t<=0?0:Math.exp(A(Math.log(e),Math.log(t),n))}function oe(e,t,n){if(!t)return e.loop;let r=P(e.loop.ratio,t.loop.ratio,n),i=new Map(t.loop.history.map(e=>[e.date,e.ratio]));return{ratio:r,level:m(r),history:e.loop.history.filter(e=>i.has(e.date)).map(e=>({date:e.date,ratio:P(e.ratio,i.get(e.date),n)})),doublingDays:null,clearDays:null}}var F=e=>e.velocity.agent+e.velocity.human;function I(e,t){let n=e.latest.open+t.latest.open;return n>0?e.latest.open/n:0}function L(e,t){let n=F(e)+F(t);return n>0?F(e)/n:0}function se(e,t){let n=I(e,t);return n>0?L(e,t)/n:null}function ce(e,t,n=O){return[{id:`agents`,label:`Agents' queue only`,weight:0},{id:`effort`,label:`By actual effort`,weight:L(e,t)},{id:`backlog`,label:`By backlog size`,weight:I(e,t)},{id:`equal`,label:`Equal per queue (default)`,weight:n},{id:`public`,label:`Public issues only (v1)`,weight:1}]}var le=[`pass`,`improve`,`missing`,`unknown`];function R(e){let t=e??{},n=e=>typeof e==`number`&&Number.isFinite(e)?e:null;return{count:Number(t.count)||0,medianHours:n(t.medianHours),p90Hours:n(t.p90Hours)}}function z(e){let t=e?.responses;return t?{windowDays:Number(t.windowDays)||30,firstResponse:R(t.firstResponse),resolution:R(t.resolution),awaitingResponse:Number(t.awaitingResponse)||0}:null}function B(e){let t=e?.practices;return Array.isArray(t)?t.filter(e=>e&&typeof e.id==`string`&&typeof e.title==`string`).map(e=>({id:e.id,title:e.title,status:le.includes(e.status)?e.status:`unknown`,evidence:String(e.evidence??``),recommendation:String(e.recommendation??``),docs:typeof e.docs==`string`&&e.docs.startsWith(`https://`)?e.docs:``})):[]}function V(e){if(e===null)return`—`;if(e<1)return`${Math.max(1,Math.round(e*60))} min`;if(e<48)return`${e<10?e.toFixed(1):Math.round(e)} h`;let t=e/24;return`${t<10?t.toFixed(1):Math.round(t)} days`}var H=864e5;function U(e,t,n,r){let i=e.filter(e=>e.date<=t);if(i.length===0)return null;let a=i.length===e.length?r:void 0;return{latest:i[i.length-1],velocity:_(i,n,a),loop:g(i,n,a)}}function ue(e,t,n=7,r){let i=[...e,...t].map(e=>e.date);if(i.length===0)return[];let a=i.reduce((e,t)=>e<t?e:t),o=i.reduce((e,t)=>e>t?e:t),s=[];for(let i=Date.parse(a);i<=Date.parse(o);i+=H){let a=new Date(i).toISOString().slice(0,10);s.push({date:a,publicQueue:U(e,a,n,r),agents:U(t,a,n,r)})}return s}var W=(e,t,n)=>e+(t-e)*n;function de(e,t,n){let r=e=>e!==null&&Number.isFinite(e)&&e>0;return r(e)&&r(t)?Math.exp(W(Math.log(e),Math.log(t),n)):n<.5?e:t}function fe(e,t,n){return{agent:W(e.agent,t.agent,n),human:W(e.human,t.human,n),arrivals:W(e.arrivals,t.arrivals,n),netBacklog:W(e.netBacklog,t.netBacklog,n),days:W(e.days,t.days,n),since:n<.5?e.since:t.since}}function pe(e,t,n){let r=W(e.agentClosed,t.agentClosed,n),i=W(e.humanClosed,t.humanClosed,n),a=r+i,o=W(e.open,t.open,n),s=a>0?r/a:0;return{date:n<1?e.date:t.date,open:o,agentClosed:r,humanClosed:i,totalClosed:a,created:o+a,agentShare:s,hoursToMidnight:W(e.hoursToMidnight,t.hoursToMidnight,n)}}function me(e,t,n){let r=de(e.ratio,t.ratio,n),i=n<.5?e:t;return{ratio:r,level:m(r),history:e.history,doublingDays:i.doublingDays,clearDays:i.clearDays}}function G(e,t,n){return!e||!t?n<1?e:t:{latest:pe(e.latest,t.latest,n),velocity:fe(e.velocity,t.velocity,n),loop:me(e.loop,t.loop,n)}}function he(e,t){let n=Math.min(Math.max(t,0),e.length-1),r=Math.floor(n),i=e[r],a=e[Math.min(r+1,e.length-1)],o=n-r;return o===0||i===a?i:{date:i.date,publicQueue:G(i.publicQueue,a.publicQueue,o),agents:G(i.agents,a.agents,o),...a.forecast?{forecast:ge(i.forecast,a.forecast,o)}:{}}}function K(e,t,n){return{low:W(e.low,t.low,n),mid:W(e.mid,t.mid,n),high:W(e.high,t.high,n)}}function ge(e,t,n){let r=e=>({low:e.mid,mid:e.mid,high:e.mid}),i=e??{day:0,fade:0,clock:r(t.clock),resolved:{public:r(t.resolved.public),agents:r(t.resolved.agents),combined:r(t.resolved.combined)}};return{day:W(i.day,t.day,n),fade:W(i.fade,t.fade,n),clock:K(i.clock,t.clock,n),resolved:{public:K(i.resolved.public,t.resolved.public,n),agents:K(i.resolved.agents,t.resolved.agents,n),combined:K(i.resolved.combined,t.resolved.combined,n)}}}var q=e=>({low:e.p5,mid:e.p50,high:e.p95});function J(e,t,n){let r=t.open.p50,i=t.byAgents.p50,a=t.byHumans.p50,o=i+a,s=o>0?i/o:0,c=t.arrivals.p50,l=t.agents.p50+t.humans.p50,u=c-l,d=l>0?c/l:c>0?1/0:null;return{latest:{date:e,open:r,agentClosed:i,humanClosed:a,totalClosed:o,created:r+o,agentShare:s,hoursToMidnight:(1-s)*24},velocity:{agent:t.agents.p50,human:t.humans.p50,arrivals:c,netBacklog:u,days:1,since:``},loop:{ratio:d,level:m(d),history:n,doublingDays:u>0&&r>0?r/u:null,clearDays:u<0?r/-u:null}}}function _e(e,t,n,r){let i=Date.parse(n);return e.slice(0,t).map(e=>{let n=new Date(i+e.day*H).toISOString().slice(0,10);return{date:n,publicQueue:J(n,e.queues.public,r.public),agents:J(n,e.queues.agents,r.agents),forecast:{day:e.day,fade:e.day/t,clock:q(e.clockHours),resolved:{public:q(e.resolved.public),agents:q(e.resolved.agents),combined:q(e.combined.resolved)}}}})}function Y(e,t){let n=0;for(let r of e){let e=t(r);e&&(n=Math.max(n,e.agent,e.human,e.arrivals))}return n}var ve=`<main class="page">
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

  <outlook-panel></outlook-panel>

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
`,ye=`:host {
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
`,be=200,xe=180,Se={start:{open:0,byAgents:0,byHumans:0},arrivals:{count:0,days:0},agents:{count:0,days:0},humans:{count:0,days:0},volatility:a},X={ratio:null,level:`unknown`,history:[],doublingDays:null,clearDays:null},Z={agent:0,human:0,arrivals:0,netBacklog:0,days:0,since:``},Q={safe:{icon:`✓`,label:`Humans hold the line`},elevated:{icon:`!`,label:`Elevated: agents gaining ground`},severe:{icon:`!`,label:`Severe: agents resolving most issues`},critical:{icon:`✕`,label:`Critical: midnight is near`}},$=class extends i{static tagName=`dashboard-page`;config=null;get queueName(){return this.config?.queue?.name??`Agents' own queue`}get issuesName(){return this.config?.queue?`Public GitHub issues`:`Issues`}constructor(){super(ve,ye)}async init(){let e=await u();this.config=e;let t=this.querySelector(`[data-tracked-link]`);if(t.href=e.issuesUrl||e.repositoryUrl,t.textContent=e.repository,this.querySelector(`[data-tracked-name]`).textContent=e.repository,this.querySelector(`[data-repo-name]`).textContent=e.repository,this.querySelector(`[data-issues-name]`).textContent=e.queue?`Public GitHub issues`:`Issues`,this.querySelector(`h1`).textContent=e.title,e.why){let e=this.querySelector(`[data-why]`);e.hidden=!1;let t=document.createElement(`a`);t.href=`/methodology`,t.className=`hero-link`,t.textContent=`Why this repository?`,e.replaceChildren(t)}this.querySelector(`[data-csv-link]`).href=f,this.querySelector(`[data-project-link]`).href=s,this.dataset.queues=e.queue?`two`:`one`,e.queue||(this.querySelector(`[data-dial="public"]`).dataset.size=`large`);let n=this.querySelector(`[data-as-of]`);try{this.render(await ne())}catch(e){n.classList.add(`error`),n.textContent=`Could not load the data: ${e.message}`}}render(e){let{latest:t,velocity:n}=e,r=e.status?.updatedAt,i=e.status,a=i&&te(i);this.querySelector(`[data-as-of]`).textContent=i?`Data as of ${re(i.updatedAt)} · updated ${i.schedule.description}`+(a?` · next around ${ie(a)}`:``):`Data as of ${x(t.date)} (UTC)`,this.querySelector(`[data-schedule]`).textContent=i?`Updated ${i.schedule.description}`:`Updated`;let o={latest:t,velocity:n,loop:e.doomLoop},s=ae(t),c=this.querySelector(`closure-evidence`);c.closures=s,c.issues=i?.issues,c.update(),this.querySelector(`[data-trend="public"]`).points=e.history,this.querySelector(`[data-content]`).setAttribute(`aria-busy`,`false`),this.stat(`verified`,s?b(s.referencedShare):`—`),this.stat(`verified-note`,s?`${S(s.byEvidence.fix_referenced)} of ${S(s.total)} closures reference a fix`:`available after the next tracker run`);let l=i?.issues,u=l?.reopened,d=l?.everClosed??0;this.stat(`reopen`,u!==void 0&&d>0?b(u/d):`—`),this.stat(`reopen-note`,u===void 0?`available after the next tracker run`:`${S(u)} of ${S(d)} closed issues were reopened`),this.renderHealth(i?.raw),window.setTimeout(()=>this.renderOutlook(r),80),(this.config?.queue?D(r):Promise.resolve(null)).then(t=>{let n=ue(e.history,t?.points??[],7,r),a=t&&{latest:t.points[t.points.length-1],velocity:t.velocity,loop:t.loop};this.frames=n,this.publicStart=e.history[0].date,this.live={publicQueue:o,agents:a,strict:T(e.history,7,r)},this.renderAgentTrend(t),this.renderQueues(o,a);let s=this.querySelector(`weight-slider`),c=i?.defaultPublicWeight??.5;if(s.hidden=!a,a){let e=ce(o,a,c);s.marks=e;let t=C.savedMark(),r=e.find(e=>e.id===t);s.mark=r?.id??null,s.weight=r?.weight??C.saved()??c,this.weight=s.weight,this.mark=s.mark,s.addEventListener(`weight-change`,e=>{this.weight=e.detail,this.mark=s.mark,this.peaks=this.scalePeaks(n),this.showDials(),window.clearTimeout(this.reforecast),this.reforecast=window.setTimeout(()=>this.refreshForecast(),200)})}let l=this.querySelector(`replay-control`);l.setDays(n.map(e=>e.date)),l.addEventListener(`replay-position`,e=>{let t=e.detail;this.replaying=t===null?null:he(this.frames,t),this.showDials()}),this.peaks=this.scalePeaks(n),this.showDials(),this.history=n,window.setTimeout(()=>this.startForecast(e,t).catch(e=>{console.warn(`Forecast unavailable:`,e),this.querySelector(`[data-forecast-note]`).textContent=`The forecast could not be run in this browser.`}),50)})}frames=[];history=[];ensemble=null;reforecast=0;async startForecast(e,t){let n=t?p(t.points,t.velocity):Se,i=p(e.history,e.velocity,t?n.volatility:void 0),a=await o({public:i.start,agents:n.start});try{let t=Number(e.latest.date.replaceAll(`-`,``));this.ensemble=r(a,{public:i,agents:n},{runs:be,days:xe,seed:t})}finally{a.dispose()}this.refreshForecast()}refreshForecast(){if(!this.ensemble||!this.live)return;let e=!this.live.agents,t=l(this.ensemble,t=>{if(e)return 1;if(this.mark===`backlog`){let e=t.public.open+t.agents.open;return e>0?t.public.open/e:0}if(this.mark===`effort`){let e=e=>e.agents+e.humans,n=e(t.public)+e(t.agents);return n>0?e(t.public)/n:0}return this.weight}),r=n(t),i=this.history[this.history.length-1],a=_e(t,r.day,i.date,{public:this.live.publicQueue.loop.history,agents:this.live.agents?.loop.history??[]});this.frames=[...this.history,...a],this.querySelector(`replay-control`).setDays(this.frames.map(e=>e.date),this.history.length-1);let o=a[a.length-1]?.date;this.querySelector(`[data-forecast-note]`).textContent=o?`The forecast runs ${r.day} days, to ${x(o)}: `+(r.reason===`limit`?`it stays informative at least that far.`:`after that it is no better than a guess.`):``}live=null;replaying=null;weight=O;mark=null;peaks=null;weightFor(e,t){return t?this.mark===`backlog`?I(e,t):this.mark===`effort`?L(e,t):this.weight:1}scalePeaks(e){return{public:Y(e,e=>e.publicQueue?.velocity??null),agents:Y(e,e=>e.agents?.velocity??null),combined:Y(e,e=>e.publicQueue?N(e.publicQueue,e.agents,this.weightFor(e.publicQueue,e.agents)):e.agents?.velocity??null)}}showDials(){if(!this.live)return;let e=this.replaying===null,t=e?this.live.publicQueue:this.replaying.publicQueue,n=e?this.live.agents:this.replaying.agents,r=e?void 0:this.replaying.forecast;for(let e of[`public`,`agents`,`combined`]){let t=this.dial(e);t.scalePeak=this.peaks?.[e]??null,t.range=r?r.resolved[e]:null,t.fade=r?.fade??0}let i=this.dial(`public`);i.heading=this.issuesName,i.open=t?t.latest.open:null,i.velocity=t?.velocity??Z;let a=this.loop(`public`);a.queue=this.issuesName,a.open=Math.round(t?.latest.open??0),a.windowDays=t?.velocity.days??0,a.strict=e?this.live.strict:{},a.loop=t?.loop??X;let o=this.dial(`agents`);o.heading=this.queueName,o.hidden=!this.live.agents,o.open=n?n.latest.open:null,o.velocity=n?.velocity??Z;let s=this.loop(`agents`);if(s.queue=this.queueName,s.caption=`issues filed per issue resolved`,s.open=Math.round(n?.latest.open??0),s.windowDays=n?.velocity.days??0,s.loop=n?.loop??X,t)this.renderCombined(t,n,this.weightFor(t,n),`public issues only`,r);else if(n){this.renderCombined(n,null,1,`agents' queue only`);let e=x(this.publicStart);this.querySelector(`doomsday-clock`).show({hours:null,note:`No reading yet: the public issue tracker starts on ${e}.`}),this.querySelector(`[data-status]`).hidden=!0,this.querySelector(`[data-clock-note]`).textContent=`The clock compares both queues, so it starts when the public issues do.`}}publicStart=``;async renderOutlook(n){let r=this.querySelector(`outlook-panel`);try{let i=await fetch(f,{cache:`no-cache`}),a=i.ok?d(await i.text()):null;if(!a){r.unavailable(`The outlook appears after the next tracker run, which records each class of issue.`);return}let s=a.bug.points,l=s[s.length-1].date,u=await c(a,o,{limits:this.config?.limits,cost:this.config?.cost??null,asOf:n,seed:Number(l.replaceAll(`-`,``))});r.show(u,l,`pending`);let p=await e(t(a),o);r.show(u,l,p)}catch(e){console.warn(`Outlook unavailable:`,e),r.unavailable(`The outlook could not be run in this browser.`)}}renderHealth(e){let t=z(e),n=(e,n,r)=>{this.stat(e,V(n?.medianHours??null)),this.stat(`${e}-note`,t?n&&n.count>0?`median of ${S(n.count)} ${r} in ${t.windowDays} days · 90% within ${V(n.p90Hours)}`:`no ${r} in the last ${t.windowDays} days`:`available after the next tracker run`)};n(`first-response`,t?.firstResponse,`issues answered`),n(`resolution`,t?.resolution,`issues resolved`),t&&t.awaitingResponse>0&&this.stat(`first-response-note`,`${this.querySelector(`[data-stat="first-response-note"]`).textContent} · ${S(t.awaitingResponse)} open with no response`),this.querySelector(`practice-list`).practices=B(e)}renderAgentTrend(e){let t=this.querySelector(`[data-queue-trend]`);if(t.hidden=!e,e){let t=this.querySelector(`[data-trend="agents"]`);t.labels={open:`Open issues`,agentClosed:`Resolved by AI agents`,humanClosed:`Resolved by humans`,totalClosed:`Total resolved`},t.points=e.points}}renderQueues(e,t){let n=e=>({open:e.latest.open,resolved:e.latest.totalClosed,resolvedByAgents:e.latest.agentClosed,resolvedByHumans:e.latest.humanClosed,arrivals:e.velocity.arrivals,agentResolved:e.velocity.agent,humanResolved:e.velocity.human,days:e.velocity.days});this.querySelector(`queue-compare`).comparison={agents:t&&n(t),publicIssues:n(e)},this.stat(`open`,S(e.latest.open+(t?.latest.open??0))),this.stat(`open-note`,t?`${S(e.latest.open)} public issues · ${S(t.latest.open)} in the agents' queue`:`GitHub issues`);let r=t?se(e,t):null;this.stat(`attention`,r===null?`—`:r.toFixed(2)),this.stat(`attention-note`,t?`public issues get ${b(L(e,t))} of resolutions and hold ${b(I(e,t))} of the backlog`:`needs the agents' own queue`)}renderCombined(e,t,n,r=`public issues only`,i){let a=this.querySelector(`doomsday-clock`),o=i?i.clock.mid:M(e,t,n);a.show({hours:o,range:i?{low:i.clock.low,high:i.clock.high}:null,fade:i?.fade??0});let s=ee(o),c=this.querySelector(`[data-status]`);c.dataset.level=s,this.querySelector(`[data-status-icon]`).textContent=Q[s].icon,this.querySelector(`[data-status-label]`).textContent=Q[s].label,c.hidden=!1;let l=t?`public issues ${Math.round(n*100)}%, agents' queue ${Math.round((1-n)*100)}%`:r;this.querySelector(`[data-clock-note]`).textContent=`Weighted: ${l}.`;let u=j(e,t,n),d=e=>{let t=e&&k(e);return t===null?`n/a`:b(t)};this.stat(`share`,b(u)),this.config?.queue?this.stat(`share-note`,`combined · public issues ${d(e)} · agents' queue ${d(t)}`):this.stat(`share-note`,`of ${S(e.latest.totalClosed)} closed issues`);let f=this.dial(`combined`);f.heading=t?`Both queues, weighted`:`Combined: ${r}`,f.open=Math.round(e.latest.open+(t?.latest.open??0)),f.velocity=N(e,t,n);let p=this.loop(`combined`);p.queue=t?`Both queues, weighted`:`Combined: ${r}`,p.caption=`issues opened per issue resolved, weighted across queues`,p.note=t?`Weighted geometric mean of the two queues' ratios: ${l}.`:``,p.open=Math.round(e.latest.open),p.windowDays=e.velocity.days,p.loop=oe(e,t,n)}dial(e){return this.querySelector(`[data-dial="${e}"]`)}loop(e){return this.querySelector(`[data-queue-loop="${e}"]`)}stat(e,t,n=``){let r=this.querySelector(`[data-stat="${e}"]`);r.textContent=t,r.classList.remove(`good`,`bad`),n&&r.classList.add(n)}};customElements.get($.tagName)||customElements.define($.tagName,$);export{$ as DashboardPageComponent};