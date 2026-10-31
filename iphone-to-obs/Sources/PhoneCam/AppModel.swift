#if os(iOS)
import AVFoundation
import Observation
import PortalKit
import UIKit

struct CameraOption: Identifiable, Hashable {
    let id: String
    let name: String
}

@MainActor
@Observable
final class AppModel {
    private(set) var settings = StreamSettings.load()
    private(set) var cameras: [CameraOption] = []
    private(set) var serverState: PortalServer.State = .stopped
    private(set) var activeFormat: StreamEngine.ActiveFormat?
    private(set) var megabitsPerSecond: Double = 0
    private(set) var permissionDenied = false

    let engine = StreamEngine()
    @ObservationIgnored private weak var previewLayer: AVCaptureVideoPreviewLayer?
    @ObservationIgnored private var device: AVCaptureDevice?
    @ObservationIgnored private var rotationCoordinator: AVCaptureDevice.RotationCoordinator?
    @ObservationIgnored private var rotationObservations: [NSKeyValueObservation] = []
    /// Last upright angle seen for each frame shape, used while the phone is held the other way.
    @ObservationIgnored private var lastAngles: [StreamOrientation: CGFloat] = [.landscape: 0, .portrait: 90]
    @ObservationIgnored private var statsTimer: Timer?
    @ObservationIgnored private var started = false

    var isConnected: Bool { serverState == .connected }

    func launch() async {
        guard !started else { return }
        let videoGranted = await AVCaptureDevice.requestAccess(for: .video)
        _ = await AVCaptureDevice.requestAccess(for: .audio)
        guard videoGranted else {
            permissionDenied = true
            return
        }
        started = true

        cameras = StreamEngine.availableCameras().map { CameraOption(id: $0.uniqueID, name: $0.localizedName) }
        engine.onServerStateChange = { [weak self] state in
            Task { @MainActor in self?.serverState = state }
        }
        applySettings()
        resume()
    }

    func resume() {
        guard started else { return }
        UIApplication.shared.isIdleTimerDisabled = true
        engine.start()
        statsTimer?.invalidate()
        statsTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            Task { @MainActor in
                guard let self else { return }
                self.megabitsPerSecond = Double(self.engine.server.takeSentBytes() * 8) / 1_000_000
            }
        }
    }

    func suspend() {
        guard started else { return }
        UIApplication.shared.isIdleTimerDisabled = false
        statsTimer?.invalidate()
        statsTimer = nil
        engine.stop()
    }

    func update(_ change: (inout StreamSettings) -> Void) {
        var next = settings
        change(&next)
        guard next != settings else { return }
        settings = next
        settings.save()
        applySettings()
    }

    func attach(previewLayer: AVCaptureVideoPreviewLayer) {
        self.previewLayer = previewLayer
        rebuildRotationCoordinator()
    }

    func focus(atLayerPoint point: CGPoint) {
        guard let previewLayer else { return }
        engine.focus(at: previewLayer.captureDevicePointConverted(fromLayerPoint: point))
    }

    private func applySettings() {
        engine.apply(settings) { [weak self] device, format in
            Task { @MainActor in
                guard let self else { return }
                self.activeFormat = format
                if self.device != device {
                    self.device = device
                    self.rebuildRotationCoordinator()
                } else {
                    self.reapplyRotation()
                }
            }
        }
    }

    /// Watches how the phone is physically held so the stream is never upside down.
    /// The UI itself stays portrait.
    private func rebuildRotationCoordinator() {
        rotationObservations = []
        rotationCoordinator = nil
        guard let device, let previewLayer else { return }

        let coordinator = AVCaptureDevice.RotationCoordinator(device: device, previewLayer: previewLayer)
        rotationCoordinator = coordinator
        rotationObservations = [
            coordinator.observe(\.videoRotationAngleForHorizonLevelPreview, options: [.initial, .new]) { [weak self] _, _ in
                Task { @MainActor in self?.reapplyPreviewRotation() }
            },
            coordinator.observe(\.videoRotationAngleForHorizonLevelCapture, options: [.initial, .new]) { [weak self] _, _ in
                Task { @MainActor in self?.reapplyCaptureRotation() }
            },
        ]
    }

    private func reapplyRotation() {
        reapplyPreviewRotation()
        reapplyCaptureRotation()
    }

    private func reapplyPreviewRotation() {
        guard let coordinator = rotationCoordinator,
              let connection = previewLayer?.connection else { return }
        let angle = coordinator.videoRotationAngleForHorizonLevelPreview
        if connection.isVideoRotationAngleSupported(angle) {
            connection.videoRotationAngle = angle
        }
    }

    /// The chosen orientation fixes the frame shape; the phone's physical orientation only
    /// picks which of its two angles is upright. Holding the phone the other way (e.g. upright
    /// while streaming landscape) keeps the last upright angle instead of changing shape.
    private func reapplyCaptureRotation() {
        let orientation = settings.orientation
        if let coordinator = rotationCoordinator {
            let measured = coordinator.videoRotationAngleForHorizonLevelCapture
            let normalized = (measured / 90).rounded() * 90
            let angle = normalized.truncatingRemainder(dividingBy: 360)
            if orientation.rotationAngles.contains(angle) {
                lastAngles[orientation] = angle
            }
        }
        engine.setRotationAngle(lastAngles[orientation] ?? orientation.rotationAngles[0])
    }
}
#endif
