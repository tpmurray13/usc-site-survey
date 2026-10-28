(function(){
'use strict';
var S=window.SURVEY, C=S.candidates, P=S.past;
var TIER={advance:{l:'Advance to field review',r:0},conditional:{l:'Conditional',r:1},screened:{l:'Screened out',r:2}};
var CK={acres:'3.5+ acres',city:'City limits',transit:'Transit',school:'School buffer',flood:'Flood'};
var CKV={pass:'Pass',fail:'Fails',verify:'Verify',unknown:'Unknown'};
var fmt$=function(n){return n==null?'—':'$'+Math.round(n).toLocaleString('en-US')};
var fmtA=function(n){return n==null?'—':(+n).toFixed(2).replace(/\.?0+$/,'')};
var mi=function(o){return o?o.mi.toFixed(2)+' mi':'—'};
var esc=function(t){return String(t==null?'':t).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})};
C.forEach(function(c,i){c.no=i+1});

/* countdown */
(function(){
  var end=new Date('2026-12-08T17:00:00-05:00'), now=new Date();
  var d=Math.max(0,Math.ceil((end-now)/86400000));
  document.getElementById('daysLeft').textContent=d;
})();

/* stats */
(function(){
  var inCity=C.filter(function(c){return c.in_city}).length;
  var meets=C.filter(function(c){return c.checks.acres==='pass'}).length;
  var items=[[C.length,'properties screened'],[inCity,'inside Fayetteville city limits'],[meets,'confirmed at 3.5 acres or more'],[5,'proposed for the Nov 12 shortlist']];
  document.getElementById('stats').innerHTML=items.map(function(x){return '<div class="stat"><div class="stat__n">'+x[0]+'</div><p class="stat__l">'+x[1]+'</p></div>'}).join('');
})();

/* map */
var map,layers={},markers={},base={};
function initMap(){
  if(!window.L){document.getElementById('mapEl').innerHTML='<p style="padding:24px">The map could not load on this network. The tables below have the same information.</p>';return}
  map=L.map('mapEl',{scrollWheelZoom:false,zoomControl:true});
  base.street=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Basemap &copy; Esri, HERE, Garmin, OpenStreetMap contributors'});
  base.aerial=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Imagery &copy; Esri'});
  base.street.addTo(map);
  layers.city=L.geoJSON(window.CITY,{style:{color:'#1f5a85',weight:1.5,dashArray:'5 4',fillColor:'#1f5a85',fillOpacity:.06},interactive:false}).addTo(map);
  layers.cand=L.layerGroup().addTo(map); layers.past=L.layerGroup().addTo(map); layers.bus=L.layerGroup();
  var col={advance:'#2e6b4a',conditional:'#9a5a12',screened:'#7b7f84',contract:'#9b2f2f',past:'#4f6275',lead:'#4f6275'};
  var bounds=[];
  C.forEach(function(c){
    if(!c.center) return;
    if(c.rings.length) L.polygon(c.rings,{color:col[c.tier],weight:2,fillOpacity:.18}).addTo(layers.cand).on('click',function(){openModal(c.id)});
    var lab=c.short?String(c.short):'';
    var m=L.marker(c.center,{icon:L.divIcon({className:'',html:'<div class="pin pin--'+c.tier+'"><span>'+lab+'</span></div>',iconSize:[30,30],iconAnchor:[15,30],popupAnchor:[0,-28]}),title:c.name,zIndexOffset:c.short?1000:0});
    m.bindPopup('<div class="pop"><p class="pop__t">'+esc(c.name)+'</p><p class="pop__s">'+TIER[c.tier].l+' · '+fmtA(c.acres)+' ac · '+(c.price?(c.price_est?'≈':'')+fmt$(c.price):'Price TBD')+'</p><button type="button" data-open="'+c.id+'">View details</button></div>');
    m.addTo(layers.cand); markers[c.id]=m; bounds.push(c.center);
  });
  P.forEach(function(p){
    if(!p.center) return;
    if(p.rings.length) L.polygon(p.rings,{color:col[p.kind],weight:1.5,fillOpacity:.15,dashArray:p.kind==='past'?'3 3':null}).addTo(layers.past);
    L.marker(p.center,{icon:L.divIcon({className:'',html:'<div class="pin pin--'+p.kind+'" style="width:22px;height:22px"><span></span></div>',iconSize:[22,22],iconAnchor:[11,22],popupAnchor:[0,-20]}),title:p.name})
     .bindPopup('<div class="pop"><p class="pop__t">'+esc(p.name)+'</p><p class="pop__s">'+esc(p.status)+'</p><p style="margin:0">'+esc(p.summary)+'</p></div>').addTo(layers.past);
  });
  map.fitBounds(bounds,{padding:[30,30]});
  map.on('popupopen',function(e){var b=e.popup.getElement().querySelector('[data-open]');if(b)b.addEventListener('click',function(){openModal(b.getAttribute('data-open'))})});
  map.on('focus',function(){map.scrollWheelZoom.enable()});map.on('blur',function(){map.scrollWheelZoom.disable()});
  function tog(id,l){document.getElementById(id).addEventListener('change',function(e){e.target.checked?map.addLayer(layers[l]):map.removeLayer(layers[l])})}
  tog('lyrCand','cand');tog('lyrPast','past');tog('lyrCity','city');
  var busLoaded=false;
  document.getElementById('lyrBus').addEventListener('change',function(e){
    if(!e.target.checked){map.removeLayer(layers.bus);return}
    map.addLayer(layers.bus);
    if(busLoaded) return; busLoaded=true;
    fetch('assets/routes.geojson').then(function(r){return r.json()}).then(function(g){L.geoJSON(g,{style:function(f){return {color:'#'+((f.properties.route_colo||'5a6b7a').trim()||'5a6b7a'),weight:2.5,opacity:.75}},interactive:false}).addTo(layers.bus)}).catch(function(){});
  });
  document.querySelectorAll('.seg button').forEach(function(b){b.addEventListener('click',function(){
    var k=b.getAttribute('data-base');Object.keys(base).forEach(function(x){map.removeLayer(base[x])});base[k].addTo(map);base[k].bringToBack();
    document.querySelectorAll('.seg button').forEach(function(o){o.classList.toggle('is-on',o===b);o.setAttribute('aria-pressed',o===b)});
  })});
}

