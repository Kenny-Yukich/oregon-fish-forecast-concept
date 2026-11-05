/* Which ODFW stocking-schedule names belong to which guide water, added 2026-10-14.
   A schedule row matches when its waterbody contains one of the names (case-insensitive, whole words).
   Rivers are listed only where the guide's reach is the stocked section: ODFW splits the McKenzie into
   "R-1 (below Leaburg Dam)" and "R-2 (above Leaburg Dam)", and the guide's reach is below the dam. */
window.ORFF_STOCKING_MATCH = {
  "haystack-reservoir": ["Haystack Reservoir"],
  "lake-billy-chinook-crooked-arm": ["Billy Chinook"],
  "diamond-lake": ["Diamond Lake"],
  "detroit-lake-mongold": ["Detroit Reservoir", "Detroit Lake"],
  "henry-hagg-lake": ["Hagg Lake", "Henry Hagg"],
  "odell-lake-princess-creek": ["Odell Lake"],
  "wallowa-lake-state-park": ["Wallowa Lake"],
  "mckenzie-river-leaburg": ["below Leaburg Dam"],
  "fall-river-above-falls": ["Fall River"]
};
