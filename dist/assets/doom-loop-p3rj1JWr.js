import{h as e}from"./index-DMsLPmzK.js";import{i as t,n,t as r}from"./format-Cx1wN9EF.js";import{i}from"./svg-CRpdUA4t.js";var a=`<section class="loop" data-loop data-level="unknown" data-region>
  <div class="loop-readout">
    <p class="loop-eyebrow">Bug doom loop</p>
    <p class="loop-queue" data-queue hidden></p>
    <p class="loop-ratio tabular">
      <span data-ratio>—</span><span class="loop-x">×</span>
    </p>
    <p class="loop-caption">
      <span data-caption>issues opened per issue closed</span>
      <span data-window></span>
    </p>
    <p class="loop-badge" data-badge>
      <span class="loop-icon" data-icon aria-hidden="true"></span>
      <span data-label>Waiting for data</span>
    </p>
  </div>

  <div class="loop-meter-wrap">
    <div class="loop-meter" data-meter role="img">
      <div class="loop-track" aria-hidden="true">
        <span class="seg seg-burning"></span>
        <span class="seg seg-steady"></span>
        <span class="seg seg-behind"></span>
        <span class="seg seg-doom"></span>
      </div>
      <div class="loop-marker" data-marker aria-hidden="true" hidden>
        <span class="loop-marker-value tabular" data-marker-value></span>
      </div>
      <div class="loop-scale" data-scale aria-hidden="true"></div>
      <div class="loop-zones" aria-hidden="true">
        <span>Burning down</span>
        <span>Break-even</span>
        <span>Doom loop</span>
      </div>
    </div>
    <p class="loop-projection" data-projection></p>
    <dl class="loop-strict" data-strict hidden>
      <div data-strict-referenced hidden>
        <dt>Counting only closures that reference a fix</dt>
        <dd class="tabular" data-strict-referenced-value></dd>
      </div>
      <div data-strict-behavior hidden>
        <dt>Bug reports only</dt>
        <dd class="tabular" data-strict-behavior-value></dd>
      </div>
    </dl>
  </div>

  <div class="loop-spark">
    <p class="loop-spark-title">Ratio by day</p>
    <div class="loop-spark-plot" data-spark></div>
  </div>
</section>
`,o=`:host {
  display: block;
  /* The layout follows the panel's own width, so two can sit side by side. */
  container-type: inline-size;
  --level: var(--ink-muted);
}
:host .loop {
  position: relative;
  height: 100%;
  box-sizing: border-box;
  align-content: start;
  display: grid;
  gap: 1.75rem;
  padding: 1.5rem 1.5rem 1.5rem 1.75rem;
  border-radius: 16px;
  border: 1px solid var(--border);
  background:
    radial-gradient(
      120% 140% at 0% 0%,
      color-mix(in srgb, var(--level) 14%, transparent),
      transparent 55%
    ),
    var(--surface);
  box-shadow: var(--shadow);
  overflow: hidden;
}
:host .loop::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 5px;
  background: var(--level);
}
@container (min-width: 900px) {
  :host .loop {
    grid-template-columns: minmax(200px, 0.8fr) minmax(320px, 1.6fr) minmax(
        200px,
        1fr
      );
    align-items: center;
    padding: 1.75rem 2rem 1.75rem 2.25rem;
  }
}
:host .loop[data-level='burning'] {
  --level: var(--good);
}
:host .loop[data-level='steady'] {
  --level: var(--warning);
}
:host .loop[data-level='behind'] {
  --level: var(--serious);
}
:host .loop[data-level='doom'] {
  --level: var(--critical);
}
:host p {
  margin: 0;
}
:host .loop-eyebrow {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink-2);
}
:host .loop-ratio {
  margin-top: 0.25rem;
  font-size: clamp(3rem, 7vw, 4.25rem);
  font-weight: 800;
  letter-spacing: -0.04em;
  line-height: 1;
  color: var(--ink);
}
:host .loop-x {
  margin-left: 0.05em;
  font-weight: 500;
  color: var(--ink-muted);
}
:host .loop-caption {
  margin-top: 0.375rem;
  font-size: 0.875rem;
  color: var(--ink-2);
}
:host .loop-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.875rem;
  padding: 0.3rem 0.75rem 0.3rem 0.4rem;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface);
  font-size: 0.8125rem;
  font-weight: 700;
}
:host .loop-icon {
  display: inline-grid;
  place-items: center;
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 999px;
  background: var(--level);
  color: #fff;
  font-size: 0.75rem;
  font-weight: 800;
}
:host .loop[data-level='steady'] .loop-icon {
  color: #0b0b0b;
}
:host .loop[data-level='doom'] .loop-icon {
  animation: loop-pulse 2.4s ease-in-out infinite;
}
@keyframes loop-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--critical) 55%, transparent);
  }
  50% {
    box-shadow: 0 0 0 6px transparent;
  }
}

/* Meter: a log scale from 1/8× to 8×, break-even in the middle. */
:host .loop-meter {
  position: relative;
  padding-top: 2.25rem;
}
:host .loop-track {
  display: flex;
  gap: 2px;
  height: 12px;
}
:host .seg {
  border-radius: 3px;
}
:host .seg-burning {
  flex: 0 0 calc(47.47% - 1.5px);
  background: var(--good);
  opacity: 0.55;
}
:host .seg-steady {
  flex: 0 0 calc(4.82% - 1.5px);
  background: var(--warning);
  opacity: 0.75;
}
:host .seg-behind {
  flex: 0 0 calc(14.38% - 1.5px);
  background: var(--serious);
  opacity: 0.6;
}
:host .seg-doom {
  flex: 1;
  background: var(--critical);
  opacity: 0.6;
}
:host .loop-marker {
  position: absolute;
  top: 0;
  bottom: 2.75rem;
  width: 0;
  transition: left 1.6s cubic-bezier(0.22, 1, 0.36, 1);
}
:host .loop-marker::after {
  content: '';
  position: absolute;
  bottom: -6px;
  left: -2px;
  width: 4px;
  top: 1.5rem;
  border-radius: 2px;
  background: var(--ink);
  box-shadow: 0 0 0 2px var(--surface);
}
:host .loop-marker-value {
  position: absolute;
  top: 0;
  transform: translateX(-50%);
  padding: 0.125rem 0.5rem;
  border-radius: 6px;
  background: var(--ink);
  color: var(--page);
  font-size: 0.75rem;
  font-weight: 700;
  white-space: nowrap;
}
:host .loop-marker[data-edge='end'] .loop-marker-value {
  transform: translateX(-100%);
}
:host .loop-marker[data-edge='start'] .loop-marker-value {
  transform: none;
}
:host .loop-scale {
  position: relative;
  height: 1.25rem;
  margin-top: 0.375rem;
  font-size: 0.6875rem;
  color: var(--ink-muted);
}
:host .loop-scale span {
  position: absolute;
  transform: translateX(-50%);
}
:host .loop-scale span:first-child {
  transform: none;
}
:host .loop-scale span:last-child {
  transform: translateX(-100%);
}
:host .loop-scale span.one {
  color: var(--ink);
  font-weight: 700;
}
:host .loop-zones {
  display: flex;
  justify-content: space-between;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ink-muted);
}
:host .loop-projection {
  margin-top: 1rem;
  font-size: 0.9375rem;
  line-height: 1.5;
  color: var(--ink-2);
}
:host .loop-projection strong {
  color: var(--ink);
}
@media (prefers-reduced-motion: reduce) {
  :host .loop-marker {
    transition: none;
  }
  :host .loop[data-level='doom'] .loop-icon {
    animation: none;
  }
}

/* Sparkline of the ratio over time, on the same log scale. */
:host .loop-spark-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--ink-muted);
}
:host .loop-spark-plot {
  position: relative;
  height: 96px;
  margin-top: 0.5rem;
}
:host .loop-spark-plot svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}
:host .loop-spark-plot .even-label {
  position: absolute;
  right: 0;
  transform: translateY(-120%);
  font-size: 0.6875rem;
  color: var(--ink-muted);
}
:host .loop-spark-plot .end-dot {
  position: absolute;
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: var(--level);
  box-shadow: 0 0 0 2px var(--surface);
  transform: translate(-50%, -50%);
}
:host .spark-dates {
  display: flex;
  justify-content: space-between;
  margin-top: 0.375rem;
  font-size: 0.6875rem;
  color: var(--ink-muted);
}
:host .loop-strict {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 2rem;
  margin: 0.875rem 0 0;
  padding-top: 0.875rem;
  border-top: 1px solid var(--grid);
}
:host .loop-strict[hidden],
:host .loop-strict div[hidden] {
  display: none;
}
:host .loop-strict dt {
  font-size: 0.8125rem;
  color: var(--ink-2);
}
:host .loop-strict dd {
  margin: 0.125rem 0 0;
  font-size: 1.125rem;
  font-weight: 650;
  color: var(--ink);
}
:host .loop-queue {
  margin-top: 0.125rem;
  font-size: 1rem;
  font-weight: 700;
  color: var(--ink);
}
`,s=-3,c=3,l=[[1/8,`⅛×`],[1/4,`¼×`],[1/2,`½×`],[1,`1×`],[2,`2×`],[4,`4×`],[8,`8×+`]],u={burning:{icon:`✓`,label:`Burning down the backlog`},steady:{icon:`=`,label:`Holding steady`},behind:{icon:`!`,label:`Falling behind`},doom:{icon:`✕`,label:`Bug doom loop`},unknown:{icon:`?`,label:`Not enough data yet`}};function d(e){return(Math.min(Math.log2(Math.max(e,2**s)),c)-s)/6*100}function f(e){return e===null?`—`:Number.isFinite(e)?e>=10?e.toFixed(0):e.toFixed(1):`∞`}var p=class extends e{static tagName=`doom-loop`;value;open=0;windowDays=0;drawn=!1;note=``;queue=``;caption=``;strict={};constructor(){super(a,o)}set loop(e){this.value=e,this.isConnected&&this.draw()}get loop(){return this.value}init(){this.querySelector(`[data-scale]`).replaceChildren(...l.map(([e,t])=>{let n=document.createElement(`span`);return n.style.left=`${d(e)}%`,n.textContent=t,e===1&&(n.className=`one`),n})),this.value&&this.draw()}draw(){let e=this.value,n=f(e.ratio),{icon:r,label:i}=u[e.level];this.querySelector(`[data-loop]`).dataset.level=e.level,this.querySelector(`[data-ratio]`).textContent=n;let a=this.querySelector(`[data-queue]`);a.textContent=this.queue,a.hidden=!this.queue,this.querySelector(`[data-region]`).setAttribute(`aria-label`,this.queue?`Bug doom loop: ${this.queue}`:`Bug doom loop`),this.caption&&(this.querySelector(`[data-caption]`).textContent=this.caption),this.querySelector(`[data-window]`).textContent=this.windowDays?`(last ${t(this.windowDays)} ${this.windowDays===1?`day`:`days`})`:``,this.querySelector(`[data-icon]`).textContent=r,this.querySelector(`[data-label]`).textContent=i,this.querySelector(`[data-projection]`).replaceChildren(...this.projection(e)),this.querySelector(`[data-meter]`).setAttribute(`aria-label`,e.ratio===null?`Not enough data for the opened-to-closed ratio`:`${n} issues opened per issue closed: ${i.toLowerCase()}`);let o=this.querySelector(`[data-marker]`);if(e.ratio!==null){let t=d(e.ratio);o.hidden=!1,o.dataset.edge=t>88?`end`:t<12?`start`:``,this.querySelector(`[data-marker-value]`).textContent=e.ratio>2**c?`${n}× ▸`:`${n}×`,this.drawn?o.style.left=`${t}%`:(o.style.left=`50%`,requestAnimationFrame(()=>requestAnimationFrame(()=>o.style.left=`${t}%`))),this.drawn=!0}else o.hidden=!0;let s=[[`referenced`,this.strict.referenced],[`behavior`,this.strict.behavior]];for(let[e,t]of s)this.querySelector(`[data-strict-${e}]`).hidden=t===void 0,this.querySelector(`[data-strict-${e}-value]`).textContent=t==null?`no activity`:`${f(t)}×`;this.querySelector(`[data-strict]`).hidden=s.every(([,e])=>e===void 0),this.drawSparkline(e)}projection(e){let t=e=>{let t=document.createElement(`strong`);return t.textContent=e,t};if(e.ratio===null)return[`Needs at least two days of data.`];if(this.note)return[this.note];if(e.doublingDays!==null){let n=Math.max(1,Math.round(e.doublingDays));return[`At this rate the open backlog of `,t(r(this.open)),` doubles in `,t(`${n} ${n===1?`day`:`days`}`),`.`]}if(e.clearDays!==null){let n=Math.max(1,Math.round(e.clearDays));return[`At this rate the backlog is cleared in `,t(`${n} ${n===1?`day`:`days`}`),`.`]}return[`The backlog is holding steady.`]}drawSparkline(e){let t=this.querySelector(`[data-spark]`),r=e.history.filter(e=>e.ratio!==null);if(r.length===0){t.replaceChildren();return}let a=r.map(e=>e.ratio).filter(Number.isFinite),o=Math.max(2,...a)*1.5,s=r.map(e=>Math.log2(Math.max(Math.min(e.ratio,o),2**-6))),c=Math.max(1,...s)+.25,l=Math.min(-1,...s)-.25,u=e=>(c-e)/(c-l)*100,d=e=>r.length===1?100:e/(r.length-1)*100,p=i(`svg`,{viewBox:`0 0 100 100`,preserveAspectRatio:`none`,"aria-hidden":`true`});i(`line`,{x1:0,x2:100,y1:u(0),y2:u(0),stroke:`var(--axis)`,"stroke-width":1,"vector-effect":`non-scaling-stroke`},p);let m=s.map((e,t)=>`${t?`L`:`M`} ${d(t)} ${u(e)}`).join(` `);i(`path`,{d:`${m} L ${d(s.length-1)} ${u(0)} L ${d(0)} ${u(0)} Z`,fill:`var(--level)`,opacity:.12},p),i(`path`,{d:m,fill:`none`,stroke:`var(--level)`,"stroke-width":2,"stroke-linejoin":`round`,"stroke-linecap":`round`,"vector-effect":`non-scaling-stroke`},p);let h=document.createElement(`span`);h.className=`even-label`,h.style.top=`${u(0)}%`,h.textContent=`1× break-even`;let g=document.createElement(`span`);g.className=`end-dot`,g.style.left=`${d(s.length-1)}%`,g.style.top=`${u(s[s.length-1])}%`,g.title=`${r[r.length-1].date}: ${f(r[r.length-1].ratio)}×`;let _=document.createElement(`div`);_.className=`spark-dates`;for(let e of[r[0],r[r.length-1]]){let t=document.createElement(`span`);t.textContent=n(e.date,!1),_.append(t)}t.replaceChildren(p,h,g),t.after(_),t.parentElement.querySelectorAll(`.spark-dates`).forEach(e=>{e!==_&&e.remove()})}};customElements.get(p.tagName)||customElements.define(p.tagName,p);export{p as DoomLoopComponent};