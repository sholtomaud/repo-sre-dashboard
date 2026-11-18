import{u as e}from"./index-4Hn5QvqR.js";import{r as t}from"./health-RCxkCncK.js";import{a as n,t as r}from"./format-DYYxeEu5.js";var i=`<article class="card delivery">
  <header class="panel-head">
    <h2>Delivery</h2>
    <p>
      The four DORA metrics over the last <span data-window>30</span> days, each
      placed on the research's scale from low to elite.
      <span data-source></span>
    </p>
  </header>
  <div class="dora" data-dora></div>
  <h3 class="ci-title">CI on the default branch</h3>
  <dl class="ci" data-ci></dl>
  <p class="panel-foot" data-ci-note></p>
</article>
`,a=`:host {
  display: block;
}
:host .delivery {
  padding: 1.25rem 1.5rem;
}
:host .dora {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
}
:host .metric {
  display: grid;
  gap: 0.375rem;
  align-content: start;
  padding: 1rem;
  border-radius: 12px;
  background: var(--surface-2);
}
:host .metric-label {
  margin: 0;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--ink-2);
}
:host .metric-value {
  margin: 0;
  font-size: 1.625rem;
  font-weight: 750;
  letter-spacing: -0.02em;
}
:host .metric-note {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--ink-muted);
  line-height: 1.4;
}
:host .scale {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 3px;
  margin: 0.25rem 0 0;
  padding: 0;
  list-style: none;
  font-size: 0.6875rem;
  color: var(--ink-muted);
  text-align: center;
}
:host .scale li {
  padding: 0.25rem 0;
  border-radius: 4px;
  background: var(--page);
  border: 1px solid var(--border);
}
:host .scale li[aria-current='true'] {
  background: var(--ink);
  border-color: var(--ink);
  color: var(--page);
  font-weight: 700;
}
:host .ci-title {
  margin: 1.5rem 0 0.75rem;
  font-size: 0.9375rem;
}
:host .ci {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 0.75rem 1.5rem;
  margin: 0;
}
:host .ci dt {
  font-size: 0.8125rem;
  color: var(--ink-muted);
}
:host .ci dd {
  margin: 0.125rem 0 0;
  font-size: 1.125rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
:host .ci dd[data-tone='bad'] {
  color: var(--critical-ink);
}
:host .ci dd[data-tone='good'] {
  color: var(--good-ink);
}
`,o=[`low`,`medium`,`high`,`elite`],s={low:`Low`,medium:`Medium`,high:`High`,elite:`Elite`};function c(e){return e<=0?`None`:e>=1?`${e.toFixed(+(e<10))} a day`:e*7>=1?`${(e*7).toFixed(1)} a week`:`${(e*30).toFixed(1)} a month`}var l=class extends e{static tagName=`delivery-panel`;data={delivery:null,ci:null};constructor(){super(i,a)}show(e,t){this.data={delivery:e,ci:t},this.isConnected&&this.draw()}init(){this.draw()}draw(){let{delivery:e,ci:i}=this.data;if(this.hidden=!e&&!i,!e&&!i)return;if(e){this.querySelector(`[data-window]`).textContent=String(e.windowDays),this.querySelector(`[data-source]`).textContent=e.source===`merges`?`With no releases or deployments recorded, a merge to the default branch counts as a delivery.`:`Deliveries are ${e.source}.`;let i=e;this.querySelector(`[data-dora]`).replaceChildren(this.metric(`Deployment frequency`,c(i.frequency.value??0),i.frequency,`${r(i.frequency.count)} ${i.frequency.basis}`),this.metric(`Lead time for changes`,t(i.leadTimeHours.value),i.leadTimeHours,`median, ${i.leadTimeHours.basis}, over ${r(i.leadTimeHours.count)} changes`),this.metric(`Change failure rate`,i.failureRate.value===null?`—`:n(i.failureRate.value),i.failureRate,`${i.failureRate.basis}, of ${r(i.failureRate.count)}`),this.metric(`Time to restore service`,t(i.restoreHours.value),i.restoreHours,i.restoreHours.count?`median over ${r(i.restoreHours.count)} ${i.restoreHours.basis}`:`Not measured: ${i.restoreHours.basis}. Label incidents to measure it.`))}let a=this.querySelector(`[data-ci]`),o=this.querySelector(`[data-ci-note]`);if(!i||i.runs===0){a.replaceChildren(),o.textContent=i?`No CI runs on the default branch in the last ${i.windowDays} days, or the dashboard workflow lacks actions: read.`:`CI health appears after the next tracker run.`;return}let s=(e,t,n=``)=>{let r=document.createElement(`dt`);r.textContent=e;let i=document.createElement(`dd`);i.textContent=t,n&&(i.dataset.tone=n);let a=document.createElement(`div`);return a.append(r,i),[a]},l=i.successRate??0;a.replaceChildren(...s(`Runs passing`,n(l),l>=.9?`good`:l<.75?`bad`:``),...s(`Runs`,r(i.runs)),...s(`Median run time`,i.medianMinutes===null?`—`:`${Math.round(i.medianMinutes)} min`),...s(`Time back to green`,t(i.medianHoursToGreen)),...s(`Failing now`,i.failingNow.length?i.failingNow.join(`, `):`Nothing`,i.failingNow.length?`bad`:`good`)),o.textContent=`Pushes to the default branch in the last ${i.windowDays} days. Time back to green runs from a workflow's first failure to its next success.`}metric(e,t,n,r){let i=document.createElement(`section`);i.className=`metric`,i.dataset.metric=e;let a=(e,t)=>{let n=document.createElement(`p`);return n.className=e,n.textContent=t,n},c=document.createElement(`ol`);c.className=`scale`,c.setAttribute(`aria-label`,n.band?`DORA band: ${s[n.band]}`:`Not banded yet`);for(let e of o){let t=document.createElement(`li`);t.textContent=s[e],t.setAttribute(`aria-current`,String(e===n.band)),c.append(t)}return i.append(a(`metric-label`,e),a(`metric-value tabular`,t),c,a(`metric-note`,r)),i}};customElements.get(l.tagName)||customElements.define(l.tagName,l);export{l as DeliveryPanelComponent,c as formatFrequency};