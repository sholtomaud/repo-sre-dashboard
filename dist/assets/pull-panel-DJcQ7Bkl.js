import{h as e}from"./index-DMsLPmzK.js";import{a as t,t as n}from"./format-Cx1wN9EF.js";var r=[`pass`,`improve`,`missing`,`unknown`];function i(e){let t=e??{},n=e=>typeof e==`number`&&Number.isFinite(e)?e:null;return{count:Number(t.count)||0,medianHours:n(t.medianHours),p90Hours:n(t.p90Hours)}}function a(e){let t=e?.responses;return t?{windowDays:Number(t.windowDays)||30,firstResponse:i(t.firstResponse),resolution:i(t.resolution),awaitingResponse:Number(t.awaitingResponse)||0}:null}function o(e){let t=e?.practices;return Array.isArray(t)?t.filter(e=>e&&typeof e.id==`string`&&typeof e.title==`string`).map(e=>({id:e.id,title:e.title,status:r.includes(e.status)?e.status:`unknown`,evidence:String(e.evidence??``),recommendation:String(e.recommendation??``),docs:typeof e.docs==`string`&&e.docs.startsWith(`https://`)?e.docs:``})):[]}function s(e){if(e===null)return`—`;if(e<1)return`${Math.max(1,Math.round(e*60))} min`;if(e<48)return`${e<10?e.toFixed(1):Math.round(e)} h`;let t=e/24;return`${t<10?t.toFixed(1):Math.round(t)} days`}var c=[`agent`,`assisted`,`human`];function l(e){let t=e?.pulls,n=t?.by_origin;if(!t||!n)return null;let r=e=>typeof e==`number`&&Number.isFinite(e)?e:null,i={};for(let[e,n]of Object.entries(t.agents??{}))typeof n==`number`&&(i[e]=n);return{windowDays:Number(t.window_days)||30,total:Number(t.total)||0,byOrigin:Object.fromEntries(c.map(e=>{let t=n[e]??{};return[e,{opened:r(t.opened)??0,merged:r(t.merged)??0,closedUnmerged:r(t.closed_unmerged)??0,stillOpen:r(t.still_open)??0,mergeRate:r(t.merge_rate),medianHoursToMerge:r(t.median_hours_to_merge)}]})),agents:i}}function u(e){let t=c.reduce((t,n)=>t+e.byOrigin[n].merged,0);return t===0?null:(e.byOrigin.agent.merged+e.byOrigin.assisted.merged)/t}var d=`<article class="card pulls">
  <header class="pulls-head">
    <h2>Pull requests</h2>
    <p>
      Who writes the changes: an AI agent's account, a person working with an
      agent (named in a commit trailer or the description), or a person alone.
      Last <span data-window>30</span> days.
    </p>
  </header>
  <p class="pulls-headline">
    <strong class="tabular" data-share>—</strong>
    <span data-share-text
      >of merged pull requests had an agent's hand in them</span
    >
  </p>
  <div class="segments" data-bar role="img"></div>
  <ul class="legend" data-legend></ul>
  <table class="pulls-table">
    <thead>
      <tr>
        <th scope="col">Written by</th>
        <th scope="col">Opened</th>
        <th scope="col">Merged</th>
        <th scope="col">Closed unmerged</th>
        <th scope="col">Merge rate</th>
        <th scope="col">Time to merge</th>
      </tr>
    </thead>
    <tbody data-rows></tbody>
  </table>
  <p class="pulls-note" data-agents></p>
  <p class="pulls-note">
    Agents working through a person's account without a trailer or signature are
    counted as people, so agent figures are a lower bound. Dependency and CI
    bots are left out.
  </p>
</article>
`,f=`:host {
  display: block;
}
:host .pulls {
  padding: 1.25rem;
}
@media (min-width: 640px) {
  :host .pulls {
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
:host .pulls-head p {
  margin-top: 0.25rem;
  max-width: 80ch;
  font-size: 0.8125rem;
  color: var(--ink-muted);
}
:host .pulls-headline {
  margin: 1.25rem 0 0.875rem;
  font-size: 0.9375rem;
  color: var(--ink-2);
}
:host .pulls-headline strong {
  margin-right: 0.375rem;
  font-size: 1.875rem;
  font-weight: 650;
  color: var(--ink);
}
:host .segments {
  display: flex;
  gap: 2px;
  height: 16px;
}
:host .segment {
  min-width: 3px;
  border-radius: 3px;
}
/* Assisted: the agents' colour with a hatch, so it reads apart without colour. */
:host .segment[data-origin='assisted'],
:host .swatch[data-origin='assisted'] {
  background: repeating-linear-gradient(
    135deg,
    var(--agents) 0 3px,
    var(--surface) 3px 5px
  ) !important;
}
:host .legend {
  list-style: none;
  margin: 0.75rem 0 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem 1.25rem;
  font-size: 0.8125rem;
  color: var(--ink-2);
}
:host .legend li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
:host .legend strong {
  color: var(--ink);
}
:host .swatch {
  width: 12px;
  height: 12px;
  border-radius: 3px;
}
:host .pulls-table {
  width: 100%;
  margin-top: 1.25rem;
  border-collapse: collapse;
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
}
:host .pulls-table th,
:host .pulls-table td {
  padding: 0.4rem 0.75rem;
  border-bottom: 1px solid var(--grid);
  text-align: right;
}
:host .pulls-table th:first-child,
:host .pulls-table td:first-child {
  text-align: left;
}
:host .pulls-table th {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--ink-muted);
}
:host .pulls-note {
  margin-top: 0.75rem;
  font-size: 0.8125rem;
  color: var(--ink-muted);
}
@media (max-width: 640px) {
  :host .pulls-table th:nth-child(4),
  :host .pulls-table td:nth-child(4) {
    display: none;
  }
}
`,p={agent:{label:`AI agent`,color:`var(--agents)`},assisted:{label:`Person with an agent`,color:`var(--agents)`},human:{label:`Person`,color:`var(--humans)`}},m=class extends e{static tagName=`pull-panel`;value=null;constructor(){super(d,f)}set pulls(e){this.value=e,this.isConnected&&this.draw()}get pulls(){return this.value}init(){this.draw()}draw(){let e=this.value;if(this.hidden=!e,!e)return;let r=(e,t)=>{this.querySelector(e).textContent=t};r(`[data-window]`,String(e.windowDays));let i=u(e);r(`[data-share]`,i===null?`—`:t(i)),r(`[data-share-text]`,i===null?`no pull requests merged in the last ${e.windowDays} days`:`of merged pull requests had an agent's hand in them`);let a=c.map(t=>({o:t,value:e.byOrigin[t].merged})),o=this.querySelector(`[data-bar]`);o.setAttribute(`aria-label`,`Merged pull requests by who wrote them: `+a.map(({o:e,value:t})=>`${p[e].label} ${t}`).join(`, `)),o.replaceChildren(...a.filter(({value:e})=>e>0).map(({o:e,value:t})=>{let n=document.createElement(`span`);return n.className=`segment`,n.dataset.origin=e,n.style.flex=`${t} 0 0`,n.style.background=p[e].color,n.title=`${p[e].label}: ${t} merged`,n})),this.querySelector(`[data-legend]`).replaceChildren(...a.map(({o:e,value:t})=>{let r=document.createElement(`li`),i=document.createElement(`span`);i.className=`swatch`,i.dataset.origin=e,i.style.background=p[e].color;let a=document.createElement(`strong`);return a.className=`tabular`,a.textContent=n(t),r.append(i,a,`${p[e].label}`),r})),this.querySelector(`[data-rows]`).replaceChildren(...c.map(r=>{let i=e.byOrigin[r],a=document.createElement(`tr`);a.dataset.origin=r;for(let e of[p[r].label,n(i.opened),n(i.merged),n(i.closedUnmerged),i.mergeRate===null?`—`:t(i.mergeRate),s(i.medianHoursToMerge)]){let t=document.createElement(`td`);t.textContent=e,a.append(t)}return a}));let l=Object.entries(e.agents).sort((e,t)=>t[1]-e[1]);r(`[data-agents]`,l.length?`Agents seen: ${l.map(([e,t])=>`${e} ${t}`).join(` · `)}.`:`No agent named in the last ${e.windowDays} days.`)}};customElements.get(m.tagName)||customElements.define(m.tagName,m);export{m as PullPanelComponent,a as i,o as n,l as r,s as t};