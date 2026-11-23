import SwiftUI

// Small pieces used on several screens.

/// A ring that fills to the score, with the number inside. Withheld and unscored waters show a mark instead.
struct ScoreBadge: View {
    let score: Score
    var size: CGFloat = 48

    var body: some View {
        let color = Theme.scoreColor(score.isScored ? score.label : nil)
        let line = max(3, size * 0.09)
        ZStack {
            Circle().stroke(color.opacity(0.2), lineWidth: line)
            if let value = score.value, score.isScored {
                Circle()
                    .trim(from: 0, to: CGFloat(value) / 100)
                    .stroke(color, style: StrokeStyle(lineWidth: line, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                Text(verbatim: "\(value)")
                    .font(.system(size: size * 0.36, weight: .semibold, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(color)
            } else {
                Image(systemName: score.status == "withheld" ? "exclamationmark" : "minus")
                    .font(.system(size: size * 0.3, weight: .bold))
                    .foregroundStyle(.secondary)
            }
        }
        .frame(width: size, height: size)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(score.spokenSummary)
    }
}

extension Score {
    /// What VoiceOver reads for a score badge.
    var spokenSummary: String {
        if isScored, let value, let label { return "Score \(value) out of 100, \(label)" }
        return status == "withheld" ? "Score withheld" : "Not scored yet"
    }
}

/// One water in a list: name and reach, the reason to go, any warning, and the score.
struct WaterRow: View {
    let water: Water
    @Environment(Favorites.self) private var favorites

    var body: some View {
        HStack(alignment: .center, spacing: 14) {
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(water.name)
                        .font(.headline)
                        .fontDesign(.serif)
                    if favorites.contains(water.id) {
                        Image(systemName: "star.fill")
                            .font(.caption2)
                            .foregroundStyle(Theme.sun)
                            .accessibilityLabel("Saved")
                    }
                }
                Text(water.reach)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                if let why = water.score.why {
                    Text(why)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
                if let note = water.score.shortNote {
                    Label(note, systemImage: "exclamationmark.triangle.fill")
                        .font(.caption)
                        .foregroundStyle(Theme.alert)
                        .lineLimit(2)
                }
            }
            Spacer(minLength: 8)
            VStack(spacing: 4) {
                ScoreBadge(score: water.score, size: 46)
                Text(water.score.statusTitle)
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(water.score.isScored ? Theme.scoreColor(water.score.label) : .secondary)
            }
            .frame(minWidth: 64)
        }
        .padding(.vertical, 4)
        .accessibilityElement(children: .combine)
    }
}

/// "Directions" with a choice of Apple Maps or Google Maps, to a documented access point.
struct DirectionsMenu: View {
    let query: String

    var body: some View {
        Menu {
            if let url = MapLinks.appleMaps(query) {
                Link(destination: url) { Label("Apple Maps", systemImage: "map") }
            }
            if let url = MapLinks.googleMaps(query) {
                Link(destination: url) { Label("Google Maps", systemImage: "globe") }
            }
        } label: {
            Label("Directions", systemImage: "car.fill")
        }
    }
}

/// A link that opens in Safari, labeled as leaving the app.
struct WebLink: View {
    let title: String
    let url: String?

    init(_ title: String, url: String?) {
        self.title = title
        self.url = url
    }

    var body: some View {
        if let url, let destination = URL(string: url) {
            Link(destination: destination) {
                Label(title, systemImage: "arrow.up.right.square")
            }
        }
    }
}

/// How fresh the forecast on screen is, and whether the last refresh worked.
struct FeedStatus: View {
    @Environment(FeedStore.self) private var store

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            if let feed = store.feed, let built = FeedFormat.instant(feed.generatedAt) {
                Text("Forecast built \(FeedFormat.dayAndTime(built)) Pacific")
            }
            switch store.origin {
            case .bundled:
                Text("Showing the sample forecast that came with the app. Pull down to get today's.")
            case .saved:
                if let at = store.downloadedAt {
                    Text("Downloaded \(FeedFormat.dayAndTime(at)).")
                }
            case .live:
                EmptyView()
            }
            if let error = store.lastError {
                Label(error, systemImage: "wifi.exclamationmark")
                    .foregroundStyle(Theme.alert)
            }
        }
        .font(.footnote)
        .foregroundStyle(.secondary)
    }
}

/// Lets a screen push a water's page.
extension View {
    func waterDestination() -> some View {
        navigationDestination(for: Water.self) { WaterDetailView(water: $0) }
    }
}
