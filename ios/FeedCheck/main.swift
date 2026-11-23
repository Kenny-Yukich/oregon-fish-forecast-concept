import Foundation

// Reads data/app.json with the app's own model code (ios/OregonFishForecast/Model), the way the app will,
// and checks what the screens rely on. Runs on Linux, so CI can catch a feed the app could not read:
//
//   swiftc ios/OregonFishForecast/Model/*.swift ios/FeedCheck/main.swift -o feedcheck && ./feedcheck data/app.json

let path = CommandLine.arguments.dropFirst().first ?? "data/app.json"
var problems: [String] = []
func expect(_ ok: Bool, _ message: @autoclosure () -> String) {
    if !ok { problems.append(message()) }
}

// Says which field broke, in words, instead of Swift's nested error dump.
func describe(_ error: Error) -> String {
    func at(_ path: [CodingKey]) -> String {
        path.map { $0.intValue.map { "[\($0)]" } ?? "." + $0.stringValue }.joined()
    }
    switch error {
    case DecodingError.keyNotFound(let key, let c): return "missing \(at(c.codingPath + [key]))"
    case DecodingError.typeMismatch(let type, let c): return "\(at(c.codingPath)) is not a \(type)"
    case DecodingError.valueNotFound(let type, let c): return "\(at(c.codingPath)) is null, expected \(type)"
    case DecodingError.dataCorrupted(let c): return "\(at(c.codingPath)): \(c.debugDescription)"
    default: return error.localizedDescription
    }
}

let feed: Feed
do {
    feed = try Feed.decode(try Data(contentsOf: URL(fileURLWithPath: path)))
} catch {
    print("The app could not read \(path): \(describe(error))")
    exit(1)
}

expect(feed.version == Feed.supportedVersion, "feed version \(feed.version), the app reads version \(Feed.supportedVersion)")
expect(!feed.waters.isEmpty, "no waters")
expect(FeedFormat.instant(feed.generatedAt) != nil, "generated_at is not a timestamp: \(feed.generatedAt)")
expect(FeedFormat.day(feed.today) != nil, "today is not a day: \(feed.today)")
expect(Set(feed.waters.map(\.id)).count == feed.waters.count, "two waters share an id")

for w in feed.waters {
    let at = w.id
    expect(w.position != nil, "\(at): no map position")
    if w.score.isScored {
        expect(w.score.label == Score.label(for: w.score.value ?? -1), "\(at): label \(w.score.label ?? "none") does not match value \(w.score.value ?? -1)")
        expect(!(w.score.factors ?? []).isEmpty, "\(at): scored with no inputs")
    } else {
        expect(w.score.reason != nil, "\(at): no score and no reason")
    }
    if let day = w.report?.reportedOn { expect(FeedFormat.day(day) != nil, "\(at): report date \(day)") }
    if let flow = w.gauge?.flow { expect(FeedFormat.instant(flow.time) != nil, "\(at): flow time \(flow.time)") }
    if let t = w.gauge?.waterTempTime { expect(FeedFormat.instant(t) != nil, "\(at): temperature time \(t)") }
    if let weather = w.weather { expect(FeedFormat.instant(weather.readAt) != nil, "\(at): weather time \(weather.readAt)") }
    for p in w.access.points {
        expect(MapLinks.appleMaps(p.mapQuery) != nil && MapLinks.googleMaps(p.mapQuery) != nil, "\(at): no directions link for \(p.mapQuery)")
    }
    for link in w.counts { expect(feed.countStation(code: link.station) != nil, "\(at): unknown count station \(link.station)") }
    for s in w.sources { expect(URL(string: s.url) != nil, "\(at): bad source link \(s.url)") }
    expect(URL(string: w.url) != nil, "\(at): bad page link")
}
for week in feed.stocking.weeks {
    expect(FeedFormat.day(week.weekStart) != nil, "stocking week \(week.weekStart)")
    for row in week.rows {
        if let id = row.waterId { expect(feed.water(id: id) != nil, "stocking row \(row.waterbody) points at unknown water \(id)") }
    }
}

// The date and link helpers the screens use.
expect(FeedFormat.days(from: "2026-10-05", to: "2026-11-23") == 49, "days between dates")
expect(FeedFormat.days(from: "2026-03-07", to: "2026-03-09") == 2, "days across the spring clock change")
expect(FeedFormat.todayInOregon(FeedFormat.instant("2026-11-24T07:59:00Z")!) == "2026-11-23", "Oregon date before midnight Pacific")
expect(FeedFormat.todayInOregon(FeedFormat.instant("2026-11-24T08:01:00Z")!) == "2026-11-24", "Oregon date after midnight Pacific")
expect(FeedFormat.instant("2026-11-22T20:29:35.890Z") != nil, "timestamp with fractional seconds")
expect(MapLinks.appleMaps("Fish & Game Lot #2")?.absoluteString == "https://maps.apple.com/?daddr=Fish%20%26%20Game%20Lot%20%232&dirflg=d", "Apple Maps link escapes & and #")
expect(FeedFormat.count(1, "water", "waters") == "1 water" && FeedFormat.count(1500, "water", "waters") == "1,500 waters", "counted nouns")
expect(Score.label(for: 80) == "Excellent" && Score.label(for: 79) == "Good" && Score.label(for: 45) == "Fair" && Score.label(for: 44) == "Slow", "score labels")

let now = FeedFormat.instant(feed.generatedAt) ?? Date()
let best = feed.bestWaters(now: now)
let scored = feed.waters.filter { $0.score.isScored }.count
print("Read \(feed.waters.count) waters (\(scored) scored), \(feed.countStations.count) count sites and \(feed.stocking.weeks.count) stocking weeks, built \(feed.generatedAt).")
print("This week's best waters:")
for w in best {
    print("  \(w.score.value ?? 0) \(w.score.label ?? "") · \(w.name), \(w.reach) · \(w.score.why ?? "")")
}
if let report = feed.waters.first(where: { $0.report?.reportedOn != nil })?.report, let day = report.reportedOn {
    print("Sample dates: \(FeedFormat.shortDay(day)), \(FeedFormat.ageText(FeedFormat.age(of: day, now: now) ?? 0)), built \(FeedFormat.dayAndTime(now)), \(FeedFormat.number(583930)) fish.")
}

if problems.isEmpty {
    print("Feed check passed.")
} else {
    print("Feed check found \(problems.count) problem(s):")
    problems.forEach { print("  - \($0)") }
    exit(1)
}
