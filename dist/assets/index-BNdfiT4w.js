const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./closure-evidence-DIYUr3KU.js","./metrics-CGSTutjD.js","./format-Cx1wN9EF.js","./dashboard-page-IdArafro.js","./doomsday-clock-Brqt63rM.js","./svg-CRpdUA4t.js","./velocity-gauge-BKI318t8.js","./trend-chart-CY7eOAL5.js","./doom-loop-C1MqTXZ5.js","./queue-compare-nMZPk00V.js","./weight-slider-DQhVH3P2.js","./practice-list-C8r4Gnuz.js","./replay-control-BWqwjn8-.js","./methodology-page-Bh2nI17l.js"])))=>i.map(i=>d[i]);
import{n as e}from"./rolldown-runtime-XKyaHtl9.js";(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),t.credentials=e.crossOrigin===`use-credentials`?`include`:e.crossOrigin===`anonymous`?`omit`:`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var t=(e,t,n)=>{let r=t.lastIndexOf(`?`),i=e[r===-1||r<t.lastIndexOf(`/`)?t:t.slice(0,r)];return i?typeof i==`function`?i():Promise.resolve(i):new Promise((e,r)=>{(typeof queueMicrotask==`function`?queueMicrotask:setTimeout)(r.bind(null,Error(`Unknown variable dynamic import: `+t+(t.split(`/`).length===n?``:`. Note that variables only represent file names one level deep.`))))})},n=`modulepreload`,r=function(e,t){return new URL(e,t).href},i={},a=function(e){return e.pathname.endsWith(`.css`)},o=function(e,t,n){if(t in e)return e[t];let r=n();if(!r){e[t]=void 0;return}let i=r.then(()=>{e[t]=void 0},n=>{throw e[t]=void 0,n});return e[t]=i,i},s=function(e,t,s){let c=Promise.resolve();if(t&&t.length>0){let e,l=document.querySelector(`meta[property=csp-nonce]`),u=l?.nonce||l?.getAttribute(`nonce`);function d(e){return Promise.all(e.map(e=>Promise.resolve(e).then(e=>({status:`fulfilled`,value:e}),e=>({status:`rejected`,reason:e}))))}function f(e){return import.meta.resolve?new URL(import.meta.resolve(e)):new URL(e,import.meta.url)}c=d(t.map(t=>{t=r(t,s);let c=f(t),l=a(c);return o(i,c.href,()=>{if(e===void 0){e={all:new Set,styles:new Set};let t=document.getElementsByTagName(`link`);for(let n=t.length-1;n>=0;n--){let r=t[n];e.all.add(r.href),r.rel===`stylesheet`&&e.styles.add(r.href)}}if((l?e.styles:e.all).has(c.href))return;let t=document.createElement(`link`);if(t.rel=l?`stylesheet`:n,l||(t.as=`script`),t.crossOrigin=``,t.href=c.href,u&&t.setAttribute(`nonce`,u),document.head.appendChild(t),l)return new Promise((e,n)=>{let r=i=>{t.removeEventListener(`load`,r),t.removeEventListener(`error`,r),i.type===`error`?n(Error(`Unable to preload CSS for ${c}`)):e(i)};t.addEventListener(`load`,r),t.addEventListener(`error`,r)})})}).filter(e=>e!==void 0))}function l(e){let t=new Event(`vite:preloadError`,{cancelable:!0});if(t.payload=e,window.dispatchEvent(t),!t.defaultPrevented)throw e}return c.then(t=>{for(let e of t||[])e.status===`rejected`&&l(e.reason);return e().catch(l)})},c=class e extends EventTarget{static instance;routes=[];currentPath=``;notFound;constructor(){super(),window.addEventListener(`popstate`,()=>{this.getAppPath()!==this.currentPath&&this.handleRoute()}),document.addEventListener(`click`,e=>this.handleLinkClick(e))}static getInstance(){return e.instance||=new e,e.instance}get baseUrl(){let e=new URL(document.baseURI).pathname;return e.endsWith(`/`)?e:e+`/`}getAppPath(){let{pathname:e,search:t}=window.location,n=this.baseUrl,r=e.startsWith(n)?e.slice(n.length-1):e;return r.length>1&&r.endsWith(`/`)&&(r=r.slice(0,-1)),r+t}registerRoute(e){let t=e.path.startsWith(`/`)?e.path:`/`+e.path,n=[],r=t.replace(/:([^/]+)/g,(e,t)=>(n.push(t),`([^\\/]+)`));this.routes.push({...e,path:t,regex:RegExp(`^${r}$`),paramNames:n})}start(){return this.handleRoute()}navigate(e){return this.go(e.startsWith(`/`)?e:`/`+e,!0)}handleRoute(){return this.go(this.getAppPath(),!1)}async go(e,t){let[n,r=``]=e.split(`?`),i=Object.fromEntries(new URLSearchParams(r)),a=this.findRoute(n),o={path:n,params:a?.params??{},query:i},s=e=>this.baseUrl+e.slice(1),c=await a?.route.beforeEnter?.(o);if(c===!1){!t&&this.currentPath&&window.history.pushState({},``,s(this.currentPath));return}if(typeof c==`string`)return this.navigate(c);let{pathname:l,search:u}=window.location;t&&l+u!==s(e)&&window.history.pushState({},``,s(e)),this.currentPath=e,a?await this.loadComponent(a.route.component,a.params,i):await this.show404(),this.dispatchEvent(new CustomEvent(`navigate`,{detail:o}))}findRoute(e){for(let t of this.routes){let n=e.match(t.regex);if(n){let e={};return t.paramNames.forEach((t,r)=>{e[t]=decodeURIComponent(n[r+1])}),{route:t,params:e}}}return null}async loadComponent(e,t={},n={}){try{await this.render(e,t,n)}catch(t){console.error(`Failed to load component: ${e}`,t),await this.show404()}}async show404(){try{if(this.notFound)return await this.render(this.notFound)}catch(e){console.error(`Failed to load component: ${this.notFound}`,e)}let e=document.querySelector(`#router-outlet`);e&&(e.innerHTML=`<h1>404 - Page Not Found</h1>`)}async render(e,n={},r={}){let i=document.querySelector(`#router-outlet`);if(!i)return;customElements.get(e)||await t(Object.assign({"../../components/closure-evidence/closure-evidence.ts":()=>s(()=>import(`./closure-evidence-DIYUr3KU.js`),__vite__mapDeps([0,1,2]),import.meta.url),"../../components/dashboard-page/dashboard-page.ts":()=>s(()=>import(`./dashboard-page-IdArafro.js`),__vite__mapDeps([3,1,2,4,5,6,7,8,9,0,10,11,12]),import.meta.url),"../../components/doom-loop/doom-loop.ts":()=>s(()=>import(`./doom-loop-C1MqTXZ5.js`),__vite__mapDeps([8,2,5]),import.meta.url),"../../components/doomsday-clock/doomsday-clock.ts":()=>s(()=>import(`./doomsday-clock-Brqt63rM.js`),__vite__mapDeps([4,1,5]),import.meta.url),"../../components/methodology-page/methodology-page.ts":()=>s(()=>import(`./methodology-page-Bh2nI17l.js`),__vite__mapDeps([13,1]),import.meta.url),"../../components/nav-page/nav-page.ts":()=>s(()=>Promise.resolve().then(()=>v),void 0,import.meta.url),"../../components/not-found-page/not-found-page.ts":()=>s(()=>import(`./not-found-page-EWN5Mgth.js`),[],import.meta.url),"../../components/practice-list/practice-list.ts":()=>s(()=>import(`./practice-list-C8r4Gnuz.js`),[],import.meta.url),"../../components/queue-compare/queue-compare.ts":()=>s(()=>import(`./queue-compare-nMZPk00V.js`),__vite__mapDeps([9,2]),import.meta.url),"../../components/replay-control/replay-control.ts":()=>s(()=>import(`./replay-control-BWqwjn8-.js`),__vite__mapDeps([12,2]),import.meta.url),"../../components/trend-chart/trend-chart.ts":()=>s(()=>import(`./trend-chart-CY7eOAL5.js`),__vite__mapDeps([7,1,2,5]),import.meta.url),"../../components/velocity-gauge/velocity-gauge.ts":()=>s(()=>import(`./velocity-gauge-BKI318t8.js`),__vite__mapDeps([6,1,2,5]),import.meta.url),"../../components/weight-slider/weight-slider.ts":()=>s(()=>import(`./weight-slider-DQhVH3P2.js`),[],import.meta.url)}),`../../components/${e}/${e}.ts`,5);let a=document.createElement(e);Object.assign(a,n),a.params=n,a.query=r,i.replaceChildren(a)}handleLinkClick(e){if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;let t=e.target.closest(`a[href]`);if(!t||t.hasAttribute(`target`)||t.hasAttribute(`download`))return;let n=t.getAttribute(`href`);n.startsWith(`#`)?(e.preventDefault(),window.location.hash=n):n.startsWith(`/`)&&!n.startsWith(`//`)&&(e.preventDefault(),this.navigate(n))}},l=class extends HTMLElement{template;constructor(e,t){super();let n=this.tagName.toLowerCase(),r=t.replace(/:host/g,n);this.template=document.createElement(`template`),this.template.innerHTML=`<style>${r}</style>${e}`}connectedCallback(){this.replaceChildren(this.template.content.cloneNode(!0)),this.init()}init(){}delegate(e,t,n){this.addEventListener(e,e=>{let r=e.target.closest(t);r&&this.contains(r)&&n.call(this,e,r)})}},u=`https://github.com/sholtomaud/repo-sre-dashboard`,d=`data/data.csv`,f={repository:`this repository`,repositoryUrl:``,issuesUrl:``,title:`Developer Doomsday Clock`,queue:null,why:null};function p(e){let t=e??{},n=e=>typeof t[e]==`string`&&t[e]?t[e]:``,r=t.queue,i=t.why;return{repository:n(`repository`)||f.repository,repositoryUrl:n(`repository_url`),issuesUrl:n(`issues_url`),title:n(`title`)||f.title,queue:r&&typeof r.open_dir==`string`?{name:String(r.name||`Agents' own queue`),repository:String(r.repository??``),openDir:String(r.open_dir),resolvedDir:String(r.resolved_dir??``)}:null,why:i&&typeof i.text==`string`&&i.text?{text:i.text,url:typeof i.url==`string`?i.url:``}:null}}var m=null;function h(e=fetch,t=`data/config.json`){return m??=e(t,{cache:`no-cache`}).then(e=>e.ok?e.json():null).then(p).catch(()=>f),m}var g=`<header class="nav">
  <div class="nav-inner">
    <a href="/" class="brand">
      <img src="favicon.svg" alt="" width="28" height="28" />
      <span class="brand-text" data-brand>Developer Doomsday Clock</span>
      <span class="sr-only">Developer Doomsday Clock home</span>
    </a>
    <nav data-nav aria-label="Main">
      <a href="/">Dashboard</a>
      <a href="/methodology">Methodology</a>
      <a data-source-link target="_blank" rel="noopener noreferrer" hidden
        >Repository</a
      >
    </nav>
  </div>
