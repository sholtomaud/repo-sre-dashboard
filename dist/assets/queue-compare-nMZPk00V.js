import{i as e}from"./index-BNdfiT4w.js";import{i as t,o as n,t as r}from"./format-Cx1wN9EF.js";var i=`<article class="card queues">
  <header class="queues-head">
    <h2>Where the agents work</h2>
    <p>
      Issues are tracked in two places: a queue of files in the repository, and
      GitHub Issues.
    </p>
  </header>
  <div class="queues-grid" data-grid></div>
  <p class="queues-summary" data-summary></p>
  <template data-queue-template>
    <section class="queue">
      <h3 data-name></h3>
      <p class="queue-source" data-source></p>
      <dl class="queue-totals">
        <div>
          <dt>Open</dt>
          <dd class="tabular" data-open></dd>
        </div>
        <div>
          <dt data-resolved-label></dt>
          <dd class="tabular" data-resolved></dd>
        </div>
      </dl>
      <p class="queue-split" data-split></p>
      <div class="queue-bars" data-bars></div>
    </section>
  </template>
</article>
`,a=`:host {
  display: block;
}
:host .queues {
  padding: 1.25rem;
}
@media (min-width: 640px) {
  :host .queues {
    padding: 1.5rem 1.75rem 1.75rem;
  }
}
:host h2 {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
}
:host .queues-head p {
  margin: 0.25rem 0 0;
  max-width: 78ch;
  font-size: 0.8125rem;
  color: var(--ink-muted);
}
:host .queues-grid {
  display: grid;
  gap: 1.5rem;
  margin-top: 1.25rem;
}
@media (min-width: 800px) {
  :host .queues-grid {
    grid-template-columns: 1fr 1fr;
    gap: 2.5rem;
  }
  :host .queue + .queue {
    padding-left: 2.5rem;
    border-left: 1px solid var(--grid);
  }
}
:host h3 {
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 700;
}
:host .queue-source {
  margin: 0.125rem 0 0;
  font-size: 0.8125rem;
  color: var(--ink-muted);
}
:host .queue-totals {
  display: flex;
  gap: 2rem;
  margin: 0.875rem 0 1rem;
}
:host dt {
  font-size: 0.8125rem;
  color: var(--ink-2);
}
:host dd {
  margin: 0.125rem 0 0;
  font-size: 1.625rem;
  font-weight: 650;
  letter-spacing: -0.02em;
  line-height: 1.15;
}
:host .bar-row {
  display: grid;
  grid-template-columns: minmax(7.5rem, 13.5rem) 1fr;
  align-items: center;
  gap: 0.75rem;
  padding: 0.3rem 0;
  font-size: 0.8125rem;
  color: var(--ink-2);
}
:host .bar-track {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}
:host .bar {
  height: 12px;
  min-width: 2px;
  border-radius: 0 4px 4px 0;
  transition: width 1.4s cubic-bezier(0.22, 1, 0.36, 1);
}
:host .bar-value {
  color: var(--ink);
  font-weight: 600;
  white-space: nowrap;
}
:host .queues-summary {
  margin: 1.25rem 0 0;
  padding-top: 1rem;
  border-top: 1px solid var(--grid);
  font-size: 0.9375rem;
  line-height: 1.5;
  color: var(--ink-2);
}
:host .queues-summary strong {
  color: var(--ink);
}
@media (prefers-reduced-motion: reduce) {
  :host .bar {
    transition: none;
  }
}
:host .queue-split {
  margin: -0.5rem 0 1rem;
  font-size: 0.8125rem;
  color: var(--ink-muted);
}
`,o=class extends e{static tagName=`queue-compare`;value;constructor(){super(i,a)}set comparison(e){this.value=e,this.isConnected&&this.draw()}get comparison(){return this.value}init(){this.value&&this.draw()}draw(){let{agents:e,publicIssues:t}=this.value,r=Math.max(1,t.arrivals,t.agentResolved,e?.arrivals??0,e?.agentResolved??0,t.humanResolved,e?.humanResolved??0),i=[this.queue(`Agents' own queue`,e?`Files in the repository`:`Could not be read on the last update`,`Resolved`,e,r),this.queue(`Public GitHub issues`,`Reported on GitHub`,`Closed`,t,r)];this.querySelector(`[data-grid]`).replaceChildren(...i);let a=this.querySelector(`[data-summary]`),o=e=>{let t=document.createElement(`strong`);return t.textContent=e,t};a.replaceChildren(...e?[`Agents resolve `,o(`${n(e.agentResolved)} a day`),` in their own queue and `,o(`${n(t.agentResolved)} a day`),` in the public one. Humans resolve `,o(`${n(e.humanResolved)} a day`),` and `,o(`${n(t.humanResolved)} a day`),`.`]:[`The agents' own queue was not available on the last update.`]),requestAnimationFrame(()=>requestAnimationFrame(()=>this.querySelectorAll(`.bar`).forEach(e=>{e.style.width=e.dataset.width})))}queue(e,n,i,a,o){let s=this.querySelector(`[data-queue-template]`).content.cloneNode(!0).firstElementChild,c=(e,t)=>{s.querySelector(e).textContent=t};return c(`[data-name]`,e),c(`[data-source]`,a?.days?`${n} · rates over the last ${t(a.days)} days`:n),c(`[data-resolved-label]`,i),c(`[data-open]`,a?r(a.open):`—`),c(`[data-resolved]`,a?r(a.resolved):`—`),a&&(s.querySelector(`[data-bars]`).append(this.bar(`New per day`,a.arrivals,o,`var(--series-1)`),this.bar(`Resolved by agents per day`,a.agentResolved,o,`var(--series-2)`),this.bar(`Resolved by humans per day`,a.humanResolved,o,`var(--series-3)`)),c(`[data-split]`,`${r(a.resolvedByAgents)} by agents · ${r(a.resolvedByHumans)} by humans`)),s}bar(e,t,r,i){let a=document.createElement(`div`);a.className=`bar-row`;let o=document.createElement(`span`);o.textContent=e;let s=document.createElement(`div`);s.className=`bar-track`;let c=document.createElement(`span`);c.className=`bar`,c.style.background=i,c.style.width=`0`,c.dataset.width=`${Math.max(0,t)/r*82}%`;let l=document.createElement(`span`);return l.className=`bar-value tabular`,l.textContent=n(t),s.append(c,l),a.append(o,s),a}};customElements.get(o.tagName)||customElements.define(o.tagName,o);export{o as QueueCompareComponent};