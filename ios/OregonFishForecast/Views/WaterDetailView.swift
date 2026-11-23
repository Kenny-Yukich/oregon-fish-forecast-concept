import MapKit
import SwiftUI

/// One water's page: the score and every input behind it, rules, conditions, weather, the latest report,
/// stocking, fish counts, angler posts, access and sources. The same sections as the website's water page.
struct WaterDetailView: View {
    let water: Water
    @Environment(FeedStore.self) private var store
    @Environment(Favorites.self) private var favorites

    var body: some View {
        List {
            Section { header }
            beforeYouGo
            scoreSection
            if let gauge = water.gauge { conditions(gauge) }
            if let weather = water.weather { weatherSection(weather) }
            reportSection
            if let stocking = water.stocking { stockingSection(stocking) }
            if !water.counts.isEmpty { countsSection }
            if !water.angler.isEmpty { anglerSection }
            accessSection
            seasonSection
            sourcesSection
        }
        .navigationTitle(water.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                let saved = favorites.contains(water.id)
                Button {
                    favorites.toggle(water.id)
                } label: {
                    Label(saved ? "Remove from your waters" : "Save to your waters", systemImage: saved ? "star.fill" : "star")
                }
                if let url = URL(string: water.url) {
                    ShareLink(item: url, subject: Text(water.name), message: Text("\(water.name), \(water.reach) on Oregon Fish Forecast"))
                }
            }
        }
    }

    // MARK: Header

    private var header: some View {
        VStack(alignment: .leading, spacing: 14) {
            if let position = water.position {
                MiniMap(coordinate: CLLocationCoordinate2D(latitude: position.lat, longitude: position.lon),
                        title: water.name,
                        tint: Theme.scoreColor(water.score.label))
                    .frame(height: 170)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .accessibilityHidden(true)
            }
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(water.name)
                        .font(.title.weight(.semibold))
                        .fontDesign(.serif)
                    Text(water.reach)
                        .font(.title3)
                        .foregroundStyle(.secondary)
                    Text("\(water.kindLabel) · \(water.region)")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                ScoreBadge(score: water.score, size: 68)
            }
            scoreSummary
        }
        .padding(.vertical, 6)
    }

    @ViewBuilder
    private var scoreSummary: some View {
        let score = water.score
        if score.isScored, let label = score.label {
            VStack(alignment: .leading, spacing: 6) {
                Text("\(label) for \(water.speciesWord)")
                    .font(.headline)
                    .foregroundStyle(Theme.scoreColor(label))
                if let confidence = score.confidence, let used = score.used, let inputs = score.inputs {
                    Text("\(confidence) confidence · \(used) of \(inputs) inputs")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                if let why = score.why {
                    Label(why, systemImage: "sparkles")
                        .font(.subheadline)
                }
            }
        } else {
            VStack(alignment: .leading, spacing: 6) {
                Text(score.status == "withheld" ? "Score withheld" : "Not scored yet")
                    .font(.headline)
                if let reason = score.reason {
                    Text(reason)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    // MARK: Before you go

    @ViewBuilder
    private var beforeYouGo: some View {
        let notes = (water.score.notes ?? []).filter { $0 != water.flowSeason }
        if !water.rules.isEmpty || !water.notices.isEmpty || water.flowSeason != nil || !notes.isEmpty {
            Section {
                ForEach(Array(water.rules.enumerated()), id: \.offset) { _, rule in
                    Label {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(rule.summary)
                            Text(ruleDates(rule))
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            WebLink("ODFW regulation update", url: rule.url)
                                .font(.caption)
                        }
                    } icon: {
                        Image(systemName: rule.isClosureOrRestriction ? "exclamationmark.octagon.fill" : "info.circle.fill")
                            .foregroundStyle(rule.isClosureOrRestriction ? Theme.alert : Theme.river)
                    }
                }
                ForEach(Array(water.notices.enumerated()), id: \.offset) { _, notice in
                    Label {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(notice.summary)
                            if notice.status == "unverified" {
                                Text("Needs a check on the day")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            WebLink("Source", url: notice.url)
                                .font(.caption)
                        }
                    } icon: {
                        Image(systemName: notice.status == "unverified" ? "questionmark.circle.fill" : "exclamationmark.triangle.fill")
                            .foregroundStyle(notice.status == "unverified" ? Color.secondary : Theme.sun)
                    }
                }
                if let season = water.flowSeason {
                    Label(season, systemImage: "drop.triangle.fill")
                }
                ForEach(Array(notes.enumerated()), id: \.offset) { _, note in
                    Label(note, systemImage: "info.circle")
                        .foregroundStyle(.secondary)
                }
            } header: {
                Text("Before you go")
            } footer: {
                Text("Always check the current ODFW regulations for this water before fishing.")
            }
        }
    }

    private func ruleDates(_ rule: Rule) -> String {
        let from = FeedFormat.shortDay(rule.effectiveFrom)
        if let to = rule.effectiveTo { return "\(from) to \(FeedFormat.shortDay(to))" }
        return "From \(from), no end date"
    }

    // MARK: Score

    private var scoreSection: some View {
        Section {
            if let factors = water.score.factors, water.score.isScored {
                ForEach(Array(factors.enumerated()), id: \.offset) { _, factor in
                    FactorRow(factor: factor)
                }
                if let missing = water.score.missing, !missing.isEmpty {
                    Text("Not available today: \(missing.joined(separator: ", ")). Missing inputs are skipped and lower confidence.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            } else {
                Text(water.score.reason ?? "There is nothing to score yet.")
                    .foregroundStyle(.secondary)
            }
        } header: {
            Text("How the score adds up")
        } footer: {
            Text("The formula uses only published data and has not yet been tested against catch results.")
        }
    }

    // MARK: Conditions

    private func conditions(_ gauge: Gauge) -> some View {
        Section {
            if let flow = gauge.flow {
                LabeledContent("Flow", value: "\(FeedFormat.number(flow.cfs)) cfs")
                if let median = flow.median7 {
                    LabeledContent("7-day median", value: "\(FeedFormat.number(median)) cfs")
                }
                if let median = flow.median30 {
                    LabeledContent("30-day median", value: "\(FeedFormat.number(median)) cfs")
                }
            }
            if let stage = gauge.stage {
                LabeledContent("Level", value: String(format: "%.2f %@", stage.value, stage.unit))
            }
            if let temp = gauge.waterTempF {
                LabeledContent("Water temperature", value: FeedFormat.fahrenheit(temp))
            }
            if let pool = gauge.pool {
                LabeledContent("Pool elevation", value: String(format: "%.1f ft", pool.elevationFt))
                if let change = pool.weekChangeFt {
                    LabeledContent("Past week", value: abs(change) < 0.1 ? "Steady" : FeedFormat.feetChange(change))
                }
                if let below = pool.belowPlanFt {
                    LabeledContent(below >= 0 ? "Below planned level" : "Above planned level", value: String(format: "%.1f ft", abs(below)))
                }
                if let outflow = pool.outflowCfs {
                    LabeledContent("Outflow", value: "\(FeedFormat.number(outflow)) cfs")
                }
            }
            if let forecast = gauge.forecast {
                VStack(alignment: .leading, spacing: 4) {
                    Label("NOAA river forecast", systemImage: "chart.line.uptrend.xyaxis")
                        .font(.subheadline.weight(.semibold))
                    Text(forecast.text)
                    WebLink("Forecast", url: forecast.url)
                        .font(.footnote)
                }
            }
            if !gauge.live {
                Text("No live reading is connected for this water.")
                    .foregroundStyle(.secondary)
            }
            VStack(alignment: .leading, spacing: 4) {
                Text(gauge.name)
                    .font(.footnote.weight(.semibold))
                Text(gauge.coverage)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                if let read = gauge.flow?.time ?? gauge.waterTempTime ?? gauge.stage?.time, let ago = FeedFormat.relative(read) {
                    Text("Read \(ago)")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
            WebLink("Gauge page", url: gauge.url)
        } header: {
            Text(water.isRiver ? "River conditions" : "Lake conditions")
        }
    }

    // MARK: Weather

    private func weatherSection(_ weather: Weather) -> some View {
        Section {
            ForEach(Array(weather.alerts.enumerated()), id: \.offset) { _, alert in
                VStack(alignment: .leading, spacing: 4) {
                    Label(alert.event, systemImage: "exclamationmark.triangle.fill")
                        .font(.headline)
                        .foregroundStyle(Theme.alert)
                    if let headline = alert.headline {
                        Text(headline)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            ForEach(Array(weather.periods.enumerated()), id: \.offset) { _, period in
                HStack(spacing: 12) {
                    Image(systemName: weatherSymbol(period))
                        .symbolRenderingMode(.multicolor)
                        .font(.title2)
                        .frame(width: 36)
                        .accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(period.name)
                            .font(.subheadline.weight(.semibold))
                        Text(period.short)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                        if let wind = period.wind {
                            Text("Wind \(wind)")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: 2) {
                        if let temp = period.temp {
                            Text(verbatim: "\(temp)°\(period.tempUnit)")
                                .font(.title3.weight(.medium))
                                .monospacedDigit()
                        }
                        if let precip = period.precip, precip > 0 {
                            Text(verbatim: "\(precip)% precip")
                                .font(.caption)
                                .foregroundStyle(Theme.river)
                        }
                    }
                }
                .accessibilityElement(children: .combine)
            }
            WebLink("National Weather Service forecast", url: weather.url)
        } header: {
            Text("Weather")
        } footer: {
            Text("NWS forecast for the general area of this water, not an access point. Weather is not part of the score.")
        }
    }

    private func weatherSymbol(_ period: WeatherPeriod) -> String {
        let s = period.short.lowercased(), day = period.isDaytime
        if s.contains("thunder") { return "cloud.bolt.rain.fill" }
        if s.contains("snow") || s.contains("flurr") { return "cloud.snow.fill" }
        if s.contains("sleet") || s.contains("freezing rain") { return "cloud.sleet.fill" }
        if s.contains("rain") || s.contains("shower") || s.contains("drizzle") { return "cloud.rain.fill" }
        if s.contains("fog") || s.contains("haze") || s.contains("smoke") { return "cloud.fog.fill" }
        if s.contains("partly") || s.contains("mostly sunny") || s.contains("mostly clear") { return day ? "cloud.sun.fill" : "cloud.moon.fill" }
        if s.contains("cloud") || s.contains("overcast") { return "cloud.fill" }
        if s.contains("wind") || s.contains("breezy") { return "wind" }
        return day ? "sun.max.fill" : "moon.stars.fill"
    }

    // MARK: Report

    private var reportSection: some View {
        Section {
            if let report = water.report {
                Text("“\(report.summary)”")
                    .fontDesign(.serif)
                if let day = report.reportedOn {
                    let age = FeedFormat.age(of: day).map { " · " + FeedFormat.ageText($0) } ?? ""
                    Label("Reported \(FeedFormat.shortDay(day))\(age)", systemImage: "calendar")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                } else {
                    Label("Undated report", systemImage: "calendar.badge.exclamationmark")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                if let source = report.source {
                    Text(source)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                if let coverage = report.coverage {
                    Text(coverage)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                WebLink("Read the report", url: report.url)
            } else {
                Text("No fishing report yet.")
                    .foregroundStyle(.secondary)
            }
        } header: {
            Text("Latest report")
        }
    }

    // MARK: Stocking

    private func stockingSection(_ stocking: WaterStocking) -> some View {
        Section {
            if stocking.latest.isEmpty && stocking.next.isEmpty {
                Text("No stocking planned in the weeks the schedule covers.")
                    .foregroundStyle(.secondary)
            }
            ForEach(Array(stocking.next.enumerated()), id: \.offset) { _, entry in
                StockingEntryRow(entry: entry, upcoming: true)
            }
            ForEach(Array(stocking.latest.enumerated()), id: \.offset) { _, entry in
                StockingEntryRow(entry: entry, upcoming: false)
            }
        } header: {
            Text("When was it stocked?")
        } footer: {
            Text("ODFW's planned stockings, not confirmed releases.")
        }
    }

    // MARK: Fish counts

    private var countsSection: some View {
        Section {
            ForEach(Array(water.counts.enumerated()), id: \.offset) { _, link in
                let station = store.feed?.countStation(code: link.station)
                VStack(alignment: .leading, spacing: 6) {
                    Text(link.name)
                        .font(.headline)
                        .fontDesign(.serif)
                    Text(link.relation)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                    if let station, let through = station.through, !station.species.isEmpty {
                        ForEach(station.species.filter { ["chinook", "coho", "steelhead"].contains($0.key) }) { species in
                            CountSpeciesRow(species: species)
                        }
                        Text("Through \(FeedFormat.shortDay(through))")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    } else if let station {
                        WebLink("Counts from \(station.operatorName)", url: station.url)
                            .font(.footnote)
                    }
                }
                .padding(.vertical, 2)
            }
        } header: {
            Text("Are fish in the system?")
        } footer: {
            Text("Counts show adult fish moving upstream past a point. They are run timing, not catch rates.")
        }
    }

    // MARK: Angler posts

    private var anglerSection: some View {
        Section {
            ForEach(Array(water.angler.enumerated()), id: \.offset) { _, post in
                VStack(alignment: .leading, spacing: 4) {
                    Text("\(FeedFormat.shortDay(post.date)) · \(post.platform) · \(post.kind.capitalized)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text(post.note)
                    if let location = post.location {
                        Text(location)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                    WebLink("Source post", url: post.url)
                        .font(.footnote)
                }
                .padding(.vertical, 2)
            }
        } header: {
            Text("From anglers · last 30 days")
        } footer: {
            Text("Word of mouth from public Facebook groups and TikTok. Not verified. Recent catch posts on this water can raise its score, never lower it.")
        }
    }

    // MARK: Access

    private var accessSection: some View {
        Section {
            VStack(alignment: .leading, spacing: 6) {
                Text(water.access.summary)
                    .font(.headline)
                Text(water.access.detail)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            ForEach(Array(water.access.points.enumerated()), id: \.offset) { _, point in
                VStack(alignment: .leading, spacing: 6) {
                    Text(point.label)
                        .font(.subheadline.weight(.semibold))
                    if let type = point.type {
                        Text(type)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                    if let note = point.note {
                        Text(note)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                    DirectionsMenu(query: point.mapQuery)
                        .font(.subheadline)
                }
                .padding(.vertical, 2)
            }
        } header: {
            Text("Getting there")
        } footer: {
            Text("Directions go to a documented public access point. The map pin above marks the general area of the reach only.")
        }
    }

    // MARK: Season and methods

    private var seasonSection: some View {
        Section {
            VStack(alignment: .leading, spacing: 6) {
                Text(water.season.summary)
                    .font(.headline)
                Text(water.season.detail)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            VStack(alignment: .leading, spacing: 6) {
                Text("Methods")
                    .font(.headline)
                Text(water.methods)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            LabeledContent("Target species", value: water.species.joined(separator: ", "))
        } header: {
            Text("Season and methods")
        }
    }

    // MARK: Sources

    private var sourcesSection: some View {
        Section {
            ForEach(Array(water.sources.enumerated()), id: \.offset) { _, source in
                WebLink(source.label, url: source.url)
            }
            WebLink("Open on oregonfishforecast.com", url: water.url)
        } header: {
            Text("Sources")
        } footer: {
            if let checked = water.checkedOn {
                Text("Field notes checked \(FeedFormat.shortDay(checked)).")
            }
        }
    }
}

// MARK: - Pieces of the water page

/// A small, still map with a pin on the general area of the reach.
private struct MiniMap: View {
    let coordinate: CLLocationCoordinate2D
    let title: String
    let tint: Color

    var body: some View {
        Map(initialPosition: .region(MKCoordinateRegion(center: coordinate, latitudinalMeters: 40_000, longitudinalMeters: 40_000)),
            interactionModes: []) {
            Marker(title, coordinate: coordinate)
                .tint(tint)
        }
        .mapStyle(.standard(elevation: .realistic))
    }
}

/// One input to the score: its share, its reading as a bar, and where the reading came from.
private struct FactorRow: View {
    let factor: ScoreFactor

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline) {
                Text(factor.label)
                    .font(.subheadline.weight(.semibold))
                Text(verbatim: "\(Int((factor.weight * 100).rounded()))%")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Spacer()
                Text(factor.display)
                    .font(.subheadline)
                    .foregroundStyle(Theme.valueColor(factor.value))
                    .multilineTextAlignment(.trailing)
            }
            ProgressView(value: Double(factor.value), total: 100)
                .tint(Theme.valueColor(factor.value))
                .accessibilityLabel("\(factor.label) reading")
                .accessibilityValue("\(factor.value) out of 100")
            Text(factor.reason)
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 4)
    }
}

private struct StockingEntryRow: View {
    let entry: StockingEntry
    let upcoming: Bool

    var body: some View {
        HStack {
            Image(systemName: upcoming ? "calendar.badge.clock" : "checkmark.circle")
                .foregroundStyle(upcoming ? Theme.river : Color.secondary)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text("\(upcoming ? "Planned" : "Stocked") week of \(FeedFormat.shortDay(entry.weekStart))")
                    .font(.subheadline.weight(.semibold))
                Text(entry.waterbody)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Text("\(FeedFormat.number(entry.total)) trout")
                .font(.subheadline)
                .monospacedDigit()
        }
    }
}

#Preview {
    let store = FeedStore()
    return NavigationStack {
        if let water = store.feed?.waters.first {
            WaterDetailView(water: water)
        }
    }
    .environment(store)
    .environment(Favorites())
}
