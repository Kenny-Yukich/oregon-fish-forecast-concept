import Foundation

// The app's data: one JSON file, data/app.json, rebuilt every morning from the website's own data and score
// formula by scripts/build-app-feed.mjs. The app never computes a score itself, so it always matches the site.
//
// Keys in the file are snake_case ("reported_on"); the decoder turns them into camelCase ("reportedOn").
// This file uses only Foundation, so ios/FeedCheck can compile it on Linux and test it against the real feed.

struct Feed: Decodable {
    /// The feed format this app understands. scripts/build-app-feed.mjs writes the same number.
    static let supportedVersion = 1

    let version: Int
    let generatedAt: String
    let today: String
    let site: String
    let gaugesReadAt: String?
    let anglerCheckedOn: String?
    let mapNote: String?
    let waters: [Water]
    let countStations: [CountStation]
    let stocking: StockingSchedule

    static func decode(_ data: Data) throws -> Feed {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return try decoder.decode(Feed.self, from: data)
    }

    func water(id: String) -> Water? {
        waters.first { $0.id == id }
    }

    func countStation(code: String) -> CountStation? {
        countStations.first { $0.code == code }
    }
}

// MARK: - A guide water

struct Water: Decodable, Identifiable {
    let id: String
    let name: String
    let reach: String
    /// "river", "lake" or "reservoir".
    let kind: String
    let region: String
    /// This water's page on oregonfishforecast.com.
    let url: String
    let species: [String]
    /// When a rule narrows the score to some species (Lower Deschutes trout), the ones still scored.
    let scoreSpecies: [String]?
    /// The fish the score is for, in an angler's words: "trout", "salmon and steelhead".
    let speciesWord: String
    let position: Position?
    let score: Score
    let report: Report?
    /// Notices recorded with the water (advisories, things to check on the day).
    let notices: [Notice]
    /// ODFW in-season rule changes that have not ended.
    let rules: [Rule]
    /// A note while irrigation season starts or ends and the flow can change fast.
    let flowSeason: String?
    let season: Season
    let methods: String
    let access: Access
    let gauge: Gauge?
    let weather: Weather?
    let stocking: WaterStocking?
    let counts: [CountLink]
    let angler: [AnglerPost]
    let sources: [SourceLink]
    let checkedOn: String?

    var isRiver: Bool { kind == "river" }
    var kindLabel: String { kind == "river" ? "River" : kind == "reservoir" ? "Reservoir" : "Lake" }
}

// Two waters are the same water when their ids match, so navigation and lists follow a water across refreshes.
extension Water: Hashable {
    static func == (lhs: Water, rhs: Water) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}

struct Position: Decodable {
    let lat: Double
    let lon: Double
}

struct Score: Decodable {
    /// "scored", "withheld" (a rules notice) or "insufficient" (not enough to score).
    let status: String
    let value: Int?
    /// "Excellent", "Good", "Fair" or "Slow".
    let label: String?
    /// "High", "Medium" or "Low".
    let confidence: String?
    let used: Int?
    let inputs: Int?
    let factors: [ScoreFactor]?
    let missing: [String]?
    let notes: [String]?
    /// The first note worth showing in a list (a rule change or a cap), one sentence.
    let shortNote: String?
    /// One concrete reason to go, from the strongest input ("Steady flow at the Madras gauge, 52°F").
    let why: String?
    /// Why there is no score, when there isn't one.
    let reason: String?

    var isScored: Bool { status == "scored" && value != nil }

    /// "Good", "Withheld" or "Not scored".
    var statusTitle: String {
        if isScored { return label ?? "Scored" }
        return status == "withheld" ? "Withheld" : "Not scored"
    }

    /// Labels by value, the same cut-offs as the website.
    static func label(for value: Int) -> String {
        value >= 80 ? "Excellent" : value >= 65 ? "Good" : value >= 45 ? "Fair" : "Slow"
    }
}

struct ScoreFactor: Decodable {
    /// "tone", "fresh", "run", "cond", "stock", "angler" or "field".
    let key: String
    let label: String
    /// Share of the score, 0 to 1.
    let weight: Double
    /// This input's own reading, 0 to 100.
    let value: Int
    let display: String
    let reason: String
}

struct Report: Decodable {
    let summary: String
    /// "yyyy-MM-dd", or nil when the report is undated.
    let reportedOn: String?
    let coverage: String?
    let url: String?
    /// Set when a WDFW creel report stands in for the water's own report.
    let source: String?
}

struct Notice: Decodable {
    let summary: String
    /// "advisory", "unverified" and the like.
    let status: String
    let url: String?
}

struct Rule: Decodable {
    /// "closure", "restriction" or "other".
    let kind: String
    let summary: String
    let effectiveFrom: String
    let effectiveTo: String?
    let url: String

