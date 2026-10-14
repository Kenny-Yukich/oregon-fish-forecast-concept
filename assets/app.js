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
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const get = (key, fallback) => { try { return localStorage.getItem('orff-concept.' + key) || fallback; } catch { return fallback; } };
  const set = (key, value) => { try { localStorage.setItem('orff-concept.' + key, value); } catch {} };
  let origin = get('origin', packet.defaultOrigin);
  let directoryHash = '#/waters';
  let currentWater = null;
  let firstRender = true;
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
  function directions(w) {
    if (!w.planning.access_point?.map_query) return null;
    return 'https://www.google.com/maps/dir/?' + new URLSearchParams({api:'1',origin,destination:w.planning.access_point.map_query,travelmode:'driving'});
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
  function memberScore(w, compact=false) {
    if (w.kind!=='river') return '';
    const href='#/membership?water='+encodeURIComponent(w.id);
    if (compact) return '<div class="member-score-cell" data-od-id="member-score-'+w.id+'"><strong>River score</strong><span class="meta">'+(w.planning.score_notice?'Rules review pending':'Planned member feature')+'</span><a class="cell-link" href="'+href+'" aria-label="About planned member scores for '+esc(w.name)+' — '+esc(w.reach)+'">About member scores '+icon('arrow')+'</a></div>';
    return '<div class="member-score-panel" data-od-id="member-score-'+w.id+'"><div class="member-score-top"><h3>River score</h3><span class="count-badge">Planned · Membership</span></div><p class="score-status">'+(w.planning.score_notice?'Rules review pending':'Not calculated yet')+'</p><p class="small">'+(w.planning.score_notice?'The source withholds a score pending a species rules review. A future subscription would not override that restriction.':'A future member score would bring together current conditions, seasonal context and species-specific rules for this reach. A scoring model has not been validated yet.')+'</p><a class="text-link" href="'+href+'">About the $4.99/month plan '+icon('arrow')+'</a></div>';
  }
  function filtered(query='',kind='all') {
    const terms=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return waters.filter(w => (kind==='all'||(kind==='river'?w.kind==='river':w.kind==='lake'||w.kind==='reservoir')) && terms.every(t=>[w.name,w.reach,w.region,...w.planning.target_species].join(' ').toLocaleLowerCase().includes(t)));
  }
  function row(w) {
    const p=w.planning, notices=p.alerts;
    return '<tr data-od-id="water-'+w.id+'" data-selected="'+(get('selected','')===w.id)+'"><td><a class="water-link" data-water-link="'+w.id+'" href="#/water/'+w.id+'">'+esc(w.name)+icon('arrow')+'<span class="reach-name">'+esc(w.reach)+'</span></a><div class="water-meta">'+esc(w.region)+' · '+(w.kind==='river'?'River':w.kind==='lake'?'Lake':'Reservoir')+'</div></td><td><ul class="species-list">'+p.target_species.map(s=>'<li>'+esc(s)+'</li>').join('')+'</ul></td><td><span class="muted">'+(p.access_point?'Check in Maps':'No verified route')+'</span>'+driveLink(w)+'</td><td>'+esc(p.access_summary)+'</td><td>'+esc(p.seasonal_summary)+'</td><td><div data-monitor="'+w.id+'">'+monitoring(w,true)+'</div>'+reportHTML(w,true)+memberScore(w,true)+'</td><td>'+alertHTML(notices[0],true)+(notices.length>1?'<details data-od-id="alerts-'+w.id+'"><summary>'+String(notices.length-1)+' more '+(notices.length===2?'notice':'notices')+'</summary>'+notices.slice(1).map(a=>alertHTML(a,true)).join('')+'</details>':'')+'</td><td><span class="review-date">'+time(p.checked_on)+'</span><div class="meta">Source review<br>Not an on-site check</div></td></tr>';
  }
  function trendingHTML() {
    const entries=window.ORFFTrends?.rank(waters)||[];
    return '<section class="trending" data-od-id="trending-waters"><div class="section-heading"><h2>Trending waters</h2><span class="count-badge">This browser</span></div><p class="small muted">Waters opened here in the last 7 days. Interest is not a fishing forecast; community activity is not connected yet.</p>'+(entries.length?'<div class="trending-grid">'+entries.map((e,i)=>'<a class="trend-card" data-water-link="'+e.water.id+'" data-trend-link="true" data-od-id="trending-'+e.water.id+'" href="#/water/'+e.water.id+'"><span class="trend-number">0'+(i+1)+'</span><span><strong>'+esc(e.water.name)+'</strong><span class="reach-name">'+esc(e.water.reach)+'</span><span class="meta">'+e.count+' '+(e.count===1?'open':'opens')+' on this browser</span></span>'+icon('arrow')+'</a>').join('')+'</div>':'<div class="trending-empty"><strong>A little interest starts here.</strong><span>Open a water to begin a local list. Shared trends will need a connected analytics source.</span></div>')+'</section>';
  }
  function directory(query='',kind='all') {
    currentWater=null;
    const counts={all:waters.length,river:waters.filter(w=>w.kind==='river').length,lake:waters.filter(w=>w.kind!=='river').length};
    app.innerHTML='<div class="wrap"><section class="intro" data-od-id="directory-introduction"><div><div class="eyebrow">An Oregon fishing field guide</div><h1 data-od-id="directory-title" tabindex="-1">Find your kind<br>of <em>water.</em></h1><p>What to catch, where to get in, and what to know before you go. Start with a reach that fits your day.</p><div class="intro-foot"><span class="rule"></span><span class="meta">Rivers, lakes &amp; a little local knowledge</span></div></div><figure class="landscape"><img src="assets/river-country-landscape.webp" width="1280" height="683" alt=""></figure></section><section class="directory" data-od-id="water-directory" aria-labelledby="directory-heading"><div class="section-heading"><h2 id="directory-heading" data-od-id="directory-heading">Explore the waters</h2><span class="count-badge">'+waters.length+' reaches</span></div><div class="directory-controls"><div class="search-box">'+icon('search')+'<label for="water-search" class="sr-only">Search by water, reach, region or species</label><input type="search" id="water-search" value="'+esc(query)+'" placeholder="Search water, reach, region or species" autocomplete="off" data-od-id="water-search"><button class="search-clear" id="clear-search" aria-label="Clear search" '+(!query?'hidden':'')+'>'+icon('close')+'</button></div><div class="filters" role="group" aria-label="Water type" data-od-id="water-type-filters">'+[['all','All waters'],['river','Rivers'],['lake','Lakes & reservoirs']].map(([v,l])=>'<button type="button" data-filter="'+v+'" aria-pressed="'+(kind===v)+'">'+l+' <span class="meta filter-count">'+counts[v]+'</span></button>').join('')+'</div></div><div class="toolbar-lower">'+originForm()+'<p class="result-note" id="result-count" role="status" aria-live="polite"></p></div><div class="snapshot-note"><p><span class="status-dot"></span>Editorial snapshot · October 12, 2026. Readings are separate from reports.</p><a href="#/approach">How to read this guide</a></div><div id="table-container" class="table-scroll" tabindex="0" role="region" aria-label="Water comparison table, scroll horizontally for more fields" data-od-id="water-comparison"><table><caption class="sr-only">Compare Oregon waters. Drive times are checked in Google Maps; last verified refers to source review.</caption><colgroup><col style="width:17%"><col style="width:12%"><col style="width:9%"><col style="width:12%"><col style="width:12%"><col style="width:14%"><col style="width:16%"><col style="width:8%"></colgroup><thead><tr>'+['Water / reach','Target species','Drive time','Access','Seasonal outlook','Current conditions','Alerts','Last verified'].map(h=>'<th scope="col">'+h+'</th>').join('')+'</tr></thead><tbody id="water-rows"></tbody></table></div><div class="empty-state" id="empty-state" hidden data-od-id="empty-search"><h3>No waters match just yet.</h3><p>Try a species like trout, a region like Central Oregon, or clear your filters.</p><button id="reset-filters" type="button">Reset search & filters</button></div><div class="table-footer"><span>Each row is a specific reach. Select its name for the full field notes.</span><span>Scroll within the table to compare all eight fields →</span></div><div id="trending-section">'+trendingHTML()+'</div></section></div>';
    let activeKind=kind;
    const search=document.getElementById('water-search');
    function update(push=true) {
      const result=filtered(search.value,activeKind);
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
    app.innerHTML='<div class="wrap"><div class="breadcrumbs"><a href="'+esc(directoryHash)+'">'+icon('back')+'Back to waters</a><span class="muted">/</span><span>'+esc(w.region)+'</span></div><header class="detail-heading" data-od-id="water-detail-heading"><div class="eyebrow">'+esc(w.kind)+' · '+esc(w.region)+'</div><h1 tabindex="-1" data-od-id="water-detail-title">'+esc(w.name)+'</h1><p class="reach-title">'+esc(w.reach)+'</p>'+(w.description?'<p class="description">'+esc(w.description)+'</p>':'')+'</header></div><div class="reach-bar" data-od-id="selected-water"><div class="wrap reach-bar-inner"><div class="reach-identity">'+esc(w.name)+'<span>'+esc(w.reach)+'</span></div><nav aria-label="Water sections"><a href="#/water/'+w.id+'?section=field-notes">Field notes</a><a href="#/water/'+w.id+'?section=access">Access</a><a href="#/water/'+w.id+'?section=alerts">Alerts</a><a href="#/water/'+w.id+'?section=sources">Sources</a></nav></div></div><div class="wrap"><div class="detail-grid"><div><section id="field-notes" class="detail-section" data-od-id="target-species"><h2>What can I catch?</h2><ul class="species-tags">'+p.target_species.map(s=>'<li>'+esc(s)+'</li>').join('')+'</ul><p class="meta">Species listed in the source record. Retention and gear rules are separate; review the reach alerts.</p>'+(p.score_notice?'<div class="reading-note"><strong>Why no fishing score?</strong><p>'+esc(p.score_notice)+'</p><span class="meta">Notice effective '+date(p.score_notice_effective_at)+'. This is a species restriction, not a closure of the entire water. No numerical scores are generated in this concept.</span></div>':'')+'</section><section class="detail-section" data-od-id="water-report"><h2>Is it worth a trip?</h2>'+memberScore(w)+reportHTML(w)+'<p class="meta" style="margin-top:12px">A dated report offers context, not a prediction for your trip.</p></section><section id="conditions" class="detail-section" data-od-id="live-conditions"><h2>At the water right now</h2><div data-monitor-detail="'+w.id+'">'+monitoring(w)+'</div></section><section class="detail-section" data-od-id="fishing-methods"><h2>How should I fish it?</h2><p>'+esc(p.methods)+'</p></section><section class="detail-section" data-od-id="seasonal-outlook"><h2>Find the seasonal window</h2><h3>'+esc(p.seasonal_summary)+'</h3><p>'+esc(p.seasonal_detail)+'</p></section><section id="sources" class="detail-section" data-od-id="water-sources"><div class="eyebrow">Follow the evidence</div><h2 style="margin-top:10px">Sources & review dates</h2><p class="small muted">Editorial sources reviewed '+time(p.checked_on)+'. Each report keeps its original date and geographic coverage. This is not an on-site access inspection.</p>'+sourceList(w)+(w.gauge?'<div class="reading-note" style="margin-top:20px"><strong>Monitoring reference</strong><p class="small">'+external(w.gauge.url,w.gauge.label+' · '+w.gauge.station_id)+'</p><span class="meta">A monitoring station is not a public fishing entrance. Directions use only the documented access point.</span></div>':'')+'</section></div><aside class="sidebar"><section id="access" class="access-panel" data-od-id="water-access"><div class="eyebrow">Plan your way in</div><h2>Where can I access it?</h2><h3>'+esc(p.access_summary)+'</h3><p>'+esc(p.access_detail)+'</p>'+(p.access_point?'<div class="destination"><span class="eyebrow">Documented destination</span><strong>'+esc(p.access_point.label)+'</strong></div>'+originForm()+driveLink(w,'Drive to access','primary')+'<p class="meta" style="margin-top:12px">Google Maps provides the route and drive time. Confirm current access before leaving.</p>':'<div class="access-unconfirmed"><strong>No verified public route</strong><p style="margin:8px 0 0">Directions are withheld. Resolve a legal public access point first; the gauge is not a substitute.</p></div>')+'</section><section id="alerts" class="alerts-panel" data-od-id="water-alerts"><h2>Know before you go</h2><p>These notices apply to the species, dates and locations described.</p>'+p.alerts.map(a=>alertHTML(a)).join('')+'</section></aside></div><nav class="adjacent-waters" aria-label="Other waters">'+(index>0?'<a data-water-link="'+waters[index-1].id+'" href="#/water/'+waters[index-1].id+'"><small>← Previous reach</small>'+esc(waters[index-1].name)+'<span class="reach-name">'+esc(waters[index-1].reach)+'</span></a>':'')+(index<waters.length-1?'<a data-water-link="'+waters[index+1].id+'" href="#/water/'+waters[index+1].id+'"><small>Next reach →</small>'+esc(waters[index+1].name)+'<span class="reach-name">'+esc(waters[index+1].reach)+'</span></a>':'')+'</nav></div>';
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
          <a class="primary" href="${esc(back)}" data-od-id="membership-return">${esc(backLabel)} ${icon('arrow')}</a>
        </aside>
      </div>
      <section class="membership-free" data-od-id="free-guide-features" aria-labelledby="free-guide-title">
        <div><div class="eyebrow">Always useful, without a membership</div><h2 id="free-guide-title" data-od-id="free-guide-title">The essentials stay open.</h2><p>In this proposed plan, the current guide remains free to use.</p></div>
        <ul><li>All 24 water records, species and fishing methods</li><li>Documented access and driving directions</li><li>Seasonal notes, dated reports and available gauge readings</li><li>Rules, restrictions, alerts and original sources</li></ul>
      </section>
      <section class="membership-faq" data-od-id="membership-questions" aria-labelledby="membership-questions-title">
        <h2 id="membership-questions-title" data-od-id="membership-questions-title">A few things to know</h2>
        <details data-od-id="membership-question-scores"><summary>Why can’t I see numerical river scores yet?</summary><p>This concept does not calculate scores. Before launch, a scoring method needs validation against reliable, dated inputs for each reach and target species. Missing or unsuitable data must produce an unavailable state, not a guessed number.</p></details>
        <details data-od-id="membership-question-deschutes"><summary>Would membership unlock the Lower Deschutes scores?</summary><p>No. Both Lower Deschutes source records withhold a score pending review of salmon and steelhead restrictions. Those notices remain visible to everyone. They do not close the entire river or remove its trout information; payment would not resolve the rules review.</p></details>
        <details data-od-id="membership-question-lakes"><summary>What about lakes and reservoirs?</summary><p>The proposed paid score feature starts with rivers. The seven lake and reservoir records remain in the free guide; lake scores are not part of this proposal.</p></details>
      </section>
    </div>`;
  }
  function approach() {
    currentWater=null;
    const principles=[
      ['A reach is not a whole river.','The two Lower Deschutes entries describe different sections. Bowman Dam guidance does not become an Opal Springs forecast. Every water keeps its named reach, and every report keeps its geographic coverage.'],
      ['A review date is not a report date.','October 12, 2026 is the editorial source-review date. Reports keep their original dates, including July and September reports. “Older report” means more than 30 days before that review. Undated information stays undated.'],
      ['Seasonal context is not a live forecast.','Species patterns and fishing methods come from the supplied sources. They do not establish today’s flow, temperature, weather, catch rate or productive depth. Readings are shown only when a connected monitoring source returns valid observations.'],
      ['Rules apply to specific fish and places.','Species restrictions are kept visible without closing an entire water. The Lower Deschutes score notices are preserved from the packet: salmon and steelhead restrictions require a rules review. Trout context remains visible. No numerical fishing score is calculated here.'],
      ['Access is a destination, not a gauge.','Directions use only the documented access_point.map_query. The origin starts at Portland, Oregon and can be changed. Drive times come from Google Maps. Opal Springs and lower Metolius / Grandview have no verified public destination, so neither receives a driving link.'],
      ['Interest is not fishing quality.','Trending waters currently reflects water pages opened on this browser in the last seven days. It is not community popularity or a recommendation. Searches can be attributed to the water a visitor opens; raw search text and driving origins are not sent as analytics. Shared trends require a connected analytics source.']
    ];
    app.innerHTML='<div class="wrap"><header class="approach-header" data-od-id="approach-heading"><div class="eyebrow">Our approach</div><h1 tabindex="-1">Good information.<br>Clear limits.</h1><p>A useful fishing guide tells you what it knows, where that knowledge comes from, and what still needs a check.</p></header><div class="approach-grid"><aside class="approach-aside"><div class="eyebrow">About this edition</div><p><strong>24 water records</strong><br>Supplied editorial packet<br>Reviewed October 12, 2026</p><p><strong>A separate concept</strong><br>Created for design comparison. Not connected to the original site.</p><a class="text-link" href="data/waters.json" download>Download source records '+icon('external')+'</a></aside><div>'+principles.map((p,i)=>'<section class="principle" data-od-id="principle-'+(i+1)+'"><span>0'+(i+1)+'</span><div><h2>'+p[0]+'</h2><p>'+p[1]+'</p></div></section>').join('')+'<section class="detail-section" data-od-id="source-directory"><div class="eyebrow">The reading room</div><h2 style="margin-top:10px">Sources by water</h2><p class="small muted">ODFW supplies fishing reports, species background and rules. Land managers document access. OHA supplies health-advisory context. Open a reach to see its actual sources.</p><div class="source-directory">'+waters.map(w=>'<details data-od-id="sources-'+w.id+'"><summary>'+esc(w.name)+'<span class="meta">'+esc(w.reach)+'</span></summary><div class="source-content"><p class="meta">Reported '+date(w.planning.report.reported_on)+' · Source reviewed '+date(w.planning.report.checked_on)+'</p><p class="small">'+esc(w.planning.report.coverage)+'</p>'+sourceList(w)+'<a class="text-link" href="#/water/'+w.id+'">Open water details '+icon('arrow')+'</a></div></details>').join('')+'</div></section></div></div></div>';
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
    if(path==='/membership') { membership(waters.find(w=>w.id===params.get('water'))); document.title='Membership ? Oregon Fish Forecast'; }
    else if(path==='/approach'||path==='/sources') { approach(); document.title='Approach & sources · Oregon Fish Forecast'; }
    else if(w) { detail(w); document.title=w.name+' — '+w.reach+' · Oregon Fish Forecast'; window.ORFFTrends?.record(w.id); }
    else if(path==='/waters'||path==='/'||!path) { directory(params.get('q')||'', ['river','lake'].includes(params.get('type'))?params.get('type'):'all'); document.title='Explore Oregon waters · Oregon Fish Forecast'; }
    else { currentWater=null;app.innerHTML='<section class="wrap not-found"><h1 tabindex="-1">That reach is not in this guide.</h1><p>Choose a water from the directory to continue.</p><a class="text-link" href="#/waters">Back to all waters '+icon('arrow')+'</a></section>'; }
    document.querySelectorAll('[data-nav]').forEach(a=>{const active=a.dataset.nav===(path==='/membership'?'membership':(path==='/approach'||path==='/sources')?'approach':(w||path==='/waters'||path==='/'||!path)?'waters':'');if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
    if(!firstRender) { window.scrollTo(0,0);app.querySelector('h1')?.focus({preventScroll:true}); }
    firstRender=false;
    if(params.get('section')) jump(params.get('section'));
  }
  function jump(section) {
    if(!['field-notes','access','alerts','sources','conditions'].includes(section))return;
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
  window.addEventListener('hashchange',route);
  window.addEventListener('orff-monitoring-update',()=>{
    document.querySelectorAll('[data-monitor]').forEach(el=>{const w=waters.find(w=>w.id===el.dataset.monitor);el.innerHTML=monitoring(w,true);});
    document.querySelectorAll('[data-monitor-detail]').forEach(el=>{const w=waters.find(w=>w.id===el.dataset.monitorDetail);el.innerHTML=monitoring(w);});
  });
  window.ORFFApp={filtered,directions,row,reportHTML,alertHTML,sourceList,route,date,esc,waters};
  route();
})();