</header>
`,_=`:host {
  display: block;
  position: sticky;
  top: 0;
  z-index: 50;
}
:host .nav {
  backdrop-filter: blur(12px);
  background: var(--nav-bg);
  border-bottom: 1px solid var(--border);
}
:host .nav-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
  height: 3.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}
@media (min-width: 640px) {
  :host .nav-inner {
    padding: 0 1.5rem;
  }
}
:host .brand {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  color: var(--ink);
  font-weight: 700;
  letter-spacing: -0.01em;
  text-decoration: none;
  white-space: nowrap;
}
:host .brand-sub {
  margin-left: 0.25rem;
  padding: 0.0625rem 0.375rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--ink-muted);
}
:host nav {
  display: flex;
  gap: 0.125rem;
  font-size: 0.875rem;
}
:host nav a {
  padding: 0.375rem 0.625rem;
  border-radius: 8px;
  color: var(--ink-2);
  text-decoration: none;
  transition:
    background 0.15s,
    color 0.15s;
}
:host nav a:hover {
  background: var(--surface-2);
  color: var(--ink);
}
:host nav a[aria-current='page'] {
  color: var(--ink);
  font-weight: 600;
}
@media (max-width: 480px) {
  :host .brand-sub,
  :host .brand-text {
    display: none;
  }
}
`,v=e({NavComponent:()=>y}),y=class extends l{static tagName=`app-nav`;constructor(){super(g,_)}init(){h().then(e=>{let t=this.querySelector(`[data-source-link]`);t.hidden=!e.repositoryUrl,t.href=e.repositoryUrl,this.querySelector(`[data-brand]`).textContent=e.title,document.title=`${e.title} · ${e.repository}`}),c.getInstance().addEventListener(`navigate`,e=>{let{path:t}=e.detail;this.querySelectorAll(`[data-nav] a`).forEach(e=>{e.getAttribute(`href`)===t?e.setAttribute(`aria-current`,`page`):e.removeAttribute(`aria-current`)})})}};customElements.get(y.tagName)||customElements.define(y.tagName,y);var b=c.getInstance();if(b.notFound=`not-found-page`,b.registerRoute({path:`/`,component:`dashboard-page`}),b.registerRoute({path:`/methodology`,component:`methodology-page`}),b.start(),`serviceWorker`in navigator){let e=!navigator.serviceWorker.controller;navigator.serviceWorker.register(`sw.js`),navigator.serviceWorker.ready.then(({active:t})=>{if(e){let e=performance.getEntriesByType(`resource`);t?.postMessage(e.map(e=>e.name))}})}export{s as a,l as i,u as n,h as r,d as t};