/* cards */
var filt='all', sortK='rank';
function sortVal(c,k){
  switch(k){
    case 'rank': return [c.short?0:1, c.short||0, TIER[c.tier].r, c.no];
    case 'price': return [c.price==null?1:0, c.price||0];
    case 'acres': return [-(c.acres||0)];
    case 'ppa': return [c.ppa==null?1:0, c.ppa||0];
    case 'transit': return [c.stop?0:1, c.stop?c.stop.mi:0];
  }
}
function cmp(a,b){for(var i=0;i<a.length;i++){if(a[i]<b[i])return -1;if(a[i]>b[i])return 1}return 0}
function checksHTML(c){return '<ul class="checks">'+Object.keys(CK).map(function(k){var v=c.checks[k];return '<li class="ck ck--'+v+'" title="'+CK[k]+': '+CKV[v]+'">'+CK[k]+'</li>'}).join('')+'</ul>'}
function renderCards(){
  var list=C.filter(function(c){return filt==='all'||(filt==='city'?c.in_city:c.tier===filt)});
  list.sort(function(a,b){return cmp(sortVal(a,sortK),sortVal(b,sortK))});
  var el=document.getElementById('cards');
  if(!list.length){el.innerHTML='<div class="empty">No properties match this filter.</div>';return}
  el.innerHTML=list.map(function(c){
    return '<article class="card">'+
      '<div class="card__img"><img loading="lazy" src="assets/img/'+c.img[0]+'" alt="'+esc(c.name)+' site exhibit">'+(c.short?'<span class="card__num">Shortlist #'+c.short+'</span>':'')+'</div>'+
      '<div class="card__b"><p class="tag tag--'+c.tier+'">'+TIER[c.tier].l+'</p>'+
      '<h3 class="card__t">'+esc(c.name)+'</h3><p class="card__a">'+esc(c.area)+'</p>'+
      '<dl class="facts"><div><dt>Acres</dt><dd>'+fmtA(c.acres)+'</dd></div><div><dt>Asking</dt><dd>'+(c.price?(c.price_est?'≈':'')+fmt$(c.price):'TBD')+'</dd></div><div><dt>$/acre</dt><dd>'+(c.ppa?(c.price_est?'≈':'')+fmt$(c.ppa):'—')+'</dd></div></dl>'+
      checksHTML(c)+
      '<div class="card__f"><span class="card__a" style="margin:0">'+esc(c.juris)+'</span><button type="button" class="linkbtn" data-open="'+c.id+'">Details &rarr;</button></div></div></article>';
  }).join('');
}
function counts(){
  document.querySelectorAll('.chip').forEach(function(ch){var f=ch.getAttribute('data-f');ch.querySelector('span').textContent=C.filter(function(c){return f==='all'||(f==='city'?c.in_city:c.tier===f)}).length});
}
document.querySelectorAll('.chip').forEach(function(ch){ch.addEventListener('click',function(){filt=ch.getAttribute('data-f');document.querySelectorAll('.chip').forEach(function(o){o.classList.toggle('is-on',o===ch);o.setAttribute('aria-pressed',o===ch)});renderCards()})});
document.getElementById('sortSel').addEventListener('change',function(e){sortK=e.target.value;renderCards()});

