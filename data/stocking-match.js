/* Which ODFW stocking-schedule names belong to which guide water, added 2026-10-14.
   A schedule row matches when its waterbody contains one of the names (case-insensitive, whole words).
   Rivers are listed only where the guide's reach is the stocked section: ODFW splits the McKenzie into
   "R-1 (below Leaburg Dam)" and "R-2 (above Leaburg Dam)", and the guide has a page for each. The two
   Lost Creek names cannot collide: "Lost Creek Reservoir" and "Rogue River above Lost Creek" are different rows. */
window.ORFF_STOCKING_MATCH = {
  "haystack-reservoir": ["Haystack Reservoir"],
  "lake-billy-chinook-crooked-arm": ["Billy Chinook"],
  "diamond-lake": ["Diamond Lake"],
  "detroit-lake-mongold": ["Detroit Reservoir", "Detroit Lake"],
  "henry-hagg-lake": ["Hagg Lake", "Henry Hagg"],
  "odell-lake-princess-creek": ["Odell Lake"],
  "wallowa-lake-state-park": ["Wallowa Lake"],
  "mckenzie-river-leaburg": ["below Leaburg Dam"],
  "fall-river-above-falls": ["Fall River"],
  // ODFW lists Big Lava Lake as "LAVA LK, B", shown as "Lava Lake (B)"; "Lava Lake (L)" is Little Lava Lake.
  "lava-lake-campground": ["Lava Lake (B"],
  "howard-prairie-reservoir": ["Howard Prairie"],
  "fourmile-lake-campground": ["Fourmile Lake"],
  "lost-creek-reservoir": ["Lost Creek Reservoir"],
  "rogue-river-above-lost-creek": ["Rogue River above Lost Creek"],
  "dexter-reservoir": ["Dexter Reservoir"],
  "dorena-reservoir": ["Dorena Reservoir"],
  "applegate-reservoir": ["Applegate Reservoir"],
  "alton-baker-canal": ["Alton Baker Canal"],
  "mckenzie-river-above-leaburg": ["above Leaburg Dam"],
  // ODFW lists the North Fork Santiam as "Santiam River (North Fork 2)".
  "north-santiam-river-mehama": ["Santiam River (North Fork 2"],
  "foster-reservoir": ["Foster Reservoir"],
  "green-peter-reservoir": ["Green Peter Reservoir"],
  "east-lake-newberry": ["East Lake"],
  "paulina-lake-newberry": ["Paulina Lake"],
  // ODFW lists Big Cultus Lake as "CULTUS LK, B", shown as "Cultus Lake (B)".
  "cultus-lake": ["Cultus Lake (B"],
  // "Lake In The Woods" is a different water on ODFW's schedule.
  "lake-of-the-woods": ["Lake of the Woods"]
};
