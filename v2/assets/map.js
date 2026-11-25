/* Water map. Tiles and river lines are public services requested by the visitor's browser;
   the directory and water pages keep working when they are unavailable. */
(() => {
  'use strict';
  const FOREST = '#023926', LAKE = '#2f6d8a', TRACE = '#f2c94c';
  const NLDI = 'https://api.water.usgs.gov/nldi/linked-data/nwissite/';
  const TRACE_KM = 25;
  const bases = {
    satellite: {
      label: 'Satellite',
      layers: [
        ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {maxZoom: 18, attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics'}],
        ['https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {maxZoom: 18, attribution: 'Labels &copy; Esri'}]
      ]
    },
    topo: {
      label: 'Topo',
      layers: [
        ['https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}', {maxZoom: 16, attribution: 'USGS The National Map'}]
      ]
    }
  };
  const HYDRO = ['https://basemap.nationalmap.gov/arcgis/rest/services/USGSHydroCached/MapServer/tile/{z}/{y}/{x}', {maxZoom: 16, opacity: 0.9, attribution: 'Hydrography: USGS The National Map'}];
  const traces = new Map();

  function station(id) {
    const s = window.ORFF_MONITORING?.[id]?.station;
    return s && /^USGS-\d+$/.test(s) ? s : null;
  }
  async function fetchTrace(stationId, signal) {
    const get = async mode => {
      const r = await fetch(NLDI + stationId + '/navigation/' + mode + '/flowlines?' + new URLSearchParams({distance: String(TRACE_KM), f: 'json'}), {signal, credentials: 'omit'});
      if (!r.ok) throw new Error('NLDI ' + r.status);
      const json = await r.json();
      return (json.features || []).filter(f => f?.geometry && /LineString$/.test(f.geometry.type));
    };
    const [up, down] = await Promise.all([get('UM'), get('DM')]);
    const features = [...up, ...down];
    if (!features.length) throw new Error('No flowlines');
    return {type: 'FeatureCollection', features};
  }

  function mount(el, opts) {
    const L = window.L, positions = window.ORFF_MAP?.positions || {};
    if (!L) { el.innerHTML = '<p class="map-fallback">The map library could not load. The list of waters still works.</p>'; return {select() {}, filter() {}, setBase() {}, setHydro() {}, destroy() {}}; }
    const map = L.map(el, {zoomControl: true, scrollWheelZoom: true, worldCopyJump: false, attributionControl: true});
    map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener noreferrer">Leaflet</a>');
    const baseLayers = Object.fromEntries(Object.entries(bases).map(([k, b]) => [k, L.layerGroup(b.layers.map(([u, o]) => L.tileLayer(u, o)))]));
    const hydro = L.tileLayer(...HYDRO);
    let base = 'satellite', selected = null, kind = 'all', controller = null, traceLayer = null;
    baseLayers[base].addTo(map);
    hydro.addTo(map);
    const markers = new Map();
    for (const w of opts.waters) {
      const pos = positions[w.id];
      if (!pos) continue;
      const m = L.circleMarker(pos, style(w, false)).addTo(map);
      m.bindTooltip(opts.esc(w.name) + '<span>' + opts.esc(w.reach) + '</span>', {direction: 'top', offset: [0, -8], className: 'map-tip'});
      m.on('click', () => opts.onSelect(w.id));
      markers.set(w.id, {marker: m, water: w});
    }
    const all = L.latLngBounds([...markers.values()].map(v => v.marker.getLatLng()));
    if (all.isValid()) map.fitBounds(all, {padding: [30, 30]});
    else map.setView([44.5, -121.5], 6);

    function style(w, on) {
      const lake = w.kind !== 'river';
      return {radius: on ? 11 : 7, color: on ? TRACE : '#ffffff', weight: on ? 4 : 2, fillColor: lake ? LAKE : FOREST, fillOpacity: 1, opacity: 1};
    }
    function visible(w) { return kind === 'all' || (kind === 'river' ? w.kind === 'river' : w.kind !== 'river'); }
    function filter(next) {
      kind = next;
      for (const {marker, water} of markers.values()) {
        if (visible(water)) marker.addTo(map); else marker.remove();
      }
    }
    function clearTrace() {
      controller?.abort(); controller = null;
      if (traceLayer) { traceLayer.remove(); traceLayer = null; }
    }
    function drawTrace(geo) {
      traceLayer = L.layerGroup([
        L.geoJSON(geo, {style: {color: '#0b1f17', weight: 9, opacity: 0.55, lineCap: 'round'}, interactive: false}),
        L.geoJSON(geo, {style: {color: TRACE, weight: 4.5, opacity: 1, lineCap: 'round'}, interactive: false})
      ]).addTo(map);
      markers.get(selected)?.marker.bringToFront();
    }
    async function select(id, {fly = true} = {}) {
      if (selected && markers.has(selected)) markers.get(selected).marker.setStyle(style(markers.get(selected).water, false));
      clearTrace();
      selected = id;
      const entry = markers.get(id);
      if (!entry) { opts.onTrace?.(id, 'none'); return; }
      entry.marker.setStyle(style(entry.water, true)).bringToFront();
      if (fly) map.flyTo(entry.marker.getLatLng(), Math.max(map.getZoom(), 11), {duration: 0.6});
      else map.setView(entry.marker.getLatLng(), Math.max(map.getZoom(), 11));
      const s = station(id);
      if (!s || entry.water.kind !== 'river') { opts.onTrace?.(id, 'none'); return; }
      if (traces.has(s)) { drawTrace(traces.get(s)); opts.onTrace?.(id, 'done'); return; }
      opts.onTrace?.(id, 'loading');
      controller = new AbortController();
      const mine = controller, timer = setTimeout(() => mine.abort(), 15000);
      try {
        const geo = await fetchTrace(s, mine.signal);
        traces.set(s, geo);
        if (selected === id) { drawTrace(geo); opts.onTrace?.(id, 'done'); }
      } catch {
        if (selected === id) opts.onTrace?.(id, 'error');
      } finally { clearTimeout(timer); }
    }
    function setBase(next) {
      if (!baseLayers[next] || next === base) return;
      baseLayers[base].remove(); base = next; baseLayers[base].addTo(map);
      hydro.bringToFront(); traceLayer?.eachLayer(l => l.bringToFront());
    }
    function setHydro(on) { if (on) hydro.addTo(map); else hydro.remove(); }
    function destroy() { clearTrace(); map.remove(); }
    return {select, filter, setBase, setHydro, destroy, map, markers};
  }
  window.ORFFMap = {mount, station, TRACE_KM, bases};
})();