    var isClosureOrRestriction: Bool { kind == "closure" || kind == "restriction" }
}

struct Season: Decodable {
    let summary: String
    let detail: String
}

struct Access: Decodable {
    let summary: String
    let detail: String
    let points: [AccessPoint]
}

struct AccessPoint: Decodable {
    let label: String
    let type: String?
    let note: String?
    /// What to search for in a maps app. Directions only ever go to a documented access point.
    let mapQuery: String
    let source: String?
}

// MARK: - Gauges and weather

struct Gauge: Decodable {
    let name: String
    /// "Madras gauge".
    let shortName: String
    /// Where the gauge is relative to the water; a gauge reading is not a reading at the access point.
    let coverage: String
    let url: String?
    /// Whether any current reading came through (readings over 36 hours old are left out).
    let live: Bool
    let flow: Flow?
    let stage: Stage?
    let waterTempF: Double?
    let waterTempTime: String?
    let forecast: RiverForecast?
    let pool: Pool?
}

struct Flow: Decodable {
    let cfs: Int
    let median7: Int?
    let median30: Int?
    let time: String
}

struct Stage: Decodable {
    let value: Double
    let unit: String
    let time: String
}

struct RiverForecast: Decodable {
    /// "Holding near 4,380 cfs through Thu, Nov 26".
    let text: String
    let peakCfs: Int
    let url: String
}

struct Pool: Decodable {
    let name: String
    let elevationFt: Double
    let weekChangeFt: Double?
    /// Positive when the pool is below its planned (rule-curve) level.
    let belowPlanFt: Double?
    let outflowCfs: Int?
    let time: String
}

struct Weather: Decodable {
    let readAt: String
    let url: String?
    let periods: [WeatherPeriod]
    let alerts: [WeatherAlert]
}

struct WeatherPeriod: Decodable {
    let name: String
    let isDaytime: Bool
    let temp: Int?
    let tempUnit: String
    let short: String
    let precip: Int?
    let wind: String?
}

struct WeatherAlert: Decodable {
    let event: String
    let headline: String?
    let ends: String?
    let url: String?
}

// MARK: - Stocking, counts and angler posts on a water

struct WaterStocking: Decodable {
    let latest: [StockingEntry]
    let next: [StockingEntry]
}

struct StockingEntry: Decodable {
    let weekStart: String
    let weekLabel: String
    let waterbody: String
    let total: Int
}

struct CountLink: Decodable {
    /// A count station code, such as "BON".
    let station: String
    let name: String
    /// Where the count site sits relative to this water.
    let relation: String
}

struct AnglerPost: Decodable {
    let date: String
    let platform: String
    /// "catch", "guide", "conditions" or "mention".
    let kind: String
    /// Where on the water the post was, when it was somewhere else or unstated.
    let location: String?
    let note: String
    let signal: String?
    let url: String

    // "where" is a Swift keyword, so it is called location here.
    enum CodingKeys: String, CodingKey {
        case date, platform, kind, location = "where", note, signal, url
    }
}

struct SourceLink: Decodable {
    let label: String
    let url: String
}

// MARK: - Statewide fish counts

struct CountStation: Decodable, Identifiable {
    let code: String
    let name: String
    let river: String
    let operatorName: String
    let url: String
    let note: String?
    let live: LiveFeed?
    /// The last day counted, or nil when the site has no daily numbers for this station.
    let through: String?
    let species: [CountSpecies]
    let source: String?

    var id: String { code }

    // "operator" is a Swift keyword, so it is called operatorName here.
    enum CodingKeys: String, CodingKey {
        case code, name, river, operatorName = "operator", url, note, live, through, species, source
    }
}

struct LiveFeed: Decodable {
    let url: String
    let label: String
    let by: String?
}

struct CountSpecies: Decodable, Identifiable {
    let key: String
    let label: String
    let last7: Int
    let ytd: Int
    let lastYearYtd: Int?

    var id: String { key }

    /// This year's count against the same date last year, as a fraction (1.1 is 110%).
    var shareOfLastYear: Double? {
        guard let last = lastYearYtd, last > 0 else { return nil }
        return Double(ytd) / Double(last)
    }
}

// MARK: - Statewide stocking schedule

struct StockingSchedule: Decodable {
    let fetchedAt: String?
    let source: String
    /// The Monday of this week, "yyyy-MM-dd".
    let thisWeek: String
    let weeks: [StockingWeek]
}

struct StockingWeek: Decodable, Identifiable {
    let weekStart: String
    let weekLabel: String
    let rows: [StockingRow]

    var id: String { weekStart }
    var totalTrout: Int { rows.reduce(0) { $0 + $1.total } }
}

struct StockingRow: Decodable {
    let waterbody: String
    let zone: String
    let total: Int
    /// The guide water this stocking is for, when it has a page in the app.
    let waterId: String?
}
