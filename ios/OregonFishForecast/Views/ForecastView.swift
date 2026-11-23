import SwiftUI

/// The home tab: the artwork, your saved waters, this week's best waters, weather alerts and stocking news.
struct ForecastView: View {
    @Binding var tab: AppTab
    @Environment(FeedStore.self) private var store
    @Environment(Favorites.self) private var favorites
    @State private var showingAbout = false

    var body: some View {
        NavigationStack {
            Group {
                if let feed = store.feed {
                    content(feed)
                } else {
                    ContentUnavailableView {
                        Label("No forecast yet", systemImage: "wifi.slash")
                    } description: {
                        Text("Connect to the internet to get today's forecast.")
                    } actions: {
                        Button("Try again") { Task { await store.refresh() } }
                    }
                }
            }
            .navigationTitle("Fish Forecast")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showingAbout = true
                    } label: {
                        Label("How scores work", systemImage: "info.circle")
                    }
                }
            }
            .sheet(isPresented: $showingAbout) { AboutView() }
            .waterDestination()
        }
    }

    private func content(_ feed: Feed) -> some View {
        let saved = feed.waters.filter { favorites.contains($0.id) }.sortedByScore()
        let alerts = feed.waters.filter { !($0.weather?.alerts.isEmpty ?? true) }
        let thisWeek = feed.stocking.weeks.first { $0.weekStart == feed.stocking.thisWeek }

        return List {
            Section {
                Hero(count: feed.waters.count)
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
            }

            if !saved.isEmpty {
                Section("Your waters") {
                    ForEach(saved) { water in
                        NavigationLink(value: water) { WaterRow(water: water) }
                    }
                }
                .headerProminence(.increased)
            }

            Section {
                ForEach(feed.bestWaters()) { water in
                    NavigationLink(value: water) { WaterRow(water: water) }
                }
                Button("Explore all \(feed.waters.count) waters") { tab = .waters }
            } header: {
                Text("This week's best waters")
            } footer: {
                Text("Scores come from dated reports, river gauges, dam counts and ODFW stocking. Each water shows every input, how sure the score is and any rules notice.")
            }
            .headerProminence(.increased)

            if !alerts.isEmpty {
                Section("Weather alerts") {
                    ForEach(alerts) { water in
                        NavigationLink(value: water) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(water.name).font(.headline).fontDesign(.serif)
                                ForEach(Array((water.weather?.alerts ?? []).enumerated()), id: \.offset) { _, alert in
                                    Label(alert.event, systemImage: "exclamationmark.triangle.fill")
                                        .font(.subheadline)
                                        .foregroundStyle(Theme.alert)
                                }
                            }
                        }
                    }
                }
                .headerProminence(.increased)
            }

            if let thisWeek {
                Section {
                    Button {
                        tab = .stocking
                    } label: {
                        Label {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Stocked this week: \(thisWeek.rows.count) Oregon waters")
                                    .foregroundStyle(.primary)
                                Text("\(FeedFormat.number(thisWeek.totalTrout)) trout planned by ODFW")
                                    .font(.footnote)
                                    .foregroundStyle(.secondary)
                            }
                        } icon: {
                            Image(systemName: "fish.fill")
                        }
                    }
                }
            }

            Section {
                FeedStatus()
                    .listRowBackground(Color.clear)
            }
        }
        .refreshable { await store.refresh() }
    }
}

/// The river artwork with the app's question.
private struct Hero: View {
    let count: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Image("Landscape")
                .resizable()
                .scaledToFit()
                .accessibilityHidden(true)
            Text("Where are you fishing?")
                .font(.title.weight(.semibold))
                .fontDesign(.serif)
                .foregroundStyle(Theme.ink)
            Text("Today's scores for \(count) Oregon waters, from ODFW reports, river gauges, dam counts and stocking.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal, 4)
        .padding(.bottom, 8)
    }
}

#Preview {
    ForecastView(tab: .constant(.forecast))
        .environment(FeedStore())
        .environment(Favorites())
}
