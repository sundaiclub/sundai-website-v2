#if os(iOS)
import CoreMedia
import Foundation
import PortalKit
import VideoToolbox

/// Hardware H.264 encoder producing Annex-B access units for the plugin's FFmpeg decoder.
/// `encode` must be called from a single queue.
final class VideoEncoder: @unchecked Sendable {
    /// Called on a VideoToolbox thread with an Annex-B access unit.
    var onEncoded: ((_ annexB: [UInt8], _ isKeyFrame: Bool) -> Void)?

    private var session: VTCompressionSession?
    private var width: Int32 = 0
    private var height: Int32 = 0

    private let lock = NSLock()
    private var forceKeyFrame = true
    private var bitrate = 10_000_000
    private var frameRate = 30
    private var needsRebuild = false

    func configure(bitrate: Int, frameRate: Int) {
        lock.lock()
        self.bitrate = bitrate
        self.frameRate = frameRate
        needsRebuild = true
        lock.unlock()
    }

    func requestKeyFrame() {
        lock.lock()
        forceKeyFrame = true
        lock.unlock()
    }

    func encode(_ sampleBuffer: CMSampleBuffer) {
        guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
        let w = Int32(CVPixelBufferGetWidth(pixelBuffer))
        let h = Int32(CVPixelBufferGetHeight(pixelBuffer))

        lock.lock()
        let rebuild = needsRebuild || session == nil || w != width || h != height
        needsRebuild = false
        let bitrate = self.bitrate
        let frameRate = self.frameRate
        lock.unlock()

        if rebuild {
            invalidate()
            guard let created = makeSession(width: w, height: h, bitrate: bitrate, frameRate: frameRate) else { return }
            session = created
            width = w
            height = h
            requestKeyFrame()
        }
        guard let session else { return }

        lock.lock()
        let keyFrame = forceKeyFrame
        forceKeyFrame = false
        lock.unlock()

        let properties = keyFrame ? [kVTEncodeFrameOptionKey_ForceKeyFrame as String: true] as CFDictionary : nil
        VTCompressionSessionEncodeFrame(
            session,
            imageBuffer: pixelBuffer,
            presentationTimeStamp: CMSampleBufferGetPresentationTimeStamp(sampleBuffer),
            duration: CMSampleBufferGetDuration(sampleBuffer),
            frameProperties: properties,
            infoFlagsOut: nil
        ) { [weak self] status, _, encoded in
            guard status == noErr, let encoded, let self else { return }
            self.handle(encoded)
        }
    }

    func invalidate() {
        guard let session else { return }
        VTCompressionSessionCompleteFrames(session, untilPresentationTimeStamp: .invalid)
        VTCompressionSessionInvalidate(session)
        self.session = nil
    }

    private func makeSession(width: Int32, height: Int32, bitrate: Int, frameRate: Int) -> VTCompressionSession? {
        var created: VTCompressionSession?
        let status = VTCompressionSessionCreate(
            allocator: nil,
            width: width,
            height: height,
            codecType: kCMVideoCodecType_H264,
            encoderSpecification: nil,
            imageBufferAttributes: nil,
            compressedDataAllocator: nil,
            outputCallback: nil,
            refcon: nil,
            compressionSessionOut: &created
        )
        guard status == noErr, let created else { return nil }

        let properties: [CFString: Any] = [
            kVTCompressionPropertyKey_RealTime: true,
            kVTCompressionPropertyKey_ProfileLevel: kVTProfileLevel_H264_High_AutoLevel,
            // No B-frames: the plugin decodes in arrival order with no PTS.
            kVTCompressionPropertyKey_AllowFrameReordering: false,
            kVTCompressionPropertyKey_ExpectedFrameRate: frameRate as CFNumber,
            kVTCompressionPropertyKey_MaxKeyFrameInterval: (frameRate * 2) as CFNumber,
            kVTCompressionPropertyKey_MaxKeyFrameIntervalDuration: 2 as CFNumber,
            kVTCompressionPropertyKey_AverageBitRate: bitrate as CFNumber,
            kVTCompressionPropertyKey_DataRateLimits: [(bitrate / 8) * 3 / 2, 1] as CFArray,
        ]
        for (key, value) in properties {
            VTSessionSetProperty(created, key: key, value: value as CFTypeRef)
        }
        VTCompressionSessionPrepareToEncodeFrames(created)
        return created
    }

    private func handle(_ sampleBuffer: CMSampleBuffer) {
        guard let dataBuffer = CMSampleBufferGetDataBuffer(sampleBuffer),
              let format = CMSampleBufferGetFormatDescription(sampleBuffer) else { return }

        let attachments = CMSampleBufferGetSampleAttachmentsArray(sampleBuffer, createIfNecessary: false) as? [[String: Any]]
        let notSync = attachments?.first?[kCMSampleAttachmentKey_NotSync as String] as? Bool ?? false
        let isKeyFrame = !notSync

        var parameterSetCount = 0
        var nalLengthSize: Int32 = 4
        CMVideoFormatDescriptionGetH264ParameterSetAtIndex(
            format,
            parameterSetIndex: 0,
            parameterSetPointerOut: nil,
            parameterSetSizeOut: nil,
            parameterSetCountOut: &parameterSetCount,
            nalUnitHeaderLengthOut: &nalLengthSize
        )

        var parameterSets: [[UInt8]] = []
        if isKeyFrame {
            for index in 0..<parameterSetCount {
                var pointer: UnsafePointer<UInt8>?
                var size = 0
                let status = CMVideoFormatDescriptionGetH264ParameterSetAtIndex(
                    format,
                    parameterSetIndex: index,
                    parameterSetPointerOut: &pointer,
                    parameterSetSizeOut: &size,
                    parameterSetCountOut: nil,
                    nalUnitHeaderLengthOut: nil
                )
                if status == noErr, let pointer {
                    parameterSets.append(Array(UnsafeBufferPointer(start: pointer, count: size)))
                }
            }
        }

        let length = CMBlockBufferGetDataLength(dataBuffer)
        var avcc = [UInt8](repeating: 0, count: length)
        guard CMBlockBufferCopyDataBytes(dataBuffer, atOffset: 0, dataLength: length, destination: &avcc) == noErr else { return }

        let annexB = H264.annexB(avcc: avcc, nalLengthSize: Int(nalLengthSize), parameterSets: parameterSets)
        onEncoded?(annexB, isKeyFrame)
    }
}
#endif
