import SwiftUI

/// How scores work, where the data comes from, and the app's version. Opened from the Forecast tab.
struct AboutView: View {
    @Environment(\.dismiss) private var dismiss

    private var version: String {
        let info = Bundle.main.infoDictionary
        let short = info?["CFBundleShortVersionString"] as? String ?? "1.0"
        let build = info?["CFBundleVersion"] as? String ?? "1"
        return "\(short) (\(build))"
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Image("FishMark")
                        .resizable()
                        .scaledToFit()
                        .frame(maxHeight: 120)
                        .frame(maxWidth: .infinity)
                        .accessibilityHidden(true)
                        .listRowBackground(Color.clear)
                }

                Section {
                    Text("Each water gets a score from 0 to 100, built only from data already published: dated fishing reports, dam counts, river gauges and ODFW stocking.")
                    WeightRow(name: "Report tone", river: 30, lake: 35)
                    WeightRow(name: "Run strength (dam counts)", river: 25, lake: nil)
                    WeightRow(name: "River conditions (flow, temperature)", river: 20, lake: nil)
                    WeightRow(name: "Report freshness", river: 15, lake: 25)
                    WeightRow(name: "Recent stocking", river: 10, lake: 40)
                } header: {
                    Text("How scores work")
                } footer: {
                    Text("Weights for rivers, then lakes. Missing inputs are skipped and lower confidence.")
                }
                .headerProminence(.increased)

                Section {
                    LabelRow(label: "Excellent", range: "80 and up")
                    LabelRow(label: "Good", range: "65 to 79")
                    LabelRow(label: "Fair", range: "45 to 64")
                    LabelRow(label: "Slow", range: "Under 45")
                } header: {
                    Text("Labels")
                } footer: {
                    Text("A score needs three inputs, and on a river a live flow reading, to reach Excellent. A rules notice withholds a score. Recent angler catch posts can raise a score, never lower it. The formula has not yet been tested against catch results.")
                }

                Section("Where the data comes from") {
                    Text("Oregon Department of Fish and Wildlife: fishing reports, regulation updates and the trout stocking schedule.")
                    Text("USGS, NOAA, the U.S. Army Corps of Engineers and the Bureau of Reclamation: river flow, water temperature, river forecasts and reservoir levels.")
                    Text("Columbia River DART: Bonneville, The Dalles and Willamette Falls fish counts.")
                    Text("National Weather Service: forecasts and alerts.")
                    Text("WDFW creel reports and public angler posts, which are word of mouth and not verified.")
                }
                .font(.subheadline)

                Section {
                    Text("Always check the current ODFW regulations and conditions before you fish. Gauge readings and map pins describe the general area of a water, not an access point.")
                        .font(.subheadline)
                    WebLink("ODFW fishing regulations", url: "https://myodfw.com/fishing/regulations")
                    WebLink("oregonfishforecast.com", url: "https://oregonfishforecast.com/")
                } header: {
                    Text("Before you fish")
                } footer: {
                    Text("Oregon Fish Forecast \(version)")
                }
            }
            .navigationTitle("About the Forecast")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}

private struct WeightRow: View {
    let name: String
    let river: Int?
    let lake: Int?

    var body: some View {
        HStack {
            Text(name)
                .font(.subheadline)
            Spacer()
            Text(verbatim: river.map { "\($0)%" } ?? "-")
                .frame(width: 44, alignment: .trailing)
            Text(verbatim: lake.map { "\($0)%" } ?? "-")
                .frame(width: 44, alignment: .trailing)
        }
        .font(.subheadline)
        .monospacedDigit()
    }
}

private struct LabelRow: View {
    let label: String
    let range: String

    var body: some View {
        HStack {
            Circle()
                .fill(Theme.scoreColor(label))
                .frame(width: 10, height: 10)
            Text(label)
                .font(.subheadline.weight(.semibold))
            Spacer()
            Text(range)
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }
}

#Preview {
    AboutView()
}
