import CoreLocation
import MapKit
import SwiftUI

/// Every guide water on a map, colored by today's score. Tap a pin for its card, then open the water.
struct WatersMapView: View {
    @Environment(FeedStore.self) private var store
    @State private var position: MapCameraPosition = .region(Self.oregon)
    @State private var selectedID: String?
    @State private var kind: WatersView.KindFilter = .all
    @State private var satellite = false
    @State private var location = CLLocationManager()

    static let oregon = MKCoordinateRegion(
        center: CLLocationCoordinate2D(latitude: 44.1, longitude: -120.6),
        span: MKCoordinateSpan(latitudeDelta: 5.2, longitudeDelta: 7.6)
    )

    private struct Pin: Identifiable {
        let id: String
        let name: String
        let coordinate: CLLocationCoordinate2D
        let symbol: String
        let color: Color
    }

    var body: some View {
        let waters = (store.feed?.waters ?? []).filter { kind.includes($0) }
        let pins = waters.compactMap { w -> Pin? in
            guard let p = w.position else { return nil }
            return Pin(id: w.id, name: w.name, coordinate: CLLocationCoordinate2D(latitude: p.lat, longitude: p.lon),
                       symbol: w.isRiver ? "water.waves" : "drop.fill", color: Theme.scoreColor(w.score.isScored ? w.score.label : nil))
        }
        let selected = selectedID.flatMap { id in waters.first { $0.id == id } }

        NavigationStack {
            Map(position: $position, selection: $selectedID) {
                UserAnnotation()
                ForEach(pins) { pin in
                    Marker(pin.name, systemImage: pin.symbol, coordinate: pin.coordinate)
                        .tint(pin.color)
                        .tag(pin.id)
                }
            }
            .mapStyle(satellite ? .hybrid(elevation: .realistic) : .standard(elevation: .realistic))
            .mapControls {
                MapUserLocationButton()
                MapCompass()
                MapScaleView()
            }
            .safeAreaInset(edge: .bottom) {
                if let selected {
                    MapCard(water: selected)
                        .padding()
                } else {
                    Text("Pins mark the general area of each water, not access points.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(.regularMaterial, in: Capsule())
                        .padding(.bottom, 8)
                }
            }
            .navigationTitle("Map")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    Picker("Show", selection: $kind) {
                        ForEach(WatersView.KindFilter.allCases) { Text($0.rawValue).tag($0) }
                    }
                    .pickerStyle(.segmented)
                    .frame(maxWidth: 240)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        satellite.toggle()
                    } label: {
                        Label(satellite ? "Map" : "Satellite", systemImage: satellite ? "map" : "globe.americas.fill")
                    }
                }
            }
            .onChange(of: kind) { selectedID = nil }
            .onAppear {
                // Shows the blue dot. iOS asks once; the app works the same if someone says no.
                if location.authorizationStatus == .notDetermined {
                    location.requestWhenInUseAuthorization()
                }
            }
            .waterDestination()
        }
    }
}

/// The card that slides up when a pin is selected.
private struct MapCard: View {
    let water: Water

    var body: some View {
        NavigationLink(value: water) {
            HStack(spacing: 14) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(water.name)
                        .font(.headline)
                        .fontDesign(.serif)
                    Text(water.reach)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    if let why = water.score.why {
                        Text(why)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                            .lineLimit(2)
                    }
                }
                Spacer()
                ScoreBadge(score: water.score, size: 46)
                Image(systemName: "chevron.right")
                    .foregroundStyle(.tertiary)
            }
            .padding()
            .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))
        }
        .buttonStyle(.plain)
    }
}

#Preview {
    WatersMapView()
        .environment(FeedStore())
        .environment(Favorites())
}
