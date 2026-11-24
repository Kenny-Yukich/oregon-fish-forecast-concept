/* Angler posts: word of mouth from public social media. Written by scripts/fetch-angler.mjs; edit that script, not this file.
   Posts from public Facebook groups and TikTok are collected with Apify and read by Claude every week.
   - Summaries are short and general. No names, handles or photos.
   - `where` says when a post was on another section of the river or did not say where on the river it was.
   - `scoring: true` only for a catch or guide report on this water, with the section unstated or on this reach.
     Angler posts can only raise a score, never lower it (see assets/member-preview.js), and only for 14 days.
   - Posts stay for 30 days. `elsewhere` lists waters anglers talked about that are not in the guide yet.
   - `read_log` counts the posts read, by the day they were posted; `reviewed` is the total for the last 30 days. */
window.ORFF_ANGLER = {
  "checked_on": "2026-11-23",
  "window_start": "2026-10-24",
  "reviewed": {
    "facebook_posts": 358,
    "tiktok_videos": 29
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
    "detroit-lake-mongold": [
      {
        "date": "2026-11-23",
        "platform": "Facebook",
        "kind": "catch",
        "where": "Detroit Lake, area not stated",
        "note": "Final trip before the drawdown produced 20 kokanee and a released 21-inch Chinook on a cold, gray day; fishing strong all month.",
        "signal": "positive",
        "scoring": true,
        "url": "https://www.facebook.com/groups/474041098053000/permalink/1422273929896374/"
      },
      {
        "date": "2026-11-01",
        "platform": "Facebook",
        "kind": "catch",
        "where": "",
        "note": "Two anglers trolled up a 20-kokanee limit, surface to 66 feet at 1.2-1.3 mph; the bite improved as fog lifted.",
        "signal": "positive",
        "scoring": true,
        "url": "https://www.facebook.com/groups/474041098053000/permalink/1400851952038572/"
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
      }
    ],
    "diamond-lake": [
      {
        "date": "2026-11-11",
        "platform": "Facebook",
        "kind": "catch",
        "where": "Diamond Lake, area not stated",
        "note": "Four days of fishing produced big tiger and brown trout released, plus plenty of rainbow trout through October and November.",
        "signal": "positive",
        "scoring": true,
        "url": "https://www.facebook.com/groups/1552453421736697/permalink/4443300239318653/"
      }
    ],
    "columbia-river-chinook-landing": [
      {
        "date": "2026-11-13",
        "platform": "Facebook",
        "kind": "catch",
        "where": "Astoria estuary, far downstream of this reach",
        "note": "A coho was landed near Astoria a few weeks earlier trolling a glow flasher setup.",
        "signal": "positive",
        "scoring": false,
        "url": "https://www.facebook.com/groups/474041098053000/permalink/1412931120830655/"
      },
      {
        "date": "2026-11-11",
        "platform": "Facebook",
        "kind": "catch",
        "where": "Buoy 10, far downstream of this reach",
        "note": "Angler's last salmon of the season came at Buoy 10 about two weeks earlier on a spinner and flasher rig.",
        "signal": "positive",
        "scoring": false,
        "url": "https://www.facebook.com/groups/474041098053000/permalink/1410702404386860/"
      },
      {
        "date": "2026-11-11",
        "platform": "Facebook",
        "kind": "catch",
        "where": "Buoy 10, far downstream of this reach",
        "note": "Angler's last salmon of the season came at Buoy 10 about two weeks earlier on a spinner and flasher rig.",
        "signal": "positive",
        "scoring": false,
        "url": "https://www.facebook.com/groups/474041098053000/permalink/1410702204386880/"
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
        "date": "2026-11-07",
        "platform": "TikTok",
        "kind": "catch",
        "where": "Deschutes, section not stated (tagged near Metolius)",
        "note": "November outing on the Deschutes produced some big fish, according to the angler's video.",
        "signal": "positive",
        "scoring": true,
        "url": "https://www.tiktok.com/@kennyyukich/video/7705560605050064159"
      },
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
    ],
    "crooked-river-opal-springs": [
      {
        "date": "2026-11-21",
        "platform": "TikTok",
        "kind": "mention",
        "where": "Crooked River Ranch area, exact section not stated",
        "note": "Angler fly fished the Crooked River near Crooked River Ranch and called it a great spot.",
        "signal": "positive",
        "scoring": false,
        "url": "https://www.tiktok.com/@kennyyukich/video/7710835770822626591"
      }
    ]
  },
  "elsewhere": [
    {
      "water": "Columbia estuary (Astoria, Buoy 10)",
      "note": "A coho was landed near Astoria a few weeks earlier trolling a glow flasher setup.",
      "posts": 3,
      "latest": "2026-11-13"
    },
    {
      "water": "Howard Prairie Lake",
      "note": "A rainbow trout just over 24 inches was caught on November 11.",
      "posts": 1,
      "latest": "2026-11-12"
    },
    {
      "water": "Fourmile Lake (Klamath Falls)",
      "note": "An angler shared a nice fish caught at the lake near Klamath Falls.",
      "posts": 1,
      "latest": "2026-11-12"
    },
    {
      "water": "Deschutes in and near Bend",
      "note": "Angler caught and released a brightly colored trout on the fly during fall fishing.",
      "posts": 1,
      "latest": "2026-11-01"
    }
  ],
  "elsewhere_posts": [
    {
      "date": "2026-11-13",
      "state": "OR",
      "water": "Columbia estuary (Astoria, Buoy 10)",
      "note": "A coho was landed near Astoria a few weeks earlier trolling a glow flasher setup.",
      "url": "https://www.facebook.com/groups/474041098053000/permalink/1412931120830655/"
    },
    {
      "date": "2026-11-12",
      "state": "OR",
      "water": "Howard Prairie Lake",
      "note": "A rainbow trout just over 24 inches was caught on November 11.",
      "url": "https://www.facebook.com/groups/1552453421736697/permalink/4445035759145101/"
    },
    {
      "date": "2026-11-12",
      "state": "OR",
      "water": "Fourmile Lake (Klamath Falls)",
      "note": "An angler shared a nice fish caught at the lake near Klamath Falls.",
      "url": "https://www.facebook.com/groups/1552453421736697/permalink/4444944035820940/"
    },
    {
      "date": "2026-11-11",
      "state": "OR",
      "water": "Columbia estuary (Astoria, Buoy 10)",
      "note": "Angler's last salmon of the season came at Buoy 10 about two weeks earlier on a spinner and flasher rig.",
      "url": "https://www.facebook.com/groups/474041098053000/permalink/1410702404386860/"
    },
    {
      "date": "2026-11-11",
      "state": "OR",
      "water": "Columbia estuary (Astoria, Buoy 10)",
      "note": "Angler's last salmon of the season came at Buoy 10 about two weeks earlier on a spinner and flasher rig.",
      "url": "https://www.facebook.com/groups/474041098053000/permalink/1410702204386880/"
    },
    {
      "date": "2026-11-01",
      "water": "Deschutes in and near Bend",
      "note": "Angler caught and released a brightly colored trout on the fly during fall fishing.",
      "url": "https://www.tiktok.com/@outdoorguy35/video/7703260227830828302",
      "state": "OR"
    }
  ],
  "read_log": [
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
      "facebook_posts": 9,
      "tiktok_videos": 0
    },
    {
      "date": "2026-11-06",
      "facebook_posts": 12,
      "tiktok_videos": 1
    },
    {
      "date": "2026-11-07",
      "facebook_posts": 15,
      "tiktok_videos": 1
    },
    {
      "date": "2026-11-08",
      "facebook_posts": 12,
      "tiktok_videos": 3
    },
    {
      "date": "2026-11-09",
      "facebook_posts": 19,
      "tiktok_videos": 1
    },
    {
      "date": "2026-11-10",
      "facebook_posts": 13,
      "tiktok_videos": 0
    },
    {
      "date": "2026-11-11",
      "facebook_posts": 11,
      "tiktok_videos": 2
    },
    {
      "date": "2026-11-12",
      "facebook_posts": 11,
      "tiktok_videos": 1
    },
    {
      "date": "2026-11-13",
      "facebook_posts": 8,
      "tiktok_videos": 2
    },
    {
      "date": "2026-11-14",
      "facebook_posts": 5,
      "tiktok_videos": 1
    },
    {
      "date": "2026-11-15",
      "facebook_posts": 8,
      "tiktok_videos": 1
    },
    {
      "date": "2026-11-16",
      "facebook_posts": 9,
      "tiktok_videos": 1
    },
    {
      "date": "2026-11-17",
      "facebook_posts": 10,
      "tiktok_videos": 3
    },
    {
      "date": "2026-11-18",
      "facebook_posts": 19,
      "tiktok_videos": 1
    },
    {
      "date": "2026-11-19",
      "facebook_posts": 7,
      "tiktok_videos": 0
    },
    {
      "date": "2026-11-20",
      "facebook_posts": 8,
      "tiktok_videos": 0
    },
    {
      "date": "2026-11-21",
      "facebook_posts": 14,
      "tiktok_videos": 2
    },
    {
      "date": "2026-11-22",
      "facebook_posts": 12,
      "tiktok_videos": 0
    },
    {
      "date": "2026-11-23",
      "facebook_posts": 11,
      "tiktok_videos": 1
    }
  ]
};
