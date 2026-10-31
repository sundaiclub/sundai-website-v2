#if os(iOS)
import AVFoundation
import PortalKit

/// Converts microphone PCM into ADTS-framed AAC-LC, one AAC frame per callback.
/// `encode` must be called from a single queue.
final class AudioEncoder {
    var onPacket: ((_ adtsFrame: [UInt8]) -> Void)?

    private var converter: AVAudioConverter?
    private var inputFormat: AVAudioFormat?
    private var outputFormat: AVAudioFormat?

    func encode(_ sampleBuffer: CMSampleBuffer) {
        guard let description = CMSampleBufferGetFormatDescription(sampleBuffer) else { return }
        let format = AVAudioFormat(cmAudioFormatDescription: description)
        if converter == nil || inputFormat != format {
            setUp(for: format)
        }
        guard let converter, let outputFormat else { return }

        let frameCount = AVAudioFrameCount(CMSampleBufferGetNumSamples(sampleBuffer))
        guard frameCount > 0, let pcm = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frameCount) else { return }
        pcm.frameLength = frameCount
        let copyStatus = CMSampleBufferCopyPCMDataIntoAudioBufferList(
            sampleBuffer,
            at: 0,
            frameCount: Int32(frameCount),
            into: pcm.mutableAudioBufferList
        )
        guard copyStatus == noErr else { return }

        let sampleRate = Int(outputFormat.sampleRate)
        let channels = Int(outputFormat.channelCount)
        var supplied = false
        while true {
            let output = AVAudioCompressedBuffer(
                format: outputFormat,
                packetCapacity: 8,
                maximumPacketSize: converter.maximumOutputPacketSize
            )
            var error: NSError?
            let status = converter.convert(to: output, error: &error) { _, inputStatus in
                if supplied {
                    inputStatus.pointee = .noDataNow
                    return nil
                }
                supplied = true
                inputStatus.pointee = .haveData
                return pcm
            }
            emitPackets(from: output, sampleRate: sampleRate, channels: channels)
            if status != .haveData || output.packetCount == 0 { break }
        }
    }

    private func setUp(for format: AVAudioFormat) {
        let channels = min(format.channelCount, 2)
        let sampleRate = ADTS.supports(sampleRate: Int(format.sampleRate)) ? format.sampleRate : 48000
        let settings: [String: Any] = [
            AVFormatIDKey: kAudioFormatMPEG4AAC,
            AVSampleRateKey: sampleRate,
            AVNumberOfChannelsKey: channels,
        ]
        guard let aac = AVAudioFormat(settings: settings),
              let converter = AVAudioConverter(from: format, to: aac) else {
            self.converter = nil
            return
        }
        self.inputFormat = format
        self.outputFormat = aac
        self.converter = converter
    }

    private func emitPackets(from buffer: AVAudioCompressedBuffer, sampleRate: Int, channels: Int) {
        guard let descriptions = buffer.packetDescriptions else { return }
        let base = buffer.data.assumingMemoryBound(to: UInt8.self)
        for index in 0..<Int(buffer.packetCount) {
            let description = descriptions[index]
            let size = Int(description.mDataByteSize)
            guard size > 0 else { continue }
            let payload = UnsafeBufferPointer(start: base + Int(description.mStartOffset), count: size)
            var frame = ADTS.header(payloadLength: size, sampleRate: sampleRate, channels: channels)
            frame.append(contentsOf: payload)
            onPacket?(frame)
        }
    }
}
#endif
