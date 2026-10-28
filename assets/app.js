(function(){
'use strict';
var S=window.SURVEY, C=S.candidates, P=S.past;
var CK={acres:'2.5+ acres',city:'City limits',transit:'Transit',school:'1,000 ft school',flood:'Flood'};
var CKV={pass:'Pass',fail:'Fails',verify:'Verify',unknown:'Unknown'};
var fmt$=function(n){return n==null?'—':'$'+Math.round(n).toLocaleString('en-US')};
var fmtA=function(n){return n==null?'—':(+n).toFixed(2).replace(/\.?0+$/,'')};
var mi=function(o){return o?o.mi.toFixed(2)+' mi':'—'};
var esc=function(t){return String(t==null?'':t).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})};
var ft=function(o){return o?Math.round(o.ft).toLocaleString('en-US')+' ft':'—'};
function sno(c){return '<span class="sno'+(c.short?' sno--short':'')+'">'+c.no+'</span>'}
function kind(c){return c.short?'short':'other'}
function contactLine(c){var k=c.contact;return k.type==='listed'?k.agent+', '+k.firm:'Not listed (owner-direct)'}
function contactHTML(c){var k=c.contact;
  if(k.type!=='listed') return '<p class="contact">'+esc(k.text)+'</p>';
  var tel=k.phone.replace(/[^0-9]/g,'');
  return '<p class="contact"><b>Listing agent:</b> '+esc(k.agent)+', '+esc(k.firm)+'<br><a href="tel:+1'+tel+'">'+esc(k.phone)+'</a>'+(k.email?' · <a href="mailto:'+esc(k.email)+'">'+esc(k.email)+'</a>':'')+(k.mls?' · MLS '+esc(k.mls):'')+'</p>'}

/* countdown */
(function(){
  var end=new Date('2026-12-08T17:00:00-05:00'), now=new Date();
  var d=Math.max(0,Math.ceil((end-now)/86400000));
  document.getElementById('daysLeft').textContent=d;
})();

