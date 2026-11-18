import{r as e,u as t}from"./index-4Hn5QvqR.js";import{o as n}from"./metrics-BATIoqxo.js";import{i as r,l as i}from"./report-DsGyZjOC.js";var a=`<main class="page">
  <header class="hero">
    <p class="eyebrow">Best-practice audit · <span data-repo></span></p>
    <h1>Audit</h1>
    <p class="lede">
      How this repository is set up and run, checked against current best
      practice for security, delivery and working with AI agents. Each finding
      says what was found, why it matters, and gives a fix you can copy.
    </p>
  </header>

  <section class="card score" data-score-card aria-live="polite">
    <div class="score-figure">
      <p class="score-value tabular" data-score>—</p>
      <p class="score-unit">out of 100</p>
    </div>
    <div class="score-text">
      <p class="score-line" data-score-line>Loading the audit…</p>
      <div class="score-bar" data-score-bar aria-hidden="true"></div>
      <ul class="counts" data-counts></ul>
      <p class="score-note">
        Weighted by impact: high-impact checks count three times as much as
        low-impact ones. Checks that need history wait until there is enough.
      </p>
    </div>
  </section>

  <div class="filters" role="group" aria-label="Show">
    <button type="button" data-filter="todo" aria-pressed="true">To do</button>
    <button type="button" data-filter="all" aria-pressed="false">All</button>
    <button type="button" data-filter="pass" aria-pressed="false">
      Passing
    </button>
    <button type="button" data-filter="waiting" aria-pressed="false">
      Waiting for data
    </button>
  </div>

  <div class="groups" data-groups></div>
  <p class="empty" data-empty hidden>Nothing here.</p>
</main>
`,o=`:host {
  display: block;
}
:host .page {
  max-width: 980px;
  margin: 0 auto;
  padding: 2.5rem 1rem 4rem;
  display: grid;
  gap: 1.25rem;
}
/* Grid items may shrink below their content (tables, the section links). */
:host .page > * {
  min-width: 0;
}
:host h1 {
  margin: 0.5rem 0 0.75rem;
  font-size: clamp(2rem, 5vw, 2.75rem);
  font-weight: 800;
  letter-spacing: -0.03em;
}
:host .lede {
  margin: 0;
  max-width: 62ch;
  color: var(--ink-2);
  line-height: 1.55;
}
:host .score {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem 2rem;
  align-items: center;
  padding: 1.5rem;
}
:host .score-figure {
  text-align: center;
  min-width: 7rem;
}
:host .score-value {
  margin: 0;
  font-size: 3.5rem;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.04em;
}
:host .score-unit {
  margin: 0.25rem 0 0;
  color: var(--ink-muted);
  font-size: 0.8125rem;
}
:host .score-text {
  flex: 1 1 280px;
  display: grid;
  gap: 0.625rem;
}
:host .score-line {
  margin: 0;
  font-weight: 650;
  font-size: 1.0625rem;
}
:host .score-bar {
  display: flex;
  gap: 2px;
  height: 10px;
  border-radius: 999px;
  overflow: hidden;
  background: var(--surface-2);
}
:host .score-bar span[data-status='pass'] {
  background: var(--good);
}
:host .score-bar span[data-status='improve'] {
  background: var(--warning);
}
:host .score-bar span[data-status='missing'] {
  background: var(--critical);
}
:host .score-bar span[data-status='waiting'] {
  background: var(--axis);
}
:host .counts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem 1.25rem;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 0.875rem;
  color: var(--ink-2);
}
:host .score-note {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--ink-muted);
}
:host .filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
:host .filters button {
  font: inherit;
  font-size: 0.875rem;
  font-weight: 600;
  padding: 0.375rem 0.875rem;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--ink-2);
  cursor: pointer;
}
:host .filters button[aria-pressed='true'] {
  background: var(--ink);
  border-color: var(--ink);
  color: var(--page);
}
:host .groups {
  display: grid;
  gap: 1.75rem;
}
:host .group h2 {
  margin: 0 0 0.75rem;
  font-size: 1.125rem;
}
:host .group-list {
  display: grid;
  gap: 0.75rem;
}
:host .check {
  padding: 1.125rem 1.25rem;
  scroll-margin-top: 5rem;
}
:host .check:target {
  outline: 2px solid var(--series-1);
  outline-offset: 2px;
}
:host .check-head {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 0.75rem;
  align-items: center;
}
:host .check h3 {
  margin: 0;
  font-size: 1rem;
  flex: 1 1 240px;
}
:host .badge {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.1875rem 0.5rem;
  border-radius: 999px;
  border: 1px solid var(--border);
  white-space: nowrap;
}
:host .badge-icon {
  display: inline-grid;
  place-items: center;
  width: 1rem;
  height: 1rem;
  border-radius: 999px;
  font-size: 0.625rem;
  color: #fff;
}
:host .badge[data-status='pass'] .badge-icon {
  background: var(--good);
}
:host .badge[data-status='improve'] .badge-icon {
  background: var(--warning);
  color: #0b0b0b;
}
:host .badge[data-status='missing'] .badge-icon {
  background: var(--critical);
}
:host .badge[data-status='waiting'] .badge-icon {
  background: var(--ink-muted);
}
:host .impact {
  font-size: 0.75rem;
  color: var(--ink-muted);
  white-space: nowrap;
}
:host .check p {
  margin: 0.5rem 0 0;
  line-height: 1.5;
  font-size: 0.9375rem;
}
:host .evidence {
  color: var(--ink-2);
}
:host .why {
  color: var(--ink-2);
}
:host .why strong,
:host .todo strong {
  color: var(--ink);
}
:host .fix {
  margin-top: 0.75rem;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface-2);
  overflow: hidden;
}
:host .fix-summary {
  padding: 0.5rem 0.875rem;
  font-size: 0.875rem;
  font-weight: 650;
  cursor: pointer;
}
:host .fix[open] .fix-summary {
  border-bottom: 1px solid var(--border);
}
:host .fix-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.375rem 0.5rem 0.375rem 0.875rem;
  border-bottom: 1px solid var(--border);
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--ink-2);
}
:host .fix-head code {
  font-size: 0.8125rem;
  overflow-wrap: anywhere;
}
:host .copy {
  font: inherit;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.25rem 0.625rem;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--ink);
  cursor: pointer;
}
:host pre {
  margin: 0;
  padding: 0.75rem 0.875rem;
  overflow-x: auto;
  font-size: 0.8125rem;
  line-height: 1.5;
}
:host .docs {
  font-size: 0.875rem;
}
:host .docs a {
  color: inherit;
  text-underline-offset: 3px;
}
:host .empty {
  color: var(--ink-muted);
}
`,s={pass:{icon:`✓`,label:`Passing`},improve:{icon:`!`,label:`Could improve`},missing:{icon:`✕`,label:`Missing`},waiting:{icon:`…`,label:`Waiting for data`}},c={high:`High impact`,medium:`Medium impact`,low:`Low impact`},l=class extends t{static tagName=`audit-page`;audit=null;filter=`todo`;constructor(){super(a,o)}async init(){this.delegate(`click`,`[data-filter]`,(e,t)=>{this.filter=t.dataset.filter,this.querySelectorAll(`[data-filter]`).forEach(e=>e.setAttribute(`aria-pressed`,String(e===t))),this.drawChecks()}),this.delegate(`click`,`[data-copy]`,(e,t)=>{let n=t.closest(`.fix`)?.querySelector(`code.fix-code`);n&&navigator.clipboard?.writeText(n.textContent??``).then(()=>{t.textContent=`Copied`,window.setTimeout(()=>t.textContent=`Copy`,1600)},()=>t.textContent=`Select and copy`)});let[t,i]=await Promise.all([e(),n()]);this.querySelector(`[data-repo]`).textContent=t.repository,this.audit=r(i?.raw),this.drawScore();let a=decodeURIComponent(location.hash.slice(1));if(a&&this.audit?.checks.some(e=>e.id===a)&&(this.filter=`all`,this.querySelectorAll(`[data-filter]`).forEach(e=>e.setAttribute(`aria-pressed`,String(e.dataset.filter===`all`)))),this.drawChecks(),a){let e=this.querySelector(`[id="${CSS.escape(a)}"]`),t=e?.querySelector(`details.fix`);t&&(t.open=!0),e?.scrollIntoView()}}drawScore(){let e=this.audit,t=(e,t)=>{this.querySelector(e).textContent=t};if(!e){t(`[data-score-line]`,`The audit appears after the next run of the dashboard workflow.`);return}t(`[data-score]`,e.score===null?`—`:String(e.score));let n=t=>e.checks.filter(e=>e.status===t).length,r=i(e.checks).length;t(`[data-score-line]`,`${e.passed} of ${e.judged} checks pass`+(r?` · ${r} to do`:``)+(e.waiting?` · ${e.waiting} waiting for data`:``));let a=[`pass`,`improve`,`missing`,`waiting`];this.querySelector(`[data-score-bar]`).replaceChildren(...a.flatMap(e=>n(e)?[Object.assign(document.createElement(`span`),{style:`flex: ${n(e)} 0 0`})].map(t=>(t.dataset.status=e,t)):[])),this.querySelector(`[data-counts]`).replaceChildren(...a.map(e=>{let t=document.createElement(`li`);return t.textContent=`${s[e].icon} ${n(e)} ${s[e].label.toLowerCase()}`,t}))}drawChecks(){let e=(this.audit?.checks??[]).filter(e=>this.filter===`all`?!0:this.filter===`todo`?e.status===`missing`||e.status===`improve`:e.status===this.filter),t=this.filter===`todo`?i(e):e,n=[...new Set(t.map(e=>e.group))];this.querySelector(`[data-empty]`).hidden=t.length>0||!this.audit,this.querySelector(`[data-groups]`).replaceChildren(...n.map(e=>{let n=document.createElement(`section`);n.className=`group`;let r=document.createElement(`h2`);r.textContent=e;let i=document.createElement(`div`);return i.className=`group-list`,i.append(...t.filter(t=>t.group===e).map(e=>this.card(e))),n.append(r,i),n}))}card(e){let t=(e,t=``,n=``)=>{let r=document.createElement(e);return t&&(r.className=t),n&&(r.textContent=n),r},n=t(`article`,`card check`);n.id=e.id,n.dataset.status=e.status;let r=t(`header`,`check-head`),i=t(`span`,`badge`);i.dataset.status=e.status;let a=t(`span`,`badge-icon`,s[e.status].icon);if(a.setAttribute(`aria-hidden`,`true`),i.append(a,s[e.status].label),r.append(t(`h3`,``,e.title),i,t(`span`,`impact`,c[e.impact])),n.append(r,t(`p`,`evidence`,e.evidence)),e.why){let r=t(`p`,`why`);r.append(t(`strong`,``,`Why it matters: `),e.why),n.append(r)}if(e.recommendation){let r=t(`p`,`todo`);r.append(t(`strong`,``,`What to do: `),e.recommendation),n.append(r)}for(let r of e.fixes){let e=t(`details`,`fix`),i=t(`summary`,`fix-summary`);i.append(r.path?`Show the fix: add ${r.path}`:r.language===`shell`?`Show the command`:`Show the snippet`);let a=t(`div`,`fix-head`),o=t(`span`);r.path?o.append(`Add `,t(`code`,``,r.path)):o.textContent=r.language===`shell`?`Run`:`Add to the workflow`;let s=t(`button`,`copy`,`Copy`);s.type=`button`,s.dataset.copy=``,s.setAttribute(`aria-label`,`Copy ${r.path||(r.language===`shell`?`the command`:`the snippet`)}`),a.append(o,s);let c=t(`pre`),l=t(`code`,`fix-code`,r.content);l.dataset.language=r.language,c.append(l),e.append(i,a,c),n.append(e)}if(e.docs){let r=t(`p`,`docs`),i=t(`a`,``,`Documentation`);i.href=e.docs,i.target=`_blank`,i.rel=`noopener noreferrer`,r.append(i),n.append(r)}return n}};customElements.get(l.tagName)||customElements.define(l.tagName,l);export{l as AuditPageComponent,s as STATUS_LABEL};