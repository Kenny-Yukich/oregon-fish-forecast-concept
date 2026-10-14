/* Offline-friendly hash application. All editorial text comes from the supplied packet. */
(() => {
  'use strict';
  const packet = window.ORFF_DATA;
  const app = document.getElementById('app');
  if (!packet || !Array.isArray(packet.waters)) {
    app.innerHTML = '<section class="wrap not-found"><h1>Water records could not load.</h1><p>Keep the data and assets folders beside index.html, then reopen this page.</p></section>';
    return;
  }
  const waters = packet.waters;
  const lakeCount = waters.filter(w=>w.kind!=='river').length;
  const words = ['no','one','two','three','four','five','six','seven','eight','nine','ten'];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const get = (key, fallback) => { try { return localStorage.getItem('orff-concept.' + key) || fallback; } catch { return fallback; } };
  const set = (key, value) => { try { localStorage.setItem('orff-concept.' + key, value); } catch {} };
  let origin = get('origin', packet.defaultOrigin);
  let directoryHash = '#/waters';
  let currentWater = null;
  let firstRender = true;
  let liveMap = null;
  const icons = {
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    external: '<path d="M14 4h6v6M20 4l-10 10M20 14v6H4V4h6"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    alert: '<path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5M12 17h.01"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    back: '<path d="M19 12H5m6-6-6 6 6 6"/>'
  };
  const icon = name => '<svg viewBox="0 0 24 24" aria-hidden="true">' + icons[name] + '</svg>';
  const date = value => value ? new Date(value.slice(0,10)+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}) : 'Undated';
  const time = value => value ? '<time datetime="'+esc(value)+'">'+date(value)+'</time>' : 'Undated';
  const external = (url, label, cls='text-link') => '<a class="'+cls+'" href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+esc(label)+icon('external')+'<span class="sr-only"> (opens in a new tab)</span></a>';
  const mapsRoute = destination => 'https://www.google.com/maps/dir/?' + new URLSearchParams({api:'1',origin,destination,travelmode:'driving'});
  function directions(w) {
    if (!w.planning.access_point?.map_query) return null;
    return mapsRoute(w.planning.access_point.map_query);
  }
  function accessPoints(w) {
    const points=w.planning.access_points||[];
    if (!points.length) return '';
    return '<div class="access-points" data-od-id="access-points-'+w.id+'"><div class="eyebrow">Documented access points · '+points.length+'</div><ul>'+points.map(pt=>'<li><span class="meta">'+esc(pt.type)+'</span><strong>'+esc(pt.label)+'</strong><p>'+esc(pt.note)+'</p><div class="point-links"><a class="cell-link" data-directions-query="'+esc(pt.map_query)+'" href="'+esc(mapsRoute(pt.map_query))+'" target="_blank" rel="noopener noreferrer">Directions'+icon('external')+'<span class="sr-only"> to '+esc(pt.label)+' in Google Maps (opens in a new tab)</span></a>'+(pt.url?external(pt.url,'Source','cell-link'):'')+'</div></li>').join('')+'</ul></div>';
  }
  function factStrip(w) {
    const c=window.ORFFMonitoring?.catalog?.[w.id], points=(w.planning.access_points||[]).length||(w.planning.access_point?1:0);
    const gauge=c?.station?'USGS gauge':c?.mode==='operator'?'Operator data':c?.mode==='historical'?'Historical record':'No live feed';
    const facts=[[w.planning.target_species.length,'Target species'],[points||'None','Verified access '+(points===1?'point':'points')],[gauge,'Monitoring'],[w.planning.alerts.length,w.planning.alerts.length===1?'Notice':'Notices']];
    return '<dl class="fact-strip" data-od-id="facts-'+w.id+'">'+facts.map(([v,l])=>'<div><dt>'+esc(l)+'</dt><dd>'+esc(v)+'</dd></div>').join('')+'</dl>';
  }
  function driveLink(w, label='Directions', cls='cell-link') {
    const url=directions(w);
    return url ? '<a data-od-id="directions-'+w.id+'" data-directions="'+w.id+'" class="'+cls+'" href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+esc(label)+icon('external')+'<span class="sr-only"> to '+esc(w.planning.access_point.label)+' in Google Maps (opens in a new tab)</span></a>' : '';
  }
  function originForm() {
    return '<form class="origin-form" data-od-id="driving-origin"><label for="origin">Driving from</label><div class="origin-field"><input id="origin" name="origin" autocomplete="off" maxlength="180" required value="'+esc(origin)+'" aria-describedby="origin-feedback"><button type="submit" aria-label="Apply driving origin" title="Apply driving origin">'+icon('check')+'</button></div><span id="origin-feedback" class="origin-status" role="status">Use your town or starting address</span></form>';
  }
  function age(report) {
    if (!report.reported_on) return 'No dated local report';
    const days=(Date.parse(report.checked_on)-Date.parse(report.reported_on))/86400000;
    return days > 30 ? 'Older report' : 'Dated report';
  }
  function sourceList(w) {
    const seen=new Set();
    return '<ul class="source-list">'+[...(w.planning.sources||[]),...(w.sources||[])].filter(s=>{const key=s.label+s.url;if(seen.has(key))return false;seen.add(key);return true;}).map(s=>'<li>'+external(s.url,s.label,'source-link')+'</li>').join('')+'</ul>';
  }
  function alertHTML(alert, compact=false) {
    return '<div class="alert-item'+(compact?' cell-alert':'')+'"><div class="alert-label '+(alert.status==='unverified'?'unverified':'')+'">'+icon('alert')+(alert.status==='unverified'?'Needs a trip-day check':'Recorded advisory')+'</div><p>'+esc(alert.summary)+'</p>'+(!compact?'<div class="meta">'+(alert.checked_on?'Source reviewed '+time(alert.checked_on):'Current status unverified')+'</div>'+external(alert.url,'Read source','cell-link'):'')+'</div>';
  }
  function reportHTML(w, compact=false) {
    const r=w.planning.report;
    if (compact) return '<details class="report-toggle" data-od-id="report-'+w.id+'"><summary>'+age(r)+' · '+(r.reported_on?date(r.reported_on):'undated')+'</summary><div class="report-copy"><p>'+esc(r.summary)+'</p><p class="muted"><strong>Coverage:</strong> '+esc(r.coverage)+'</p><p class="meta">Source reviewed '+date(r.checked_on)+'</p>'+external(r.url,'Original report','cell-link')+'</div></details>';
    return '<div class="report-panel"><div class="report-meta"><span class="report-age">'+age(r)+'</span><span>Reported '+time(r.reported_on)+'</span></div><h3>'+esc(r.summary)+'</h3><div class="coverage"><strong>Where this report applies</strong>'+esc(r.coverage)+'</div>'+(r.coverage.includes('live')?'<p class="meta">The source wording is preserved; live readings are not included in this editorial packet.</p>':'')+'<div class="report-meta"><span>Source reviewed '+time(r.checked_on)+'</span>'+external(r.url,'Original report','cell-link')+'</div></div>';
  }
  function monitoring(w, compact=false) {
    if (window.ORFFMonitoring) return window.ORFFMonitoring.render(w, compact);
    return '<p class="cell-label">Readings unavailable</p>'+(compact?'':'<p class="small muted">No flow, water temperature or weather measurements are included in this concept.</p>');
  }
  function previewScore(w, compact) {
    const sc=window.ORFFPreview.score(w), href='#/membership?water='+encodeURIComponent(w.id);
    const tag='<span class="preview-tag">Preview</span>';
    if (sc.status!=='scored') {
      const title=sc.status==='withheld'?'Rules review pending':'Not enough data yet';
      if (compact) return '<div class="member-score-cell is-preview" data-od-id="member-score-'+w.id+'"><strong>River score '+tag+'</strong><span class="meta">'+title+'</span></div>';
      return '<div class="member-score-panel is-preview" data-od-id="member-score-'+w.id+'"><div class="member-score-top"><h3>River score</h3>'+tag+'</div><p class="score-status">'+title+'</p><p class="small">'+esc(sc.reason)+(sc.status==='withheld'?' Membership would not override that restriction.':'')+'</p></div>';
    }
    const ring='<span class="score-ring" style="--score:'+sc.value+'" aria-hidden="true"><span>'+sc.value+'</span></span>';
    if (compact) return '<div class="member-score-cell is-preview" data-od-id="member-score-'+w.id+'"><strong>River score '+tag+'</strong><div class="score-inline">'+ring+'<span><b>'+sc.label+'</b><span class="meta">'+sc.confidence+' confidence</span></span></div><a class="cell-link" href="#/water/'+w.id+'?section=field-notes">Why this score '+icon('arrow')+'</a></div>';
    return '<div class="member-score-panel is-preview" data-od-id="member-score-'+w.id+'"><div class="member-score-top"><h3>River score</h3>'+tag+'</div><div class="score-hero">'+ring.replace('aria-hidden="true"','role="img" aria-label="Score '+sc.value+' out of 100"')+'<div><p class="score-status">'+sc.label+'</p><p class="small">'+sc.confidence+' confidence · built from '+sc.factors.length+' of 4 inputs'+(sc.unverified?' · '+sc.unverified+' rule '+(sc.unverified===1?'notice needs':'notices need')+' a trip-day check':'')+'</p></div></div><ul class="score-factors">'+sc.factors.map(f=>'<li><div class="factor-top"><strong>'+esc(f.label)+'</strong><span>'+esc(f.display)+'</span></div><span class="factor-bar" aria-hidden="true"><span style="width:'+f.value+'%"></span></span><p class="meta">'+esc(f.reason)+'</p></li>').join('')+'</ul>'+(sc.missing.length?'<p class="meta">Not available for this reach: '+esc(sc.missing.join(', '))+'. Missing inputs lower confidence; they are never filled in with guesses.</p>':'')+'<p class="meta">Preview formula: report tone 35%, run strength 30%, report freshness 20%, recent stocking 15%, using only the inputs available. It has not been validated against catch results.</p><a class="text-link" href="'+href+'">About the $4.99/month plan '+icon('arrow')+'</a></div>';
  }
  function memberScore(w, compact=false) {
    if (w.kind!=='river') return '';
    if (window.ORFFPreview?.on) return previewScore(w, compact);
    const href='#/membership?water='+encodeURIComponent(w.id);
    if (compact) return '<div class="member-score-cell" data-od-id="member-score-'+w.id+'"><strong>River score</strong><span class="meta">'+(w.planning.score_notice?'Rules review pending':'Planned member feature')+'</span><a class="cell-link" href="'+href+'" aria-label="About planned member scores for '+esc(w.name)+' — '+esc(w.reach)+'">About member scores '+icon('arrow')+'</a></div>';
    return '<div class="member-score-panel" data-od-id="member-score-'+w.id+'"><div class="member-score-top"><h3>River score</h3><span class="count-badge">Planned · Membership</span></div><p class="score-status">'+(w.planning.score_notice?'Rules review pending':'Not calculated yet')+'</p><p class="small">'+(w.planning.score_notice?'The source withholds a score pending a species rules review. A future subscription would not override that restriction.':'A future member score would bring together current conditions, seasonal context and species-specific rules for this reach. A scoring model has not been validated yet.')+'</p><a class="text-link" href="'+href+'">About the $4.99/month plan '+icon('arrow')+'</a></div>';
  }
  const fmt = n => Number(n).toLocaleString('en-US');
  function countLinks(w) { return (window.ORFF_COUNT_STATIONS?.waters?.[w.id]||[]).map(l=>({...l,meta:window.ORFF_COUNT_STATIONS.stations[l.station],data:window.ORFF_COUNTS?.stations?.[l.station]})).filter(l=>l.meta); }
  function countsHTML(w, compact=false) {
    const links=countLinks(w);
    if (!links.length) return '';
    if (compact) {
      const l=links.find(l=>l.data), top=l&&Object.values(l.data.species).sort((a,b)=>b.last7-a.last7)[0];
      return top&&top.last7>0?'<p class="cell-label count-cell">Fish counts</p><p class="small">'+esc(l.meta.name)+': '+fmt(top.last7)+' '+esc(top.label.toLowerCase())+' past week</p>':'';
    }
    return '<section id="fish-counts" class="detail-section" data-od-id="fish-counts"><h2>Are fish in the system?</h2><p class="small muted">Counts of adult fish moving upstream past a dam or trap. They show run timing, not how many fish anglers are catching.</p>'+links.map(l=>{
      const rows=l.data?Object.values(l.data.species).filter(v=>v.ytd>0||v.last_year_ytd>0):[];
      return '<div class="count-panel"><div class="count-top"><div><div class="eyebrow">'+esc(l.meta.river)+'</div><h3>'+esc(l.meta.name)+'</h3></div>'+(l.data?'<span class="count-badge">Through '+date(l.data.through)+'</span>':'')+'</div><p class="small">'+esc(l.relation)+'</p>'+(rows.length?'<div class="count-table-wrap"><table class="count-table"><caption class="sr-only">'+esc(l.meta.name)+' adult counts through '+date(l.data.through)+'</caption><thead><tr><th scope="col">Species</th><th scope="col">7 days</th><th scope="col">This year</th><th scope="col">Last year</th></tr></thead><tbody>'+rows.map(v=>'<tr><th scope="row">'+esc(v.label)+'</th><td>'+fmt(v.last7)+'</td><td>'+fmt(v.ytd)+'</td><td>'+(v.last_year_ytd==null?'Unavailable':fmt(v.last_year_ytd))+'</td></tr>').join('')+'</tbody></table></div><p class="meta">7 days ends on the latest counted day. This year counts from January 1 across all runs, and last year is the count to the same date. Wild steelhead are included in the steelhead total.</p>':'<p class="reading-note">'+(l.meta.dart?'Daily counts have not been loaded yet. Use the official counts below.':'This site publishes its own counts. Open them below; they are not copied into this guide.')+'</p>')+(l.meta.live?'<div class="count-live"><span class="live-dot" aria-hidden="true"></span>'+external(l.meta.live.url,l.meta.live.label,'cell-link')+'<span class="meta">'+esc(l.meta.live.by)+'</span></div>':'')+(l.meta.note?'<p class="meta">'+esc(l.meta.note)+'</p>':'')+'<p class="meta">'+esc(l.meta.operator)+' · '+external(l.meta.url,'Official counts','cell-link')+'</p></div>';
    }).join('')+'</section>';
  }
  // Trout stocking (ODFW schedule, refreshed daily into data/stocking.js)
  const stockRows = () => window.ORFF_STOCKING?.rows || [];
  const todayPT = () => new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles'}).format(new Date());
  const addDays = (iso,n) => new Date(Date.parse(iso+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
  function weekMonday(iso) { const d=new Date(iso+'T12:00:00Z'), back=(d.getUTCDay()+6)%7; return addDays(iso,-back); }
  function weekBucket(r) { const mon=weekMonday(todayPT()); return r.week_start<mon?'recent':r.week_start<addDays(mon,7)?'this':r.week_start<addDays(mon,14)?'next':'later'; }
  const bucketLabel = {recent:'Recently stocked',this:'This week',next:'Next week',later:'Coming up'};
  const monthLabel = iso => new Date(iso+'T12:00:00Z').toLocaleDateString('en-US',{month:'long',year:'numeric',timeZone:'UTC'});
  function stockMatches(w) {
    const names=window.ORFF_STOCKING_MATCH?.[w.id];
    if (!names) return null;
    const res=names.map(n=>new RegExp('\\b'+n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','i'));
    return stockRows().filter(r=>res.some(re=>re.test(r.waterbody)));
  }
  function stockWater(r) { return waters.find(w=>(window.ORFF_STOCKING_MATCH?.[w.id]||[]).some(n=>new RegExp('\\b'+n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','i').test(r.waterbody))); }
  function fishLine(r) {
    const parts=[['legals','legals'],['larger','larger'],['pounders','pounders'],['trophy','trophy'],['brood','brood'],['fingerling','fingerlings']].filter(([k])=>r[k]>0).map(([k,l])=>fmt(r[k])+' '+l);
    return parts.length?parts.join(' · '):fmt(r.total)+' trout';
  }
  function stockCard(r, withWater=true) {
    const w=withWater&&stockWater(r), b=weekBucket(r);
    return '<li class="stock-card'+(b==='this'?' is-now':'')+'"><div class="stock-week"><span class="count-badge">'+esc(b==='later'?monthLabel(r.week_start):bucketLabel[b])+'</span><span class="meta">'+esc(r.week_label||('Week of '+date(r.week_start)))+'</span></div>'+(withWater?'<strong>'+esc(r.waterbody)+'</strong>':'')+(r.zone?'<span class="meta">'+esc(r.zone)+'</span>':'')+'<p>'+esc(fishLine(r))+'</p><div class="point-links">'+(withWater?external('https://www.google.com/maps/search/?'+new URLSearchParams({api:'1',query:r.waterbody+', Oregon'}),'Find on map','cell-link'):'')+(w?'<a class="cell-link" data-water-link="'+w.id+'" href="#/water/'+w.id+'">Field notes '+icon('arrow')+'</a>':'')+'</div></li>';
  }
  function stockHTML(w, compact=false) {
    const rows=stockMatches(w);
    if (rows==null) return '';
    const upcoming=rows.filter(r=>weekBucket(r)!=='recent').sort((a,b)=>a.week_start.localeCompare(b.week_start));
    const past=rows.filter(r=>weekBucket(r)==='recent').sort((a,b)=>b.week_start.localeCompare(a.week_start));
    if (compact) { const r=upcoming[0]||past[0]; return r?'<p class="cell-label count-cell">Trout stocking</p><p class="small">'+(upcoming[0]?'Next':'Last')+': '+esc(r.week_label||date(r.week_start))+' · '+esc(fishLine(r))+'</p>':''; }
    const loaded=!!window.ORFF_STOCKING?.fetched_at;
    const lead=[...upcoming.slice(0,2),...past.slice(0,1)];
    const all=[...rows].sort((a,b)=>a.week_start.localeCompare(b.week_start));
    return '<section id="stocking" class="detail-section" data-od-id="water-stocking"><h2>When was it stocked?</h2><p class="small muted">ODFW\'s planned trout stockings for this water, kept for 8 weeks after they happen. Plans can change for weather, access or fish health.</p>'+(rows.length?'<ul class="stock-list">'+lead.map(r=>stockCard(r,false)).join('')+'</ul>'+(all.length>lead.length?'<details class="stock-all"><summary>Full ODFW schedule for this water ('+all.length+')</summary><ul class="stock-list">'+all.map(r=>stockCard(r,false)).join('')+'</ul></details>':''):'<p class="reading-note">'+(loaded?'No stockings for this water in ODFW\'s current schedule or the past 8 weeks.':'The stocking schedule has not been loaded yet.')+'</p>')+'<p class="meta">'+external(window.ORFF_STOCKING?.source||'https://myodfw.com/fishing/species/trout/stocking-schedule','ODFW stocking schedule','cell-link')+'</p></section>';
  }
  function stockingPage(query='',bucket='upcoming') {
    currentWater=null;
    const rows=stockRows(), loaded=!!window.ORFF_STOCKING?.fetched_at;
    const by=b=>rows.filter(r=>weekBucket(r)===b), sum=list=>list.reduce((t,r)=>t+r.total,0);
    const tiles=[['this','This week'],['next','Next week'],['later','Rest of season'],['recent','Past 8 weeks']].map(([b,l])=>{const list=by(b), n=new Set(list.map(r=>r.waterbody)).size;return '<div><dt>'+l+'</dt><dd>'+fmt(n)+' <small>'+(n===1?'water':'waters')+'</small></dd><span class="meta">'+fmt(sum(list))+' trout</span></div>';}).join('');
    const zones=[...new Set(rows.map(r=>r.zone).filter(Boolean))].sort();
    app.innerHTML='<div class="wrap stocking-page" data-od-id="stocking-page"><header class="map-heading"><div><div class="eyebrow">Trout stocking</div><h1 tabindex="-1" data-od-id="stocking-title">Fresh fish,<br><em>this week.</em></h1></div><p>ODFW\'s planned weekly trout stockings across Oregon, refreshed every morning. Waters already in the guide link to their field notes.</p></header>'+(loaded?'<dl class="fact-strip stock-tiles">'+tiles+'</dl>':'')+'<div class="directory-controls stock-controls"><div class="search-box">'+icon('search')+'<label for="stock-search" class="sr-only">Search stocked waters or zones</label><input type="search" id="stock-search" value="'+esc(query)+'" placeholder="Search a lake, pond or zone" autocomplete="off"></div><div class="filters" role="group" aria-label="Weeks">'+[['upcoming','This & next week'],['later','Coming up'],['recent','Recent'],['all','All']].map(([v,l])=>'<button type="button" data-stock-filter="'+v+'" aria-pressed="'+(v===bucket)+'">'+l+'</button>').join('')+'</div>'+(zones.length?'<label class="sr-only" for="stock-zone">Zone</label><select id="stock-zone"><option value="">All zones</option>'+zones.map(z=>'<option>'+esc(z)+'</option>').join('')+'</select>':'')+'</div><p class="result-note" id="stock-count" role="status" aria-live="polite"></p><div id="stock-results"></div><p class="meta map-note">These are ODFW\'s planned stockings, not confirmed releases. The page is read daily from the '+external(window.ORFF_STOCKING?.source||'https://myodfw.com/fishing/species/trout/stocking-schedule','ODFW stocking schedule','cell-link')+(loaded?', last on '+date(window.ORFF_STOCKING.fetched_at.slice(0,10)):'')+'. Past weeks stay here for 8 weeks after ODFW removes them. Check current rules and access before you go.</p></div>';
    let active=bucket;
    const search=document.getElementById('stock-search'), zoneSel=document.getElementById('stock-zone');
    function update() {
      const terms=search.value.trim().toLowerCase().split(/\s+/).filter(Boolean), zone=zoneSel?.value||'';
      const list=rows.filter(r=>{const b=weekBucket(r);return (active==='all'||(active==='upcoming'?b==='this'||b==='next':b===active))&&(!zone||r.zone===zone)&&terms.every(t=>(r.waterbody+' '+r.zone).toLowerCase().includes(t));});
      const order={this:0,next:1,later:2,recent:3}, groups={};
      for (const r of list.sort((a,b)=>order[weekBucket(a)]-order[weekBucket(b)]||(weekBucket(a)==='recent'?b.week_start.localeCompare(a.week_start):a.week_start.localeCompare(b.week_start))||a.waterbody.localeCompare(b.waterbody))) { const b=weekBucket(r); (groups[b==='later'?monthLabel(r.week_start):bucketLabel[b]]??=[]).push(r); }
      document.getElementById('stock-results').innerHTML=list.length?Object.entries(groups).map(([label,g])=>'<section class="stock-group"><h2>'+esc(label)+' <span class="count-badge">'+g.length+'</span></h2><ul class="stock-list">'+g.map(r=>stockCard(r)).join('')+'</ul></section>').join(''):'<div class="empty-state"><h3>'+(loaded?'No stockings match.':'The stocking schedule has not been loaded yet.')+'</h3><p>'+(loaded?'Try another week, zone or name.':'It is read from ODFW every morning. Until then, use the ODFW schedule linked below.')+'</p></div>';
      document.getElementById('stock-count').textContent=list.length+' planned '+(list.length===1?'stocking':'stockings');
      document.querySelectorAll('[data-stock-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.stockFilter===active)));
      const params=new URLSearchParams(); if(search.value.trim())params.set('q',search.value.trim()); if(active!=='upcoming')params.set('weeks',active);
      try{history.replaceState(null,'','#/stocking'+(params.size?'?'+params:''));}catch{}
    }
    search.addEventListener('input',update); zoneSel?.addEventListener('change',update);
    document.querySelectorAll('[data-stock-filter]').forEach(b=>b.addEventListener('click',()=>{active=b.dataset.stockFilter;update();}));
    update();
  }
  function filtered(query='',kind='all') {
    const terms=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return waters.filter(w => (kind==='all'||(kind==='river'?w.kind==='river':w.kind==='lake'||w.kind==='reservoir')) && terms.every(t=>[w.name,w.reach,w.region,...w.planning.target_species].join(' ').toLocaleLowerCase().includes(t)));
  }
  function row(w) {
    const p=w.planning, notices=p.alerts;
    return '<tr data-od-id="water-'+w.id+'" data-selected="'+(get('selected','')===w.id)+'"><td><a class="water-link" data-water-link="'+w.id+'" href="#/water/'+w.id+'">'+esc(w.name)+icon('arrow')+'<span class="reach-name">'+esc(w.reach)+'</span></a><div class="water-meta">'+esc(w.region)+' · '+(w.kind==='river'?'River':w.kind==='lake'?'Lake':'Reservoir')+'</div>'+(window.ORFFPreview?.on?memberScore(w,true):'')+'</td><td><ul class="species-list">'+p.target_species.map(s=>'<li>'+esc(s)+'</li>').join('')+'</ul></td><td><span class="muted">'+(p.access_point?'Check in Maps':'No verified route')+'</span>'+driveLink(w)+'</td><td>'+esc(p.access_summary)+'</td><td>'+esc(p.seasonal_summary)+'</td><td><div data-monitor="'+w.id+'">'+monitoring(w,true)+'</div>'+countsHTML(w,true)+stockHTML(w,true)+reportHTML(w,true)+(window.ORFFPreview?.on?'':memberScore(w,true))+'</td><td>'+alertHTML(notices[0],true)+(notices.length>1?'<details data-od-id="alerts-'+w.id+'"><summary>'+String(notices.length-1)+' more '+(notices.length===2?'notice':'notices')+'</summary>'+notices.slice(1).map(a=>alertHTML(a,true)).join('')+'</details>':'')+'</td><td><span class="review-date">'+time(p.checked_on)+'</span><div class="meta">Source review<br>Not an on-site check</div></td></tr>';
  }
  function trendingHTML() {
    const entries=window.ORFFTrends?.rank(waters)||[];
    return '<section class="trending" data-od-id="trending-waters"><div class="section-heading"><h2>Trending waters</h2><span class="count-badge">This browser</span></div><p class="small muted">Waters opened here in the last 7 days. Interest is not a fishing forecast; community activity is not connected yet.</p>'+(entries.length?'<div class="trending-grid">'+entries.map((e,i)=>'<a class="trend-card" data-water-link="'+e.water.id+'" data-trend-link="true" data-od-id="trending-'+e.water.id+'" href="#/water/'+e.water.id+'"><span class="trend-number">0'+(i+1)+'</span><span><strong>'+esc(e.water.name)+'</strong><span class="reach-name">'+esc(e.water.reach)+'</span><span class="meta">'+e.count+' '+(e.count===1?'open':'opens')+' on this browser</span></span>'+icon('arrow')+'</a>').join('')+'</div>':'<div class="trending-empty"><strong>A little interest starts here.</strong><span>Open a water to begin a local list. Shared trends will need a connected analytics source.</span></div>')+'</section>';
  }
  function directory(query='',kind='all') {
    currentWater=null;
    const counts={all:waters.length,river:waters.filter(w=>w.kind==='river').length,lake:waters.filter(w=>w.kind!=='river').length};
    app.innerHTML='<div class="wrap"><section class="intro" data-od-id="directory-introduction"><div><div class="eyebrow">An Oregon &amp; SW Washington fishing field guide</div><h1 data-od-id="directory-title" tabindex="-1">Find your kind<br>of <em>water.</em></h1><p>What to catch, where to get in, and what to know before you go. Start with a reach that fits your day.</p><div class="intro-foot"><span class="rule"></span><span class="meta">Rivers, lakes &amp; a little local knowledge</span></div></div><figure class="landscape"><img src="assets/river-country-landscape.webp" width="1280" height="683" alt=""></figure></section><section class="directory" data-od-id="water-directory" aria-labelledby="directory-heading"><div class="section-heading"><h2 id="directory-heading" data-od-id="directory-heading">Explore the waters</h2><span class="count-badge">'+waters.length+' reaches</span></div><div class="directory-controls"><div class="search-box">'+icon('search')+'<label for="water-search" class="sr-only">Search by water, reach, region or species</label><input type="search" id="water-search" value="'+esc(query)+'" placeholder="Search water, reach, region or species" autocomplete="off" data-od-id="water-search"><button class="search-clear" id="clear-search" aria-label="Clear search" '+(!query?'hidden':'')+'>'+icon('close')+'</button></div><div class="filters" role="group" aria-label="Water type" data-od-id="water-type-filters">'+[['all','All waters'],['river','Rivers'],['lake','Lakes & reservoirs']].map(([v,l])=>'<button type="button" data-filter="'+v+'" aria-pressed="'+(kind===v)+'">'+l+' <span class="meta filter-count">'+counts[v]+'</span></button>').join('')+'</div></div><div class="toolbar-lower">'+originForm()+(window.ORFFPreview?.on?'<label class="score-sort"><span>Sort</span><select id="score-sort"><option value="guide">Guide order</option><option value="score"'+(get('sort','guide')==='score'?' selected':'')+'>Best river score first</option></select></label>':'')+'<p class="result-note" id="result-count" role="status" aria-live="polite"></p></div>'+(()=>{const now=stockRows().filter(r=>weekBucket(r)==='this'), n=new Set(now.map(r=>r.waterbody)).size;return n?'<a class="stock-callout" href="#/stocking" data-od-id="stocking-callout"><span class="live-dot" aria-hidden="true"></span><span><strong>Stocked this week: '+n+' Oregon '+(n===1?'water':'waters')+'</strong><span class="meta">'+fmt(now.reduce((t,r)=>t+r.total,0))+' trout planned by ODFW</span></span>'+icon('arrow')+'</a>':'';})()+'<div class="snapshot-note"><p><span class="status-dot"></span>Editorial snapshot · October 12, 2026. Readings are separate from reports.</p><a href="#/approach">How to read this guide</a></div><div id="table-container" class="table-scroll" tabindex="0" role="region" aria-label="Water comparison table, scroll horizontally for more fields" data-od-id="water-comparison"><table><caption class="sr-only">Compare Oregon and Southwest Washington waters. Drive times are checked in Google Maps; last verified refers to source review.</caption><colgroup><col style="width:17%"><col style="width:12%"><col style="width:9%"><col style="width:12%"><col style="width:12%"><col style="width:14%"><col style="width:16%"><col style="width:8%"></colgroup><thead><tr>'+['Water / reach','Target species','Drive time','Access','Seasonal outlook','Current conditions','Alerts','Last verified'].map(h=>'<th scope="col">'+h+'</th>').join('')+'</tr></thead><tbody id="water-rows"></tbody></table></div><div class="empty-state" id="empty-state" hidden data-od-id="empty-search"><h3>No waters match just yet.</h3><p>Try a species like trout, a region like Central Oregon or Southwest Washington, or clear your filters.</p><button id="reset-filters" type="button">Reset search & filters</button></div><div class="table-footer"><span>Each row is a specific reach. Select its name for the full field notes.</span><span>Scroll within the table to compare all eight fields →</span></div><div id="trending-section">'+trendingHTML()+'</div></section></div>';
    let activeKind=kind;
    const search=document.getElementById('water-search');
    function update(push=true) {
      const result=filtered(search.value,activeKind);
      if (window.ORFFPreview?.on && document.getElementById('score-sort')?.value==='score') {
        const v=w=>{const sc=window.ORFFPreview.score(w);return sc.status==='scored'?sc.value:-1;};
        result.sort((a,b)=>v(b)-v(a));
      }
      document.getElementById('water-rows').innerHTML=result.map(row).join('');
      document.getElementById('result-count').textContent=result.length+' of '+waters.length+' reaches · '+(activeKind==='all'?'All water types':activeKind==='river'?'Rivers':'Lakes & reservoirs');
      document.getElementById('empty-state').hidden=result.length!==0;
      document.getElementById('table-container').hidden=result.length===0;
      document.getElementById('clear-search').hidden=!search.value;
      document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===activeKind)));
      const params=new URLSearchParams();
      if(search.value.trim()) params.set('q',search.value.trim());
      if(activeKind!=='all') params.set('type',activeKind);
      directoryHash='#/waters'+(params.size?'?'+params:'');
      if(push) { try { history.replaceState(null,'',directoryHash); } catch {} }
    }
    search.addEventListener('input',()=>update());
    document.getElementById('score-sort')?.addEventListener('change',e=>{set('sort',e.target.value);update();});
    document.getElementById('clear-search').addEventListener('click',()=>{search.value='';update();search.focus();});
    document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{activeKind=b.dataset.filter;update();}));
    document.getElementById('reset-filters').addEventListener('click',()=>{activeKind='all';search.value='';update();search.focus();});
    update(false);
    bindOrigin();
  }
  function detail(w) {
    currentWater=w.id;
    set('selected',w.id);
    const p=w.planning, index=waters.indexOf(w);
    app.innerHTML='<div class="wrap"><div class="breadcrumbs"><a href="'+esc(directoryHash)+'">'+icon('back')+'Back to waters</a><span class="muted">/</span><span>'+esc(w.region)+'</span></div><header class="detail-heading" data-od-id="water-detail-heading"><div class="eyebrow">'+esc(w.kind)+' · '+esc(w.region)+'</div><h1 tabindex="-1" data-od-id="water-detail-title">'+esc(w.name)+'</h1><p class="reach-title">'+esc(w.reach)+'</p>'+(w.description?'<p class="description">'+esc(w.description)+'</p>':'')+factStrip(w)+'</header></div><div class="reach-bar" data-od-id="selected-water"><div class="wrap reach-bar-inner"><div class="reach-identity">'+esc(w.name)+'<span>'+esc(w.reach)+'</span></div><nav aria-label="Water sections"><a href="#/water/'+w.id+'?section=field-notes">Field notes</a><a href="#/water/'+w.id+'?section=access">Access</a><a href="#/water/'+w.id+'?section=alerts">Alerts</a><a href="#/water/'+w.id+'?section=sources">Sources</a>'+(window.ORFF_MAP?.positions?.[w.id]?'<a href="#/map?water='+w.id+'">Map</a>':'')+'</nav></div></div><div class="wrap"><div class="detail-grid"><div><section id="field-notes" class="detail-section" data-od-id="target-species"><h2>What can I catch?</h2><ul class="species-tags">'+p.target_species.map(s=>'<li>'+esc(s)+'</li>').join('')+'</ul><p class="meta">Species listed in the source record. Retention and gear rules are separate; review the reach alerts.</p>'+(p.score_notice?'<div class="reading-note"><strong>Why no fishing score?</strong><p>'+esc(p.score_notice)+'</p><span class="meta">Notice effective '+date(p.score_notice_effective_at)+'. This is a species restriction, not a closure of the entire water. No numerical scores are generated in this concept.</span></div>':'')+'</section><section class="detail-section" data-od-id="water-report"><h2>Is it worth a trip?</h2>'+memberScore(w)+reportHTML(w)+'<p class="meta" style="margin-top:12px">A dated report offers context, not a prediction for your trip.</p></section><section id="conditions" class="detail-section" data-od-id="live-conditions"><h2>At the water right now</h2><div data-monitor-detail="'+w.id+'">'+monitoring(w)+'</div></section>'+countsHTML(w)+stockHTML(w)+'<section class="detail-section" data-od-id="fishing-methods"><h2>How should I fish it?</h2><p>'+esc(p.methods)+'</p></section><section class="detail-section" data-od-id="seasonal-outlook"><h2>Find the seasonal window</h2><h3>'+esc(p.seasonal_summary)+'</h3><p>'+esc(p.seasonal_detail)+'</p></section><section id="sources" class="detail-section" data-od-id="water-sources"><div class="eyebrow">Follow the evidence</div><h2 style="margin-top:10px">Sources & review dates</h2><p class="small muted">Editorial sources reviewed '+time(p.checked_on)+'. Each report keeps its original date and geographic coverage. This is not an on-site access inspection.</p>'+sourceList(w)+(w.gauge?'<div class="reading-note" style="margin-top:20px"><strong>Monitoring reference</strong><p class="small">'+external(w.gauge.url,w.gauge.label+' · '+w.gauge.station_id)+'</p><span class="meta">A monitoring station is not a public fishing entrance. Directions use only the documented access point.</span></div>':'')+'</section></div><aside class="sidebar"><section id="access" class="access-panel" data-od-id="water-access"><div class="eyebrow">Plan your way in</div><h2>Where can I access it?</h2><h3>'+esc(p.access_summary)+'</h3><p>'+esc(p.access_detail)+'</p>'+(p.access_point?'<div class="destination"><span class="eyebrow">Documented destination</span><strong>'+esc(p.access_point.label)+'</strong></div>'+originForm()+driveLink(w,'Drive to access','primary')+'<p class="meta" style="margin-top:12px">Google Maps provides the route and drive time. Confirm current access before leaving.</p>'+((p.access_points||[]).length>1?accessPoints(w):''):'<div class="access-unconfirmed"><strong>No verified public route</strong><p style="margin:8px 0 0">Directions are withheld. Resolve a legal public access point first; the gauge is not a substitute.</p></div>')+'</section><section id="alerts" class="alerts-panel" data-od-id="water-alerts"><h2>Know before you go</h2><p>These notices apply to the species, dates and locations described.</p>'+p.alerts.map(a=>alertHTML(a)).join('')+'</section></aside></div><nav class="adjacent-waters" aria-label="Other waters">'+(index>0?'<a data-water-link="'+waters[index-1].id+'" href="#/water/'+waters[index-1].id+'"><small>← Previous reach</small>'+esc(waters[index-1].name)+'<span class="reach-name">'+esc(waters[index-1].reach)+'</span></a>':'')+(index<waters.length-1?'<a data-water-link="'+waters[index+1].id+'" href="#/water/'+waters[index+1].id+'"><small>Next reach →</small>'+esc(waters[index+1].name)+'<span class="reach-name">'+esc(waters[index+1].reach)+'</span></a>':'')+'</nav></div>';
    bindOrigin();
  }
  function membership(w) {
    currentWater=null;
    const back=w?'#/water/'+w.id:'#/waters?type=river';
    const backLabel=w?'Back to '+w.name:'Explore the rivers';
    app.innerHTML=`<div class="wrap membership-page" data-od-id="membership-page">
      <header class="membership-heading" data-od-id="membership-heading">
        <div class="eyebrow">A future membership</div>
        <h1 tabindex="-1" data-od-id="membership-title">A little more insight.<br>For your next river day.</h1>
        <p>The field guide stays free. We’re exploring a membership that adds river scores, with clear reasons behind every rating.</p>
      </header>
      <div class="membership-layout">
        <section class="membership-story" data-od-id="membership-features" aria-labelledby="member-features-title">
          <div class="eyebrow">The proposed paid feature</div>
          <h2 id="member-features-title" data-od-id="member-features-title">River scores, with the context.</h2>
          <p>A quick way to weigh a trip, supported by the same named reaches and source transparency you see in the guide.</p>
          <ol class="membership-features">
            <li data-od-id="membership-feature-score"><h3>A score for your reach and target fish</h3><p>Consider seasonal opportunity and available observations together. Show a rating only when there is enough reliable information.</p></li>
            <li data-od-id="membership-feature-reasons"><h3>Understand what’s behind it</h3><p>See which factors inform the rating, when the inputs were updated, and where the evidence is limited.</p></li>
            <li data-od-id="membership-feature-comparison"><h3>Compare river opportunities</h3><p>Bring those ratings into the water directory to help choose between reaches. A popular river and a promising fishing day are different things.</p></li>
          </ol>
          <p class="small muted">These are proposed features. The scoring method, coverage and release date are still to be determined.</p>
        </section>
        <aside class="membership-price" data-od-id="membership-pricing" aria-labelledby="membership-plan-title">
          <span class="count-badge">Planned · Not yet available</span>
          <h2 id="membership-plan-title" data-od-id="membership-plan-title">Oregon Fish Forecast<br>Membership</h2>
          <p class="membership-amount"><strong>$4.99</strong><span>USD / month</span></p>
          <p>Proposed monthly price for river scores and the context behind them.</p>
          <div class="membership-availability"><strong>Something to look forward to.</strong><p>Subscriptions are not open yet. This concept has no checkout, payment collection or active member accounts.</p></div>
          <div class="preview-cta" data-od-id="member-preview-toggle"><button type="button" class="${window.ORFFPreview?.on?'':'primary'}" data-preview-toggle>${window.ORFFPreview?.on?'Exit the member preview':'See the member preview'}</button><p class="small">${window.ORFFPreview?.on?'You are seeing river scores across the guide. Scores use a prototype formula from the guide’s own data and are not validated.':'Turn on river scores across the guide to see what members would get. Scores use a prototype formula and are clearly marked.'}</p></div>
          <a class="primary" href="${esc(back)}" data-od-id="membership-return">${esc(backLabel)} ${icon('arrow')}</a>
        </aside>
      </div>
      <section class="membership-free" data-od-id="free-guide-features" aria-labelledby="free-guide-title">
        <div><div class="eyebrow">Always useful, without a membership</div><h2 id="free-guide-title" data-od-id="free-guide-title">The essentials stay open.</h2><p>In this proposed plan, the current guide remains free to use.</p></div>
        <ul><li>All ${waters.length} water records, species and fishing methods</li><li>Documented access and driving directions</li><li>Seasonal notes, dated reports and available gauge readings</li><li>Rules, restrictions, alerts and original sources</li></ul>
      </section>
      <section class="membership-faq" data-od-id="membership-questions" aria-labelledby="membership-questions-title">
        <h2 id="membership-questions-title" data-od-id="membership-questions-title">A few things to know</h2>
        <details data-od-id="membership-question-scores"><summary>Why can’t I see numerical river scores yet?</summary><p>This concept does not calculate scores. Before launch, a scoring method needs validation against reliable, dated inputs for each reach and target species. Missing or unsuitable data must produce an unavailable state, not a guessed number.</p></details>
        <details data-od-id="membership-question-deschutes"><summary>Would membership unlock the Lower Deschutes scores?</summary><p>No. Both Lower Deschutes source records withhold a score pending review of salmon and steelhead restrictions. Those notices remain visible to everyone. They do not close the entire river or remove its trout information; payment would not resolve the rules review.</p></details>
        <details data-od-id="membership-question-lakes"><summary>What about lakes and reservoirs?</summary><p>The proposed paid score feature starts with rivers. The ${words[lakeCount]||lakeCount} lake and reservoir records remain in the free guide; lake scores are not part of this proposal.</p></details>
      </section>
    </div>`;
  }
  function mapPage(selectedId) {
    currentWater=null;
    const kindLabel=w=>w.kind==='river'?'River':w.kind==='lake'?'Lake':'Reservoir';
    app.innerHTML='<div class="wrap map-page" data-od-id="map-page"><header class="map-heading"><div><div class="eyebrow">The water map</div><h1 tabindex="-1" data-od-id="map-title">See the <em>water.</em></h1></div><p>Every stream and lake glows blue. Pick a water to find it, and a gauged river traces its own channel from the USGS station.</p></header><div class="map-layout"><div class="map-frame"><div id="water-map" class="water-map" role="region" aria-label="Map of the guide\'s waters. Use the list of waters to choose one with a keyboard."></div><div class="map-toolbar"><div class="filters map-filters" role="group" aria-label="Water type">'+[['all','All'],['river','Rivers'],['lake','Lakes']].map(([v,l])=>'<button type="button" data-map-filter="'+v+'" aria-pressed="'+(v==='all')+'">'+l+'</button>').join('')+'</div><div class="filters map-filters" role="group" aria-label="Base map">'+Object.entries(window.ORFFMap?.bases||{}).map(([k,b],i)=>'<button type="button" data-map-base="'+k+'" aria-pressed="'+(i===0)+'">'+esc(b.label)+'</button>').join('')+'</div></div><div class="map-legend" aria-hidden="true"><span><i class="dot river"></i>River reach</span><span><i class="dot lake"></i>Lake or reservoir</span><span><i class="line"></i>Traced river</span><label><input type="checkbox" id="hydro-toggle" checked> Streams &amp; lakes</label></div></div><aside class="map-side"><div id="map-card" class="map-card" aria-live="polite"></div><div class="map-list-head"><h2>Waters</h2><span class="count-badge" id="map-count">'+waters.length+'</span></div><ul class="map-list" id="map-list">'+waters.map(w=>'<li data-map-kind="'+(w.kind==='river'?'river':'lake')+'"><button type="button" data-map-water="'+w.id+'"><i class="dot '+(w.kind==='river'?'river':'lake')+'"></i><span><strong>'+esc(w.name)+'</strong><span class="reach-name">'+esc(w.reach)+'</span></span><span class="meta">'+esc(w.region)+'</span></button></li>').join('')+'</ul></aside></div><p class="meta map-note">'+esc(window.ORFF_MAP?.note||'')+' River lines follow the USGS network about '+(window.ORFFMap?.TRACE_KM||25)+' km up and downstream of the gauge, which can run past the named reach. Map tiles and river lines need a connection.</p></div>';
    const trace={};
    function card(id) {
      const w=waters.find(w=>w.id===id), el=document.getElementById('map-card');
      document.querySelectorAll('[data-map-water]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mapWater===id)));
      if(!w){el.innerHTML='<div class="eyebrow">Start here</div><p class="map-card-empty">Choose a pin or a water from the list.</p>';return;}
      const t=trace[id], hasGauge=!!window.ORFFMap?.station(w.id)&&w.kind==='river';
      const traceNote=!hasGauge?(w.kind==='river'?'No connected gauge, so the river line is not traced. The blue stream layer still shows it.':''):t==='loading'?'Tracing the river from its USGS gauge…':t==='done'?'River traced from the USGS gauge.':t==='error'?'The river line could not load. The blue stream layer still shows the channel.':'';
      el.innerHTML='<div class="eyebrow">'+esc(kindLabel(w))+' · '+esc(w.region)+'</div><h3>'+esc(w.name)+'</h3><p class="reach-name">'+esc(w.reach)+'</p><ul class="species-tags">'+w.planning.target_species.map(s=>'<li>'+esc(s)+'</li>').join('')+'</ul><p class="small">'+esc(w.planning.access_summary)+'</p>'+(traceNote?'<p class="meta">'+traceNote+'</p>':'')+'<div class="map-card-actions"><a class="primary" data-water-link="'+w.id+'" href="#/water/'+w.id+'">Field notes '+icon('arrow')+'</a>'+driveLink(w,'Directions','text-link')+'</div>';
    }
    function choose(id,opts) {
      card(id);
      liveMap?.select(id,opts);
      try{history.replaceState(null,'','#/map'+(id?'?water='+encodeURIComponent(id):''));}catch{}
    }
    liveMap=window.ORFFMap?window.ORFFMap.mount(document.getElementById('water-map'),{waters,esc,onSelect:id=>{choose(id);document.querySelector('[data-map-water="'+id+'"]')?.scrollIntoView({block:'nearest'});},onTrace:(id,status)=>{trace[id]=status;if(document.querySelector('[data-map-water="'+id+'"][aria-pressed="true"]'))card(id);}}):null;
    if(!liveMap) document.getElementById('water-map').innerHTML='<p class="map-fallback">The map could not load. The list of waters still works.</p>';
    document.getElementById('map-list').addEventListener('click',e=>{const b=e.target.closest('[data-map-water]');if(!b)return;choose(b.dataset.mapWater);const frame=document.querySelector('.map-frame'),r=frame.getBoundingClientRect();if(r.top<0||r.bottom>innerHeight)frame.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});});
    document.querySelectorAll('[data-map-filter]').forEach(b=>b.addEventListener('click',()=>{
      const k=b.dataset.mapFilter;
      document.querySelectorAll('[data-map-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
      document.querySelectorAll('#map-list li').forEach(li=>{li.hidden=k!=='all'&&li.dataset.mapKind!==k;});
      document.getElementById('map-count').textContent=document.querySelectorAll('#map-list li:not([hidden])').length;
      liveMap?.filter(k);
    }));
    document.querySelectorAll('[data-map-base]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-map-base]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));liveMap?.setBase(b.dataset.mapBase);}));
    document.getElementById('hydro-toggle').addEventListener('change',e=>liveMap?.setHydro(e.target.checked));
    const start=waters.find(w=>w.id===selectedId);
    if(start) choose(start.id,{fly:false}); else card(null);
  }
  function approach() {
    currentWater=null;
    const principles=[
      ['A reach is not a whole river.','The two Lower Deschutes entries describe different sections. Bowman Dam guidance does not become an Opal Springs forecast. Every water keeps its named reach, and every report keeps its geographic coverage.'],
      ['A review date is not a report date.','October 12, 2026 is the editorial source-review date. Reports keep their original dates, including July and September reports. “Older report” means more than 30 days before that review. Undated information stays undated.'],
      ['Seasonal context is not a live forecast.','Species patterns and fishing methods come from the supplied sources. They do not establish today’s flow, temperature, weather, catch rate or productive depth. Readings are shown only when a connected monitoring source returns valid observations.'],
      ['Rules apply to specific fish and places.','Species restrictions are kept visible without closing an entire water. The Lower Deschutes score notices are preserved from the packet: salmon and steelhead restrictions require a rules review. Trout context remains visible. No numerical fishing score is calculated here.'],
      ['Access is a destination, not a gauge.','Directions use only the documented access_point.map_query. The origin starts at Portland, Oregon and can be changed. Drive times come from Google Maps. Opal Springs, lower Metolius / Grandview, and the Coweeman, Toutle and Elochoman reaches have no verified public destination, so none receives a driving link. Where a source documents more than one launch, each point gets its own directions.'],
      ['A fish count is not a catch rate.','Dam and trap counts show adult fish moving upstream past one point. Each water says whether the count site is above or below it, and counts for one river never stand in for another. Bonneville, The Dalles and Willamette Falls counts refresh daily from Columbia River DART; other sites link to their own published counts.'],
      ['Interest is not fishing quality.','Trending waters currently reflects water pages opened on this browser in the last seven days. It is not community popularity or a recommendation. Searches can be attributed to the water a visitor opens; raw search text and driving origins are not sent as analytics. Shared trends require a connected analytics source.']
    ];
    app.innerHTML='<div class="wrap"><header class="approach-header" data-od-id="approach-heading"><div class="eyebrow">Our approach</div><h1 tabindex="-1">Good information.<br>Clear limits.</h1><p>A useful fishing guide tells you what it knows, where that knowledge comes from, and what still needs a check.</p></header><div class="approach-grid"><aside class="approach-aside"><div class="eyebrow">About this edition</div><p><strong>'+waters.length+' water records</strong><br>Supplied editorial packet<br>Reviewed October 12, 2026</p><p><strong>Southwest Washington</strong><br>'+waters.filter(w=>w.region==='Southwest Washington').length+' Kelso &amp; Longview rivers<br>Added October 14, 2026</p><p><strong>A separate concept</strong><br>Created for design comparison. Not connected to the original site.</p><a class="text-link" href="data/waters.json" download>Download source records '+icon('external')+'</a></aside><div>'+principles.map((p,i)=>'<section class="principle" data-od-id="principle-'+(i+1)+'"><span>0'+(i+1)+'</span><div><h2>'+p[0]+'</h2><p>'+p[1]+'</p></div></section>').join('')+'<section class="detail-section" data-od-id="source-directory"><div class="eyebrow">The reading room</div><h2 style="margin-top:10px">Sources by water</h2><p class="small muted">ODFW supplies Oregon fishing reports, species background and rules; WDFW creel checks and rules cover the Washington rivers. Land managers document access. OHA supplies health-advisory context. Open a reach to see its actual sources.</p><div class="source-directory">'+waters.map(w=>'<details data-od-id="sources-'+w.id+'"><summary>'+esc(w.name)+'<span class="meta">'+esc(w.reach)+'</span></summary><div class="source-content"><p class="meta">Reported '+date(w.planning.report.reported_on)+' · Source reviewed '+date(w.planning.report.checked_on)+'</p><p class="small">'+esc(w.planning.report.coverage)+'</p>'+sourceList(w)+'<a class="text-link" href="#/water/'+w.id+'">Open water details '+icon('arrow')+'</a></div></details>').join('')+'</div></section></div></div></div>';
  }
  function bindOrigin() {
    const form=document.querySelector('.origin-form');
    if(!form)return;
    form.addEventListener('submit',event=>{
      event.preventDefault();
      const input=document.getElementById('origin'), value=input.value.trim();
      if(!value){input.setCustomValidity('Enter a starting town or address.');input.reportValidity();return;}
      input.setCustomValidity(''); origin=value; set('origin',origin);
      document.querySelectorAll('[data-directions]').forEach(a=>{const w=waters.find(w=>w.id===a.dataset.directions);a.href=directions(w);});
      document.querySelectorAll('[data-directions-query]').forEach(a=>{a.href=mapsRoute(a.dataset.directionsQuery);});
      document.getElementById('origin-feedback').textContent='Directions updated for '+origin;
    });
    form.querySelector('input').addEventListener('input',event=>event.target.setCustomValidity(''));
  }
  function route() {
    const hash=location.hash || '#/waters', parts=hash.slice(1).split('?'), path=parts[0], params=new URLSearchParams(parts[1]||'');
    const id=path.startsWith('/water/')?path.slice(7):null;
    const w=waters.find(w=>w.id===id);
    if(w && currentWater===w.id && params.get('section')) {
      jump(params.get('section')); return;
    }
    if(liveMap){liveMap.destroy();liveMap=null;}
    if(path==='/stocking') { stockingPage(params.get('q')||'', ['later','recent','all'].includes(params.get('weeks'))?params.get('weeks'):'upcoming'); document.title='Trout stocking · Oregon Fish Forecast'; }
    else if(path==='/map') { mapPage(params.get('water')); document.title='Water map · Oregon Fish Forecast'; }
    else if(path==='/membership') { membership(waters.find(w=>w.id===params.get('water'))); document.title='Membership ? Oregon Fish Forecast'; }
    else if(path==='/approach'||path==='/sources') { approach(); document.title='Approach & sources · Oregon Fish Forecast'; }
    else if(w) { detail(w); document.title=w.name+' — '+w.reach+' · Oregon Fish Forecast'; window.ORFFTrends?.record(w.id); }
    else if(path==='/waters'||path==='/'||!path) { directory(params.get('q')||'', ['river','lake'].includes(params.get('type'))?params.get('type'):'all'); document.title='Explore waters · Oregon Fish Forecast'; }
    else { currentWater=null;app.innerHTML='<section class="wrap not-found"><h1 tabindex="-1">That reach is not in this guide.</h1><p>Choose a water from the directory to continue.</p><a class="text-link" href="#/waters">Back to all waters '+icon('arrow')+'</a></section>'; }
    document.querySelectorAll('[data-nav]').forEach(a=>{const active=a.dataset.nav===(path==='/stocking'?'stocking':path==='/map'?'map':path==='/membership'?'membership':(path==='/approach'||path==='/sources')?'approach':(w||path==='/waters'||path==='/'||!path)?'waters':'');if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
    if(!firstRender) { window.scrollTo(0,0);app.querySelector('h1')?.focus({preventScroll:true}); }
    firstRender=false;
    if(params.get('section')) jump(params.get('section'));
  }
  function jump(section) {
    if(!['field-notes','access','alerts','sources','conditions','fish-counts','stocking'].includes(section))return;
    const target=document.getElementById(section);if(!target)return;
    const offset=(document.querySelector('.reach-bar')?.getBoundingClientRect().height||0)+20;
    window.scrollTo({top:target.getBoundingClientRect().top+window.scrollY-offset,behavior:'auto'});
    target.setAttribute('tabindex','-1');target.focus({preventScroll:true});
  }
  document.addEventListener('click',event=>{
    if(event.target.closest('.skip-link')){event.preventDefault();document.getElementById('main-content').focus({preventScroll:true});return;}
    const a=event.target.closest('[data-water-link]');
    if(a) window.ORFFTrends?.setEntry(a.hasAttribute('data-trend-link')?'trending':document.getElementById('water-search')?.value.trim()?'search':'directory');
  });
  function banner() {
    const el=document.getElementById('preview-banner');
    if (!el) return;
    el.hidden=!window.ORFFPreview?.on;
    el.innerHTML=window.ORFFPreview?.on?'<div class="wrap preview-banner-inner"><span><strong>Member preview</strong> River scores use a prototype formula built from this guide’s data. They are not validated and are not fishing advice.</span><span class="preview-actions"><a href="#/waters?type=river">See scored rivers</a><button type="button" data-preview-toggle>Exit preview</button></span></div>':'';
  }
  document.addEventListener('click',e=>{const t=e.target.closest('[data-preview-toggle]');if(t)window.ORFFPreview?.set(!window.ORFFPreview.on);});
  window.addEventListener('orff-preview-change',()=>{banner();currentWater=null;route();});
  banner();
  window.addEventListener('hashchange',route);
  window.addEventListener('orff-monitoring-update',()=>{
    document.querySelectorAll('[data-monitor]').forEach(el=>{const w=waters.find(w=>w.id===el.dataset.monitor);el.innerHTML=monitoring(w,true);});
    document.querySelectorAll('[data-monitor-detail]').forEach(el=>{const w=waters.find(w=>w.id===el.dataset.monitorDetail);el.innerHTML=monitoring(w);});
  });
  window.ORFFApp={countsHTML,stockHTML,weekBucket,filtered,directions,accessPoints,factStrip,row,reportHTML,alertHTML,sourceList,route,date,esc,waters};
  route();
})();
