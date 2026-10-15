/* Angler posts: word of mouth from public social media, added 2026-10-15.
   Read by hand from two public Facebook groups and TikTok, Sept 15 to Oct 15, 2026. Collected with Apify.
   Rules for this file:
   - Summaries are short and general. No names, handles or photos, and nothing copied word for word beyond a short quote.
   - `where` says when a post was on another section of the river or did not say where on the river it was.
   - `scoring: true` only for a catch or fishing report on this water, with the section unstated or on this reach.
     Posts from other sections, conditions notes and secondhand mentions never count toward a score.
   - Angler posts can only raise a score, never lower it (see assets/member-preview.js), and only for 14 days.
   - `elsewhere` lists waters anglers talked about that are not in the guide yet, as a guide to which ones to add. */
window.ORFF_ANGLER = {
  checked_on: "2026-10-15",
  window_start: "2026-09-15",
  reviewed: {facebook_posts: 430, tiktok_videos: 120, tiktok_comments: 499},
  sources: [
    {label: "Oregon Fishing (public Facebook group, about 38,000 people)", url: "https://www.facebook.com/groups/1552453421736697/"},
    {label: "Oregon Fishing Network (public Facebook group, about 4,000 people)", url: "https://www.facebook.com/groups/474041098053000/"},
    {label: "TikTok #oregonfishing", url: "https://www.tiktok.com/tag/oregonfishing"}
  ],
  waters: {
    "siletz-river-jack-morgan": [
      {date: "2026-10-01", platform: "Facebook", kind: "guide", where: "Siletz, Alsea or Yaquina; section not stated", note: "A local guide booking fall Chinook trips said bobber fishing was starting to heat up.", signal: "positive", scoring: true, url: "https://www.facebook.com/groups/474041098053000/permalink/1372773878179713/"},
      {date: "2026-09-21", platform: "Facebook", kind: "catch", where: "Tidewater, below this reach", note: "Boats trolling tidewater were hooking fall Chinook. One pair landed a Chinook and lost two more.", signal: "positive", scoring: false, url: "https://www.facebook.com/groups/1552453421736697/permalink/4384483885200289/"}
    ],
    "rogue-river-touvelle": [
      {date: "2026-10-14", platform: "TikTok", kind: "catch", where: "Rogue, section not stated", note: "An angler posted a fall steelhead from the Rogue.", signal: "positive", scoring: true, url: "https://www.tiktok.com/@trevor.meek05/video/7696686242481638686"}
    ],
    "detroit-lake-mongold": [
      {date: "2026-10-12", platform: "TikTok", kind: "catch", where: "Tagged at Detroit Lake", note: "A kokanee catch was posted from Detroit Lake.", signal: "positive", scoring: true, url: "https://www.tiktok.com/@cade.140/video/7696009452800986399"},
      {date: "2026-09-19", platform: "Facebook", kind: "conditions", where: "", note: "A weekly roundup noted low water, with boats launching from the winter ramp, and only secondhand catch reports.", signal: "neutral", scoring: false, url: "https://www.facebook.com/groups/1552453421736697/permalink/4382218052093539/"}
    ],
    "henry-hagg-lake": [
      {date: "2026-10-11", platform: "Facebook", kind: "mention", where: "", note: "An angler asked where trout were biting near Portland “besides Hagg Lake,” suggesting Hagg has been giving up trout.", signal: "positive", scoring: false, url: "https://www.facebook.com/groups/1552453421736697/permalink/4407374442911233/"},
      {date: "2026-09-21", platform: "TikTok", kind: "catch", where: "Tagged at Henry Hagg Lake", note: "A video showed a mix of fish caught on a Ned rig.", signal: "positive", scoring: true, url: "https://www.tiktok.com/@jalenmurphishes/video/7688131435546381581"}
    ],
    "north-fork-nehalem-hatchery": [
      {date: "2026-09-27", platform: "Facebook", kind: "catch", where: "Nehalem, section not stated", note: "An angler called the Nehalem slow but landed a fish.", signal: "mixed", scoring: true, url: "https://www.facebook.com/groups/1552453421736697/permalink/4391290904519587/"}
    ],
    "willamette-river-cathedral-park": [
      {date: "2026-10-04", platform: "Facebook", kind: "catch", where: "Willamette in Portland; section not stated", note: "An angler living on a floating home reported catching a few fish. Species not stated.", signal: "positive", scoring: false, url: "https://www.facebook.com/groups/1552453421736697/permalink/4399205423728135/"}
    ],
    "middle-deschutes-culver": [
      {date: "2026-10-08", platform: "TikTok", kind: "catch", where: "Near Bend, upstream of this reach", note: "A regular fly-fishing poster said a crisp morning produced whitefish.", signal: "positive", scoring: false, url: "https://www.tiktok.com/@outdoorguy35/video/7694373540111387917"},
      {date: "2026-09-22", platform: "TikTok", kind: "catch", where: "Near Bend, upstream of this reach", note: "Trout were taking dry flies.", signal: "positive", scoring: false, url: "https://www.tiktok.com/@outdoorguy35/video/7688488315489668366"}
    ],
    "diamond-lake": [
      {date: "2026-10-11", platform: "Facebook", kind: "conditions", where: "", note: "The lakeside resort posted a 26°F Sunday morning.", signal: "neutral", scoring: false, url: "https://www.facebook.com/groups/474041098053000/permalink/1381501610640273/"}
    ],
    "columbia-river-chinook-landing": [
      {date: "2026-10-14", platform: "Facebook", kind: "guide", where: "Near The Dalles, well upstream of this reach", note: "A guide called upper Columbia coho fishing “on fire.”", signal: "positive", scoring: false, url: "https://www.facebook.com/groups/1552453421736697/permalink/4410782009237143/"},
      {date: "2026-10-04", platform: "Facebook", kind: "catch", where: "Columbia Gorge, upstream of this reach", note: "Coho photos were posted from boats in the Gorge.", signal: "positive", scoring: false, url: "https://www.facebook.com/groups/1552453421736697/permalink/4399593107022700/"},
      {date: "2026-09-17", platform: "Facebook", kind: "guide", where: "Astoria, far downstream", note: "A guide described estuary coho fishing as very good, with three-fish limits.", signal: "positive", scoring: false, url: "https://www.facebook.com/groups/1552453421736697/permalink/4380805535568124/"}
    ]
  },
  elsewhere: [
    {water: "Alsea and Yaquina", note: "Fall Chinook, mostly guide trip posts", posts: 8, latest: "2026-10-14"},
    {water: "Columbia estuary (Astoria, Buoy 10)", note: "Coho, three-fish limits in mid-September", posts: 3, latest: "2026-09-19"},
    {water: "Siuslaw (Florence)", note: "Chinook and coho, guide posts", posts: 5, latest: "2026-10-07"},
    {water: "Columbia near The Dalles", note: "Coho in October", posts: 2, latest: "2026-10-14"},
    {water: "Green Peter Reservoir", note: "Two catch videos, identified by commenters", posts: 2, latest: "2026-10-03"},
    {water: "Wickiup and Paulina lakes", note: "Kokanee, a guide boat limiting", posts: 1, latest: "2026-10-09"},
    {water: "Cultus Lake", note: "Lake trout and a 21-inch rainbow", posts: 1, latest: "2026-09-26"},
    {water: "Crescent Lake", note: "Lake trout, released", posts: 1, latest: "2026-09-29"},
    {water: "Emigrant Lake", note: "Catch video near Ashland", posts: 1, latest: "2026-10-06"},
    {water: "Deschutes in and near Bend", note: "Trout on dry flies and whitefish, from a regular fly-fishing poster", posts: 6, latest: "2026-10-08"},
    {water: "Upper Deschutes", note: "Closing weekend, kokanee spawning", posts: 1, latest: "2026-09-27"}
  ]
};