/* matrix */
var mSort={k:'rank',dir:1};
function cell(v,t){return '<span class="cell cell--'+v+'"><i></i>'+t+'</span>'}
function renderMatrix(){
  var rows=C.slice();
  var k=mSort.k;
  var val=function(c){switch(k){
    case 'name':return [c.name];case 'rank':return sortVal(c,'rank');case 'acres':return [c.acres];case 'price':return [c.price==null?Infinity:c.price];
    case 'ppa':return [c.ppa==null?Infinity:c.ppa];case 'zoning':return [c.zoning];case 'city':return [c.in_city?0:1];case 'flood':return [c.flood];
    case 'transit':return [c.stop?c.stop.mi:99];case 'school':return [c.school?c.school.mi:99]}};
  rows.sort(function(a,b){return cmp(val(a),val(b))*mSort.dir});
  document.querySelector('#matrix tbody').innerHTML=rows.map(function(c){
    return '<tr data-open="'+c.id+'" tabindex="0"><td class="name">'+(c.short?'#'+c.short+' ':'')+esc(c.name)+'<span class="sub">'+esc(c.pins.length?c.pins.join(', '):'Parcel not matched')+'</span></td>'+
    '<td><span class="tag tag--'+c.tier+'">'+TIER[c.tier].l+'</span></td>'+
    '<td class="num">'+cell(c.checks.acres,fmtA(c.acres))+(c.gis_acres&&Math.abs(c.gis_acres-c.acres)>.1?'<span class="sub">GIS '+fmtA(c.gis_acres)+'</span>':'')+'</td>'+
    '<td class="num">'+(c.price?(c.price_est?'≈':'')+fmt$(c.price):'TBD')+'</td><td class="num">'+(c.ppa?(c.price_est?'≈':'')+fmt$(c.ppa):'—')+'</td>'+
    '<td>'+esc(c.zoning)+'</td><td>'+cell(c.checks.city,c.in_city?'Inside':'Outside')+'</td>'+
    '<td>'+cell(c.checks.flood,esc(c.flood))+'</td>'+
    '<td class="num">'+cell(c.checks.transit,mi(c.stop))+'</td><td class="num">'+cell(c.checks.school,mi(c.school))+'</td></tr>';
  }).join('');
  document.querySelectorAll('#matrix thead th').forEach(function(th){th.removeAttribute('aria-sort');if(th.getAttribute('data-k')===k)th.setAttribute('aria-sort',mSort.dir>0?'ascending':'descending')});
}
document.querySelectorAll('#matrix thead th').forEach(function(th){th.addEventListener('click',function(){var k=th.getAttribute('data-k');mSort.dir=(mSort.k===k)?-mSort.dir:1;mSort.k=k;renderMatrix()})});

/* timeline + past */
var TL=[
 ['Dec 2025','County issues brokerage RFP','Site of at least 3.5 acres inside Fayetteville city limits. Grant-Murray responds December 19.'],
 ['Feb 2026','Initial survey and feasibility study','County list of possible locations (Feb 2) and a broad market survey of more than 25 sites. Agency agreement signed.'],
 ['Feb 16, 2026','Sites meeting narrows the field','Four finalists: 914–918 Person St, 135 S King St, 610 E Russell St and 531 S Eastern Blvd.'],
 ['Mar 12, 2026','Board of Commissioners presentation','Site options presented at the agenda session with an HRC feasibility matrix.'],
 ['Apr 23 – May 4, 2026','Term sheets for King St and Racepath St','Term sheets go through Board review on April 27 and May 4.'],
 ['Jun 11, 2026','Purchase agreement signed','135 S King St and 110 S Racepath St at $900,000, with a 180-day examination period.','is-key'],
 ['Aug 11, 2026','Phase II field sampling','F&R collects soil, groundwater and soil-gas samples on both tracts.'],
 ['Sep 9, 2026','Limited assessments returned','Contamination above NCDEQ levels on both tracts, plus a residential vapor intrusion risk at Racepath.','is-key'],
 ['Sep 10, 2026','Strategy meeting','Person St assemblage reviewed, options for the contract discussed, and a new market survey agreed.'],
 ['Oct 19, 2026','Board motion on alternatives','Identify up to five alternative sites within the county for the Nov 12 agenda session, alongside an RFI for a development partner and an RFP for turnkey shelter services.','is-key'],
 ['Oct 20 – 28, 2026','New survey and owner leads','October land review (13 listings), plus Mann St and Bonnie St owner leads referred by County staff, and 511 S Eastern Blvd.','is-now'],
 ['Nov 12, 2026','Agenda session','Up to five alternative sites go to the Board.','is-next'],
 ['Dec 8, 2026','Examination period ends','Last day to terminate the King/Racepath contract, before 5:00 PM.','is-next']
];
document.getElementById('timeline').innerHTML=TL.map(function(t){return '<li class="'+(t[3]||'')+'"><div class="tl__d">'+t[0]+'</div><p class="tl__t">'+esc(t[1])+'</p><p class="tl__x">'+esc(t[2])+'</p></li>'}).join('');
document.getElementById('pastGrid').innerHTML=P.filter(function(p){return p.kind!=='contract'}).map(function(p){
  return '<article class="pcard"><p class="tag tag--'+p.kind+'">'+esc(p.status)+'</p><h4>'+esc(p.name)+'</h4><p class="pmeta">'+fmtA(p.acres)+' ac · '+esc(p.zoning)+(p.school?' · '+p.school.mi.toFixed(2)+' mi to '+esc(p.school.name.trim()):'')+'</p><p>'+esc(p.summary)+'</p></article>'}).join('');

