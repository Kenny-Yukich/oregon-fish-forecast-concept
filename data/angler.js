/* Angler posts: word of mouth from public social media. Written by scripts/fetch-angler.mjs; edit that script, not this file.
   Posts from public Facebook groups and TikTok are collected with Apify and read by Claude every week.
   - Summaries are short and general. No names, handles or photos.
   - `where` says when a post was on another section of the river or did not say where on the river it was.
   - `scoring: true` only for a catch or guide report on this water, with the section unstated or on this reach.
     Angler posts can only raise a score, never lower it (see assets/member-preview.js), and only for 14 days.
   - Posts stay for 30 days. `elsewhere` lists waters anglers talked about that are not in the guide yet.
   - `read_log` counts the posts read, by the day they were posted; `reviewed` is the total for the last 30 days. */
window.ORFF_ANGLER = {
  "checked_on": "2026-11-05",
  "window_start": "2026-10-06",
  "reviewed": {
    "facebook_posts": 420,
    "tiktok_videos": 32
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
    "rogue-river-touvelle": [
      {
        "date": "2026-10-23",
        "platform": "Facebook",
        "kind": "catch",
        "where": "Rogue, section not stated",
        "note": "Angler landed a personal-best fish just over 40 inches on the Rogue, apparently a wild late-run fish.",
        "signal": "positive",
        "scoring": true,
        "url": "https://www.facebook.com/groups/672427923442117/permalink/2067777697240459/"
      },
      {
        "date": "2026-10-19",
        "platform": "Facebook",
        "kind": "guide",
        "where": "Lower Rogue at Gold Beach, well below this reach",
        "note": "Guide boat had a big salmon day near Gold Beach, with fish still moving through on the southern coast.",
        "signal": "positive",
        "scoring": false,
        "url": "https://www.facebook.com/groups/672427923442117/permalink/2064288160922746/"
      },
      {
        "date": "2026-10-14",
        "platform": "TikTok",
        "kind": "catch",
        "where": "Rogue, section not stated",
        "note": "An angler posted a fall steelhead from the Rogue.",
        "signal": "positive",
        "scoring": true,
        "url": "https://www.tiktok.com/@trevor.meek05/video/7696686242481638686"
      }
    ],
    "detroit-lake-mongold": [
      {
        "date": "2026-11-01",
        "platform": "Facebook",
        "kind": "catch",
        "where": "",
        "note": "Two anglers trolled up a 20-kokanee limit, surface to 66 feet at 1.2-1.3 mph; the bite improved as fog lifted.",
        "signal": "positive",
        "scoring": true,
        "url": "https://www.facebook.com/groups/474041098053000/permalink/1400851952038572/"
      },
      {
        "date": "2026-10-12",
        "platform": "TikTok",
        "kind": "catch",
        "where": "Tagged at Detroit Lake",
        "note": "A kokanee catch was posted from Detroit Lake.",
        "signal": "positive",
        "scoring": true,
        "url": "https://www.tiktok.com/@cade.140/video/7696009452800986399"
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
      }
    ],
    "willamette-river-cathedral-park": [
      {
        "date": "2026-11-01",
        "platform": "Facebook",
        "kind": "catch",
        "where": "Sellwood, upstream of this reach",
        "note": "Smallmouth bass taken off a dock on drop shots along with many pikeminnow, but the bass bite is slowing.",
        "signal": "mixed",
        "scoring": false,
        "url": "https://www.facebook.com/groups/1552453421736697/permalink/4431617353820275/"
      }
    ],
    "middle-deschutes-culver": [
      {
        "date": "2026-11-01",
        "platform": "TikTok",
        "kind": "catch",
        "where": "Deschutes at Bend, well upstream of this reach",
        "note": "Angler caught and released a brightly colored trout on the fly during fall fishing.",
        "signal": "positive",
        "scoring": false,
        "url": "https://www.tiktok.com/@outdoorguy35/video/7703260227830828302"
      },
      {
        "date": "2026-10-08",
        "platform": "TikTok",
        "kind": "catch",
        "where": "Near Bend, upstream of this reach",
        "note": "A regular fly-fishing poster said a crisp morning produced whitefish.",
        "signal": "positive",
        "scoring": false,
        "url": "https://www.tiktok.com/@outdoorguy35/video/7694373540111387917"
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
      }
    ],
    "odell-lake-princess-creek": [
      {
        "date": "2026-10-30",
        "platform": "Facebook",
        "kind": "mention",
        "where": "Odell Lake, section not stated",
        "note": "Angler shared photos from a recent outing on Odell Lake without details on catch.",
        "signal": "neutral",
        "scoring": false,
        "url": "https://www.facebook.com/groups/1552453421736697/permalink/4429063904075620/"
      }
    ],
    "lake-billy-chinook-crooked-arm": [
      {
        "date": "2026-11-01",
        "platform": "Facebook",
        "kind": "catch",
        "where": "The narrows on Lake Billy Chinook, not clearly the Crooked River arm",
        "note": "Seven kokanee after a few hours at 50 feet on white or white-pink dodgers with white flies or hoochies; calm water.",
        "signal": "positive",
        "scoring": false,
        "url": "https://www.facebook.com/groups/474041098053000/permalink/1400997785357322/"
      },
      {
        "date": "2026-10-30",
        "platform": "Facebook",
        "kind": "conditions",
        "where": "Lake Billy Chinook, arm not stated",
        "note": "Kokanee were jumping everywhere in the evening and the lake surface was glassy calm.",
        "signal": "neutral",
        "scoring": false,
        "url": "https://www.facebook.com/groups/474041098053000/permalink/1399129638877470/"
      }
    ],
    "lower-deschutes-warm-springs-trout-creek": [
      {
        "date": "2026-10-26",
        "platform": "Facebook",
        "kind": "guide",
        "where": "Lower Deschutes, section not stated",
        "note": "An outfitter says trout fishing continues to be good on the Lower Deschutes.",
        "signal": "positive",
        "scoring": true,
        "url": "https://www.facebook.com/groups/474041098053000/permalink/1394962185960882/"
      }
    ]
  },
  "elsewhere": [
    {
      "water": "Chetco estuary (Brookings)",
      "note": "A guide reports putting nice fish in the bag over the last four days in the Chetco estuary.",
      "posts": 5,
      "latest": "2026-10-15"
    },
    {
      "water": "Deschutes in and near Bend",
      "note": "Angler caught and released a brightly colored trout on the fly during fall fishing.",
      "posts": 2,
      "latest": "2026-11-01"
    },
    {
      "water": "Lower Rogue (Gold Beach)",
      "note": "Guide boat had a big salmon day near Gold Beach, with fish still moving through on the southern coast.",
      "posts": 1,
      "latest": "2026-10-19"
    },
    {
      "water": "Alsea and Yaquina",
      "note": "A guide is booking fall Chinook trips, with coho twitching on the Yaquina planned for early November.",
      "posts": 1,
      "latest": "2026-10-14"
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
    }
  ],
  "elsewhere_posts": [
    {
      "date": "2026-11-01",
      "water": "Deschutes in and near Bend",
      "note": "Angler caught and released a brightly colored trout on the fly during fall fishing.",
      "url": "https://www.tiktok.com/@outdoorguy35/video/7703260227830828302"
    },
    {
      "date": "2026-10-19",
      "water": "Lower Rogue (Gold Beach)",
      "note": "Guide boat had a big salmon day near Gold Beach, with fish still moving through on the southern coast.",
      "url": "https://www.facebook.com/groups/672427923442117/permalink/2064288160922746/"
    },
    {
      "date": "2026-10-15",
      "water": "Chetco estuary (Brookings)",
      "note": "A guide reports putting nice fish in the bag over the last four days in the Chetco estuary.",
      "url": "https://www.facebook.com/groups/672427923442117/permalink/2060805951270967/"
    },
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
    }
  ],
  "read_log": [
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
      "facebook_posts": 16,
      "tiktok_videos": 1
    },
    {
      "date": "2026-10-16",
      "facebook_posts": 11,
      "tiktok_videos": 0
    },
    {
      "date": "2026-10-17",
      "facebook_posts": 18,
      "tiktok_videos": 0
    },
    {
      "date": "2026-10-18",
      "facebook_posts": 13,
      "tiktok_videos": 0
    },
    {
      "date": "2026-10-19",
      "facebook_posts": 13,
      "tiktok_videos": 0
    },
    {
      "date": "2026-10-20",
      "facebook_posts": 15,
      "tiktok_videos": 2
    },
    {
      "date": "2026-10-21",
      "facebook_posts": 17,
      "tiktok_videos": 1
    },
    {
      "date": "2026-10-22",
      "facebook_posts": 12,
      "tiktok_videos": 1
    },
    {
      "date": "2026-10-23",
      "facebook_posts": 15,
      "tiktok_videos": 0
    },
    {
      "date": "2026-10-24",
      "facebook_posts": 18,
      "tiktok_videos": 0
    },
    {
      "date": "2026-10-25",
      "facebook_posts": 8,
      "tiktok_videos": 1
    },
    {
      "date": "2026-10-26",
      "facebook_posts": 9,
      "tiktok_videos": 0
    },
    {
      "date": "2026-10-27",
      "facebook_posts": 12,
      "tiktok_videos": 0
    },
    {
      "date": "2026-10-28",
      "facebook_posts": 16,
      "tiktok_videos": 0
    },
    {
      "date": "2026-10-29",
      "facebook_posts": 16,
      "tiktok_videos": 3
    },
    {
      "date": "2026-10-30",
      "facebook_posts": 14,
      "tiktok_videos": 0
    },
    {
      "date": "2026-10-31",
      "facebook_posts": 11,
      "tiktok_videos": 2
    },
    {
      "date": "2026-11-01",
      "facebook_posts": 11,
      "tiktok_videos": 1
    },
    {
      "date": "2026-11-02",
      "facebook_posts": 13,
      "tiktok_videos": 0
    },
    {
      "date": "2026-11-03",
      "facebook_posts": 6,
      "tiktok_videos": 0
    },
    {
      "date": "2026-11-04",
      "facebook_posts": 11,
      "tiktok_videos": 1
    },
    {
      "date": "2026-11-05",
      "facebook_posts": 4,
      "tiktok_videos": 0
    }
  ]
};
