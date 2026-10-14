/* Local interest, never fabricated community statistics. No analytics SDK is loaded. */
(() => {
  const KEY='orff-concept.interest.v1', WEEK=7*24*60*60*1000;
  let entry='direct', events=[];
  try { const saved=JSON.parse(localStorage.getItem(KEY)||'[]'); if(Array.isArray(saved)) events=saved.filter(e=>typeof e.id==='string'&&Number.isFinite(e.at)); } catch {}
  function prune(){events=events.filter(e=>e.at>Date.now()-WEEK&&e.at<=Date.now());}
  window.ORFFTrends={
    setEntry(value){entry=value;},
    record(id){
      prune();
      /* Deduplicate repeated refreshes/visits within 30 minutes. */
      if(events.some(e=>e.id===id&&Date.now()-e.at<30*60*1000))return;
      events.push({id,at:Date.now()});
      try {localStorage.setItem(KEY,JSON.stringify(events));}catch{}
      /* A future host must explicitly connect its consented analytics before this fires. */
      if(window.ORFF_ANALYTICS_CONSENT===true&&typeof window.gtag==='function'){
        window.gtag('event','water_view',{water_id:id,entry_point:entry});
      }
      entry='direct';
    },
    rank(waters){
      prune();const counts=new Map();
      events.forEach(e=>counts.set(e.id,(counts.get(e.id)||0)+1));
      return waters.filter(w=>counts.has(w.id)).map(w=>({water:w,count:counts.get(w.id)})).sort((a,b)=>b.count-a.count||a.water.name.localeCompare(b.water.name)).slice(0,3);
    }
  };
})();