/* stats */
(function(){
  var inCity=C.filter(function(c){return c.in_city}).length;
  var meets=C.filter(function(c){return c.checks.acres==='pass'&&c.checks.school==='pass'}).length;var dry=C.filter(function(c){return !c.flood_in}).length;
  var items=[[C.length,'properties screened'],[inCity,'inside Fayetteville city limits'],[meets,'meet 2.5 acres and the 1,000 ft school buffer'],[dry,'entirely out of the FEMA flood zone'],[5,'proposed for the Nov 12 shortlist']];
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
  layers.city=L.geoJSON(window.CITY,{style:{color:'#1d2a22',weight:1.5,dashArray:'5 4',fillColor:'#1d2a22',fillOpacity:.05},interactive:false}).addTo(map);
  layers.cand=L.layerGroup().addTo(map); layers.past=L.layerGroup().addTo(map); layers.bus=L.layerGroup();
  layers.stops=L.layerGroup().addTo(map); layers.schools=L.layerGroup().addTo(map);
  var POI=window.POI||{stops:[],schools:[]}, rnd=L.canvas({padding:.3});
  POI.stops.forEach(function(s){L.circleMarker([s[0],s[1]],{renderer:rnd,radius:3.5,color:'#fff',weight:1,fillColor:'#1f5fa8',fillOpacity:.95}).bindTooltip('FAST stop: '+esc(s[2])).addTo(layers.stops)});
  POI.schools.forEach(function(s){
    L.circle([s[0],s[1]],{radius:304.8,color:'#b8860b',weight:1,dashArray:'3 3',fillColor:'#d4a017',fillOpacity:.07,interactive:false}).addTo(layers.schools);
    L.marker([s[0],s[1]],{icon:L.divIcon({className:'',html:'<div class="schpin" aria-hidden="true">S</div>',iconSize:[15,15],iconAnchor:[7,7]}),title:s[2],keyboard:false,zIndexOffset:-1000})
     .bindPopup('<div class="pop"><p class="pop__t">'+esc(s[2])+'</p><p class="pop__s">'+esc(s[3])+' school · '+esc(s[4])+'</p><p style="margin:0">Dashed ring is about 1,000 ft from the campus point. The screening test measures parcel edge to school parcel.</p></div>').addTo(layers.schools)});
  var col={short:'#17613c',other:'#6b7570',contract:'#9b2f2f'};
  var bounds=[];
  C.forEach(function(c){
    if(!c.center) return;
    if(c.rings.length) L.polygon(c.rings,{color:col[kind(c)],weight:2,fillOpacity:.18}).addTo(layers.cand).on('click',function(){openModal(c.id)});
    var lab=String(c.no);
    var m=L.marker(c.center,{icon:L.divIcon({className:'',html:'<div class="pin pin--'+kind(c)+'"><span>'+lab+'</span></div>',iconSize:[30,30],iconAnchor:[15,30],popupAnchor:[0,-28]}),title:c.name,zIndexOffset:c.short?2000:1000});
    m.bindPopup('<div class="pop"><p class="pop__t">'+esc(c.name)+'</p><p class="pop__s">Site '+c.no+(c.short?' · Proposed shortlist':'')+' · '+fmtA(c.acres)+' ac · '+(c.price?(c.price_est?'≈':'')+fmt$(c.price):'Price TBD')+'</p><button type="button" data-open="'+c.id+'">View details</button></div>');
    m.addTo(layers.cand); markers[c.id]=m; bounds.push(c.center);
  });
  P.forEach(function(p){
    if(!p.center) return;
    if(p.rings.length) L.polygon(p.rings,{color:col.contract,weight:1.5,fillOpacity:.15}).addTo(layers.past);
    L.marker(p.center,{icon:L.divIcon({className:'',html:'<div class="pin pin--'+p.kind+'" style="width:22px;height:22px"><span></span></div>',iconSize:[22,22],iconAnchor:[11,22],popupAnchor:[0,-20]}),title:p.name})
     .bindPopup('<div class="pop"><p class="pop__t">'+esc(p.name)+'</p><p class="pop__s">'+esc(p.status)+'</p></div>').addTo(layers.past);
  });
  map.fitBounds(bounds,{padding:[30,30]});
  map.on('popupopen',function(e){var b=e.popup.getElement().querySelector('[data-open]');if(b)b.addEventListener('click',function(){openModal(b.getAttribute('data-open'))})});
  map.on('focus',function(){map.scrollWheelZoom.enable()});map.on('blur',function(){map.scrollWheelZoom.disable()});
  function tog(id,l){document.getElementById(id).addEventListener('change',function(e){e.target.checked?map.addLayer(layers[l]):map.removeLayer(layers[l])})}
  tog('lyrCand','cand');tog('lyrPast','past');tog('lyrCity','city');tog('lyrStops','stops');tog('lyrSch','schools');
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
var sortK='rank';
function sortVal(c,k){
  switch(k){
    case 'rank': return [c.no];
    case 'price': return [c.price==null?1:0, c.price||0];
    case 'acres': return [-(c.acres||0)];
    case 'ppa': return [c.ppa==null?1:0, c.ppa||0];
    case 'transit': return [c.stop?0:1, c.stop?c.stop.mi:0];
  }
}
function cmp(a,b){for(var i=0;i<a.length;i++){if(a[i]<b[i])return -1;if(a[i]>b[i])return 1}return 0}
function checksHTML(c){return '<ul class="checks">'+Object.keys(CK).map(function(k){var v=c.checks[k];return '<li class="ck ck--'+v+'" title="'+CK[k]+': '+CKV[v]+'">'+CK[k]+'</li>'}).join('')+'</ul>'}
function renderCards(){
  var list=C.slice();
  list.sort(function(a,b){return cmp(sortVal(a,sortK),sortVal(b,sortK))});
  var el=document.getElementById('cards');
  if(!list.length){el.innerHTML='<div class="empty">No properties match this filter.</div>';return}
  el.innerHTML=list.map(function(c){
    return '<article class="card">'+
      '<div class="card__img"><img loading="lazy" src="assets/img/'+c.img[0]+'" alt="'+esc(c.name)+' site exhibit">'+(c.short?'<span class="card__num">Proposed shortlist</span>':'')+'</div>'+
      '<div class="card__b">'+
      '<h3 class="card__t">'+sno(c)+esc(c.name)+'</h3><p class="card__a">'+esc(c.area)+'</p>'+
      '<dl class="facts"><div><dt>Acres</dt><dd>'+fmtA(c.acres)+'</dd></div><div><dt>Asking</dt><dd>'+(c.price?(c.price_est?'≈':'')+fmt$(c.price):'TBD')+'</dd></div><div><dt>$/acre</dt><dd>'+(c.ppa?(c.price_est?'≈':'')+fmt$(c.ppa):'—')+'</dd></div></dl>'+
      checksHTML(c)+contactHTML(c)+
      '<div class="card__f"><span class="card__a" style="margin:0">'+esc(c.juris)+'</span><button type="button" class="linkbtn" data-open="'+c.id+'">Details &rarr;</button></div></div></article>';
  }).join('');
}
document.getElementById('sortSel').addEventListener('change',function(e){sortK=e.target.value;renderCards()});

/* matrix */
var mSort={k:'name',dir:1};
function cell(v,t){return '<span class="cell cell--'+v+'"><i></i>'+t+'</span>'}
function renderMatrix(){
  var rows=C.slice();
  var k=mSort.k;
  var val=function(c){switch(k){
    case 'name':return [c.no];case 'contact':return [contactLine(c)];case 'acres':return [c.acres];case 'price':return [c.price==null?Infinity:c.price];
    case 'ppa':return [c.ppa==null?Infinity:c.ppa];case 'zoning':return [c.zoning];case 'city':return [c.in_city?0:1];case 'flood':return [c.sfha];
    case 'transit':return [c.stop?c.stop.mi:99];case 'school':return [c.school?c.school.ft:1e9]}};
  rows.sort(function(a,b){return cmp(val(a),val(b))*mSort.dir});
  document.querySelector('#matrix tbody').innerHTML=rows.map(function(c){
    return '<tr data-open="'+c.id+'" tabindex="0"><td class="name">'+sno(c)+esc(c.name)+'<span class="sub">'+esc(c.pins.length?c.pins.join(', '):'Parcel not matched')+'</span></td>'+
    '<td>'+esc(contactLine(c))+(c.contact.type==='listed'?'<span class="sub">'+esc(c.contact.phone)+'</span>':'')+'</td>'+
    '<td class="num">'+cell(c.checks.acres,fmtA(c.acres))+(c.gis_acres&&Math.abs(c.gis_acres-c.acres)>.1?'<span class="sub">GIS '+fmtA(c.gis_acres)+'</span>':'')+'</td>'+
    '<td class="num">'+(c.price?(c.price_est?'≈':'')+fmt$(c.price):'TBD')+'</td><td class="num">'+(c.ppa?(c.price_est?'≈':'')+fmt$(c.ppa):'—')+'</td>'+
    '<td>'+esc(c.zoning)+'</td><td>'+cell(c.checks.city,c.in_city?'Inside':'Outside')+'</td>'+
    '<td>'+cell(c.checks.flood,esc(c.flood_short))+(c.fw>0.5?'<span class="sub">'+Math.round(c.fw)+'% floodway</span>':'')+'</td>'+
    '<td class="num">'+cell(c.checks.transit,mi(c.stop))+'</td><td class="num">'+cell(c.checks.school,ft(c.school))+'</td></tr>';
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
 ['Oct 20 – 28, 2026','New survey','October land review (13 listings), plus Mann St and Bonnie St referred by County staff, and 511 S Eastern Blvd.','is-now'],
 ['Nov 12, 2026','Agenda session','Up to five alternative sites go to the Board.','is-next'],
 ['Dec 8, 2026','Examination period ends','Last day to terminate the King/Racepath contract, before 5:00 PM.','is-next']
];
document.getElementById('timeline').innerHTML=TL.map(function(t){return '<li class="'+(t[3]||'')+'"><div class="tl__d">'+t[0]+'</div><p class="tl__t">'+esc(t[1])+'</p><p class="tl__x">'+esc(t[2])+'</p></li>'}).join('');

/* modal */
var modal=document.getElementById('modal');
function openModal(id){
  var c=C.filter(function(x){return x.id===id})[0]; if(!c) return;
  var rows=[
   ['Site number',c.no+(c.short?' · Proposed shortlist':'')],['Jurisdiction',c.juris],['Acreage',fmtA(c.acres)+' ac listed'+(c.gis_acres!=null?' · '+fmtA(c.gis_acres)+' ac mapped (County GIS)':'')],
   ['Asking price',c.price?(c.price_est?'≈':'')+fmt$(c.price)+(c.price_note?' ('+c.price_note+')':''):(c.price_note||'TBD')],['Price per acre',c.ppa?(c.price_est?'≈':'')+fmt$(c.ppa):'—'],['Zoning',c.zoning],
   ['Parcel ID(s)',c.pins.length?c.pins.join(', '):'Not matched'],['Flood (FEMA)',c.flood],['Nearest FAST stop',c.stop?c.stop.mi.toFixed(2)+' mi · '+c.stop.name:'—'],
   ['Nearest public school',c.school?ft(c.school)+' · '+c.school.name.trim():'—'],['Listing / contact',c.contact.type==='listed'?contactLine(c)+' · '+c.contact.phone+(c.contact.email?' · '+c.contact.email:'')+(c.contact.mls?' · MLS '+c.contact.mls:''):c.contact.text]
  ];
  document.getElementById('mBody').innerHTML=
   '<div class="mgal">'+c.img.map(function(f){return '<img src="assets/img/'+f+'" alt="'+esc(c.name)+' exhibit">'}).join('')+'</div>'+
   '<div class="mbody">'+(c.short?'<p class="tag tag--short">Proposed shortlist</p>':'')+'<h3 id="mTitle">'+sno(c)+esc(c.name)+'</h3><p class="sub">'+esc(c.area)+(c.img_cap?' · '+esc(c.img_cap):'')+'</p>'+
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

renderCards();renderMatrix();initMap();
})();
