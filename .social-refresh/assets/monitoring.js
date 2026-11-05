/* One public-data request only when a visitor asks. No background polling. */
(() => {
  const catalog=window.ORFF_MONITORING||{}, state=new Map();
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const parameters={'00060':'Flow','00065':'Gage height','00010':'Water temperature','62614':'Lake elevation (NGVD29)','62615':'Lake elevation (NAVD88)'};
  // Water temperature is shown in Fahrenheit; USGS reports it in degrees Celsius.
  const shown=p=>p.parameter_code==='00010'&&/deg ?C|°C/i.test(p.unit_of_measure||'')?{value:(Number(p.value)*9/5+32).toFixed(1),unit:'°F'}:{value:p.value,unit:p.unit_of_measure};
  const endpoint=station=>'https://api.waterdata.usgs.gov/ogcapi/v1/collections/latest-continuous/items?'+new URLSearchParams({f:'json',monitoring_location_id:station,limit:'100'});
  function observations(features,station,now=Date.now()){
    const latest=new Map();
    for(const feature of features||[]){
      const p=feature.properties||{}, timestamp=Date.parse(p.time), value=Number(p.value);
      if(p.monitoring_location_id!==station||!parameters[p.parameter_code]||p.value===null||String(p.value).trim()===''||!Number.isFinite(value)||value<=-9999||!Number.isFinite(timestamp)||timestamp>now+300000||now-timestamp>7*86400000)continue;
      const old=latest.get(p.parameter_code);
      if(!old||timestamp>Date.parse(old.time))latest.set(p.parameter_code,p);
    }
    return [...latest.values()];
  }
  function render(w,compact=false){
    const c=catalog[w.id]||{name:'Monitoring not connected',coverage:'No verified monitoring source is connected.',mode:'unavailable'},s=state.get(w.id);
    const url=c.url||(c.station?'https://waterdata.usgs.gov/monitoring-location/'+c.station+'/':null);
    const label=s?.status==='loading'?'Checking station…':s?.rows?.length?'Station observations':'Readings unavailable';
    if(compact)return '<p class="cell-label">'+label+'</p>'+(s?.rows?.length?'<p>'+s.rows.slice(0,2).map(p=>esc(parameters[p.parameter_code])+': '+esc(shown(p).value)+' '+esc(shown(p).unit)).join('<br>')+'</p>':'')+'<a class="cell-link" href="#/water/'+w.id+'?section=conditions">Station & coverage →</a>';
    const stamp=p=>new Date(p.time).toLocaleString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZone:'America/Los_Angeles',timeZoneName:'short'});
    return '<div class="monitor-panel" data-od-id="monitoring-'+w.id+'"><div class="eyebrow">'+(c.station?'USGS monitoring':c.mode==='operator'?'Operator monitoring':c.mode==='historical'?'Historical station':'Coverage gap')+'</div><h3>'+esc(c.name)+'</h3><p class="small">'+esc(c.coverage)+'</p>'+(s?.rows?.length?'<dl class="readings-grid">'+s.rows.map(p=>'<div><dt>'+esc(parameters[p.parameter_code])+'</dt><dd>'+esc(shown(p).value)+' <small>'+esc(shown(p).unit)+'</small></dd><span class="meta">'+esc(stamp(p))+'<br>'+esc(p.approval_status||'Status not supplied')+(Date.now()-Date.parse(p.time)>6*3600000?' · Older than 6 hours':'')+'</span></div>').join('')+'</dl>':'<p class="reading-note">'+(s?.status==='loading'?'Requesting the latest available observations.':s?.status==='error'?'The station request could not be completed. Readings remain unavailable; use the official source below.':s?.status==='done'?'No valid observations from the last seven days were returned. Current readings remain unavailable.':'No readings loaded. '+(c.station?'Request the station’s latest observations below.':'No current feed is connected for this water.'))+'</p>')+'<div class="monitor-actions">'+(c.station?'<button type="button" data-load-gauge="'+w.id+'" '+(s?.status==='loading'?'disabled':'')+'>'+(s?.status==='loading'?'Checking…':s?.status==='done'?'Refresh station readings':'Load station readings')+'</button>':'')+(url?'<a class="text-link" href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+(c.mode==='operator'?'View operator readings':'Official station record')+' ↗<span class="sr-only"> (opens in a new tab)</span></a>':'')+'</div><p class="meta">Measurements describe this monitoring station, not every point in the fishing reach. No weather or fishing score is inferred.</p></div>';
  }
  const update=()=>window.dispatchEvent(new CustomEvent('orff-monitoring-update'));
  async function load(id){
    const c=catalog[id];if(!c?.station||state.get(id)?.status==='loading')return;
    state.set(id,{status:'loading'});update();
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
    try{
      const response=await fetch(endpoint(c.station),{signal:controller.signal,credentials:'omit'});
      if(!response.ok)throw new Error('Request failed');
      const json=await response.json();
      state.set(id,{status:'done',rows:observations(json.features,c.station)});
    }catch{state.set(id,{status:'error'});}
    finally{clearTimeout(timer);update();document.querySelector('[data-load-gauge="'+id+'"]')?.focus({preventScroll:true});}
  }
  document.addEventListener('click',e=>{const button=e.target.closest('[data-load-gauge]');if(button)load(button.dataset.loadGauge);});
  window.ORFFMonitoring={render,observations,endpoint,load,catalog};
})();
