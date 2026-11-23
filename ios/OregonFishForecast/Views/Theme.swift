import SwiftUI
import UIKit

/// Colors from the website (brand-spec.md and v2/assets/site.css), each with a lighter dark-mode version.
enum Theme {
    /// Forest ink from the fish artwork, RGB (2, 57, 38). The app's accent color (Assets: AccentColor) matches it.
    static let ink = Color(light: 0x023926, dark: 0x9ED9BA)
    /// The site's warm paper background.
    static let paper = Color(light: 0xF7F4EA, dark: 0x0F1A15)
    static let river = Color(light: 0x1F6FBF, dark: 0x74B4F2)
    static let sun = Color(light: 0xB58500, dark: 0xF2CE4B)
    static let alert = Color(light: 0xB24F1E, dark: 0xF39A6B)

    /// Excellent, Good, Fair and Slow, from deep green to rust.
    static func scoreColor(_ label: String?) -> Color {
        switch label {
        case "Excellent": return Color(light: 0x0E6B45, dark: 0x4FD394)
        case "Good": return Color(light: 0x3A8840, dark: 0x93D47F)
        case "Fair": return Color(light: 0xA27000, dark: 0xF0C34E)
        case "Slow": return Color(light: 0xA8532C, dark: 0xF09A72)
        default: return .secondary
        }
    }

    /// The color for one score input's own reading (0 to 100), on the same scale as the score.
    static func valueColor(_ value: Int) -> Color {
        scoreColor(Score.label(for: value))
    }
}

extension Color {
    /// A color that switches with light and dark mode, from two hex values such as 0x023926.
    init(light: UInt32, dark: UInt32) {
        self.init(uiColor: UIColor { traits in
            let hex = traits.userInterfaceStyle == .dark ? dark : light
            return UIColor(
                red: CGFloat((hex >> 16) & 0xFF) / 255,
                green: CGFloat((hex >> 8) & 0xFF) / 255,
                blue: CGFloat(hex & 0xFF) / 255,
                alpha: 1
            )
        })
    }
}
