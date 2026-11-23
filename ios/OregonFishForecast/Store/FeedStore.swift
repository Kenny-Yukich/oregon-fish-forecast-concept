import Foundation
import Observation

/// Loads the forecast and keeps it current.
///
/// On launch it shows the last forecast it downloaded (or the sample bundled with the app), then fetches
/// data/app.json from oregonfishforecast.com. The website rebuilds that file every morning.
@MainActor
@Observable
final class FeedStore {
    enum Origin {
        /// The copy bundled with the app (SampleFeed.json), used until the first download.
        case bundled
        /// The last download, saved on this device.
        case saved
        /// Downloaded since the app opened.
        case live
    }

    static let feedURL = URL(string: "https://oregonfishforecast.com/data/app.json")!
    /// Coming back to the app refreshes when the forecast is older than this.
    static let staleAfter: TimeInterval = 30 * 60

    private(set) var feed: Feed?
    private(set) var origin: Origin = .bundled
    /// When this device last downloaded the forecast.
    private(set) var downloadedAt: Date?
    private(set) var isRefreshing = false
    /// Why the last refresh failed, cleared by the next one that works.
    private(set) var lastError: String?

    private let savedURL = URL.cachesDirectory.appending(path: "app-feed.json")

    init() {
        loadSavedOrBundled()
    }

    func water(id: String) -> Water? {
        feed?.water(id: id)
    }

    /// Downloads the latest forecast. On failure the forecast on screen stays as it was.
    func refresh() async {
        guard !isRefreshing else { return }
        isRefreshing = true
        defer { isRefreshing = false }
        do {
            let request = URLRequest(url: Self.feedURL, cachePolicy: .reloadRevalidatingCacheData, timeoutInterval: 20)
            let (data, response) = try await URLSession.shared.data(for: request)
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            if status == 404 {
                lastError = "oregonfishforecast.com doesn't have the app's forecast file yet."
                return
            }
            guard status == 200 else { throw URLError(.badServerResponse) }
            let fresh = try Feed.decode(data)
            feed = fresh
            origin = .live
            downloadedAt = Date()
            lastError = nil
            try? data.write(to: savedURL, options: .atomic)
        } catch is DecodingError {
            lastError = "The forecast changed format. Update the app to read it."
        } catch is CancellationError {
            // The screen that asked went away; nothing to report.
        } catch let error as URLError where error.code == .cancelled {
            // Same as above, from URLSession.
        } catch {
            lastError = "Couldn't reach oregonfishforecast.com."
        }
    }

    /// Refreshes when the forecast on screen is older than `staleAfter`.
    func refreshIfStale() async {
        if let downloadedAt, Date().timeIntervalSince(downloadedAt) < Self.staleAfter { return }
        await refresh()
    }

    private func loadSavedOrBundled() {
        if let data = try? Data(contentsOf: savedURL), let saved = try? Feed.decode(data) {
            feed = saved
            origin = .saved
            downloadedAt = (try? FileManager.default.attributesOfItem(atPath: savedURL.path)[.modificationDate]) as? Date
        } else if let url = Bundle.main.url(forResource: "SampleFeed", withExtension: "json"),
                  let data = try? Data(contentsOf: url), let sample = try? Feed.decode(data) {
            feed = sample
            origin = .bundled
        }
    }
}
