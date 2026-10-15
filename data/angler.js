/* Angler posts: word of mouth from public social media. Written by scripts/fetch-angler.mjs; edit that script, not this file.
   Posts from public Facebook groups and TikTok are collected with Apify and read by Claude every morning.
   - Summaries are short and general. No names, handles or photos.
   - `where` says when a post was on another section of the river or did not say where on the river it was.
   - `scoring: true` only for a catch or guide report on this water, with the section unstated or on this reach.
     Angler posts can only raise a score, never lower it (see assets/member-preview.js), and only for 14 days.
   - Posts stay for 30 days. `elsewhere` lists waters anglers talked about that are not in the guide yet.
   - `read_log` counts the posts read, by the day they were posted; `reviewed` is the total for the last 30 days. */
window.ORFF_ANGLER = {
  "checked_on": "2026-10-15",
  "window_start": "2026-09-15",
  "reviewed": {
    "facebook_posts": 578,
    "tiktok_videos": 48
  },
  "sources": [
    {
      "label": "Oregon Fishing (public Facebook group, about 38,000 people)",
      "url": "https://www.facebook.com/groups/1552453421736697/"
    },
    {
      "label": "Oregon Fishing Network (public Facebook group, about 4,000 people)",
      "url": "https://www.facebook.com/groups/474041098053000/"
    },
    {
      "label": "Rogue River, Chetco River, Elk River, & Sixes River Fishing Reports (public Facebook group, about 11,500 people)",
      "url": "https://www.facebook.com/groups/672427923442117/"
    },
    {
      "label": "TikTok #oregonfishing and Oregon fishing creators",
      "url": "https://www.tiktok.com/tag/oregonfishing"
    }
  ],
  "waters": {
    "siletz-river-jack-morgan": [
      {
        "date": "2026-10-01",
        "platform": "Facebook",
        "kind": "guide",
        "where": "Siletz, Alsea or Yaquina; section not stated",
        "note": "A local guide booking fall Chinook trips said bobber fishing was starting to heat up.",
        "signal": "positive",
        "scoring": true,
        "url": "https://www.facebook.com/groups/474041098053000/permalink/1372773878179713/"
      },
      {
        "date": "2026-09-21",
        "platform": "Facebook",
        "kind": "catch",
        "where": "Tidewater, below this reach",
        "note": "Boats trolling tidewater were hooking fall Chinook. One pair landed a Chinook and lost two more.",
        "signal": "positive",
        "scoring": false,
        "url": "https://www.facebook.com/groups/1552453421736697/permalink/4384483885200289/"
      }
    ],
    "rogue-river-touvelle": [
      {
        "date": "2026-10-14",
        "platform": "TikTok",
        "kind": "catch",
        "where": "Rogue, section not stated",
        "note": "An angler posted a fall steelhead from the Rogue.",
        "signal": "positive",
        "scoring": true,
        "url": "https://www.tiktok.com/@trevor.meek05/video/7696686242481638686"
      },
      {
        "url": "https://www.facebook.com/groups/672427923442117/permalink/2043275366357359/",
        "date": "2026-09-26",
        "platform": "Facebook",
        "kind": "guide",
        "where": "Lower Rogue near Gold Beach, far downstream of this reach",
        "note": "After rain brought in bright fish, a guide boat kept five Chinook and released about ten wild coho.",
        "signal": "positive",
        "scoring": false
      },
      {
        "url": "https://www.facebook.com/groups/672427923442117/permalink/2038802226804673/",
        "date": "2026-09-21",
        "platform": "Facebook",
        "kind": "guide",
        "where": "Lower Rogue near Gold Beach, far downstream of this reach",
        "note": "A guide said Rogue Bay trips had averaged about 1.5 fish per person a day since late July.",
        "signal": "positive",
        "scoring": false
      }
    ],
    "detroit-lake-mongold": [
      {
        "date": "2026-10-12",
        "platform": "TikTok",
        "kind": "catch",
        "where": "Tagged at Detroit Lake",
        "note": "A kokanee catch was posted from Detroit Lake.",
        "signal": "positive",
        "scoring": true,
        "url": "https://www.tiktok.com/@cade.140/video/7696009452800986399"
      },
      {
        "date": "2026-09-19",
        "platform": "Facebook",
        "kind": "conditions",
        "where": "",
        "note": "A weekly roundup noted low water, with boats launching from the winter ramp, and only secondhand catch reports.",
        "signal": "neutral",
        "scoring": false,
        "url": "https://www.facebook.com/groups/1552453421736697/permalink/4382218052093539/"
      }
    ],
    "henry-hagg-lake": [
      {
        "date": "2026-10-11",
        "platform": "Facebook",
        "kind": "mention",
        "where": "",
        "note": "An angler asked where trout were biting near Portland “besides Hagg Lake,” suggesting Hagg has been giving up trout.",
        "signal": "positive",
        "scoring": false,
        "url": "https://www.facebook.com/groups/1552453421736697/permalink/4407374442911233/"
      },
      {
        "date": "2026-09-21",
        "platform": "TikTok",
        "kind": "catch",
        "where": "Tagged at Henry Hagg Lake",
        "note": "A video showed a mix of fish caught on a Ned rig.",
        "signal": "positive",
        "scoring": true,
        "url": "https://www.tiktok.com/@jalenmurphishes/video/7688131435546381581"
      }
    ],
    "north-fork-nehalem-hatchery": [
      {
        "date": "2026-09-27",
        "platform": "Facebook",
        "kind": "catch",
        "where": "Nehalem, section not stated",
        "note": "An angler called the Nehalem slow but landed a fish.",
        "signal": "mixed",
        "scoring": true,
        "url": "https://www.facebook.com/groups/1552453421736697/permalink/4391290904519587/"
      }
    ],
    "willamette-river-cathedral-park": [
      {
        "date": "2026-10-04",
        "platform": "Facebook",
        "kind": "catch",
        "where": "Willamette in Portland; section not stated",
        "note": "An angler living on a floating home reported catching a few fish. Species not stated.",
        "signal": "positive",
        "scoring": false,
        "url": "https://www.facebook.com/groups/1552453421736697/permalink/4399205423728135/"
      }
    ],
    "middle-deschutes-culver": [
      {
        "date": "2026-10-08",
        "platform": "TikTok",
        "kind": "catch",
        "where": "Near Bend, upstream of this reach",
        "note": "A regular fly-fishing poster said a crisp morning produced whitefish.",
        "signal": "positive",
        "scoring": false,
        "url": "https://www.tiktok.com/@outdoorguy35/video/7694373540111387917"
      },
      {
        "date": "2026-09-22",
        "platform": "TikTok",
        "kind": "catch",
        "where": "Near Bend, upstream of this reach",
        "note": "Trout were taking dry flies.",
        "signal": "positive",
        "scoring": false,
        "url": "https://www.tiktok.com/@outdoorguy35/video/7688488315489668366"
      }
    ],
    "diamond-lake": [
      {
        "date": "2026-10-11",
        "platform": "Facebook",
        "kind": "conditions",
        "where": "",
        "note": "The lakeside resort posted a 26°F Sunday morning.",
        "signal": "neutral",
        "scoring": false,
        "url": "https://www.facebook.com/groups/474041098053000/permalink/1381501610640273/"
      }
    ],
    "columbia-river-chinook-landing": [
      {
        "date": "2026-10-14",
        "platform": "Facebook",
        "kind": "guide",
        "where": "Near The Dalles, well upstream of this reach",
        "note": "A guide called upper Columbia coho fishing “on fire.”",
        "signal": "positive",
        "scoring": false,
        "url": "https://www.facebook.com/groups/1552453421736697/permalink/4410782009237143/"
      },
      {
        "date": "2026-10-04",
        "platform": "Facebook",
        "kind": "catch",
        "where": "Columbia Gorge, upstream of this reach",
        "note": "Coho photos were posted from boats in the Gorge.",
        "signal": "positive",
        "scoring": false,
        "url": "https://www.facebook.com/groups/1552453421736697/permalink/4399593107022700/"
      },
      {
        "date": "2026-09-17",
        "platform": "Facebook",
        "kind": "guide",
        "where": "Astoria, far downstream",
        "note": "A guide described estuary coho fishing as very good, with three-fish limits.",
        "signal": "positive",
        "scoring": false,
        "url": "https://www.facebook.com/groups/1552453421736697/permalink/4380805535568124/"
      }
    ]
  },
  "elsewhere": [
    {
      "water": "Chetco estuary (Brookings)",
      "note": "After a slow day, a lone angler landed a Chinook on the last pass near the jetty while nearby boats hooked up.",
      "posts": 10,
      "latest": "2026-10-14"
    },
    {
      "water": "Alsea and Yaquina",
      "note": "A guide is booking fall Chinook trips, with coho twitching on the Yaquina planned for early November.",
      "posts": 7,
      "latest": "2026-10-14"
    },
    {
      "water": "Lower Rogue (Gold Beach)",
      "note": "After rain brought in bright fish, a guide boat kept five Chinook and released about ten wild coho.",
      "posts": 6,
      "latest": "2026-09-26"
    },
    {
      "water": "Deschutes in and near Bend",
      "note": "A crisp morning produced whitefish on the fly.",
      "posts": 4,
      "latest": "2026-10-08"
    },
    {
      "water": "Green Peter Reservoir",
      "note": "A catch video from near Sweet Home that commenters placed at Green Peter.",
      "posts": 2,
      "latest": "2026-10-03"
    },
    {
      "water": "Siuslaw (Florence)",
      "note": "A charter out of Florence had a Chinook on the bar and its coho offshore by 8:30 a.m.",
      "posts": 2,
      "latest": "2026-09-20"
    },
    {
      "water": "Columbia near The Dalles",
      "note": "A guide called upper Columbia coho fishing “on fire.”",
      "posts": 1,
      "latest": "2026-10-14"
    },
    {
      "water": "Wickiup and Paulina lakes",
      "note": "A guide boat was limiting on kokanee at Wickiup and Paulina.",
      "posts": 1,
      "latest": "2026-10-09"
    },
    {
      "water": "Emigrant Lake",
      "note": "An angler posted a day of fishing at Emigrant Lake near Ashland.",
      "posts": 1,
      "latest": "2026-10-06"
    },
    {
      "water": "Crescent Lake",
      "note": "Several big lake trout were landed and released.",
      "posts": 1,
      "latest": "2026-09-29"
    },
    {
      "water": "Upper Deschutes",
      "note": "Closing weekend on the upper river, with kokanee spawning.",
      "posts": 1,
      "latest": "2026-09-27"
    },
    {
      "water": "Cultus Lake",
      "note": "A lake trout and a 21-inch rainbow on a crisp morning.",
      "posts": 1,
      "latest": "2026-09-26"
    },
    {
      "water": "Columbia estuary (Astoria, Buoy 10)",
      "note": "A guide called Astoria coho fishing very good, with three-fish limits.",
      "posts": 1,
      "latest": "2026-09-17"
    }
  ],
  "elsewhere_posts": [
    {
      "date": "2026-10-14",
      "water": "Alsea and Yaquina",
      "note": "A guide is booking fall Chinook trips, with coho twitching on the Yaquina planned for early November.",
      "url": "https://www.facebook.com/groups/474041098053000/permalink/1384007457056355/"
    },
    {
      "date": "2026-10-14",
      "water": "Chetco estuary (Brookings)",
      "note": "After a slow day, a lone angler landed a Chinook on the last pass near the jetty while nearby boats hooked up.",
      "url": "https://www.facebook.com/groups/672427923442117/permalink/2059232391428323/"
    },
    {
      "date": "2026-10-14",
      "water": "Columbia near The Dalles",
      "note": "A guide called upper Columbia coho fishing “on fire.”",
      "url": "https://www.facebook.com/groups/1552453421736697/permalink/4410782009237143/"
    },
    {
      "date": "2026-10-09",
      "water": "Chetco estuary (Brookings)",
      "note": "A guide boat had a good day on the Chetco estuary.",
      "url": "https://www.facebook.com/groups/672427923442117/permalink/2055177341833828/"
    },
    {
      "date": "2026-10-09",
      "water": "Chetco estuary (Brookings)",
      "note": "A guide posted the day’s Chinook catches from the Chetco estuary.",
      "url": "https://www.facebook.com/groups/672427923442117/permalink/2055096841841878/"
    },
    {
      "date": "2026-10-09",
      "water": "Wickiup and Paulina lakes",
      "note": "A guide boat was limiting on kokanee at Wickiup and Paulina.",
      "url": "https://www.facebook.com/groups/1552453421736697/permalink/4404449596537051/"
    },
    {
      "date": "2026-10-08",
      "water": "Chetco estuary (Brookings)",
      "note": "A lodge called it peak season on the Chetco estuary, with solid fishing expected to improve with dry weather and big tides.",
      "url": "https://www.facebook.com/groups/672427923442117/permalink/2054318251919737/"
    },
    {
      "date": "2026-10-08",
      "water": "Deschutes in and near Bend",
      "note": "A crisp morning produced whitefish on the fly.",
      "url": "https://www.tiktok.com/@outdoorguy35/video/7694373540111387917"
    },
    {
      "date": "2026-10-06",
      "water": "Emigrant Lake",
      "note": "An angler posted a day of fishing at Emigrant Lake near Ashland.",
      "url": "https://www.tiktok.com/@getrightkell/video/7693779241850178846"
    },
    {
      "date": "2026-10-05",
      "water": "Alsea and Yaquina",
      "note": "A guide had a seat open for fall Chinook on the Alsea, Yaquina or Siletz.",
      "url": "https://www.facebook.com/groups/474041098053000/permalink/1376201054503662/"
    },
    {
      "date": "2026-10-03",
      "water": "Chetco estuary (Brookings)",
      "note": "A guide said the Chetco had been fishing very well.",
      "url": "https://www.facebook.com/groups/672427923442117/permalink/2049839905700905/"
    },
    {
      "date": "2026-10-03",
      "water": "Green Peter Reservoir",
      "note": "A catch video from near Sweet Home that commenters placed at Green Peter.",
      "url": "https://www.tiktok.com/@twoguysnomap/video/7692507923280301325"
    },
    {
      "date": "2026-10-01",
      "water": "Alsea and Yaquina",
      "note": "A guide said bobber fishing for fall Chinook was starting to heat up.",
      "url": "https://www.facebook.com/groups/474041098053000/permalink/1372773878179713/"
    },
    {
      "date": "2026-10-01",
      "water": "Green Peter Reservoir",
      "note": "A catch video that commenters placed at Green Peter.",
      "url": "https://www.tiktok.com/@dean.perri/video/7691688406258044191"
    },
    {
      "date": "2026-09-29",
      "water": "Crescent Lake",
      "note": "Several big lake trout were landed and released.",
      "url": "https://www.facebook.com/groups/1552453421736697/permalink/4393993687582642/"
    },
    {
      "date": "2026-09-27",
      "water": "Upper Deschutes",
      "note": "Closing weekend on the upper river, with kokanee spawning.",
      "url": "https://www.tiktok.com/@watermalon__/video/7690242003380030733"
    },
    {
      "date": "2026-09-26",
      "water": "Chetco estuary (Brookings)",
      "note": "A guide said big Chetco kings had arrived after a strong day.",
      "url": "https://www.facebook.com/groups/672427923442117/permalink/2043195433032019/"
    },
    {
      "date": "2026-09-26",
      "water": "Lower Rogue (Gold Beach)",
      "note": "After rain brought in bright fish, a guide boat kept five Chinook and released about ten wild coho.",
      "url": "https://www.facebook.com/groups/672427923442117/permalink/2043275366357359/"
    },
    {
      "date": "2026-09-26",
      "water": "Deschutes in and near Bend",
      "note": "A fly angler had a slow day.",
      "url": "https://www.tiktok.com/@outdoorguy35/video/7690004012636278030"
    },
    {
      "date": "2026-09-26",
      "water": "Cultus Lake",
      "note": "A lake trout and a 21-inch rainbow on a crisp morning.",
      "url": "https://www.facebook.com/groups/474041098053000/permalink/1368608465262921/"
    },
    {
      "date": "2026-09-25",
      "water": "Alsea and Yaquina",
      "note": "A guide was booking fall Chinook trips on the Siletz, Alsea and Yaquina.",
      "url": "https://www.facebook.com/groups/474041098053000/permalink/1367225482067886/"
    },
    {
      "date": "2026-09-25",
      "water": "Chetco estuary (Brookings)",
      "note": "A first scouting trip to Brookings produced a large Chinook.",
      "url": "https://www.facebook.com/groups/672427923442117/permalink/2042299556454940/"
    },
    {
      "date": "2026-09-24",
      "water": "Chetco estuary (Brookings)",
      "note": "A 16-pound Chinook came trolling anchovies on the last pass in the estuary.",
      "url": "https://www.facebook.com/groups/672427923442117/permalink/2041387453212817/"
    },
    {
      "date": "2026-09-22",
      "water": "Chetco estuary (Brookings)",
      "note": "Chinook were caught trolling anchovies in the estuary.",
      "url": "https://www.facebook.com/groups/672427923442117/permalink/2039506340067595/"
    },
    {
      "date": "2026-09-22",
      "water": "Deschutes in and near Bend",
      "note": "Trout were taking dry flies.",
      "url": "https://www.tiktok.com/@outdoorguy35/video/7688488315489668366"
    },
    {
      "date": "2026-09-21",
      "water": "Alsea and Yaquina",
      "note": "A guide was booking fall Chinook trips on the Siletz, Alsea and Yaquina.",
      "url": "https://www.facebook.com/groups/474041098053000/permalink/1363828832407551/"
    },
    {
      "date": "2026-09-21",
      "water": "Chetco estuary (Brookings)",
      "note": "An angler said the Chetco was on fire.",
      "url": "https://www.facebook.com/groups/672427923442117/permalink/2038587350159494/"
    },
    {
      "date": "2026-09-21",
      "water": "Lower Rogue (Gold Beach)",
      "note": "A guide said Rogue Bay trips had averaged about 1.5 fish per person a day since late July.",
      "url": "https://www.facebook.com/groups/672427923442117/permalink/2038802226804673/"
    },
    {
      "date": "2026-09-20",
      "water": "Siuslaw (Florence)",
      "note": "A charter out of Florence had a Chinook on the bar and its coho offshore by 8:30 a.m.",
      "url": "https://www.facebook.com/groups/474041098053000/permalink/1363235205800247/"
    },
    {
      "date": "2026-09-19",
      "water": "Lower Rogue (Gold Beach)",
      "note": "A guide boat caught bright Chinook, including a 30-pound fish, and released about a dozen coho.",
      "url": "https://www.facebook.com/groups/672427923442117/permalink/2037061686978727/"
    },
    {
      "date": "2026-09-18",
      "water": "Alsea and Yaquina",
      "note": "A guide was booking fall Chinook trips on the Siletz, Alsea and Yaquina.",
      "url": "https://www.facebook.com/groups/474041098053000/permalink/1361886882601746/"
    },
    {
      "date": "2026-09-18",
      "water": "Lower Rogue (Gold Beach)",
      "note": "Ocean-bright Chinook were arriving daily in the Rogue Bay.",
      "url": "https://www.facebook.com/groups/672427923442117/permalink/2036243797060516/"
    },
    {
      "date": "2026-09-17",
      "water": "Alsea and Yaquina",
      "note": "A guide had a seat open for a Yaquina trip.",
      "url": "https://www.facebook.com/groups/474041098053000/permalink/1360691072721327/"
    },
    {
      "date": "2026-09-17",
      "water": "Siuslaw (Florence)",
      "note": "A guide said wild coho retention opened Sept 19 while fishing the Coos and Siuslaw.",
      "url": "https://www.facebook.com/groups/1552453421736697/permalink/4380701812245163/"
    },
    {
      "date": "2026-09-17",
      "water": "Columbia estuary (Astoria, Buoy 10)",
      "note": "A guide called Astoria coho fishing very good, with three-fish limits.",
      "url": "https://www.facebook.com/groups/1552453421736697/permalink/4380805535568124/"
    },
    {
      "date": "2026-09-16",
      "water": "Lower Rogue (Gold Beach)",
      "note": "Everyone on a guide boat took home a couple of salmon.",
      "url": "https://www.facebook.com/groups/672427923442117/permalink/2034636730554556/"
    },
    {
      "date": "2026-09-15",
      "water": "Lower Rogue (Gold Beach)",
      "note": "A guide said the Rogue Bay was fishing very well for Chinook.",
      "url": "https://www.facebook.com/groups/672427923442117/permalink/2033881120630117/"
    },
    {
      "date": "2026-09-15",
      "water": "Deschutes in and near Bend",
      "note": "Another trout was caught and released.",
      "url": "https://www.tiktok.com/@outdoorguy35/video/7685950768070855950"
    }
  ],
  "read_log": [
    {
      "date": "2026-09-15",
      "facebook_posts": 10,
      "tiktok_videos": 1
    },
    {
      "date": "2026-09-16",
      "facebook_posts": 24,
      "tiktok_videos": 0
    },
    {
      "date": "2026-09-17",
      "facebook_posts": 34,
      "tiktok_videos": 0
    },
    {
      "date": "2026-09-18",
      "facebook_posts": 35,
      "tiktok_videos": 1
    },
    {
      "date": "2026-09-19",
      "facebook_posts": 31,
      "tiktok_videos": 0
    },
    {
      "date": "2026-09-20",
      "facebook_posts": 19,
      "tiktok_videos": 1
    },
    {
      "date": "2026-09-21",
      "facebook_posts": 24,
      "tiktok_videos": 3
    },
    {
      "date": "2026-09-22",
      "facebook_posts": 19,
      "tiktok_videos": 1
    },
    {
      "date": "2026-09-23",
      "facebook_posts": 16,
      "tiktok_videos": 0
    },
    {
      "date": "2026-09-24",
      "facebook_posts": 23,
      "tiktok_videos": 1
    },
    {
      "date": "2026-09-25",
      "facebook_posts": 22,
      "tiktok_videos": 2
    },
    {
      "date": "2026-09-26",
      "facebook_posts": 16,
      "tiktok_videos": 6
    },
    {
      "date": "2026-09-27",
      "facebook_posts": 28,
      "tiktok_videos": 2
    },
    {
      "date": "2026-09-28",
      "facebook_posts": 20,
      "tiktok_videos": 1
    },
    {
      "date": "2026-09-29",
      "facebook_posts": 14,
      "tiktok_videos": 1
    },
    {
      "date": "2026-09-30",
      "facebook_posts": 21,
      "tiktok_videos": 2
    },
    {
      "date": "2026-10-01",
      "facebook_posts": 16,
      "tiktok_videos": 3
    },
    {
      "date": "2026-10-02",
      "facebook_posts": 15,
      "tiktok_videos": 2
    },
    {
      "date": "2026-10-03",
      "facebook_posts": 12,
      "tiktok_videos": 2
    },
    {
      "date": "2026-10-04",
      "facebook_posts": 22,
      "tiktok_videos": 0
    },
    {
      "date": "2026-10-05",
      "facebook_posts": 11,
      "tiktok_videos": 0
    },
    {
      "date": "2026-10-06",
      "facebook_posts": 15,
      "tiktok_videos": 1
    },
    {
      "date": "2026-10-07",
      "facebook_posts": 21,
      "tiktok_videos": 1
    },
    {
      "date": "2026-10-08",
      "facebook_posts": 16,
      "tiktok_videos": 4
    },
    {
      "date": "2026-10-09",
      "facebook_posts": 20,
      "tiktok_videos": 0
    },
    {
      "date": "2026-10-10",
      "facebook_posts": 11,
      "tiktok_videos": 1
    },
    {
      "date": "2026-10-11",
      "facebook_posts": 14,
      "tiktok_videos": 1
    },
    {
      "date": "2026-10-12",
      "facebook_posts": 18,
      "tiktok_videos": 5
    },
    {
      "date": "2026-10-13",
      "facebook_posts": 10,
      "tiktok_videos": 3
    },
    {
      "date": "2026-10-14",
      "facebook_posts": 16,
      "tiktok_videos": 3
    },
    {
      "date": "2026-10-15",
      "facebook_posts": 5,
      "tiktok_videos": 0
    }
  ]
};
