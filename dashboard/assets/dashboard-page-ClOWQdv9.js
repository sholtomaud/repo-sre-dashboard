import{a as e,c as t,l as n,n as r,o as i,r as a,s as o,t as s,u as c}from"./index-kWKZl1p4.js";import{a as l,d as u,i as d,l as f,r as p,s as m,u as h}from"./metrics-BATIoqxo.js";import{a as g,c as _,n as v,o as y,r as b,s as x,t as S}from"./format-DYYxeEu5.js";import{t as C}from"./svg-DZDJgajS.js";import{a as w,i as T,n as E,r as D}from"./health-RCxkCncK.js";import{a as O,c as k,i as A,n as j,o as M,s as N,t as P}from"./report-DsGyZjOC.js";import{formatFrequency as F}from"./delivery-panel-CytEBUwu.js";import"./trend-chart-CRRjqxja.js";import"./closure-evidence-CDmt__id.js";import"./pull-panel-iSFBHBe9.js";import"./outlook-panel-CJ1w6ITJ.js";import"./class-table-GTZ8DvGk.js";import"./repo-profile-B5WenetP.js";function I(e){if(!e.closures)return null;let t=Object.values(e.closures).reduce((e,t)=>e+t,0);return{total:t,byEvidence:e.closures,referencedShare:t>0?e.closures.fix_referenced/t:0}}function L(e,t=7,n){let[r=``,...i]=e.trim().split(/\r?\n/),a=r.split(`,`).map(e=>e.trim()),o=e=>a.indexOf(e),[s,c,l]=[`date`,`open`,`resolved`].map(o),m=o(`resolved_by_human`);if(s===-1||c===-1||l===-1||i.length===0)return null;let g=i.map(e=>{let t=e.split(`,`).map(e=>e.trim()),n=m===-1?0:Number(t[m])||0,r=Number(t[l])-n;return`${t[s]},${t[c]},${r},${n}`}),_=h(f([`date,open,agent_closed,human_closed`,...g].join(`
`))),v=_[_.length-1],y=u(_,t,n);return{date:v.date,open:v.open,resolved:v.totalClosed,points:_,velocity:y,ratio:d(y),loop:p(_,t,n)}}async function R(e,t=fetch,n=`data/agent_queue.csv`){try{let r=await t(n,{cache:`no-cache`});return r.ok?L(await r.text(),7,e):null}catch{return null}}var z=`<main class="page">
  <header class="hero">
    <div>
      <p class="eyebrow">
        Repository health ·
        <a
          data-tracked-link
          class="hero-link"
          target="_blank"
          rel="noopener noreferrer"
        ></a>
      </p>
      <h1 data-title>Repository health</h1>
      <p class="lede" data-lede>
        Issues and pull requests, who resolves them (AI agents or people), how
        fast changes are delivered, where the backlog is heading, and how to set
        the repository up to do better.
      </p>
    </div>
    <p class="as-of" data-as-of role="status">Loading the latest numbers…</p>
  </header>

  <nav class="jump" aria-label="Sections">
    <a href="#overview">Overview</a>
    <a href="#outlook">Outlook</a>
    <a href="#issues">Issues</a>
    <a href="#agents">Pull requests and agents</a>
    <a href="#delivery">Delivery</a>
    <a href="#codebase">Codebase</a>
    <a href="/audit" class="jump-audit">Audit →</a>
  </nav>

  <section id="overview" class="section" data-content aria-busy="true">
    <h2 class="sr-only">Overview</h2>
    <div class="kpis" data-kpis></div>
    <article class="card attention">
      <header class="attention-head">
        <h3>What needs attention</h3>
        <a href="/audit" class="attention-link" data-audit-link
          >Full audit<span data-audit-score></span
        ></a>
      </header>
      <ul class="findings" data-findings>
        <li class="finding" data-tone="neutral">Loading…</li>
      </ul>
    </article>
  </section>

  <section id="outlook" class="section">
    <outlook-panel></outlook-panel>
  </section>

  <section id="issues" class="section">
    <header class="section-head">
      <h2>Issues</h2>
      <p>
        The backlog over time, the facts for each class, and how issues are
        closed.
      </p>
    </header>
    <article class="card panel">
      <header class="panel-head">
        <h3>Open and resolved over time</h3>
        <p>
          Open issues, and running totals resolved by AI agents and by people.
        </p>
      </header>
      <trend-chart data-trend="public"></trend-chart>
    </article>
    <class-table></class-table>
    <closure-evidence></closure-evidence>
  </section>

  <section id="agents" class="section">
    <header class="section-head">
      <h2>Pull requests and agents</h2>
      <p>
        Who writes the changes and resolves the issues: AI agents or people.
      </p>
    </header>
    <pull-panel hidden></pull-panel>
    <article class="card panel" data-queue-trend hidden>
      <header class="panel-head">
        <h3 data-queue-title>Agents' own queue</h3>
        <p>
          The agents' file-based issue queue: open issues and running totals
          resolved.
        </p>
      </header>
      <trend-chart data-trend="agents"></trend-chart>
    </article>
  </section>

  <section id="delivery" class="section">
    <delivery-panel hidden></delivery-panel>
  </section>

  <section id="codebase" class="section">
    <repo-profile hidden></repo-profile>
  </section>

  <footer class="foot">
    <a data-csv-link>Download data.csv</a>
    <a href="/methodology">How it is measured</a>
    <a data-project-link target="_blank" rel="noopener noreferrer"
      >Repo SRE Dashboard</a
    >
  </footer>
</main>
`,B=`:host {
  display: block;
}
:host .page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2.5rem 1rem 3rem;
  display: grid;
  gap: 1.5rem;
}
@media (min-width: 640px) {
  :host .page {
    padding: 3rem 1.5rem 4rem;
  }
}
/* Grid items may shrink below their content (tables, the section links). */
:host .page > *,
:host .section > * {
  min-width: 0;
}
:host .hero {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem 2rem;
}
:host h1 {
  margin: 0.5rem 0 0.75rem;
  font-size: clamp(1.875rem, 4.5vw, 2.75rem);
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.1;
  overflow-wrap: anywhere;
}
:host .lede {
  margin: 0;
  max-width: 62ch;
  color: var(--ink-2);
  font-size: 1.0625rem;
  line-height: 1.55;
}
:host .hero-link {
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 3px;
}
:host .as-of {
  margin: 0;
  color: var(--ink-muted);
  font-size: 0.875rem;
}
:host .as-of.error {
  color: var(--critical-ink);
}

/* Section links: scroll sideways on narrow screens rather than wrap. */
:host .jump {
  position: sticky;
  top: 3.75rem;
  z-index: 5;
  display: flex;
  gap: 0.25rem;
  overflow-x: auto;
  margin: 0 -0.25rem;
  padding: 0.375rem 0.25rem;
  background: var(--nav-bg);
  backdrop-filter: blur(8px);
  scrollbar-width: none;
}
:host .jump a {
  flex: none;
  padding: 0.375rem 0.75rem;
  border-radius: 999px;
  color: var(--ink-2);
  font-size: 0.875rem;
  font-weight: 600;
  text-decoration: none;
}
:host .jump a:hover {
  background: var(--surface-2);
  color: var(--ink);
}
:host .jump .jump-audit {
  margin-left: auto;
  color: var(--ink);
  border: 1px solid var(--border);
  background: var(--surface);
}

:host .section {
  display: grid;
  gap: 1rem;
  scroll-margin-top: 7rem;
}
:host .section-head h2 {
  margin: 0.75rem 0 0.25rem;
  font-size: 1.375rem;
  letter-spacing: -0.015em;
}
:host .section-head p {
  margin: 0;
  color: var(--ink-2);
}
:host .panel {
  padding: 1.25rem 1.5rem;
}

/* Key figures. */
:host .kpis {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 250px), 1fr));
}
:host .kpi {
  display: grid;
  gap: 0.25rem;
  align-content: start;
  padding: 1rem 1.125rem;
  color: inherit;
  text-decoration: none;
  transition: border-color 0.15s;
}
:host a.kpi:hover {
  border-color: var(--axis);
}
:host .kpi p {
  margin: 0;
}
:host .kpi-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--ink-2);
}
:host .kpi-value {
  font-size: 2rem;
  font-weight: 750;
  letter-spacing: -0.025em;
  line-height: 1.15;
}
:host .kpi-verdict {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.875rem;
  font-weight: 650;
}
:host .kpi-note {
  font-size: 0.8125rem;
  color: var(--ink-muted);
  line-height: 1.4;
}
:host .kpi-spark {
  height: 28px;
  margin-top: 0.25rem;
}
:host .kpi-spark svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}

/* Tone: an icon and words carry the meaning; colour only reinforces it. */
:host .tone-icon {
  display: inline-grid;
  place-items: center;
  flex: none;
  width: 1.125rem;
  height: 1.125rem;
  border-radius: 999px;
  font-size: 0.6875rem;
  font-weight: 800;
  color: #fff;
  background: var(--ink-muted);
}
:host [data-tone='good'] .tone-icon {
  background: var(--good);
}
:host [data-tone='warn'] .tone-icon {
  background: var(--warning);
  color: #0b0b0b;
}
:host [data-tone='bad'] .tone-icon {
  background: var(--critical);
}
:host .kpi-verdict[data-tone='good'] {
  color: var(--good-ink);
}
:host .kpi-verdict[data-tone='bad'] {
  color: var(--critical-ink);
}

/* What needs attention. */
:host .attention {
  padding: 1.125rem 1.5rem 1.25rem;
}
:host .attention-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem 1rem;
}
:host .attention-head h3 {
  margin: 0;
  font-size: 1.0625rem;
}
:host .attention-link {
  font-size: 0.875rem;
  font-weight: 650;
  color: inherit;
  text-underline-offset: 3px;
}
:host .findings {
  display: grid;
  gap: 0.5rem;
  margin: 0.875rem 0 0;
  padding: 0;
  list-style: none;
}
:host .finding {
  display: flex;
  align-items: flex-start;
  gap: 0.625rem;
  line-height: 1.45;
}
:host .finding .tone-icon {
  margin-top: 0.125rem;
}
:host .finding a {
  color: inherit;
  text-decoration: none;
}
:host .finding a:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

:host .foot {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border);
  font-size: 0.875rem;
}
:host .foot a {
  color: var(--ink-2);
  text-underline-offset: 3px;
}
`,V={good:`✓`,warn:`!`,bad:`✕`,neutral:`·`},H=class extends c{static tagName=`dashboard-page`;config=null;constructor(){super(z,B)}async init(){let e=await a();this.config=e;let t=this.querySelector(`[data-tracked-link]`);t.href=e.repositoryUrl||e.issuesUrl,t.textContent=e.repository,this.querySelector(`[data-title]`).textContent=e.title,this.querySelector(`[data-csv-link]`).href=s,this.querySelector(`[data-project-link]`).href=r;let n=this.querySelector(`[data-as-of]`);try{this.render(await l())}catch(e){n.classList.add(`error`),n.textContent=`Could not load the data: ${e.message}`}}render(e){let t=e.status,n=t?.raw,r=t&&m(t);this.querySelector(`[data-as-of]`).textContent=t?`Data as of ${b(t.updatedAt)} · updated ${t.schedule.description}`+(r?` · next around ${_(r)}`:``):`Data as of ${v(e.latest.date)} (UTC)`;let i=k(n);i?.description&&(this.querySelector(`[data-lede]`).textContent=i.description);let a=M(n),o=O(n),s=N(n),c=A(n),l=T(n),u=w(n),d=I(e.latest);this.renderKpis(e,{classes:a,delivery:s,audit:c,pulls:l,responses:u,closures:d}),this.renderFindings(j({classes:a,ci:o,flowRatio:e.doomLoop.ratio,audit:c}));let f=this.querySelector(`[data-audit-score]`);f.textContent=c?.score==null?``:` · ${c.score}/100`,this.querySelector(`[data-trend="public"]`).points=e.history,this.querySelector(`class-table`).classes=a;let p=this.querySelector(`closure-evidence`);p.closures=d,p.issues=t?.issues,p.update(),this.querySelector(`pull-panel`).pulls=l,this.querySelector(`delivery-panel`).show(s,o),this.querySelector(`repo-profile`).profile=i,this.querySelector(`[data-content]`).setAttribute(`aria-busy`,`false`),this.renderAgentQueue(t?.updatedAt),window.setTimeout(()=>this.renderOutlook(t?.updatedAt),80)}renderKpis(e,t){let{latest:n,velocity:r,history:i}=e,a=i.slice(-90),o=[],s=e.doomLoop.ratio;o.push({label:`Open issues`,value:S(n.open),verdict:r.days>0?{tone:e.openDelta>0?`warn`:e.openDelta<0?`good`:`neutral`,text:e.openDelta===0?`No change in ${Math.round(r.days)} days`:`${x(e.openDelta)} in ${Math.round(r.days)} days`}:void 0,note:`${S(n.totalClosed)} resolved of ${S(n.created)} ever opened`,spark:a.map(e=>e.open),href:`#issues`}),o.push({label:`Opened per issue closed`,value:s===null?`—`:s===1/0?`∞`:s.toFixed(2),verdict:s===null?{tone:`neutral`,text:`No activity in the last week`}:s===1/0?{tone:`bad`,text:`Issues arrive, none are closed`}:s<=.9?{tone:`good`,text:`Backlog shrinking`}:s<=1.1?{tone:`good`,text:`Keeping pace`}:s<=1.5?{tone:`warn`,text:`Falling behind`}:{tone:`bad`,text:`Falling well behind`},note:`${y(r.arrivals)} opened and ${y(r.agent+r.human)} closed a day, last ${Math.round(r.days)||7} days`,spark:e.doomLoop.history.slice(-90).map(e=>e.ratio===null?1:Math.min(e.ratio===1/0?3:e.ratio,3)),href:`#outlook`});let c=t.classes?P.reduce((e,n)=>e+t.classes[n].overLimit,0):null,l=t.responses?.resolution;o.push({label:`Time to resolve`,value:D(l?.medianHours??null),verdict:c===null?void 0:c>0?{tone:`bad`,text:`${S(c)} open past ${c===1?`its`:`their`} limit`}:{tone:`good`,text:`All open issues within limits`},note:l?.count?`median of ${S(l.count)} in ${t.responses.windowDays} days · 90% within ${D(l.p90Hours)}`:`no issues resolved recently`,href:`#issues`});let u=t.responses?.firstResponse,d=t.responses?.awaitingResponse??0;o.push({label:`Time to first response`,value:D(u?.medianHours??null),verdict:t.responses?d>0?{tone:`warn`,text:`${S(d)} open with no reply`}:{tone:`good`,text:`Every open issue has a reply`}:void 0,note:u?.count?`median of ${S(u.count)} issues answered in ${t.responses.windowDays} days`:`no replies recorded recently`,href:`#issues`});let f=n.totalClosed?n.agentClosed/n.totalClosed:null,p=t.pulls?E(t.pulls):null;o.push({label:`Resolved by AI agents`,value:f===null?`—`:g(f),note:`${S(n.agentClosed)} of ${S(n.totalClosed)} closed issues`+(p===null?``:` · ${g(p)} of merged pull requests had an agent's hand`),spark:a.map(e=>e.totalClosed?e.agentClosed/e.totalClosed:0),href:`#agents`});let m=t.closures?.referencedShare??null;o.push({label:`Closures with a linked fix`,value:m===null?`—`:g(m),verdict:m===null?void 0:m>=.8?{tone:`good`,text:`Closures can be verified`}:m>=.5?{tone:`warn`,text:`Many closures unverified`}:{tone:`bad`,text:`Most closures unverified`},note:t.closures?`${S(t.closures.byEvidence.fix_referenced)} of ${S(t.closures.total)} closures reference a commit, pull request or release`:`available after the next tracker run`,href:`#issues`});let h=t.delivery;h&&o.push({label:`Deployment frequency`,value:F(h.frequency.value??0),verdict:h.frequency.band?{tone:{elite:`good`,high:`good`,medium:`warn`,low:`bad`}[h.frequency.band],text:`DORA ${h.frequency.band}`}:void 0,note:`${S(h.frequency.count)} ${h.frequency.basis} in ${h.windowDays} days · lead time ${D(h.leadTimeHours.value)}`,href:`#delivery`});let _=t.audit;_&&o.push({label:`Best-practice audit`,value:_.score===null?`—`:`${_.score}/100`,verdict:_.score===null?void 0:{tone:_.score>=80?`good`:_.score>=50?`warn`:`bad`,text:`${_.passed} of ${_.judged} checks pass`},note:_.waiting>0?`${_.waiting} more checks judged once there is history`:`every check judged`,href:`/audit`}),this.querySelector(`[data-kpis]`).replaceChildren(...o.map(e=>this.kpi(e)))}kpi(e){let t=document.createElement(e.href?`a`:`div`);t.className=`card kpi`,e.href&&(t.href=e.href),t.dataset.kpi=e.label;let n=(e,t)=>{let n=document.createElement(`p`);return n.className=e,n.textContent=t,n};if(t.append(n(`kpi-label`,e.label),n(`kpi-value tabular`,e.value)),e.verdict){let r=n(`kpi-verdict`,``);r.dataset.tone=e.verdict.tone;let i=document.createElement(`span`);i.className=`tone-icon`,i.setAttribute(`aria-hidden`,`true`),i.textContent=V[e.verdict.tone],r.append(i,e.verdict.text),t.append(r)}return t.append(n(`kpi-note`,e.note)),e.spark&&e.spark.length>2&&t.append(U(e.spark)),t}renderFindings(e){let t=e.length?e.map(e=>{let t=document.createElement(`li`);t.className=`finding`,t.dataset.tone=e.tone;let n=document.createElement(`span`);n.className=`tone-icon`,n.setAttribute(`aria-hidden`,`true`),n.textContent=V[e.tone];let r=document.createElement(`a`);return r.href=e.href,r.textContent=e.text,t.append(n,r),t}):[Object.assign(document.createElement(`li`),{className:`finding`,textContent:`Nothing urgent: no issues past their limits, CI is green, and the audit has no open items.`})];this.querySelector(`[data-findings]`).replaceChildren(...t)}async renderAgentQueue(e){let t=this.querySelector(`[data-queue-trend]`);if(!this.config?.queue)return;let n=await R(e);if(t.hidden=!n,!n)return;this.querySelector(`[data-queue-title]`).textContent=this.config.queue.name;let r=this.querySelector(`[data-trend="agents"]`);r.labels={open:`Open issues`,agentClosed:`Resolved by AI agents`,humanClosed:`Resolved by people`,totalClosed:`Total resolved`},r.points=n.points}async renderOutlook(r){let a=this.querySelector(`outlook-panel`);try{let c=await fetch(s,{cache:`no-cache`}),l=c.ok?o(await c.text()):null;if(!l){a.unavailable(`The outlook appears after the next tracker run, which records each class of issue.`);return}let u=l.bug.points,d=u[u.length-1].date,f=await i(l,n,{limits:this.config?.limits,cost:this.config?.cost??null,asOf:r,seed:Number(d.replaceAll(`-`,``))});a.show(f,d,`pending`);let p=await e(t(l),n);a.show(f,d,p)}catch(e){console.warn(`Outlook unavailable:`,e),a.unavailable(`The outlook could not be run in this browser.`)}}};function U(e){let t=document.createElement(`div`);t.className=`kpi-spark`;let n=C(`svg`,{viewBox:`0 0 100 28`,preserveAspectRatio:`none`,"aria-hidden":`true`}),r=Math.min(...e),i=Math.max(...e)-r||1,a=t=>t/(e.length-1)*100,o=e=>25-(e-r)/i*22;return C(`path`,{d:e.map((e,t)=>`${t?`L`:`M`} ${a(t)} ${o(e)}`).join(` `),fill:`none`,stroke:`var(--series-1)`,"stroke-width":2,"vector-effect":`non-scaling-stroke`,"stroke-linejoin":`round`},n),t.append(n),t}customElements.get(H.tagName)||customElements.define(H.tagName,H);export{H as DashboardPageComponent};