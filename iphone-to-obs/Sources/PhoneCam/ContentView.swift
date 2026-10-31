#if os(iOS)
import PortalKit
import SwiftUI

struct ContentView: View {
    let model: AppModel
    @State private var controlsHidden = false

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            if model.permissionDenied {
                PermissionMessage()
            } else {
                CameraPreview(model: model)
                    .ignoresSafeArea()

                VStack(spacing: 12) {
                    if !controlsHidden {
                        StatusBar(model: model)
                        if !model.isConnected {
                            ConnectHint(state: model.serverState)
                        }
                    }
                    Spacer()
                    if controlsHidden {
                        HStack {
                            Spacer()
                            IconButton(systemName: "eye", active: false) { controlsHidden = false }
                                .opacity(0.4)
                        }
                    } else {
                        ControlPanel(model: model, hide: { controlsHidden = true })
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
            }
        }
        .preferredColorScheme(.dark)
        .statusBarHidden()
    }
}

private struct StatusBar: View {
    let model: AppModel

    var body: some View {
        HStack(spacing: 10) {
            HStack(spacing: 6) {
                Circle()
                    .fill(model.isConnected ? Color.red : Color.orange)
                    .frame(width: 9, height: 9)
                Text(model.isConnected ? "LIVE IN OBS" : "WAITING")
                    .font(.caption.weight(.bold))
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(.ultraThinMaterial, in: Capsule())

            Spacer()

            if let format = model.activeFormat {
                Text("\(model.settings.resolution.rawValue) · \(format.frameRate) fps")
                    .font(.caption.monospacedDigit())
            }
            if model.isConnected {
                Text(String(format: "%.1f Mbps", model.megabitsPerSecond))
                    .font(.caption.monospacedDigit())
            }
        }
        .foregroundStyle(.white)
    }
}

private struct ConnectHint: View {
    let state: PortalServer.State

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            if case .failed(let message) = state {
                Text("USB server error").font(.subheadline.weight(.semibold))
                Text(message).font(.caption)
            } else {
                Text("Plug this phone into your computer").font(.subheadline.weight(.semibold))
                Text("In OBS, add an “iOS Camera” source and pick this device. The stream starts automatically.")
                    .font(.caption)
            }
        }
        .foregroundStyle(.white)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
    }
}

private struct ControlPanel: View {
    let model: AppModel
    let hide: () -> Void

    var body: some View {
        VStack(spacing: 12) {
            HStack(spacing: 8) {
                OptionMenu(
                    title: currentCameraName,
                    options: model.cameras,
                    label: \.name
                ) { camera in model.update { $0.cameraID = camera.id } }

                OptionMenu(
                    title: model.settings.orientation.rawValue,
                    options: StreamOrientation.allCases,
                    label: \.rawValue
                ) { value in model.update { $0.orientation = value } }

                Spacer(minLength: 0)
            }

            HStack(spacing: 8) {
                OptionMenu(
                    title: model.settings.resolution.rawValue,
                    options: StreamResolution.allCases,
                    label: \.rawValue
                ) { value in model.update { $0.resolution = value } }

                OptionMenu(
                    title: "\(model.settings.frameRate) fps",
                    options: StreamSettings.frameRates,
                    label: { "\($0) fps" }
                ) { value in model.update { $0.frameRate = value } }

                OptionMenu(
                    title: "\(model.settings.bitrateMbps) Mbps",
                    options: StreamSettings.bitratesMbps,
                    label: { "\($0) Mbps" }
                ) { value in model.update { $0.bitrateMbps = value } }

                Spacer(minLength: 0)
            }

            HStack(spacing: 10) {
                IconButton(
                    systemName: model.settings.audioEnabled ? "mic.fill" : "mic.slash",
                    active: model.settings.audioEnabled
                ) { model.update { $0.audioEnabled.toggle() } }

                IconButton(
                    systemName: "arrow.left.and.right.righttriangle.left.righttriangle.right",
                    active: model.settings.mirrored
                ) { model.update { $0.mirrored.toggle() } }

                Spacer()

                IconButton(systemName: "eye.slash", active: false, action: hide)
            }
        }
        .tint(.white)
        .padding(14)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 18))
    }

    private var currentCameraName: String {
        model.cameras.first { $0.id == model.settings.cameraID }?.name ?? "Back Camera"
    }
}

private struct OptionMenu<Option: Hashable>: View {
    let title: String
    let options: [Option]
    let label: (Option) -> String
    let select: (Option) -> Void

    var body: some View {
        Menu {
            ForEach(options, id: \.self) { option in
                Button(label(option)) { select(option) }
            }
        } label: {
            Text(title)
                .font(.subheadline.weight(.semibold).monospacedDigit())
                .foregroundStyle(.white)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(Color.white.opacity(0.15), in: Capsule())
        }
    }
}

private struct IconButton: View {
    let systemName: String
    let active: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: 17, weight: .semibold))
                .frame(width: 44, height: 44)
                .foregroundStyle(active ? Color.black : Color.white)
                .background(active ? Color.white : Color.white.opacity(0.15), in: Circle())
        }
    }
}

private struct PermissionMessage: View {
    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "camera.fill").font(.largeTitle)
            Text("Camera access is off").font(.headline)
            Text("Enable it in Settings → PhoneCam to stream to OBS.")
                .font(.subheadline)
                .multilineTextAlignment(.center)
            Button("Open Settings") {
                if let url = URL(string: UIApplication.openSettingsURLString) {
                    UIApplication.shared.open(url)
                }
            }
            .buttonStyle(.borderedProminent)
        }
        .foregroundStyle(.white)
        .padding(32)
    }
}
#endif
