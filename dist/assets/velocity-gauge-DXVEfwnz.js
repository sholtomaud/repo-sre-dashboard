import{h as e}from"./index-DMsLPmzK.js";import{u as t}from"./metrics-CGSTutjD.js";import{i as n,o as r}from"./format-Cx1wN9EF.js";import{i,n as a,r as o,t as s}from"./svg-CRpdUA4t.js";var c=`<figure class="gauge">
  <h3 class="gauge-heading" data-heading hidden></h3>
  <div class="gauge-frame" data-gauge role="img"></div>
  <figcaption>
    <p class="gauge-gap" data-gap></p>
    <p class="gauge-forecast" data-forecast hidden></p>
    <ul class="gauge-legend" data-legend></ul>
    <p class="gauge-odometer" data-odometer role="img" hidden>
      <span class="odometer-label" aria-hidden="true">Open</span>
      <span
        class="odometer-wheels tabular"
        data-wheels
        aria-hidden="true"
      ></span>
    </p>
  </figcaption>
</figure>
`,l=`:host {
  display: block;
}
:host .gauge {
  margin: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}
:host .gauge-frame {
  width: min(100%, 380px);
  aspect-ratio: 320 / 236;
}
:host .gauge-frame svg {
  width: 100%;
  height: 100%;
  overflow: visible;
}
:host .needle {
  transform-box: view-box;
  transform-origin: 160px 150px;
  transition: transform 2s cubic-bezier(0.34, 1.3, 0.5, 1);
}
:host .gauge-legend {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem 1.25rem;
  font-size: 0.8125rem;
  color: var(--ink-2);
}
:host .gauge-legend li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
:host .gauge-legend strong {
  color: var(--ink);
  font-weight: 600;
}
:host .key {
  display: inline-block;
  width: 14px;
  height: 4px;
  border-radius: 2px;
}
:host .key-tick {
  width: 3px;
  height: 12px;
}
:host .gauge-gap {
  margin: 0 0 0.5rem;
  font-size: 0.875rem;
  font-weight: 650;
  text-align: center;
  color: var(--ink);
}
:host .gauge-gap[data-state='ahead'] {
  color: var(--good-ink);
}
:host .gauge-gap[data-state='behind'] {
  color: var(--critical-ink);
}
@media (prefers-reduced-motion: reduce) {
  :host .needle {
    transition: none;
  }
}
:host .gauge-heading {
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--ink);
}
/* The smaller dials of the cluster: the same dial, lighter legend. */
:host[data-size='small'] .gauge-frame {
  width: min(100%, 250px);
}
:host[data-size='small'] .gauge-legend {
  font-size: 0.75rem;
  gap: 0.25rem 0.875rem;
}
:host[data-size='large'] .gauge-frame {
  width: min(100%, 420px);
}
:host[data-size='small'] .gauge-gap {
  font-size: 0.8125rem;
}
:host .gauge-forecast {
  margin: -0.25rem 0 0.5rem;
  font-size: 0.8125rem;
  text-align: center;
  color: var(--ink-2);
}
/* The open backlog as a rally-car odometer. */
:host .gauge-odometer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin: 0.75rem 0 0;
}
:host .gauge-odometer[hidden] {
  display: none;
}
:host .odometer-label {
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--ink-muted);
}
:host .odometer-wheels {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  border-radius: 6px;
  background: var(--ink);
}
:host .wheel {
  display: inline-block;
  width: 1.05em;
  padding: 0.1em 0;
  border-radius: 3px;
  background: linear-gradient(
    var(--clock-ink),
    var(--ink-2) 50%,
    var(--clock-ink)
  );
  color: var(--page);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.9375rem;
  font-weight: 700;
  text-align: center;
}
:host .wheel.lead {
  opacity: 0.45;
}
:host[data-size='small'] .wheel {
  font-size: 0.8125rem;
}
`,u=160,d=150,f=118,p=-120,m=240,h=.05;function g(e){let t=e.agent+e.human;return Math.abs(t-e.arrivals)<h?`even`:t>e.arrivals?`ahead`:`behind`}var _=class extends e{static tagName=`velocity-gauge`;value;drawn=!1;scalePeak=null;heading=``;open=null;range=null;fade=0;constructor(){super(c,l)}set velocity(e){this.value=e,this.isConnected&&this.draw()}get velocity(){return this.value}init(){this.value&&this.draw()}draw(){let e=this.value,c=e.agent+e.human,l=t(Math.max(this.scalePeak??0,c,e.arrivals,4)*1.08),h=e=>p+Math.min(Math.max(e,0),l)/l*m,_=g(e),v=Math.abs(c-e.arrivals),y=this.querySelector(`[data-gauge]`);y.setAttribute(`aria-label`,`${r(c)} issues resolved per day: ${r(e.agent)} by AI agents and ${r(e.human)} by humans. ${r(e.arrivals)} new issues arrive per day, so resolution is `+(_===`even`?`level with them`:`${r(v)} a day ${_}`)+`. Averaged over ${n(e.days)} days.`);let b=i(`svg`,{viewBox:`0 0 320 236`,"aria-hidden":`true`});i(`path`,{d:s(u,d,f,p,120),fill:`none`,stroke:`var(--grid)`,"stroke-width":16,"stroke-linecap":`round`},b);let x=i(`g`,{class:`value-arcs`},b),S=(e,t,n)=>{t-e<.3||i(`path`,{d:s(u,d,f,e,t),fill:`none`,stroke:n,"stroke-width":16},x)},C=h(e.agent),w=h(c);if(S(p,C,`var(--agents)`),S(C+ +(e.agent>0),w,`var(--humans)`),_!==`even`){let t=Math.min(h(c),h(e.arrivals)),n=Math.max(h(c),h(e.arrivals));n-t>=.3&&i(`path`,{d:s(u,d,133,t,n),fill:`none`,stroke:_===`ahead`?`var(--good)`:`var(--critical)`,"stroke-width":5,"stroke-linecap":`butt`,..._===`behind`?{"stroke-dasharray":`7 4`}:{},class:`gap gap-${_}`},b)}for(let e=0;e<=20;e++){let t=e%4==0,n=p+e/20*m,r=a(u,d,105,n),o=a(u,d,f-(t?24:18),n);if(i(`line`,{x1:o.x,y1:o.y,x2:r.x,y2:r.y,stroke:t?`var(--ink-2)`:`var(--axis)`,"stroke-width":t?2:1,"stroke-linecap":`round`},b),t){let t=a(u,d,80,n),r=i(`text`,{x:t.x,y:t.y,"text-anchor":`middle`,"dominant-baseline":`central`,fill:`var(--ink-muted)`,"font-size":11,class:`tabular`},b),o=l/5*(e/4);r.textContent=Number.isInteger(o)?String(o):o.toFixed(1)}}let T=h(e.arrivals),E=a(u,d,109,T),D=a(u,d,137,T);for(let[e,t]of[[`var(--surface)`,7],[`var(--arrivals)`,3]])i(`line`,{x1:E.x,y1:E.y,x2:D.x,y2:D.y,stroke:e,"stroke-width":t,"stroke-linecap":`round`},b);let O=a(u,d,139,T),k=a(u,d,147,T-3.2),A=a(u,d,147,T+3.2);if(i(`path`,{d:`M ${O.x} ${O.y} L ${k.x} ${k.y} L ${A.x} ${A.y} Z`,fill:`var(--arrivals)`},b),this.range){let e=h(this.range.low),t=Math.max(h(this.range.high),e+.5);i(`path`,{d:`${s(u,d,126,e,t)} L ${u} ${d} Z`,fill:`var(--ink)`,opacity:.14*(1-this.fade)+.04,class:`forecast-range`},b)}let j=i(`g`,{class:`needle`},b);j.style.opacity=String(1-this.fade),i(`path`,{d:`M 156 164 L ${u} 82 L 164 164 Z`,fill:`var(--ink)`},j),i(`circle`,{cx:u,cy:d,r:10,fill:`var(--ink)`},b),i(`circle`,{cx:u,cy:d,r:4,fill:`var(--agents)`},b);let M=i(`text`,{x:u,y:204,"text-anchor":`middle`,fill:`var(--ink)`,"font-size":34,"font-weight":700,"letter-spacing":`-0.02em`,"data-readout":``},b);M.textContent=r(c);let N=i(`text`,{x:u,y:226,"text-anchor":`middle`,fill:`var(--ink-muted)`,"font-size":11,"font-weight":600,"letter-spacing":`0.08em`},b);N.textContent=`ISSUES RESOLVED / DAY`,y.replaceChildren(b);let P=()=>{j.style.transform=`rotate(${h(c)}deg)`};j.style.transform=`rotate(${p}deg)`,this.drawn||o()?P():requestAnimationFrame(()=>requestAnimationFrame(P)),this.drawn=!0,this.renderCaption(e,_,v)}renderCaption(e,t,n){let i=this.querySelector(`[data-heading]`);i.textContent=this.heading,i.hidden=!this.heading;let a=this.querySelector(`[data-gap]`);a.dataset.state=t,a.textContent=t===`even`?`= Level with new issues`:t===`ahead`?`▲ ${r(n)} a day ahead of new issues`:`▼ ${r(n)} a day behind new issues`;let o=this.querySelector(`[data-forecast]`);o.hidden=!this.range,this.range&&(o.textContent=`Forecast: likely ${r(this.range.low)}–${r(this.range.high)} resolved a day`);let s=this.querySelector(`[data-odometer]`);if(s.hidden=this.open===null,this.open!==null){let e=String(Math.max(0,Math.round(this.open))).padStart(6,`0`);this.querySelector(`[data-wheels]`).replaceChildren(...[...e].map((t,n)=>{let r=document.createElement(`span`);return r.className=`wheel`,n<e.length-String(Math.round(this.open)).length&&r.classList.add(`lead`),r.textContent=t,r})),s.setAttribute(`aria-label`,`${Math.round(this.open)} open issues`)}let c=(e,t,n,i)=>{let a=document.createElement(`li`),o=document.createElement(`span`);o.className=`key key-${e}`,o.style.background=t;let s=document.createElement(`span`),c=document.createElement(`strong`);return c.className=`tabular`,c.textContent=r(i),s.append(c,` ${n}`),a.append(o,s),a};this.querySelector(`[data-legend]`).replaceChildren(c(`arc`,`var(--agents)`,`AI agents`,e.agent),c(`arc`,`var(--humans)`,`humans`,e.human),c(`tick`,`var(--arrivals)`,`new issues a day`,e.arrivals))}};customElements.get(_.tagName)||customElements.define(_.tagName,_);export{_ as VelocityGaugeComponent,g as pace};