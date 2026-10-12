(function(){
'use strict';
/* Japan Earth — CesiumJS + Google Photorealistic 3D Tiles via Cesium ion (free Community plan).
   Token below is public by design: read-only and restricted to https://tds987.github.io in Cesium ion. */
const ION_TOKEN='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6ImNmRjhRZDhjTGE3RUJEa0YiLCJqdGkiOiIyNWQyOGQxYi1lMTlkLTQ2NWQtOWRkYS05MGFlMTlmZmVjMGUiLCJpZCI6NTIyMTUxLCJzdWIiOiJUSmFwYW4iLCJpc3MiOiJodHRwczovL2FwaS5jZXNpdW0uY29tIiwiYXVkIjoiSmFwYW4gRWFydGggd2ViIGFwcCIsImlhdCI6MTc5MTg0NTQzOX0.GrNzQ-NTtedlcCtkU_2Y4vTToeD88J_npw9iE0-XG_4';

const $=s=>document.querySelector(s);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LS={get(k,d){try{const v=localStorage.getItem('tje_'+k);return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem('tje_'+k,JSON.stringify(v))}catch(e){}}};
let RATE=LS.get('rate',158.3);
const layerOn=Object.assign(Object.fromEntries(LAYERS.map(l=>[l.id,true])),LS.get('layers',{}));
let bourdainOnly=false;
const layerOf=id=>LAYERS.find(l=>l.id===id);

if(!window.Cesium){$('#loading').textContent='The 3D engine did not load. Check your connection and reopen.';return}
Cesium.Ion.defaultAccessToken=ION_TOKEN;

/* ---------- viewer ---------- */
const viewer=new Cesium.Viewer('stage',{
  animation:false,timeline:false,baseLayerPicker:false,geocoder:false,homeButton:false,sceneModePicker:false,
  navigationHelpButton:false,fullscreenButton:false,infoBox:false,selectionIndicator:false,
  creditContainer:'credits',requestRenderMode:true,maximumRenderTimeChange:Infinity,
  baseLayer:false,terrainProvider:new Cesium.EllipsoidTerrainProvider()
});
const scene=viewer.scene,camera=viewer.camera;
scene.skyAtmosphere.show=true;scene.fog.enabled=true;
scene.globe.baseColor=Cesium.Color.fromCssColorString('#0d1a33');
scene.globe.enableLighting=false;
scene.screenSpaceCameraController.enableCollisionDetection=true;

let mode='photo';
function chip(t){const c=$('#modeChip');if(!t){c.hidden=true;return}c.textContent=t;c.hidden=false}
async function setupFallback(){
  mode='satellite';
  try{scene.globe.show=true;
    viewer.imageryLayers.addImageryProvider(await Cesium.IonImageryProvider.fromAssetId(2));
    viewer.terrainProvider=await Cesium.CesiumTerrainProvider.fromIonAssetId(1);
  }catch(e){}
  chip('Satellite mode · photoreal 3D unavailable right now');setTimeout(()=>chip(null),6000);
}
let tileset=null;
async function setupPhoto(){
  try{
    tileset=await Cesium.createGooglePhotorealistic3DTileset(undefined,{showCreditsOnScreen:true,maximumScreenSpaceError:LS.get('lite',false)?24:16});
    scene.primitives.add(tileset);scene.globe.show=false;
    tileset.tileFailed.addEventListener(()=>{});
  }catch(e){console.warn('Photoreal tiles failed',e);await setupFallback()}
}

/* ---------- pins ---------- */
function pinImage(color,glyph,ring){
  const c=document.createElement('canvas'),s=2,W=40*s,H=52*s;c.width=W;c.height=H;const g=c.getContext('2d');
  g.scale(s,s);g.shadowColor='rgba(0,0,0,.55)';g.shadowBlur=5;g.shadowOffsetY=2;
  g.beginPath();g.moveTo(20,50);g.bezierCurveTo(20,40,4,32,4,18);g.arc(20,18,16,Math.PI,0);g.bezierCurveTo(36,32,20,40,20,50);g.closePath();
  g.fillStyle=color;g.fill();g.shadowColor='transparent';g.lineWidth=2.5;g.strokeStyle=ring||'rgba(255,255,255,.95)';g.stroke();
  g.fillStyle='#111';g.font='600 15px system-ui,sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(glyph,20,18.5);
  return c.toDataURL();
}
const ents=new Map();
function makePins(){
  PLACES.forEach(p=>{const L=layerOf(p.layer);
    const e=viewer.entities.add({
      id:'p_'+p.id,position:Cesium.Cartesian3.fromDegrees(p.lon,p.lat,0),
      billboard:{image:pinImage(L.color,L.glyph),width:30,height:39,verticalOrigin:Cesium.VerticalOrigin.BOTTOM,
        heightReference:Cesium.HeightReference.CLAMP_TO_GROUND,disableDepthTestDistance:Number.POSITIVE_INFINITY,
        scaleByDistance:new Cesium.NearFarScalar(2e3,1.15,3e6,.55)},
      label:{text:p.name+(p.bourdain?'  ·AB':''),font:'500 13px "Zen Kaku Gothic New",system-ui,sans-serif',fillColor:Cesium.Color.WHITE,
        showBackground:true,backgroundColor:Cesium.Color.fromCssColorString('rgba(7,11,23,.78)'),backgroundPadding:new Cesium.Cartesian2(6,3),
        verticalOrigin:Cesium.VerticalOrigin.TOP,pixelOffset:new Cesium.Cartesian2(0,4),heightReference:Cesium.HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance:Number.POSITIVE_INFINITY,distanceDisplayCondition:new Cesium.DistanceDisplayCondition(0,p.layer==='series'?900000:180000)}
    });ents.set(p.id,{e,p})});
  refreshPins();
}
function refreshPins(){
  ents.forEach(({e,p})=>{e.show=layerOn[p.layer]&&(!bourdainOnly||p.bourdain);
    const st=store.marks[p.id],L=layerOf(p.layer);
    e.billboard.image=pinImage(L.color,st==='visited'?'✓':L.glyph,st==='visited'?'#6fd6a0':st==='want'?'#e9b44c':null)});
  scene.requestRender();
}
const handler=new Cesium.ScreenSpaceEventHandler(scene.canvas);
handler.setInputAction(m=>{const pick=scene.pick(m.position);
  if(pick&&pick.id&&typeof pick.id.id==='string'&&pick.id.id.startsWith('p_')){openPlace(pick.id.id.slice(2),true)}
  closeResults()},Cesium.ScreenSpaceEventType.LEFT_CLICK);

/* ---------- camera ---------- */
const HOME={lon:136.6,lat:30.2,h:1250000,heading:0,pitch:-52};
function flyTo(o,dur,done){
  camera.flyTo({destination:Cesium.Cartesian3.fromDegrees(o.lon,o.lat,o.h),
    orientation:{heading:Cesium.Math.toRadians(o.heading??0),pitch:Cesium.Math.toRadians(o.pitch??-45),roll:0},
    duration:dur,complete:done,easingFunction:Cesium.EasingFunction.QUADRATIC_IN_OUT});
}
function flyToPlace(p,close){
  const range=close?1100:(p.layer==='autumn'?60000:p.layer==='outdoors'?14000:5200);
  const pitch=close?-24:-38,hd=Cesium.Math.toDegrees(camera.heading);
  camera.flyToBoundingSphere(new Cesium.BoundingSphere(Cesium.Cartesian3.fromDegrees(p.lon,p.lat,close?40:0),10),
    {offset:new Cesium.HeadingPitchRange(Cesium.Math.toRadians(hd),Cesium.Math.toRadians(pitch),range),duration:close?2.2:undefined});
}
$('#zin').onclick=()=>{camera.zoomIn(camera.positionCartographic.height*.5);scene.requestRender()};
$('#zout').onclick=()=>{camera.zoomOut(camera.positionCartographic.height*1);scene.requestRender()};
$('#compass').onclick=()=>{const c=pickCenter();if(!c)return;
  camera.flyToBoundingSphere(new Cesium.BoundingSphere(c,1),{offset:new Cesium.HeadingPitchRange(0,Cesium.Math.toRadians(-89.9),Cesium.Cartesian3.distance(camera.positionWC,c)),duration:.8})};
$('#tiltbtn').onclick=()=>{const c=pickCenter();if(!c)return;const d=Cesium.Cartesian3.distance(camera.positionWC,c);
  const tilted=camera.pitch>Cesium.Math.toRadians(-70);
  camera.flyToBoundingSphere(new Cesium.BoundingSphere(c,1),{offset:new Cesium.HeadingPitchRange(camera.heading,Cesium.Math.toRadians(tilted?-89.9:-30),d),duration:.8})};
$('#home').onclick=()=>{closeSheet();flyTo(HOME,2.2)};
function pickCenter(){const w=scene.canvas.clientWidth,h=scene.canvas.clientHeight,pt=new Cesium.Cartesian2(w/2,h/2);
  let c=scene.pickPositionSupported?scene.pickPosition(pt):undefined;
  if(!c){const ray=camera.getPickRay(pt);c=scene.globe.pick(ray,scene)||Cesium.IntersectionTests.rayEllipsoid(ray,Cesium.Ellipsoid.WGS84)&&Cesium.Ray.getPoint(ray,Cesium.IntersectionTests.rayEllipsoid(ray,Cesium.Ellipsoid.WGS84).start)}
  return c}
scene.postRender.addEventListener(()=>{const c=camera.positionCartographic,alt=c.height/1000;
  $('#hud').textContent=`${Math.abs(Cesium.Math.toDegrees(c.latitude)).toFixed(2)}°N ${Math.abs(Cesium.Math.toDegrees(c.longitude)).toFixed(2)}°E · eye ${alt<10?alt.toFixed(2):Math.round(alt).toLocaleString('en-US')} km`;
  $('#compass svg').style.transform=`rotate(${-Cesium.Math.toDegrees(camera.heading)}deg)`;
  $('#tiltbtn').classList.toggle('on',camera.pitch>Cesium.Math.toRadians(-70))});

/* ---------- money & dates ---------- */
const fmtY=n=>'¥'+Math.round(n).toLocaleString('en-US');
const fmtD=n=>{const u=n/RATE;return '$'+(u<10?u.toFixed(2):Math.round(u).toLocaleString('en-US'))};
function priceHTML(p){
  if(p.ticket)return `<div class="price"><span class="yen">≤ ${fmtY(200*RATE)}</span><span class="usd">your $200 ticket ceiling</span></div>`;
  if(!p.yen)return '';
  if(p.yen[1]===0)return `<div class="price"><span class="yen">Free</span><span class="usd">¥0 · $0</span></div>`;
  const y=p.yen[0]===p.yen[1]?fmtY(p.yen[0]):`${fmtY(p.yen[0])}–${fmtY(p.yen[1]).slice(1)}`;
  const d=p.yen[0]===p.yen[1]?fmtD(p.yen[0]):`${fmtD(p.yen[0])}–${fmtD(p.yen[1]).slice(1)}`;
  return `<div class="price"><span class="yen">${p.est?'≈ ':''}${y}</span><span class="usd">${p.est?'≈ ':''}${d}</span></div>${p.est?'<p class="note">Estimate. Verify on the ground.</p>':''}`}
const dt=s=>new Date(s+'T12:00:00');
const md=s=>dt(s).toLocaleDateString('en-US',{month:'short',day:'numeric'});
function seasonChip(p){
  if(p.peak){const a=dt(p.peak[0]),b=dt(p.peak[1]),s=dt(TRIP.start),e=dt(TRIP.end);
    let t,cls='';if(b<s)t='Peaks before you land';else if(a>e)t='Peaks after you leave';else if(a<=s)t='Peaking as you arrive';else if(b>=e&&a>dt('2026-11-08'))t='Starts turning as you leave';else{t='Peaks during your trip';cls='gold'}
    return `<span class="chip ${cls}">${t}</span><span class="chip">Typical peak ${md(p.peak[0])}–${md(p.peak[1])}</span>`}
  if(p.start)return `<span class="chip gold">${p.start===p.end?md(p.start):md(p.start)+'–'+md(p.end)}</span>`;
  return ''}

/* ---------- sheet ---------- */
const sheet=$('#sheet'),body=$('#sheetBody');let sheetMode=null;
function openSheet(html,m){body.innerHTML=html;body.scrollTop=0;sheet.classList.add('open');sheetMode=m;setTab(m==='series'?'series':m==='journal'?'journal':'map')}
function closeSheet(){sheet.classList.remove('open');sheetMode=null;setTab('map')}
$('#sheetClose').onclick=closeSheet;
function setTab(t){['map','series','journal'].forEach(x=>$('#tab-'+x).setAttribute('aria-selected',x===t))}
$('#tab-map').onclick=closeSheet;$('#tab-series').onclick=()=>showSeries();$('#tab-journal').onclick=()=>showJournal();
let sy=null;sheet.querySelector('.grab').addEventListener('pointerdown',e=>{sy=e.clientY});
addEventListener('pointerup',e=>{if(sy!=null&&e.clientY-sy>50)closeSheet();sy=null});

function openPlace(id,fly){
  const p=PLACES.find(x=>x.id===id);if(!p)return;const L=layerOf(p.layer),st=store.marks[id];
  const gm=`https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}`;
  openSheet(`
   <div class="hero" style="background:linear-gradient(135deg,${L.color},${L.color}66 60%,#0d1426)"><div class="kanji" aria-hidden="true">${esc(p.jp.slice(0,3))}</div>
     <div class="chips"><span class="chip">${L.glyph} ${esc(L.label)}</span>${p.bourdain?'<span class="chip gold">Bourdain was here</span>':''}</div></div>
   <div class="eyebrow">${esc(p.city)}${p.dates?' · '+esc(p.dates):''}</div>
   <h2>${esc(p.name)}</h2><div class="jp">${esc(p.jp)}</div>
   <div class="chips" style="margin-top:10px">${p.status?`<span class="chip hot">${esc(p.status)}</span>`:''}${seasonChip(p)}</div>
   <p class="why">${esc(p.why)}</p>
   ${priceHTML(p)}
   ${p.tips?`<ul class="tips">${p.tips.map(t=>`<li>${esc(t)}</li>`).join('')}</ul>`:''}
   <div class="actions">
     <button class="btn ${st==='want'?'wanton':''}" data-mark="want">${st==='want'?'★ On my list':'☆ Want to go'}</button>
     <button class="btn ${st==='visited'?'on':''}" data-mark="visited">${st==='visited'?'✓ Been here':'Mark visited'}</button>
     <button class="btn" id="flyclose">Street-level 3D</button>
     <button class="btn primary" id="writeHere">Write entry</button>
   </div>
   <p class="note" style="margin-top:12px"><a href="${gm}" target="_blank" rel="noopener" style="color:var(--gold)">Directions in Google Maps ↗</a> · ${p.lat.toFixed(4)}°N ${p.lon.toFixed(4)}°E</p>`,'place');
  body.querySelectorAll('[data-mark]').forEach(b=>b.onclick=()=>{const m=b.dataset.mark;store.setMark(id,store.marks[id]===m?null:m);openPlace(id,false)});
  $('#flyclose').onclick=()=>{closeSheet();flyToPlace(p,true)};
  $('#writeHere').onclick=()=>showJournal({compose:true,place:id});
  if(fly)flyToPlace(p,false);
}

function showLayers(){
  const n=id=>PLACES.filter(p=>p.layer===id).length;
  openSheet(`<div class="eyebrow">Map layers</div><h2>What to show</h2>
   ${LAYERS.map(l=>`<div class="layer"><div class="sw" style="background:${l.color}">${l.glyph}</div><div class="t"><b>${esc(l.label)} <span class="jp" style="font-size:12px">${l.jp}</span></b><span>${n(l.id)?n(l.id)+' places':l.id==='concert'?'Nothing from your Spotify artists in Japan Oct 22–Nov 14 yet':'None yet'}</span></div>
   <button class="tog" role="switch" aria-checked="${layerOn[l.id]}" aria-label="${esc(l.label)}" data-l="${l.id}"></button></div>`).join('')}
   <div class="layer"><div class="sw" style="background:var(--gold);font:700 10px var(--f-data)">AB</div><div class="t"><b>Bourdain places only</b><span>Spots Anthony Bourdain ate, drank or stayed</span></div><button class="tog" role="switch" aria-checked="${bourdainOnly}" aria-label="Bourdain places only" id="bdtog"></button></div>
   <h3>Map</h3>
   <div class="layer"><div class="t"><b>Data saver</b><span>Lower-detail 3D. Faster on weak signal, uses less of your eSIM data.</span></div><button class="tog" role="switch" aria-checked="${LS.get('lite',false)}" id="litetog" aria-label="Data saver"></button></div>
   <p class="note">Now showing: ${mode==='photo'?'Google photorealistic 3D':'satellite imagery with 3D terrain'}. Free plan: 1,000 photoreal loads a month; one per app open.</p>
   <h3>Money</h3><label class="f" for="rate">Yen per US dollar</label><input class="inp" id="rate" type="number" step="0.1" inputmode="decimal" value="${RATE}">
   <p class="note">Set Oct 10, 2026 at the mid-market rate. Your card will run a little worse.</p>
   <h3>Your data</h3><p class="note">Your marks and journal are saved in this browser on this device. Use backup to move them or keep a safe copy.</p>
   <div class="actions"><button class="btn" id="exportBtn">Copy backup</button><button class="btn" id="importBtn">Restore backup</button></div>
   <textarea class="inp" id="backupBox" hidden placeholder="Paste a backup here, then tap Restore again" style="margin-top:8px;min-height:80px"></textarea>`,'layers');
  body.querySelectorAll('[data-l]').forEach(b=>b.onclick=()=>{const id=b.dataset.l;layerOn[id]=!layerOn[id];b.setAttribute('aria-checked',layerOn[id]);LS.set('layers',layerOn);refreshPins()});
  $('#bdtog').onclick=e=>{bourdainOnly=!bourdainOnly;e.currentTarget.setAttribute('aria-checked',bourdainOnly);refreshPins()};
  $('#litetog').onclick=e=>{const v=!LS.get('lite',false);LS.set('lite',v);e.currentTarget.setAttribute('aria-checked',v);if(tileset){tileset.maximumScreenSpaceError=v?24:16;scene.requestRender()}};
  $('#rate').onchange=e=>{const v=parseFloat(e.target.value);if(v>50&&v<400){RATE=v;LS.set('rate',v);toast('Rate updated')}};
  $('#exportBtn').onclick=async()=>{const data=JSON.stringify({marks:store.marks,entries:store.entries.map(({photo,...r})=>r)});
    try{await navigator.clipboard.writeText(data);toast('Backup copied. Paste it into Notes or email it to yourself.')}catch(e){const b=$('#backupBox');b.hidden=false;b.value=data;b.select();toast('Select all and copy')}};
  $('#importBtn').onclick=()=>{const b=$('#backupBox');if(b.hidden||!b.value.trim()){b.hidden=false;b.value='';b.focus();return}
    try{const d=JSON.parse(b.value);store.marks=Object.assign(store.marks,d.marks||{});(d.entries||[]).forEach(en=>{if(!store.entries.find(x=>x.id===en.id))store.entries.push(en)});store.save();refreshPins();toast('Backup restored')}catch(e){toast('That backup text is not valid. Copy it again and retry.')}};
}
$('#layersBtn').onclick=()=>sheetMode==='layers'?closeSheet():showLayers();

function showSeries(){
  const g=(d,dow,title,where,id,cls)=>`<div class="game ${cls||''}"><div class="d">${dow}<b>${d}</b></div><div class="g"><b>${title}</b><p>${where}</p>${id?`<button data-go="${id}">Show on map ›</button>`:''}</div></div>`;
  openSheet(`<div class="eyebrow">Oct 24 – Nov 1 · 2-3-2 format</div><h2>Following the Japan Series</h2>
   <p class="why">Matchups lock when the Climax Series finals end, Oct 14–19 (rain dates to Oct 21). Right now the favorites are <b>Hanshin</b> (CL first place, hosting at Koshien) and <b>SoftBank</b> (PL champs, starting with an edge). Venues below follow that guess and will update.</p>
   ${g('22','THU','Land in Tokyo','Flight Oct 21 or 22 · ~$680 one-way, not booked yet',null,'off')}
   ${g('24','SAT','Game 1','Koshien (if Hanshin) · Central League park','koshien')}
   ${g('25','SUN','Game 2','Koshien · stay in Osaka, eat in Shinsekai','koshien')}
   ${g('26','MON','Travel day','Shin-Osaka → Hakata ≈2.5h. Himeji Castle is on the way.','himeji','off')}
   ${g('27','TUE','Game 3','Fukuoka dome (if SoftBank) · Pacific League park','paypay')}
   ${g('28','WED','Game 4','Fukuoka · morning at Dazaifu','paypay')}
   ${g('29','THU','Game 5*','Fukuoka · yatai after','paypay')}
   ${g('30','FRI','Travel day','Back to the Central League city',null,'off')}
   ${g('31','SAT','Game 6*','Koshien','koshien')}
   ${g('1','SUN','Game 7*','Koshien · Nov 1','koshien')}
   ${g('2','MON','The road opens','Karatsu Kunchi starts today, an hour from Fukuoka','karatsu','off')}
   <p class="note">* Only if needed. If someone sweeps, the Series ends early and your open stretch starts sooner.</p>
   <h3>Still researching</h3><ul class="tips"><li>Fan-club presales: which teams require membership and how foreigners join</li><li>Cheering sections (ouendan) and where to sit</li><li>Bars to watch away games with fans</li><li>Ticket resale options under $200</li></ul>`,'series');
  body.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>openPlace(b.dataset.go,true));
}

/* ---------- journal ---------- */
const photoDB={db:null,
  open(){return new Promise(r=>{try{const q=indexedDB.open('tje',1);q.onupgradeneeded=()=>q.result.createObjectStore('photos');q.onsuccess=()=>{this.db=q.result;r(this.db)};q.onerror=()=>r(null)}catch(e){r(null)}})},
  async put(id,blob){const db=this.db||await this.open();if(!db)return false;return new Promise(r=>{const t=db.transaction('photos','readwrite');t.objectStore('photos').put(blob,id);t.oncomplete=()=>r(true);t.onerror=()=>r(false)})},
  async get(id){const db=this.db||await this.open();if(!db)return null;return new Promise(r=>{const q=db.transaction('photos').objectStore('photos').get(id);q.onsuccess=()=>r(q.result||null);q.onerror=()=>r(null)})},
  async del(id){const db=this.db||await this.open();if(!db)return;db.transaction('photos','readwrite').objectStore('photos').delete(id)}};
async function shrink(file){try{const img=await createImageBitmap(file);const s=Math.min(1,1600/Math.max(img.width,img.height));const c=document.createElement('canvas');c.width=img.width*s;c.height=img.height*s;c.getContext('2d').drawImage(img,0,0,c.width,c.height);return await new Promise(r=>c.toBlob(r,'image/jpeg',.82))}catch(e){return file}}
function showJournal(opt={}){
  const list=store.entries.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')||b.created-a.created);
  const t=new Date(),iso=`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
  const placeOpts=['<option value="">No place</option>'].concat(PLACES.map(p=>`<option value="${p.id}" ${opt.place===p.id?'selected':''}>${esc(p.name)}</option>`)).join('');
  const form=`<form id="jform"><label class="f" for="jdate">Date</label><input class="inp" id="jdate" type="date" value="${iso}">
    <label class="f" for="jplace">Place</label><select class="inp" id="jplace">${placeOpts}</select>
    <label class="f" for="jtitle">Title</label><input class="inp" id="jtitle" maxlength="120" placeholder="Rokko Oroshi with 47,000 strangers">
    <label class="f" for="jbody">What happened</label><textarea class="inp" id="jbody" placeholder="Write it while it's fresh."></textarea>
    <label class="f" for="jphoto">Photo</label><input class="inp" id="jphoto" type="file" accept="image/*">
    <div class="actions"><button type="button" class="btn" id="jcancel">Cancel</button><button class="btn primary" type="submit">Save entry</button></div></form>`;
  openSheet(`<div class="eyebrow">Private journal</div><h2>On the road</h2>
   <p><span class="lock">🔒 Only on this device. Not published anywhere.</span></p>
   ${opt.compose?form:'<button class="btn primary" id="jnew" style="width:100%">New entry</button>'}
   ${list.length?list.map(e=>{const p=PLACES.find(x=>x.id===e.place);return `<article class="entry"><div class="m">${e.date?md(e.date):''}${p?' · '+esc(p.name):''}</div><h4>${esc(e.title||'Untitled')}</h4>${e.body?`<p>${esc(e.body)}</p>`:''}${e.photo?`<img data-photo="${esc(e.id)}" alt="">`:''}
      <div style="display:flex;gap:14px;margin-top:6px">${p?`<button class="del" data-fly="${p.id}">On map</button>`:''}<button class="del" data-del="${e.id}">Delete</button></div></article>`}).join('')
     :`<p class="note" style="margin-top:16px">No entries yet. Your first one goes here: the flight, the first bowl of ramen, the first time a stadium sings.</p>`}`,'journal');
  body.querySelectorAll('img[data-photo]').forEach(async im=>{const b=await photoDB.get(im.dataset.photo);if(b)im.src=URL.createObjectURL(b);else im.remove()});
  const jn=$('#jnew');if(jn)jn.onclick=()=>showJournal({compose:true});
  const f=$('#jform');if(f){$('#jcancel').onclick=()=>showJournal();
    f.onsubmit=async ev=>{ev.preventDefault();const id='j_'+Date.now(),file=$('#jphoto').files[0];let photo=false;
      if(file)photo=await photoDB.put(id,await shrink(file));
      store.entries.push({id,date:$('#jdate').value,place:$('#jplace').value||null,title:$('#jtitle').value.trim(),body:$('#jbody').value.trim(),photo,created:Date.now()});
      if(!store.save()){toast('Could not save. Your browser storage may be full.');return}
      toast('Saved');showJournal()}}
  body.querySelectorAll('[data-del]').forEach(b=>{let armed=false;b.onclick=()=>{if(!armed){armed=true;b.textContent='Tap again to delete';setTimeout(()=>{armed=false;b.textContent='Delete'},3000);return}
    store.entries=store.entries.filter(e=>e.id!==b.dataset.del);photoDB.del(b.dataset.del);store.save();showJournal()}});
  body.querySelectorAll('[data-fly]').forEach(b=>b.onclick=()=>openPlace(b.dataset.fly,true));
}
const store={marks:LS.get('marks',{}),entries:LS.get('entries',[]),
  save(){try{localStorage.setItem('tje_marks',JSON.stringify(this.marks));localStorage.setItem('tje_entries',JSON.stringify(this.entries));return true}catch(e){return false}},
  setMark(id,v){if(v)this.marks[id]=v;else delete this.marks[id];this.save();refreshPins();toast(v==='visited'?'Marked visited':v==='want'?'Added to your list':'Removed')}};
try{navigator.storage&&navigator.storage.persist&&navigator.storage.persist()}catch(e){}

/* ---------- search ---------- */
const CITIES=[['Tokyo','東京',35.68,139.76],['Osaka','大阪',34.69,135.50],['Kyoto','京都',35.01,135.77],['Fukuoka','福岡',33.59,130.40],['Sapporo','札幌',43.06,141.35],['Hiroshima','広島',34.39,132.46],['Nagoya','名古屋',35.18,136.91],['Sendai','仙台',38.27,140.87],['Kanazawa','金沢',36.56,136.65],['Naha','那覇',26.21,127.68],['Nara','奈良',34.68,135.80],['Yokohama','横浜',35.44,139.64]];
const q=$('#q'),res=$('#results');
function closeResults(){res.hidden=true}
q.addEventListener('input',()=>{const s=q.value.trim().toLowerCase();if(!s){closeResults();return}
  const hits=PLACES.filter(p=>[p.name,p.jp,p.city,layerOf(p.layer).label,p.bourdain?'bourdain':''].join(' ').toLowerCase().includes(s)).slice(0,8);
  const ch=CITIES.filter(c=>(c[0]+c[1]).toLowerCase().includes(s)).slice(0,3);
  res.innerHTML=ch.map(c=>`<button data-city="${c[0]}"><span style="font:700 16px var(--f-display);width:36px">${c[1].slice(0,2)}</span><span><b>${c[0]}</b><br><span class="note">City</span></span></button>`).join('')+
   hits.map(p=>{const L=layerOf(p.layer);return `<button data-id="${p.id}"><span style="width:28px;height:28px;border-radius:8px;display:grid;place-items:center;background:${L.color};color:#111">${L.glyph}</span><span><b>${esc(p.name)}</b><br><span class="note">${esc(p.city)} · ${esc(L.label)}</span></span></button>`}).join('')||'<p class="note" style="padding:10px">No match yet. The map grows as we research.</p>';
  res.hidden=false;
  res.querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>{closeResults();q.blur();openPlace(b.dataset.id,true)});
  res.querySelectorAll('[data-city]').forEach(b=>b.onclick=()=>{const c=CITIES.find(x=>x[0]===b.dataset.city);closeResults();q.blur();closeSheet();
    camera.flyToBoundingSphere(new Cesium.BoundingSphere(Cesium.Cartesian3.fromDegrees(c[3],c[2]),1),{offset:new Cesium.HeadingPitchRange(0,Cesium.Math.toRadians(-40),9000)})})});

let tt;function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('show'),2400)}

/* ---------- intro ---------- */
function intro(){
  camera.setView({destination:Cesium.Cartesian3.fromDegrees(-90.2,38.6,21000000)});
  const skip=$('#skip');skip.hidden=false;let done=false;
  const end=()=>{if(done)return;done=true;skip.hidden=true;$('#intro').classList.add('gone')};
  skip.onclick=()=>{camera.cancelFlight();camera.setView({destination:Cesium.Cartesian3.fromDegrees(HOME.lon,HOME.lat,HOME.h),orientation:{heading:0,pitch:Cesium.Math.toRadians(HOME.pitch),roll:0}});end()};
  setTimeout(()=>{camera.flyTo({destination:Cesium.Cartesian3.fromDegrees(160,32,16000000),duration:4,easingFunction:Cesium.EasingFunction.QUADRATIC_IN_OUT,
    complete:()=>flyTo(HOME,3.2,end)})},800);
}

/* ---------- boot ---------- */
(async function(){
  await setupPhoto();
  makePins();
  $('#loading').classList.add('gone');
  intro();
})();
})();
