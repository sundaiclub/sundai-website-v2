#if os(iOS)
import AVFoundation
import PortalKit

/// Owns the capture session, the encoders and the USB server, and moves
/// encoded media from one to the other.
final class StreamEngine: NSObject, @unchecked Sendable {
    struct ActiveFormat: Sendable {
        var width: Int32
        var height: Int32
        var frameRate: Int
    }

    let session = AVCaptureSession()
    let server = PortalServer()

    /// Called on an internal queue.
    var onServerStateChange: (@Sendable (PortalServer.State) -> Void)?

    private let sessionQueue = DispatchQueue(label: "engine.session")
    private let videoQueue = DispatchQueue(label: "engine.video", qos: .userInteractive)
    private let audioQueue = DispatchQueue(label: "engine.audio", qos: .userInteractive)
    private let videoOutput = AVCaptureVideoDataOutput()
    private let audioOutput = AVCaptureAudioDataOutput()
    private let videoEncoder = VideoEncoder()
    private let audioEncoder = AudioEncoder()
    private var videoInput: AVCaptureDeviceInput?
    private var audioInput: AVCaptureDeviceInput?
    private var rotationAngle: CGFloat = 0
    private var mirrored = false

    /// Above this backlog, P-frames are dropped until the next key frame.
    private let maxPendingBytes = 4 * 1024 * 1024
    private let streamLock = NSLock()
    private var clientConnected = false
    private var waitingForKeyFrame = false

    override init() {
        super.init()

        server.onStateChange = { [weak self] state in
            guard let self else { return }
            self.streamLock.lock()
            self.clientConnected = state == .connected
            self.streamLock.unlock()
            self.onServerStateChange?(state)
        }
        server.onClientConnected = { [weak self] in
            self?.videoEncoder.requestKeyFrame()
        }
        videoEncoder.onEncoded = { [weak self] annexB, isKeyFrame in
            self?.sendVideo(annexB, isKeyFrame: isKeyFrame)
        }
        audioEncoder.onPacket = { [weak self] frame in
            self?.server.send(type: .audio, payload: frame)
        }

        videoOutput.alwaysDiscardsLateVideoFrames = true
        videoOutput.videoSettings = [
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange,
        ]
        videoOutput.setSampleBufferDelegate(self, queue: videoQueue)
        audioOutput.setSampleBufferDelegate(self, queue: audioQueue)
    }

    static func availableCameras() -> [AVCaptureDevice] {
        AVCaptureDevice.DiscoverySession(
            deviceTypes: [.builtInWideAngleCamera, .builtInUltraWideCamera, .builtInTelephotoCamera],
            mediaType: .video,
            position: .unspecified
        ).devices
    }

    func start() {
        server.start()
        sessionQueue.async {
            if !self.session.isRunning { self.session.startRunning() }
        }
    }

    func stop() {
        server.stop()
        sessionQueue.async {
            if self.session.isRunning { self.session.stopRunning() }
        }
    }

    /// Reconfigures capture for `settings`; `completion` receives the active camera and format.
    func apply(_ settings: StreamSettings, completion: @escaping @Sendable (AVCaptureDevice?, ActiveFormat?) -> Void) {
        sessionQueue.async {
            let result = self.configure(settings)
            completion(result.device, result.format)
        }
    }

    func setRotationAngle(_ angle: CGFloat) {
        sessionQueue.async {
            self.rotationAngle = angle
            self.applyConnectionSettings()
        }
    }

    /// `point` is in capture-device coordinates (0...1, landscape).
    func focus(at point: CGPoint) {
        sessionQueue.async {
            guard let device = self.videoInput?.device, (try? device.lockForConfiguration()) != nil else { return }
            if device.isFocusPointOfInterestSupported {
                device.focusPointOfInterest = point
                device.focusMode = .autoFocus
            }
            if device.isExposurePointOfInterestSupported {
                device.exposurePointOfInterest = point
                device.exposureMode = .continuousAutoExposure
            }
            device.isSubjectAreaChangeMonitoringEnabled = true
            device.unlockForConfiguration()
        }
    }

    // MARK: - Configuration (on sessionQueue)

    private func configure(_ settings: StreamSettings) -> (device: AVCaptureDevice?, format: ActiveFormat?) {
        let cameras = Self.availableCameras()
        guard let device = cameras.first(where: { $0.uniqueID == settings.cameraID })
            ?? AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back)
            ?? cameras.first else {
            return (nil, nil)
        }

