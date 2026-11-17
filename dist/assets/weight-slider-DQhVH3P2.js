import{i as e}from"./index-BNdfiT4w.js";var t=`<section class="card weighting" aria-labelledby="weighting-title">
  <div class="weighting-head">
    <div>
      <h2 id="weighting-title">How the two queues are combined</h2>
      <p>
        The combined clock, dial and doom loop weight the public issues against
        the agents' own queue. Drag to see how the picture changes.
      </p>
    </div>
    <p class="weighting-readout tabular" data-readout aria-live="polite"></p>
  </div>
  <div class="weighting-control">
    <span class="weighting-end">Agents' queue only</span>
    <div class="weighting-track">
      <input
        type="range"
        min="0"
        max="100"
        step="1"
        value="50"
        data-range
        aria-label="Weight given to the public issues, percent"
      />
      <div class="weighting-ticks" data-ticks aria-hidden="true"></div>
    </div>
    <span class="weighting-end">Public issues only</span>
  </div>
  <div
    class="weighting-marks"
    data-marks
    role="group"
    aria-label="Preset weightings"
  ></div>
</section>
`,n=`:host {
  display: block;
}
:host .weighting {
  padding: 1.125rem 1.25rem;
}
@media (min-width: 640px) {
  :host .weighting {
    padding: 1.25rem 1.75rem;
  }
}
:host .weighting-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem 2rem;
}
:host h2 {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
}
:host .weighting-head p {
  margin: 0.25rem 0 0;
  font-size: 0.8125rem;
  color: var(--ink-muted);
}
:host .weighting-head .weighting-readout {
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 650;
  color: var(--ink);
  white-space: nowrap;
}
:host .weighting-control {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0.875rem;
  margin-top: 1rem;
}
:host .weighting-end {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--ink-2);
}
@media (max-width: 560px) {
  :host .weighting-end {
    display: none;
  }
  :host .weighting-control {
    grid-template-columns: 1fr;
  }
}
:host .weighting-track {
  position: relative;
  padding-bottom: 0.625rem;
}
:host input[type='range'] {
  display: block;
  width: 100%;
  margin: 0;
  accent-color: var(--ink);
  cursor: pointer;
}
/* Ticks sit under the track, inset by half the thumb's width. */
:host .weighting-ticks {
  position: absolute;
  left: 8px;
  right: 8px;
  bottom: 0;
  height: 8px;
}
:host .weighting-ticks span {
  position: absolute;
  top: 0;
  width: 2px;
  height: 8px;
  margin-left: -1px;
  border-radius: 1px;
  background: var(--axis);
}
:host .weighting-marks {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin-top: 0.75rem;
}
:host .weighting-marks button {
  padding: 0.25rem 0.625rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: transparent;
  color: var(--ink-2);
  font: inherit;
  font-size: 0.8125rem;
  cursor: pointer;
  transition: background 0.15s;
}
:host .weighting-marks button:hover {
  background: var(--surface-2);
}
:host .weighting-marks button[aria-pressed='true'] {
  border-color: var(--ink);
  color: var(--ink);
  font-weight: 600;
}
:host .weighting-marks .mark-value {
  margin-left: 0.25rem;
  color: var(--ink-muted);
  font-weight: 400;
}
`,r=`public-weight`,i=`public-weight-mark`,a=class extends e{static tagName=`weight-slider`;value=.5;presets=[];chosenMark=null;constructor(){super(t,n)}static saved(){try{let e=window.localStorage.getItem(r),t=e===null?NaN:Number(e);return t>=0&&t<=1?t:null}catch{return null}}static savedMark(){try{return window.localStorage.getItem(i)||null}catch{return null}}set mark(e){this.chosenMark=e,this.isConnected&&this.render()}get mark(){return this.chosenMark}set marks(e){this.presets=e,this.isConnected&&this.render()}get marks(){return this.presets}set weight(e){this.value=Math.min(1,Math.max(0,e)),this.isConnected&&this.render()}get weight(){return this.value}init(){let e=this.querySelector(`[data-range]`);e.addEventListener(`input`,()=>this.choose(Number(e.value)/100,null)),this.delegate(`click`,`[data-mark]`,(e,t)=>this.choose(Number(t.dataset.weight),t.dataset.mark)),this.render()}choose(e,t){this.chosenMark=t,this.weight=e;try{window.localStorage.setItem(r,String(this.value)),window.localStorage.setItem(i,t??``)}catch{}this.dispatchEvent(new CustomEvent(`weight-change`,{detail:this.value,bubbles:!0}))}render(){let e=Math.round(this.value*100);this.querySelector(`[data-range]`).value=String(e),this.querySelector(`[data-readout]`).textContent=`Public issues ${e}% · agents' queue ${100-e}%`,this.querySelector(`[data-ticks]`).replaceChildren(...this.presets.map(e=>{let t=document.createElement(`span`);return t.style.left=`${e.weight*100}%`,t})),this.querySelector(`[data-marks]`).replaceChildren(...this.presets.map(t=>{let n=document.createElement(`button`);n.type=`button`,n.dataset.mark=t.id,n.dataset.weight=String(t.weight),n.setAttribute(`aria-pressed`,String(this.chosenMark?t.id===this.chosenMark:Math.round(t.weight*100)===e));let r=document.createElement(`span`);return r.className=`mark-value tabular`,r.textContent=`${o(t.weight)} public`,n.append(t.label,r),n}))}};function o(e){let t=e*100;return t>0&&t<1?`${t.toFixed(1)}%`:`${Math.round(t)}%`}customElements.get(a.tagName)||customElements.define(a.tagName,a);export{a as WeightSliderComponent};