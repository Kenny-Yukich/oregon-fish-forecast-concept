import SwiftUI

/// Every guide water: search, rivers or lakes, and three ways to sort.
struct WatersView: View {
    enum KindFilter: String, CaseIterable, Identifiable {
        case all = "All", rivers = "Rivers", lakes = "Lakes"
        var id: Self { self }

        func includes(_ water: Water) -> Bool {
            switch self {
            case .all: return true
            case .rivers: return water.isRiver
            case .lakes: return !water.isRiver
            }
        }
    }

    enum SortOrder: String, CaseIterable, Identifiable {
        case score = "Best score", name = "Name", region = "Region"
        var id: Self { self }
    }

    @Environment(FeedStore.self) private var store
    @Environment(Favorites.self) private var favorites
    @State private var query = ""
    @State private var kind: KindFilter = .all
    @State private var sort: SortOrder = .score

    var body: some View {
        let all = store.feed?.waters ?? []
        let shown = sorted(all.filter { kind.includes($0) && $0.matches(query) })

        NavigationStack {
            List {
                Picker("Show", selection: $kind) {
                    ForEach(KindFilter.allCases) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.segmented)
                .listRowBackground(Color.clear)
                .listRowInsets(EdgeInsets())

                if sort == .region {
                    ForEach(store.feed?.regions ?? [], id: \.self) { region in
                        let inRegion = shown.filter { $0.region == region }
                        if !inRegion.isEmpty {
                            Section(region) {
                                ForEach(inRegion) { row($0) }
                            }
                        }
                    }
                } else {
                    Section {
                        ForEach(shown) { row($0) }
                    } footer: {
                        if !shown.isEmpty {
                            Text("\(shown.count) of \(all.count) waters")
                        }
                    }
                }
            }
            .overlay {
                if shown.isEmpty && !all.isEmpty {
                    ContentUnavailableView.search(text: query)
                }
            }
            .searchable(text: $query, prompt: "Water, region or species")
            .navigationTitle("Waters")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Picker("Sort by", selection: $sort) {
                            ForEach(SortOrder.allCases) { Text($0.rawValue).tag($0) }
                        }
                    } label: {
                        Label("Sort", systemImage: "arrow.up.arrow.down")
                    }
                }
            }
            .refreshable { await store.refresh() }
            .waterDestination()
        }
    }

    private func sorted(_ waters: [Water]) -> [Water] {
        switch sort {
        case .score, .region: return waters.sortedByScore()
        case .name: return waters.sorted { $0.name == $1.name ? $0.reach < $1.reach : $0.name < $1.name }
        }
    }

    private func row(_ water: Water) -> some View {
        NavigationLink(value: water) {
            WaterRow(water: water)
        }
        .swipeActions(edge: .trailing) {
            let saved = favorites.contains(water.id)
            Button {
                favorites.toggle(water.id)
            } label: {
                Label(saved ? "Unsave" : "Save", systemImage: saved ? "star.slash" : "star")
            }
            .tint(Theme.sun)
        }
    }
}

#Preview {
    WatersView()
        .environment(FeedStore())
        .environment(Favorites())
}
