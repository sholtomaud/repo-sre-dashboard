import{h as e}from"./index-DMsLPmzK.js";var t=`<article class="card practices">
  <header class="practices-head">
    <h2>Get more from this dashboard</h2>
    <p>
      How much the dashboard can measure depends on how the repository is run.
      These checks say what it found and what would let it measure more.
    </p>
  </header>
  <p class="practices-score" data-score></p>
  <ul class="practice-items" data-items></ul>
  <template data-item-template>
    <li class="practice" data-status>
      <span class="practice-icon" data-icon aria-hidden="true"></span>
      <div class="practice-body">
        <p class="practice-title">
          <strong data-title></strong>
          <span class="practice-status" data-status-label></span>
        </p>
        <p class="practice-evidence" data-evidence></p>
        <p class="practice-advice" data-advice hidden>
          <span data-recommendation></span>
          <a data-docs target="_blank" rel="noopener noreferrer">How to</a>
        </p>
      </div>
    </li>
  </template>
</article>
`,n=`:host {
  display: block;
}
:host .practices {
  padding: 1.25rem;
}
@media (min-width: 640px) {
  :host .practices {
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
:host .practices-head p {
  margin-top: 0.25rem;
  max-width: 78ch;
  font-size: 0.8125rem;
  color: var(--ink-muted);
}
:host .practices-score {
  margin-top: 1rem;
  font-size: 0.9375rem;
  font-weight: 650;
}
:host .practice-items {
  list-style: none;
  margin: 1rem 0 0;
  padding: 0;
  display: grid;
  gap: 0.75rem;
}
@media (min-width: 900px) {
  :host .practice-items {
    grid-template-columns: 1fr 1fr;
    column-gap: 2rem;
  }
}
:host .practice {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.75rem;
  padding: 0.75rem 0;
  border-top: 1px solid var(--grid);
}
:host .practice-icon {
  display: inline-grid;
  place-items: center;
  width: 1.375rem;
  height: 1.375rem;
  border-radius: 999px;
  color: #fff;
  font-size: 0.75rem;
  font-weight: 800;
}
:host .practice[data-status='pass'] .practice-icon {
  background: var(--good);
}
:host .practice[data-status='improve'] .practice-icon {
  background: var(--warning);
  color: #0b0b0b;
}
:host .practice[data-status='missing'] .practice-icon {
  background: var(--critical);
}
:host .practice[data-status='unknown'] .practice-icon {
  background: var(--ink-muted);
}
:host .practice-title {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.25rem 0.625rem;
  font-size: 0.9375rem;
}
:host .practice-status {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--ink-muted);
}
:host .practice-evidence {
  margin-top: 0.125rem;
  font-size: 0.8125rem;
  color: var(--ink-muted);
}
:host .practice-advice {
  margin-top: 0.375rem;
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--ink-2);
}
:host .practice-advice[hidden] {
  display: none;
}
:host .practice-advice a {
  margin-left: 0.25rem;
  color: var(--ink);
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 3px;
}
`,r={pass:{icon:`✓`,label:`In place`},improve:{icon:`!`,label:`Could improve`},missing:{icon:`✕`,label:`Missing`},unknown:{icon:`?`,label:`Not enough data yet`}},i=[`missing`,`improve`,`unknown`,`pass`],a=class extends e{static tagName=`practice-list`;items=[];constructor(){super(t,n)}set practices(e){this.items=e,this.isConnected&&this.draw()}get practices(){return this.items}init(){this.draw()}draw(){this.hidden=this.items.length===0;let e=this.items.filter(e=>e.status===`pass`).length;this.querySelector(`[data-score]`).textContent=`${e} of ${this.items.length} in place`;let t=[...this.items].sort((e,t)=>i.indexOf(e.status)-i.indexOf(t.status)),n=this.querySelector(`[data-item-template]`);this.querySelector(`[data-items]`).replaceChildren(...t.map(e=>{let t=n.content.cloneNode(!0).firstElementChild;t.dataset.status=e.status,t.dataset.id=e.id;let i=(e,n)=>{t.querySelector(e).textContent=n};i(`[data-icon]`,r[e.status].icon),i(`[data-title]`,e.title),i(`[data-status-label]`,r[e.status].label),i(`[data-evidence]`,e.evidence);let a=t.querySelector(`[data-advice]`);a.hidden=!e.recommendation,i(`[data-recommendation]`,e.recommendation);let o=t.querySelector(`[data-docs]`);return o.hidden=!e.docs,o.href=e.docs,t}))}};customElements.get(a.tagName)||customElements.define(a.tagName,a);export{a as PracticeListComponent};