        session.beginConfiguration()
        defer { session.commitConfiguration() }
        session.sessionPreset = .inputPriority

        if videoInput?.device != device {
            if let videoInput { session.removeInput(videoInput) }
            videoInput = nil
            if let input = try? AVCaptureDeviceInput(device: device), session.canAddInput(input) {
                session.addInput(input)
                videoInput = input
            }
        }

        if settings.audioEnabled, audioInput == nil,
           let mic = AVCaptureDevice.default(for: .audio),
           let input = try? AVCaptureDeviceInput(device: mic),
           session.canAddInput(input) {
            session.addInput(input)
            audioInput = input
        } else if !settings.audioEnabled, let audioInput {
            session.removeInput(audioInput)
            self.audioInput = nil
        }

        if !session.outputs.contains(videoOutput), session.canAddOutput(videoOutput) {
            session.addOutput(videoOutput)
        }
        if !session.outputs.contains(audioOutput), session.canAddOutput(audioOutput) {
            session.addOutput(audioOutput)
        }

        let format = selectFormat(on: device, resolution: settings.resolution, frameRate: settings.frameRate)
        mirrored = settings.mirrored
        applyConnectionSettings()

        let bitrate = settings.bitrateMbps * 1_000_000
        videoEncoder.configure(bitrate: bitrate, frameRate: format?.frameRate ?? settings.frameRate)
        return (device, format)
    }

    private func selectFormat(on device: AVCaptureDevice, resolution: StreamResolution, frameRate: Int) -> ActiveFormat? {
        let target = resolution.dimensions
        func candidates(fps: Int) -> [AVCaptureDevice.Format] {
            device.formats.filter { format in
                let dims = CMVideoFormatDescriptionGetDimensions(format.formatDescription)
                return dims.width == target.width && dims.height == target.height
                    && format.videoSupportedFrameRateRanges.contains { $0.maxFrameRate >= Double(fps) }
            }
        }

        var fps = frameRate
        var matches = candidates(fps: fps)
        if matches.isEmpty {
            fps = 30
            matches = candidates(fps: fps)
        }
        let videoRange = kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange
        guard let format = matches.first(where: { CMFormatDescriptionGetMediaSubType($0.formatDescription) == videoRange })
            ?? matches.first,
            (try? device.lockForConfiguration()) != nil else {
            return nil
        }
        device.activeFormat = format
        let duration = CMTime(value: 1, timescale: CMTimeScale(fps))
        device.activeVideoMinFrameDuration = duration
        device.activeVideoMaxFrameDuration = duration
        if device.isFocusModeSupported(.continuousAutoFocus) {
            device.focusMode = .continuousAutoFocus
        }
        device.unlockForConfiguration()
        return ActiveFormat(width: target.width, height: target.height, frameRate: fps)
    }

    private func applyConnectionSettings() {
        guard let connection = videoOutput.connection(with: .video) else { return }
        if connection.isVideoRotationAngleSupported(rotationAngle) {
            connection.videoRotationAngle = rotationAngle
        }
        if connection.isVideoMirroringSupported {
            connection.automaticallyAdjustsVideoMirroring = false
            connection.isVideoMirrored = mirrored
        }
    }

    // MARK: - Streaming

    private var isClientConnected: Bool {
        streamLock.lock()
        defer { streamLock.unlock() }
        return clientConnected
    }

    private func sendVideo(_ annexB: [UInt8], isKeyFrame: Bool) {
        streamLock.lock()
        defer { streamLock.unlock() }
        if isKeyFrame {
            waitingForKeyFrame = false
        } else if waitingForKeyFrame {
            return
        }
        if server.pendingBytes > maxPendingBytes {
            waitingForKeyFrame = true
            videoEncoder.requestKeyFrame()
            return
        }
        server.send(type: .video, payload: annexB)
    }
}

extension StreamEngine: AVCaptureVideoDataOutputSampleBufferDelegate, AVCaptureAudioDataOutputSampleBufferDelegate {
    func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        // Nothing is listening: skip encoding to save battery and heat.
        guard isClientConnected else { return }
        if output === videoOutput {
            videoEncoder.encode(sampleBuffer)
        } else if output === audioOutput {
            audioEncoder.encode(sampleBuffer)
        }
    }
}
#endif
