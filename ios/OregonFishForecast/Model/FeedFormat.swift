import Foundation

// Dates, numbers, sorting and links shared by the screens. Foundation only, so ios/FeedCheck can test it on Linux.

enum FeedFormat {
    static let oregon = TimeZone(identifier: "America/Los_Angeles") ?? .current
    private static let utc = TimeZone(identifier: "UTC") ?? .current

    // MARK: Calendar days ("2026-10-05")

    /// A "yyyy-MM-dd" day as a date at noon UTC, so it shows as the same calendar day everywhere.
    static func day(_ iso: String) -> Date? {
        let parts = iso.prefix(10).split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = utc
        return calendar.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2], hour: 12))
    }

    /// Today's date in Oregon, "yyyy-MM-dd". Report ages count from here, as on the website.
    static func todayInOregon(_ now: Date = Date()) -> String {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = oregon
        let c = calendar.dateComponents([.year, .month, .day], from: now)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    /// Whole days from one "yyyy-MM-dd" day to another.
    static func days(from: String, to: String) -> Int? {
        guard let a = day(from), let b = day(to) else { return nil }
        return Int((b.timeIntervalSince(a) / 86_400).rounded())
    }

    /// Days since a "yyyy-MM-dd" day, counted from today in Oregon.
    static func age(of iso: String, now: Date = Date()) -> Int? {
        days(from: iso, to: todayInOregon(now))
    }

    /// "Oct 5".
    static func shortDay(_ iso: String) -> String {
        guard let date = day(iso) else { return iso }
        let f = DateFormatter()
        f.timeZone = utc
        f.setLocalizedDateFormatFromTemplate("MMMd")
        return f.string(from: date)
    }

    /// "today", "yesterday", "12 days ago".
    static func ageText(_ days: Int) -> String {
        switch days {
        case ..<0: return "in \(-days) days"
        case 0: return "today"
        case 1: return "yesterday"
        default: return "\(days) days ago"
        }
    }

    // MARK: Moments ("2026-11-22T19:30:00+00:00")

    /// An ISO 8601 timestamp, with or without fractional seconds.
    static func instant(_ iso: String) -> Date? {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = f.date(from: iso) { return date }
        f.formatOptions = [.withInternetDateTime]
        return f.date(from: iso)
    }

    /// "just now", "40 minutes ago", "3 hours ago", "2 days ago".
    static func relative(_ iso: String, now: Date = Date()) -> String? {
        guard let date = instant(iso) else { return nil }
        let minutes = Int(now.timeIntervalSince(date) / 60)
        switch minutes {
        case ..<2: return "just now"
        case ..<60: return "\(minutes) minutes ago"
        case ..<120: return "an hour ago"
        case ..<(48 * 60): return "\(minutes / 60) hours ago"
        default: return "\(minutes / (24 * 60)) days ago"
        }
    }

    /// "Mon, Nov 23, 6:43 AM", in Oregon time.
    static func dayAndTime(_ date: Date) -> String {
        let f = DateFormatter()
        f.timeZone = oregon
        f.setLocalizedDateFormatFromTemplate("EEEMMMdjmm")
        return f.string(from: date)
    }

    // MARK: Numbers

    /// "3,920".
    static func number(_ n: Int) -> String {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        return f.string(from: NSNumber(value: n)) ?? String(n)
    }

    /// "92%".
    static func percent(_ fraction: Double) -> String {
        "\(Int((fraction * 100).rounded()))%"
    }

    /// "51.6°F".
    static func fahrenheit(_ value: Double) -> String {
        String(format: "%.1f°F", value)
    }

    /// "+1.2 ft", "-0.4 ft".
    static func feetChange(_ value: Double) -> String {
        String(format: "%+.1f ft", value)
    }
}

// MARK: - Sorting and searching waters

extension Water {
    /// Days since the latest dated report, or nil when there is none.
    func reportAge(now: Date = Date()) -> Int? {
        report?.reportedOn.flatMap { FeedFormat.age(of: $0, now: now) }
    }

    /// Whether a search matches the water's name, reach, region or species.
    func matches(_ query: String) -> Bool {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
        if q.isEmpty { return true }
        let haystack = ([name, reach, region, kindLabel] + species).joined(separator: " ")
        return q.split(separator: " ").allSatisfy { haystack.range(of: $0, options: [.caseInsensitive, .diacriticInsensitive]) != nil }
    }
}

extension Array where Element == Water {
    /// Best score first; on a tie, the fresher report first; waters without a score last, by name.
    func sortedByScore(now: Date = Date()) -> [Water] {
        sorted { a, b in
            switch (a.score.isScored, b.score.isScored) {
            case (true, false): return true
            case (false, true): return false
            case (false, false): return a.name < b.name
            case (true, true):
                if a.score.value != b.score.value { return (a.score.value ?? 0) > (b.score.value ?? 0) }
                return (a.reportAge(now: now) ?? .max) < (b.reportAge(now: now) ?? .max)
            }
        }
    }
}

extension Feed {
    /// The website's short list: the five best scores today.
    func bestWaters(now: Date = Date()) -> [Water] {
        Array(waters.filter { $0.score.isScored }.sortedByScore(now: now).prefix(5))
    }

    /// Regions in the order they first appear in the guide.
    var regions: [String] {
        var seen: [String] = []
        for w in waters where !seen.contains(w.region) { seen.append(w.region) }
        return seen
    }
}

// MARK: - Links

enum MapLinks {
    // Characters that must be escaped inside a query value, beyond the ones URLs never allow.
    private static let allowed = CharacterSet.urlQueryAllowed.subtracting(CharacterSet(charactersIn: "&=+?#"))

    private static func encode(_ text: String) -> String {
        text.addingPercentEncoding(withAllowedCharacters: allowed) ?? text
    }

    /// Driving directions in Apple Maps to a documented access point.
    static func appleMaps(_ query: String) -> URL? {
        URL(string: "https://maps.apple.com/?daddr=" + encode(query) + "&dirflg=d")
    }

    /// Driving directions in Google Maps (opens the app when it is installed).
    static func googleMaps(_ query: String) -> URL? {
        URL(string: "https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=" + encode(query))
    }
}
