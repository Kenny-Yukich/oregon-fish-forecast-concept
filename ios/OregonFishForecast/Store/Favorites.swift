import Foundation
import Observation

/// The waters someone saved ("Your waters" on the Forecast tab), kept on this device.
@MainActor
@Observable
final class Favorites {
    private static let key = "savedWaters"
    private(set) var ids: Set<String>

    init() {
        ids = Set(UserDefaults.standard.stringArray(forKey: Self.key) ?? [])
    }

    func contains(_ id: String) -> Bool {
        ids.contains(id)
    }

    func toggle(_ id: String) {
        if ids.contains(id) { ids.remove(id) } else { ids.insert(id) }
        UserDefaults.standard.set(ids.sorted(), forKey: Self.key)
    }
}
