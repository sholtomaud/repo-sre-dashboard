import{h as e}from"./index-Cze6PZ7Z.js";import{f as t,r as n}from"./metrics-CGSTutjD.js";import{i as r,n as i,r as a,t as o}from"./svg-CRpdUA4t.js";var s=`<figure class="clock">
  <div class="clock-frame" data-clock role="img"></div>
  <figcaption class="clock-readout">
    <span class="clock-hours tabular" data-hours>—</span>
    <span class="clock-unit">hours to midnight</span>
    <span class="clock-time tabular" data-time></span>
  </figcaption>
</figure>
`,c=`:host {
  display: block;
}
:host .clock {
  margin: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}
:host .clock-frame {
  width: min(100%, 320px);
  aspect-ratio: 1;
}
:host .clock-frame svg {
  width: 100%;
  height: 100%;
  overflow: visible;
}
:host .hand {
  transform-box: view-box;
  transform-origin: 160px 160px;
  transition: transform 1.8s cubic-bezier(0.22, 1, 0.36, 1);
}
:host .second-hand {
  transition: transform 0.25s cubic-bezier(0.4, 2.2, 0.6, 1);
}
:host .countdown {
  transition: stroke-dasharray 1.8s cubic-bezier(0.22, 1, 0.36, 1);
}
:host .clock-readout {
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1.1;
}
:host .clock-hours {
  font-size: 3rem;
  font-weight: 700;
  letter-spacing: -0.03em;
  color: var(--ink);
}
:host .clock-unit {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--ink-2);
}
:host .clock-time {
  margin-top: 0.375rem;
  font-size: 0.75rem;
  color: var(--ink-muted);
}
@media (prefers-reduced-motion: reduce) {
  :host .hand,
  :host .countdown {
    transition: none;
  }
}
:host[data-size='large'] .clock-frame {
  width: min(100%, 420px);
}
`;function l(e,t,n,r,i){return`${o(e,t,n,r,i)} L ${e} ${t} Z`}var u=160,d=15,f={safe:`good`,elevated:`warning`,severe:`serious`,critical:`critical`},p=class extends e{static tagName=`doomsday-clock`;value;spread=null;faded=0;message=``;timer;drawn=!1;constructor(){super(s,c)}set hours(e){this.show({hours:e})}get hours(){return this.value}show({hours:e,range:t=null,fade:n=0,note:r=``}){let i=e=>Math.min(24,Math.max(0,e));this.value=e===null?null:i(e),this.spread=t&&{low:i(t.low),high:i(t.high)},this.faded=Math.min(1,Math.max(0,n)),this.message=r,this.isConnected&&this.draw()}init(){this.value!==void 0&&this.draw()}disconnectedCallback(){window.clearInterval(this.timer)}draw(){let e=this.value!==null&&this.value!==void 0,s=e?this.value:24,c=24-s,p=n(s),m=this.spread,h=p===`00:00`?` (start of the day)`:p===`24:00`?` (midnight)`:``;this.querySelector(`[data-hours]`).textContent=e?s.toFixed(1):`—`;let g=this.querySelector(`[data-clock]`);if(!e)this.querySelector(`[data-time]`).textContent=this.message,g.setAttribute(`aria-label`,`Developer Doomsday Clock: ${this.message}`);else if(m){let e=`${m.low.toFixed(1)}–${m.high.toFixed(1)}`;this.querySelector(`[data-time]`).textContent=`Forecast: likely ${e} hours to midnight`,g.setAttribute(`aria-label`,`Forecast of the Developer Doomsday Clock: about ${s.toFixed(1)} hours to midnight, likely between ${e}`)}else this.querySelector(`[data-time]`).textContent=`Clock reads ${p}${h}`,g.setAttribute(`aria-label`,`24-hour doomsday clock at ${s.toFixed(1)} hours to midnight, reading ${p}`);let _=r(`svg`,{viewBox:`0 0 320 320`,"aria-hidden":`true`});r(`circle`,{cx:u,cy:u,r:156,fill:`var(--surface-2)`},_),r(`circle`,{cx:u,cy:u,r:146,fill:`var(--clock-face)`,stroke:`var(--border)`,"stroke-width":1},_),r(`path`,{d:o(u,u,112,18*d,30*d),fill:`none`,stroke:`var(--ink)`,"stroke-width":14,opacity:.06},_),r(`path`,{d:o(u,u,112,23*d,24*d),fill:`none`,stroke:`var(--critical)`,"stroke-width":14,opacity:.35},_);let v=s/24*360;r(`circle`,{cx:u,cy:u,r:142,fill:`none`,stroke:`var(--grid)`,"stroke-width":4},_);let y=r(`circle`,{cx:u,cy:u,r:142,fill:`none`,stroke:`var(--${f[t(s)]})`,"stroke-width":4,"stroke-linecap":`round`,pathLength:360,"stroke-dasharray":`0 360`,transform:`rotate(${270-v} ${u} ${u})`,class:`countdown`},_);for(let e=0;e<96;e++){let t=e%4==0,n=e%24==0,a=e/4*d,o=i(u,u,136,a),s=i(u,u,n?120:t?126:131,a);r(`line`,{x1:s.x,y1:s.y,x2:o.x,y2:o.y,stroke:`var(--clock-ink)`,"stroke-width":n?3:t?1.75:1,"stroke-linecap":`round`,opacity:n?.9:t?.6:.25},_)}for(let e=0;e<24;e+=2){let t=e%6==0,n=i(u,u,92,e*d),a=r(`text`,{x:n.x,y:n.y,"text-anchor":`middle`,"dominant-baseline":`central`,fill:`var(--clock-ink)`,"font-size":t?17:12,"font-weight":t?700:500,opacity:t?1:.65,class:`tabular`},_);a.textContent=String(e).padStart(2,`0`)}for(let[e,t]of[[`AI REPLACEMENT INDEX`,204],[`24-HOUR DIAL`,216]]){let n=r(`text`,{x:u,y:t,"text-anchor":`middle`,fill:`var(--ink-muted)`,"font-size":8.5,"font-weight":600,"letter-spacing":`0.18em`},_);n.textContent=e}let b=this.hand(_,70,6),x=this.hand(_,112,3.5);if(m){let e=(24-m.high)*d,t=(24-m.low)*d,n=r(`path`,{d:l(u,u,96,e,Math.max(t,e+.5)),fill:`var(--clock-ink)`,opacity:.16*(1-this.faded)+.04},_);_.insertBefore(n,b),x.style.display=`none`}b.style.opacity=String(1-this.faded),e||(b.style.display=`none`,x.style.display=`none`,y.style.display=`none`);let S=r(`g`,{class:`hand second-hand`},_);r(`line`,{x1:u,y1:184,x2:u,y2:36,stroke:`var(--critical)`,"stroke-width":1.5,"stroke-linecap":`round`},S),r(`circle`,{cx:u,cy:u,r:7,fill:`var(--clock-ink)`},_),r(`circle`,{cx:u,cy:u,r:3,fill:`var(--critical)`},_),g.replaceChildren(_);let C=(e,t)=>{e.style.transform=`rotate(${t}deg)`};C(b,0),C(x,0);let w=()=>{C(b,c*d),C(x,360+c%1*360),y.setAttribute(`stroke-dasharray`,`${v} 360`)};this.drawn||a()?w():requestAnimationFrame(()=>requestAnimationFrame(w)),this.drawn=!0;let T=0,E=-1,D=()=>{let e=new Date().getSeconds();e<E&&T++,E=e,C(S,T*360+e*6)};D(),window.clearInterval(this.timer),a()||(this.timer=window.setInterval(D,1e3))}hand(e,t,n){let i=r(`g`,{class:`hand`},e);return r(`line`,{x1:u,y1:174,x2:u,y2:u-t,stroke:`var(--clock-ink)`,"stroke-width":n,"stroke-linecap":`round`},i),i}};customElements.get(p.tagName)||customElements.define(p.tagName,p);export{p as DoomsdayClockComponent,f as STATUS_COLOR};