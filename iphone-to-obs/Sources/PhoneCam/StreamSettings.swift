#if os(iOS)
import Foundation

enum StreamResolution: String, CaseIterable, Codable, Identifiable {
    case hd720 = "720p"
    case hd1080 = "1080p"
    case uhd4K = "4K"

    var id: String { rawValue }

    /// Landscape sensor dimensions; rotation to portrait happens on the capture connection.
    var dimensions: (width: Int32, height: Int32) {
        switch self {
        case .hd720: (1280, 720)
        case .hd1080: (1920, 1080)
        case .uhd4K: (3840, 2160)
        }
    }
}

enum StreamOrientation: String, CaseIterable, Codable, Identifiable {
    case landscape = "Landscape"
    case portrait = "Portrait"

    var id: String { rawValue }

    /// Capture-connection rotation angles that produce this frame shape.
    var rotationAngles: [CGFloat] {
        switch self {
        case .landscape: [0, 180]
        case .portrait: [90, 270]
        }
    }
}

struct StreamSettings: Codable, Equatable {
    static let frameRates = [24, 30, 60]
    static let bitratesMbps = [4, 8, 12, 20, 35, 50]

    /// `AVCaptureDevice.uniqueID`; nil picks the default back camera.
    var cameraID: String?
    var resolution: StreamResolution = .hd1080
    var frameRate = 30
    var bitrateMbps = 12
    var audioEnabled = true
    var mirrored = false
    var orientation: StreamOrientation = .landscape

    private static let defaultsKey = "streamSettings"

    static func load() -> StreamSettings {
        guard let data = UserDefaults.standard.data(forKey: defaultsKey),
              let settings = try? JSONDecoder().decode(StreamSettings.self, from: data) else {
            return StreamSettings()
        }
        return settings
    }

    func save() {
        if let data = try? JSONEncoder().encode(self) {
            UserDefaults.standard.set(data, forKey: Self.defaultsKey)
        }
    }
}
#endif
