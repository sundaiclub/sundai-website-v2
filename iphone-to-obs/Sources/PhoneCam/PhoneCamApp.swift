#if os(iOS)
import SwiftUI

@main
struct PhoneCamApp: App {
    @State private var model = AppModel()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            ContentView(model: model)
                .task { await model.launch() }
                .onChange(of: scenePhase) { _, phase in
                    switch phase {
                    case .active: model.resume()
                    case .background: model.suspend()
                    default: break
                    }
                }
        }
    }
}
#endif
