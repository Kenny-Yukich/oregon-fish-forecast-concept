import SwiftUI

/// Dam and trap counts: adult salmon and steelhead climbing the fish ladders, read every morning.
struct CountsView: View {
    @Environment(FeedStore.self) private var store

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Text("Adult salmon and steelhead counted climbing the fish ladders, updated every morning. Counts show run timing, not how many fish are being caught.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                ForEach(store.feed?.countStations ?? []) { station in
                    StationSection(station: station)
                }
            }
            .navigationTitle("Fish Counts")
            .refreshable { await store.refresh() }
        }
    }
}

private struct StationSection: View {
    let station: CountStation

    var body: some View {
        Section {
            if let through = station.through, !station.species.isEmpty {
                ForEach(station.species) { species in
                    CountSpeciesRow(species: species)
                }
                Text("Through \(FeedFormat.shortDay(through)). Columbia River DART.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else {
                Text("The app doesn't carry daily numbers for this site yet.")
                    .foregroundStyle(.secondary)
                WebLink("Counts from \(station.operatorName)", url: station.url)
            }
            if let live = station.live {
                VStack(alignment: .leading, spacing: 4) {
                    WebLink(live.label, url: live.url)
                    if let by = live.by {
                        Text(by)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
        } header: {
            VStack(alignment: .leading, spacing: 2) {
                Text(station.name)
                    .font(.title3.weight(.semibold))
                    .fontDesign(.serif)
                    .foregroundStyle(.primary)
                Text(station.river)
                    .font(.subheadline)
            }
            .textCase(nil)
        } footer: {
            if let note = station.note {
                Text(note)
            }
        }
    }
}

/// One species at a count site: the last seven days, the year so far, and the year so far against last year.
struct CountSpeciesRow: View {
    let species: CountSpecies

    private var isSubgroup: Bool { species.key.contains("_") }

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 2) {
                Text(species.label)
                    .font(isSubgroup ? .subheadline : .subheadline.weight(.semibold))
                    .foregroundStyle(isSubgroup ? Color.secondary : Color.primary)
                Text("\(FeedFormat.number(species.last7)) in the last 7 days")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text("\(FeedFormat.number(species.ytd)) this year")
                    .font(.subheadline)
                    .monospacedDigit()
                if let share = species.shareOfLastYear {
                    Label {
                        Text(verbatim: "\(FeedFormat.percent(share)) of last year")
                    } icon: {
                        Image(systemName: share >= 1 ? "arrow.up.right" : "arrow.down.right")
                    }
                    .font(.caption)
                    .foregroundStyle(share >= 1 ? Theme.scoreColor("Good") : Theme.scoreColor("Slow"))
                }
            }
        }
        .padding(.leading, isSubgroup ? 12 : 0)
        .accessibilityElement(children: .combine)
    }
}

#Preview {
    CountsView()
        .environment(FeedStore())
}
