import SwiftUI

enum AppTab: Hashable {
    case forecast, waters, map, counts, stocking
}

struct ContentView: View {
    @Environment(FeedStore.self) private var store
    @Environment(\.scenePhase) private var scenePhase
    @State private var tab: AppTab = .forecast

    var body: some View {
        TabView(selection: $tab) {
            Tab("Forecast", systemImage: "sun.horizon", value: AppTab.forecast) {
                ForecastView(tab: $tab)
            }
            Tab("Waters", systemImage: "list.bullet", value: AppTab.waters) {
                WatersView()
            }
            Tab("Map", systemImage: "map", value: AppTab.map) {
                WatersMapView()
            }
            Tab("Counts", systemImage: "chart.bar.xaxis", value: AppTab.counts) {
                CountsView()
            }
            Tab("Stocking", systemImage: "fish", value: AppTab.stocking) {
                StockingView()
            }
        }
        // Fetch today's forecast on launch, and again when coming back to the app after a while.
        .task { await store.refresh() }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active {
                Task { await store.refreshIfStale() }
            }
        }
    }
}

#Preview {
    ContentView()
        .environment(FeedStore())
        .environment(Favorites())
}
