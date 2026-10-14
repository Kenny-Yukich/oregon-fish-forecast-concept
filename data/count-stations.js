/* Fish-count stations and how each relates to a water, added 2026-10-14.
   Counts show fish moving upstream past a dam or trap. They are run timing, not catch rates.
   Stations with a dart code are refreshed daily into data/counts.js by .github/workflows/fish-counts.yml;
   the others link to the operator's published counts. */
window.ORFF_COUNT_STATIONS = {
  stations: {
    BON: {name: "Bonneville Dam", river: "Columbia River", operator: "U.S. Army Corps of Engineers, via Columbia River DART", dart: "BON", url: "https://www.cbr.washington.edu/dart/query/adult_daily"},
    TDA: {name: "The Dalles Dam", river: "Columbia River", operator: "U.S. Army Corps of Engineers, via Columbia River DART", dart: "TDA", url: "https://www.cbr.washington.edu/dart/query/adult_daily"},
    WFF: {name: "Willamette Falls", river: "Willamette River", operator: "ODFW, via Columbia River DART", dart: "WFF", url: "https://myodfw.com/willamette-falls-fish-counts"},
    SHERARS: {name: "Sherars Falls trap", river: "Deschutes River", operator: "ODFW", url: "https://myodfw.com/sherars-falls-fish-counts", note: "The trap catches an unknown share of fall Chinook and summer steelhead, so its numbers show timing, not run size."},
    LEABURG: {name: "Leaburg Dam", river: "McKenzie River", operator: "ODFW and U.S. Army Corps of Engineers", url: "https://myodfw.com/fish-counts-leaburg-dam"},
    WINCHESTER: {name: "Winchester Dam", river: "North Umpqua River", operator: "ODFW", url: "https://myodfw.com/winchester-dam-fish-counts", note: "ODFW notes these counts can run one to two months behind."}
  },
  waters: {
    "columbia-river-chinook-landing": [
      {station: "BON", relation: "About 25 miles upstream. Fish counted here have already passed Chinook Landing, so a rising count means fish are moving through the Portland-area reach."}
    ],
    "lower-deschutes-moody": [
      {station: "TDA", relation: "Downstream of the Deschutes mouth. Deschutes-bound fish pass here first, along with fish headed farther up the Columbia."},
      {station: "BON", relation: "The first Columbia dam fish pass on the way to the Deschutes."},
      {station: "SHERARS", relation: "Upstream of this reach, near river mile 44."}
    ],
    "lower-deschutes-warm-springs-trout-creek": [
      {station: "SHERARS", relation: "Downstream of this reach. Fish counted here are headed up toward it."},
      {station: "TDA", relation: "Deschutes-bound fish pass The Dalles before entering the river."}
    ],
    "willamette-river-cathedral-park": [
      {station: "WFF", relation: "Upstream of Cathedral Park. Fish counted at the falls have already passed through Portland."}
    ],
    "mckenzie-river-leaburg": [
      {station: "LEABURG", relation: "At this reach. Leaburg Dam is the count site for the McKenzie above Leaburg."},
      {station: "WFF", relation: "McKenzie spring Chinook and steelhead pass Willamette Falls first, along with fish for every other upper-Willamette river."}
    ],
    "umpqua-river-elkton": [
      {station: "WINCHESTER", relation: "On the North Umpqua, upstream of Elkton. Counts cover only fish entering the North Umpqua."}
    ]
  }
};