/* modal */
var modal=document.getElementById('modal');
function openModal(id){
  var c=C.filter(function(x){return x.id===id})[0]; if(!c) return;
  var rows=[
   ['Status',TIER[c.tier].l+(c.short?' · Shortlist #'+c.short:'')],['Jurisdiction',c.juris],['Acreage',fmtA(c.acres)+' ac listed'+(c.gis_acres!=null?' · '+fmtA(c.gis_acres)+' ac in County GIS':'')],
   ['Asking price',c.price?(c.price_est?'≈':'')+fmt$(c.price)+(c.price_note?' ('+c.price_note+')':''):(c.price_note||'TBD')],['Price per acre',c.ppa?(c.price_est?'≈':'')+fmt$(c.ppa):'—'],['Zoning',c.zoning],
   ['Parcel ID(s)',c.pins.length?c.pins.join(', '):'Not matched'],['Flood (FEMA)',c.flood],['Nearest FAST stop',c.stop?c.stop.mi.toFixed(2)+' mi · '+c.stop.name:'—'],
   ['Nearest public school',c.school?c.school.mi.toFixed(2)+' mi · '+c.school.name.trim():'—'],['To County DSS',c.dss!=null?c.dss+' mi':'—'],['Data check',c.conf]
  ];
  document.getElementById('mBody').innerHTML=
   '<div class="mgal">'+c.img.map(function(f){return '<img src="assets/img/'+f+'" alt="'+esc(c.name)+' exhibit">'}).join('')+'</div>'+
   '<div class="mbody"><p class="tag tag--'+c.tier+'">'+TIER[c.tier].l+'</p><h3 id="mTitle">'+esc(c.name)+'</h3><p class="sub">'+esc(c.area)+(c.img_cap?' · '+esc(c.img_cap):'')+'</p>'+
   '<div class="mgrid"><div><h4 class="h4" style="margin-top:0">Screening notes</h4><ul class="mnotes">'+c.notes.map(function(n){return '<li>'+esc(n)+'</li>'}).join('')+'</ul>'+
   '<h4 class="h4">Checks</h4>'+checksHTML(c)+'</div>'+
   '<dl class="mlist">'+rows.map(function(r){return '<dt>'+r[0]+'</dt><dd>'+esc(r[1])+'</dd>'}).join('')+'</dl></div>'+
   '<div class="mact">'+(c.center?'<button type="button" class="btn" data-map="'+c.id+'">Show on map</button>':'')+'<button type="button" class="btn btn--line" data-close>Close</button></div></div>';
  if(modal.showModal) modal.showModal(); else modal.setAttribute('open','');
}
modal.addEventListener('click',function(e){
  if(e.target===modal||e.target.closest('[data-close]')) closeModal();
  var m=e.target.closest('[data-map]'); if(m){var id=m.getAttribute('data-map');closeModal();document.getElementById('map').scrollIntoView();var c=C.filter(function(x){return x.id===id})[0];if(map&&c){setTimeout(function(){map.setView(c.center,16);markers[id]&&markers[id].openPopup()},350)}}
});
function closeModal(){modal.close?modal.close():modal.removeAttribute('open')}
document.addEventListener('click',function(e){var o=e.target.closest('[data-open]');if(o&&!o.closest('.leaflet-popup')&&!modal.contains(o))openModal(o.getAttribute('data-open'))});
document.addEventListener('keydown',function(e){if(e.key==='Enter'){var r=e.target.closest&&e.target.closest('tr[data-open]');if(r)openModal(r.getAttribute('data-open'))}});

counts();renderCards();renderMatrix();initMap();
})();
