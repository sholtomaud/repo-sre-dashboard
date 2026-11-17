import{h as e}from"./index-Cze6PZ7Z.js";import{n as t}from"./format-Cx1wN9EF.js";var n=`<div class="replay" data-replay hidden>
  <button type="button" class="replay-button" data-play>
    <span class="replay-icon" data-icon aria-hidden="true">▶</span>
    <span data-play-label>Replay the record</span>
  </button>
  <div class="replay-track">
    <input
      type="range"
      class="replay-scrubber"
      min="0"
      max="1"
      step="0.01"
      value="1"
      data-scrubber
      aria-label="Position in the record and forecast"
    />
    <span class="replay-today" data-today aria-hidden="true" hidden>
      <span>Today</span>
    </span>
  </div>
  <span class="replay-date tabular" data-date aria-live="off">Live</span>
</div>
`,r=`:host {
  display: block;
}
:host .replay {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0.75rem;
}
:host .replay[hidden] {
  display: none;
}
:host .replay-button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.875rem 0.4rem 0.625rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--ink);
  color: var(--page);
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}
:host .replay-button:hover {
  opacity: 0.88;
}
:host .replay-icon {
  display: inline-block;
  width: 1em;
  font-size: 0.75rem;
  text-align: center;
}
:host .replay-track {
  position: relative;
  min-width: 0;
  padding-bottom: 0.875rem;
}
/* Today's place: the forecast runs to the right of it. */
:host .replay-today {
  position: absolute;
  top: 0;
  bottom: 0;
  left: calc(8px + (100% - 16px) * var(--today, 1));
  width: 2px;
  margin-left: -1px;
  background: var(--ink-muted);
  pointer-events: none;
}
:host .replay-today[hidden] {
  display: none;
}
:host .replay-today span {
  position: absolute;
  bottom: -0.125rem;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ink-muted);
  white-space: nowrap;
}
:host .replay-scrubber {
  display: block;
  width: 100%;
  min-width: 0;
  margin: 0;
  accent-color: var(--ink);
  cursor: pointer;
}
:host .replay-date {
  min-width: 6.5rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--ink-2);
  text-align: right;
}
:host .replay[data-state='replaying'] .replay-date,
:host .replay[data-state='forecast'] .replay-date {
  color: var(--ink);
}
:host .replay-date {
  min-width: 9rem;
}
@media (max-width: 420px) {
  :host .replay {
    grid-template-columns: 1fr auto;
  }
  :host .replay-track {
    grid-column: 1 / -1;
    grid-row: 2;
  }
}
`,i=.45,a=class extends e{static tagName=`replay-control`;days=[];todayIndex=0;position=0;playing=!1;frame=0;lastTick=0;constructor(){super(n,r)}setDays(e,t=e.length-1){let n=this.isLive;this.days=e,this.todayIndex=Math.min(Math.max(t,0),Math.max(0,e.length-1)),(n||this.position>this.end)&&(this.position=this.todayIndex),this.isConnected&&this.render()}set dates(e){this.setDays(e)}get dates(){return this.days}get end(){return Math.max(0,this.days.length-1)}get isLive(){return!this.playing&&this.position===this.todayIndex}init(){this.position=this.todayIndex,this.delegate(`click`,`[data-play]`,()=>this.toggle());let e=this.querySelector(`[data-scrubber]`);e.addEventListener(`input`,()=>{let t=Number(e.value);this.pause(),this.moveTo(t)}),this.render()}disconnectedCallback(){cancelAnimationFrame(this.frame)}toggle(){this.playing?this.pause():((this.isLive||this.position>=this.end)&&(this.position=0),this.playing=!0,this.lastTick=performance.now(),this.frame=requestAnimationFrame(e=>this.tick(e)),this.moveTo(this.position))}pause(){this.playing=!1,cancelAnimationFrame(this.frame),this.render()}tick(e){if(!this.playing)return;let t=(e-this.lastTick)/1e3;this.lastTick=e;let n=this.position+t/i;n>=this.end?(this.playing=!1,this.moveTo(this.todayIndex)):(this.moveTo(n),this.frame=requestAnimationFrame(e=>this.tick(e)))}moveTo(e){this.position=Math.min(Math.max(e,0),this.end),this.render(),this.dispatchEvent(new CustomEvent(`replay-position`,{detail:this.isLive?null:this.position,bubbles:!0}))}render(){let e=this.querySelector(`[data-replay]`);if(e.hidden=this.days.length<2,e.hidden)return;let n=this.isLive,r=this.position>this.todayIndex;e.dataset.state=n?`live`:r?`forecast`:`replaying`;let i=this.querySelector(`[data-scrubber]`);i.max=String(this.end),i.value=String(this.position);let a=this.days[Math.min(Math.round(this.position),this.end)],o=n?`Live`:r?`Forecast · ${t(a)}`:t(a);i.setAttribute(`aria-valuetext`,o),this.querySelector(`[data-date]`).textContent=o;let s=this.querySelector(`[data-today]`),c=this.end>0?this.todayIndex/this.end:1;s.hidden=this.todayIndex>=this.end,e.style.setProperty(`--today`,String(c)),this.querySelector(`[data-icon]`).textContent=this.playing?`❚❚`:`▶`,this.querySelector(`[data-play-label]`).textContent=this.playing?`Pause`:n?this.todayIndex<this.end?`Replay and forecast`:`Replay the record`:`Resume`}};customElements.get(a.tagName)||customElements.define(a.tagName,a);export{a as ReplayControlComponent};