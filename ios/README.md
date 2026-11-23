# Oregon Fish Forecast for iPhone

A native SwiftUI app for the guide waters on oregonfishforecast.com. It shows the same scores as the website, because it never computes a score itself: it reads one file, `data/app.json`, that the website's daily data job builds with the site's own score formula.

## What's in the app

Five tabs:

- **Forecast:** the river artwork, your saved waters, this week's five best waters (the website's short list), any National Weather Service alerts on a guide water, and how many waters ODFW is stocking this week.
- **Waters:** all 28 guide waters. Search by water, region or species; show rivers or lakes; sort by best score, name or region. Swipe a row to save it.
- **Map:** every water as a pin colored by today's score. Tap a pin for its card, then open the water. Switches between map and satellite, and shows where you are if you allow it.
- **Counts:** Bonneville, The Dalles and Willamette Falls fish counts: last 7 days, this year, and this year against last year. Sites without daily numbers link to ODFW.
- **Stocking:** ODFW's planned trout stockings from last week through five weeks out, searchable. Guide waters open their page.

Each water's page has the score with every input behind it, a **Before you go** list (ODFW rule changes, notices, irrigation switches), river or lake conditions with the NOAA forecast, weather, the latest report, stocking, fish counts, angler posts, access points with directions in Apple Maps or Google Maps, season and methods, and sources.

Eddy, the AI assistant, is not in this first version. See [Before the App Store](#before-the-app-store).

## Your first day with the Mac

1. **Install Xcode** from the Mac App Store (search "Xcode", free). It is a large download, so start it first. Open it once and let it install the iOS components it offers.
2. **Get this code.** In Xcode choose **Integrate > Clone...** (or **Clone Git Repository** on the welcome window), paste `https://github.com/kenny-yukich/oregon-fish-forecast-concept`, and sign in to GitHub when asked. Once this work is merged into `main`, the default branch has everything. Until then, pick the branch `claude/trusting-archimedes-7lhg0q` when Xcode asks.
3. **Open** `ios/OregonFishForecast.xcodeproj` (double-click it in Finder, or **File > Open** in Xcode).
4. **Run it in the Simulator.** At the top of the Xcode window, pick any recent iPhone from the device menu, then press **Command-R** or the Play button. The first build takes a minute.
5. **Run it on your own iPhone.**
   - Connect the iPhone with a cable and tap **Trust** on the phone.
   - On the iPhone: **Settings > Privacy & Security > Developer Mode**, turn it on and let the phone restart.
   - In Xcode, click the blue project icon at the top of the left sidebar, choose the **OregonFishForecast** target, then **Signing & Capabilities**. Under **Team**, choose **Add an Account...**, sign in with your Apple ID, and pick your name ("Personal Team").
   - If Xcode says the bundle identifier is taken, change `com.oregonfishforecast.app` to something like `com.yourname.oregonfishforecast`.
   - Pick your iPhone in the device menu and press **Command-R**. The first time, the phone may ask you to trust the developer under **Settings > General > VPN & Device Management**.
   - With a free Personal Team the app stops opening after 7 days; run it from Xcode again to renew it. A paid developer account removes that limit.

If the first build shows an error, copy the red message from Xcode's Issue navigator (the triangle icon in the left sidebar) and paste it to Claude. The data code was compiled and tested against the real feed before you got it, but the screens could only be checked by reading them, since Xcode only runs on a Mac.

**Claude Code on the Mac** can build the app and run it in the Simulator for you (`xcodebuild`), which the cloud session that wrote this could not. Install it and run `claude` inside this folder.

## Where things are

| Path | What it is |
| --- | --- |
| `OregonFishForecast/OregonFishForecastApp.swift` | Where the app starts. |
| `OregonFishForecast/Model/Feed.swift` | The shape of `data/app.json`, one Swift type per part of the file. |
| `OregonFishForecast/Model/FeedFormat.swift` | Dates, numbers, sorting, search and map links. |
| `OregonFishForecast/Store/FeedStore.swift` | Downloads the forecast, keeps the last copy on the phone, refreshes when you come back to the app. |
| `OregonFishForecast/Store/Favorites.swift` | Saved waters, kept on the phone. |
| `OregonFishForecast/Views/` | One file per screen, plus `Components.swift` (score ring, list row, links) and `Theme.swift` (colors). |
| `OregonFishForecast/Assets.xcassets` | App icon, the accent color, and the two pieces of brand artwork. |
| `OregonFishForecast/SampleFeed.json` | A copy of `data/app.json` bundled with the app, shown until the first download and in Xcode previews. |
| `FeedCheck/main.swift` | A test that reads `data/app.json` with the app's model code. CI runs it on Linux. |

The project uses Xcode's folder syncing: any file you add inside `OregonFishForecast/` is part of the app automatically.

## How the data gets to the phone

1. Every morning (about 6:41 am Pacific) the **Daily data** workflow fetches counts, stocking, gauges, weather and reports, then runs `node scripts/build-app-feed.mjs`. That script loads the same data files and score formula (`assets/member-preview.js`) the website loads and writes `data/app.json`: every water with its score, inputs, notes, conditions, weather, stocking, counts, angler posts and access, plus the statewide counts and stocking weeks. About 140 KB.
2. The file is committed with the rest of the day's data, so it is published at **https://oregonfishforecast.com/data/app.json**.
3. The app downloads it on launch, on pull-to-refresh, and when you return after 30 minutes. If the download fails, it keeps showing the last copy and says so.

The app's first live download needs this work merged into `main`, so that the site publishes `data/app.json`. Until then the app shows the bundled sample and says the site doesn't have the file yet.

**Changing the feed:** `scripts/build-app-feed.mjs` writes it and `Model/Feed.swift` reads it. Change both together. A field the app reads but the feed lacks stops the app from reading the feed, so the **iPhone app feed** workflow builds the feed and reads it with the app's model code on every pull request that touches either side. To run the same check yourself on the Mac:

```bash
node scripts/build-app-feed.mjs --check
```

```bash
swiftc ios/OregonFishForecast/Model/*.swift ios/FeedCheck/main.swift -o /tmp/feedcheck && /tmp/feedcheck data/app.json
```

Adding a field is safe for apps already on phones (they ignore fields they don't know). Removing or renaming one is not: older versions of the app on people's phones would stop updating. Keep old fields until everyone has updated, or raise `FEED_VERSION` and publish the new format under a new file name.

## Before the App Store

- **Apple Developer Program** ($99 a year, developer.apple.com/programs) is needed for TestFlight and the App Store. Enrollment can take a day or two, so it is worth starting early. Enrolling as an individual lists your name as the seller; enrolling as a business needs a D-U-N-S number and lists the business.
- **App Store Connect** needs a privacy policy URL (a short page on oregonfishforecast.com works). The app collects no data: saved waters stay on the phone, and your location is used only to show the blue dot on the map. That makes the privacy label "Data Not Collected".
- **Screenshots:** run the app in the Simulator and press **Command-S** to save one.
- **Eddy:** selling Eddy passes inside an iPhone app falls under Apple's in-app purchase rules (App Review Guideline 3.1), which differ from the website's Stripe checkout and have changed for the US storefront recently. Read the current guideline before adding Eddy to the app.
