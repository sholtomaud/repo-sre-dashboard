import{d as e,i as t}from"./index-CgDyoNcz.js";import{a as n,n as r,s as i,t as a}from"./format-0i7eZnoE.js";import{r as o}from"./svg-BJXHUiNH.js";var s=`<article class="card outlook" data-outlook>
  <header class="outlook-head">
    <div>
      <h2>Project outlook</h2>
      <p>
        Will this repository stay manageable? Each class of issue has a limit on
        how long a new issue may wait. Simulated with GSSK from the last week's
        rates.
      </p>
    </div>
  </header>
  <p class="outlook-pending" data-pending>Running the simulation…</p>
  <div class="outlook-body" data-body hidden>
    <section class="outlook-index">
      <p class="index-label">Manageability index</p>
      <p class="index-value tabular" data-index></p>
      <p class="index-text" data-index-text></p>
      <p class="index-state" data-state>
        <span class="state-icon" data-state-icon aria-hidden="true"></span>
        <span data-state-label></span>
      </p>
    </section>
    <dl class="outlook-cards">
      <div class="outlook-card">
        <dt>Loses control</dt>
        <dd class="card-value" data-doom-all></dd>
        <dd class="card-note" data-doom-all-note></dd>
        <dd class="card-curve" data-curve-all></dd>
      </div>
      <div class="outlook-card">
        <dt>With humans alone</dt>
        <dd class="card-value" data-doom-humans></dd>
        <dd class="card-note" data-doom-humans-note></dd>
        <dd class="card-curve" data-curve-humans></dd>
      </div>
      <div class="outlook-card">
        <dt>Backlog cleared</dt>
        <dd class="card-value" data-completion></dd>
        <dd class="card-note" data-completion-note></dd>
      </div>
      <div class="outlook-card">
        <dt>Agents</dt>
        <dd class="card-value" data-agents></dd>
        <dd class="card-note" data-agents-note></dd>
      </div>
    </dl>
    <table class="outlook-classes">
      <caption>
        Each class now
      </caption>
      <thead>
        <tr>
          <th scope="col">Class</th>
          <th scope="col">Open</th>
          <th scope="col">Resolved a day</th>
          <th scope="col">Expected wait</th>
          <th scope="col">Limit</th>
          <th scope="col">Status</th>
        </tr>
      </thead>
      <tbody data-classes></tbody>
    </table>
    <p class="outlook-line" data-cost></p>
    <p class="outlook-line" data-reliability></p>
  </div>
</article>
`,c=`:host {
  display: block;
}
:host .outlook {
  padding: 1.25rem;
}
@media (min-width: 640px) {
  :host .outlook {
    padding: 1.5rem 1.75rem 1.75rem;
  }
}
:host h2 {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
}
:host p {
  margin: 0;
}
:host .outlook-head p {
  margin-top: 0.25rem;
  max-width: 80ch;
  font-size: 0.8125rem;
  color: var(--ink-muted);
}
:host .outlook-pending {
  margin-top: 1rem;
  font-size: 0.875rem;
  color: var(--ink-muted);
}
:host .outlook-body {
  display: grid;
  gap: 1.5rem;
  margin-top: 1.25rem;
}
:host .outlook-body[hidden] {
  display: none;
}
@media (min-width: 960px) {
  :host .outlook-body {
    grid-template-columns: 15rem 1fr;
    column-gap: 2rem;
  }
  :host .outlook-classes,
  :host .outlook-line {
    grid-column: 1 / -1;
  }
}
:host .index-label {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--ink-2);
}
:host .index-value {
  margin-top: 0.25rem !important;
  font-size: 3.5rem;
  font-weight: 800;
  letter-spacing: -0.04em;
  line-height: 1;
}
:host .index-text {
  margin-top: 0.375rem !important;
  font-size: 0.875rem;
  color: var(--ink-2);
}
:host .index-state {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.75rem !important;
  padding: 0.3rem 0.75rem 0.3rem 0.4rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  font-size: 0.8125rem;
  font-weight: 700;
}
:host .state-icon {
  display: inline-grid;
  place-items: center;
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 999px;
  color: #fff;
  font-size: 0.75rem;
  font-weight: 800;
}
:host [data-state='secure'] .state-icon {
  background: var(--good);
}
:host [data-state='holding'] .state-icon {
  background: var(--warning);
  color: #0b0b0b;
}
:host [data-state='risk'] .state-icon {
  background: var(--serious);
}
:host [data-state='lost'] .state-icon {
  background: var(--critical);
}
:host .outlook-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(12rem, 100%), 1fr));
  gap: 1rem;
  margin: 0;
}
:host .outlook-card {
  display: grid;
  grid-row: span 4;
  grid-template-rows: subgrid;
  row-gap: 0;
  align-items: start;
  padding: 0.875rem 1rem;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface-2);
}
:host .outlook-card dt {
  font-size: 0.8125rem;
  color: var(--ink-2);
}
:host .outlook-card dd {
  margin: 0;
}
:host .card-value {
  margin-top: 0.25rem !important;
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1.2;
}
:host .card-note {
  margin-top: 0.25rem !important;
  font-size: 0.8125rem;
  color: var(--ink-muted);
}
:host .card-curve svg {
  display: block;
  width: 100%;
  height: 28px;
  margin-top: 0.5rem;
}
:host .outlook-classes {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
}
:host .outlook-classes caption {
  margin-bottom: 0.5rem;
  font-size: 0.8125rem;
  font-weight: 700;
  text-align: left;
}
:host .outlook-classes th,
:host .outlook-classes td {
  padding: 0.4rem 0.75rem;
  border-bottom: 1px solid var(--grid);
  text-align: right;
}
:host .outlook-classes th:first-child,
:host .outlook-classes td:first-child,
:host .outlook-classes th:last-child,
:host .outlook-classes td:last-child {
  text-align: left;
}
:host .outlook-classes th {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--ink-muted);
}
:host .class-status[data-status='over'] {
  color: var(--critical-ink);
  font-weight: 700;
}
:host .class-status[data-status='within'] {
  color: var(--good-ink);
  font-weight: 600;
}
:host .class-status[data-status='unjudged'] {
  color: var(--ink-muted);
}
:host .outlook-line {
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--ink-2);
}
@media (max-width: 640px) {
  :host .outlook-classes th:nth-child(3),
  :host .outlook-classes td:nth-child(3) {
    display: none;
  }
}
`,l={security:`Security`,bug:`Bugs`,other:`Features and other`},u={secure:{icon:`✓`,label:`In control`},holding:{icon:`!`,label:`Holding, with risk`},risk:{icon:`!`,label:`Likely to lose control`},lost:{icon:`✕`,label:`Control already lost`}},d=e=>`${Math.round(e*100)}%`,f=e=>Number.isFinite(e)?e<1?`${Math.round(e*24)} h`:`${Number.isInteger(e)?e:i(e)} ${e===1?`day`:`days`}`:`never`,p=class extends e{static tagName=`outlook-panel`;constructor(){super(s,c)}unavailable(e){this.isConnected&&(this.querySelector(`[data-pending]`).textContent=e)}show(e,o,s){if(!this.isConnected)return;let c=e=>r(new Date(Date.parse(o)+e*864e5).toISOString().slice(0,10)),p=(e,t)=>{this.querySelector(e).textContent=t};this.querySelector(`[data-pending]`).hidden=!0,this.querySelector(`[data-body]`).hidden=!1;let h=c(e.horizonDay);p(`[data-index]`,d(e.index)),p(`[data-index-text]`,`chance of staying manageable to ${h}, where the forecast stops being better than a guess`);let g=e.doom.all.day===0?`lost`:e.index>=.9?`secure`:e.index>=.5?`holding`:`risk`;this.querySelector(`[data-state]`).dataset.state=g,p(`[data-state-icon]`,u[g].icon),p(`[data-state-label]`,u[g].label);let _=(t,n)=>{let r=e.doom[t];p(`[data-doom-${t}]`,r.day===0?`Now`:r.day===null?`Not by ${h}`:c(r.day)),p(`[data-doom-${t}-note]`,r.day===0?`a class is already past its limit ${n}`:r.day===null?`${d(r.byHorizon)} chance by then ${n}`:`50% chance by then ${n}; ${d(r.byHorizon)} by ${h}`),this.curve(`[data-curve-${t}]`,r.day===0?[]:r.curve)};_(`all`,`with agents and humans`),_(`humans`,`with people alone`);let v=e.completion;p(`[data-completion]`,v.state===`diverging`?`Diverging`:v.state===`beyond`?`Not within ${v.days} days`:c(v.p50)),p(`[data-completion-note]`,v.state===`diverging`?`issues arrive at least as fast as they are resolved, so there is no completion date`:v.state===`beyond`?`fewer than half the simulations clear it`:v.p85===null?`50% chance by then`:`50% chance by then; 85% by ${c(v.p85)}`);let y=e.agents;p(`[data-agents]`,{benefit:`A benefit`,burden:`A burden`,neutral:`No clear effect`,none:`No agent activity`}[y.verdict]),p(`[data-agents-note]`,y.verdict===`none`?`no issues filed or resolved by agents in the last week`:`chance of losing control by ${h}: ${d(y.withAgents)} with agents, ${d(y.withoutAgents)} without; median backlog ${a(y.openWith)} with, ${a(y.openWithout)} without`),this.querySelector(`[data-classes]`).replaceChildren(...t.map(t=>{let n=e.now[t],r=e.judged.includes(t),o=document.createElement(`tr`),s=r?n.over?`over`:`within`:`unjudged`,c=[l[t],a(Math.max(0,n.open)),i(n.resolvedPerDay),r?f(n.waitDays):`—`,f(n.limitDays),s===`unjudged`?`No issues yet`:s===`over`?`✕ Over limit`:`✓ Within limit`];return c.forEach((e,t)=>{let n=document.createElement(`td`);n.textContent=e,t===c.length-1&&(n.className=`class-status`,n.dataset.status=s),o.append(n)}),o.dataset.class=t,o}));let b=e.cost;p(`[data-cost]`,b?`Cost: about ${n(b.monthlySpendNow,b.currency)} a month at today's resolution rate; keeping pace with new issues would take ${n(b.monthlyToKeepPace,b.currency)} a month.`+m(e,`human`,h,c)+m(e,`agentic`,h,c):`Cost: set the agent-cost-per-issue and human-hourly-rate inputs to see what resolving issues costs, and when it would outrun a budget.`),p(`[data-reliability]`,s===`pending`?`Reliability: checking past forecasts…`:s?`Reliability: ${s.inside} of ${s.checked} past 7-day forecasts of the backlog landed inside their 90% range (${d(s.inside/s.checked)}).`:`Reliability: needs at least two weeks of history to check past forecasts.`)}curve(e,t){let n=this.querySelector(e);if(t.length<2){n.replaceChildren();return}let r=o(`svg`,{viewBox:`0 0 100 28`,preserveAspectRatio:`none`,"aria-hidden":`true`}),i=e=>e/(t.length-1)*100,a=e=>26-e*24;o(`line`,{x1:0,x2:100,y1:a(.5),y2:a(.5),stroke:`var(--axis)`,"stroke-width":1,"vector-effect":`non-scaling-stroke`,"stroke-dasharray":`2 2`},r),o(`path`,{d:t.map((e,t)=>`${t?`L`:`M`} ${i(t)} ${a(e)}`).join(` `),fill:`none`,stroke:`var(--critical)`,"stroke-width":2,"vector-effect":`non-scaling-stroke`},r),n.replaceChildren(r)}};function m(e,t,n,r){let i=t===`human`?`People's`:`Agents'`,a=t===`human`?`monthly-human-budget`:`monthly-agentic-budget`,o=e.doom.cost?.[t]??null;return o?o.day===null?` ${i} budget holds to ${n} (${d(o.byHorizon)} chance of exceeding it).`:` Keeping pace is likely to exceed ${i.toLowerCase()} budget by ${r(o.day)}.`:` Set ${a} to forecast when ${i.toLowerCase()} budget would be exceeded.`}customElements.get(p.tagName)||customElements.define(p.tagName,p);export{p as OutlookPanelComponent};