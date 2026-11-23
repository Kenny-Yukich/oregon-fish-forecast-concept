import SwiftUI
import UIKit

@main
struct OregonFishForecastApp: App {
    @State private var store = FeedStore()
    @State private var favorites = Favorites()

    init() {
        // Serif navigation titles, like the website's headings (New York, Apple's serif).
        let bar = UINavigationBar.appearance()
        if let large = UIFont.preferredFont(forTextStyle: .largeTitle).fontDescriptor.withDesign(.serif)?.withSymbolicTraits(.traitBold) {
            bar.largeTitleTextAttributes = [.font: UIFont(descriptor: large, size: 0)]
        }
        if let inline = UIFont.preferredFont(forTextStyle: .headline).fontDescriptor.withDesign(.serif)?.withSymbolicTraits(.traitBold) {
            bar.titleTextAttributes = [.font: UIFont(descriptor: inline, size: 0)]
        }
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(store)
                .environment(favorites)
        }
    }
}
