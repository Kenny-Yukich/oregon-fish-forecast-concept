import SwiftUI

/// ODFW's planned trout stockings, last week through five weeks out. Guide waters open their page.
struct StockingView: View {
    @Environment(FeedStore.self) private var store
    @State private var query = ""

    var body: some View {
        let schedule = store.feed?.stocking
        let weeks = (schedule?.weeks ?? []).map { WeekMatches(week: $0, rows: $0.rows.filter(matches)) }.filter { !$0.rows.isEmpty }

        NavigationStack {
            List {
                ForEach(weeks) { item in
                    Section {
                        ForEach(Array(item.rows.enumerated()), id: \.offset) { _, row in
                            if let id = row.waterId, let water = store.water(id: id) {
                                NavigationLink(value: water) { StockingRowView(row: row, inGuide: true) }
                            } else {
                                StockingRowView(row: row, inGuide: false)
                            }
                        }
                    } header: {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(title(for: item.week, thisWeek: schedule?.thisWeek))
                                .font(.title3.weight(.semibold))
                                .fontDesign(.serif)
                                .foregroundStyle(.primary)
                            Text("\(item.week.weekLabel) · \(FeedFormat.number(item.week.totalTrout)) trout at \(item.week.rows.count) waters")
                                .font(.caption)
                        }
                        .textCase(nil)
                    }
                }
                Section {
                    WebLink("ODFW's full stocking schedule", url: schedule?.source)
                } footer: {
                    Text("These are ODFW's planned stockings, not confirmed releases. ODFW changes the schedule; check it before you go.")
                }
            }
            .overlay {
                if weeks.isEmpty {
                    if query.isEmpty {
                        ContentUnavailableView("No stockings planned", systemImage: "fish", description: Text("ODFW has nothing scheduled for these weeks."))
                    } else {
                        ContentUnavailableView.search(text: query)
                    }
                }
            }
            .searchable(text: $query, prompt: "Water or zone")
            .navigationTitle("Trout Stocking")
            .refreshable { await store.refresh() }
            .waterDestination()
        }
    }

    /// A week with the rows that match the search.
    private struct WeekMatches: Identifiable {
        let week: StockingWeek
        let rows: [StockingRow]
        var id: String { week.id }
    }

    private func matches(_ row: StockingRow) -> Bool {
        let q = query.trimmingCharacters(in: .whitespaces)
        return q.isEmpty || row.waterbody.localizedCaseInsensitiveContains(q) || row.zone.localizedCaseInsensitiveContains(q)
    }

    private func title(for week: StockingWeek, thisWeek: String?) -> String {
        guard let thisWeek, let gap = FeedFormat.days(from: thisWeek, to: week.weekStart) else {
            return "Week of \(FeedFormat.shortDay(week.weekStart))"
        }
        switch gap {
        case -7: return "Last week"
        case 0: return "This week"
        case 7: return "Next week"
        default: return "Week of \(FeedFormat.shortDay(week.weekStart))"
        }
    }
}

private struct StockingRowView: View {
    let row: StockingRow
    let inGuide: Bool

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(row.waterbody)
                    .font(inGuide ? .body.weight(.semibold) : .body)
                Text(row.zone)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Text("\(FeedFormat.number(row.total)) trout")
                .font(.subheadline)
                .monospacedDigit()
                .foregroundStyle(.secondary)
        }
        .accessibilityElement(children: .combine)
    }
}

#Preview {
    StockingView()
        .environment(FeedStore())
        .environment(Favorites())
}
