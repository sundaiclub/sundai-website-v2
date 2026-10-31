/// Helpers to turn VideoToolbox / AudioToolbox output into the raw elementary
/// streams the plugin's FFmpeg decoders expect (they are opened without extradata).
public enum H264 {
    public static let startCode: [UInt8] = [0, 0, 0, 1]

    /// Converts length-prefixed (AVCC) NAL units into an Annex-B access unit,
    /// prefixed with the given parameter sets (SPS, PPS) when non-empty.
    public static func annexB(avcc: [UInt8], nalLengthSize: Int, parameterSets: [[UInt8]] = []) -> [UInt8] {
        var out = [UInt8]()
        out.reserveCapacity(avcc.count + parameterSets.reduce(0) { $0 + $1.count + 4 } + 16)
        for set in parameterSets {
            out.append(contentsOf: startCode)
            out.append(contentsOf: set)
        }
        var offset = 0
        while offset + nalLengthSize <= avcc.count {
            var length = 0
            for i in 0..<nalLengthSize {
                length = length << 8 | Int(avcc[offset + i])
            }
            offset += nalLengthSize
            guard length > 0, offset + length <= avcc.count else { break }
            out.append(contentsOf: startCode)
            out.append(contentsOf: avcc[offset..<(offset + length)])
            offset += length
        }
        return out
    }
}

public enum ADTS {
    public static let headerSize = 7

    private static let sampleRates = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350]

    public static func supports(sampleRate: Int) -> Bool {
        sampleRates.contains(sampleRate)
    }

    /// 7-byte ADTS header (MPEG-4, AAC-LC, no CRC) for one raw AAC frame.
    public static func header(payloadLength: Int, sampleRate: Int, channels: Int) -> [UInt8] {
        let frequencyIndex = sampleRates.firstIndex(of: sampleRate) ?? 3
        let profile = 1 // AAC-LC (object type 2) minus one
        let frameLength = payloadLength + headerSize
        return [
            0xFF,
            0xF1,
            UInt8(profile << 6 | frequencyIndex << 2 | (channels >> 2) & 0x1),
            UInt8((channels & 0x3) << 6 | (frameLength >> 11) & 0x3),
            UInt8((frameLength >> 3) & 0xFF),
            UInt8((frameLength & 0x7) << 5 | 0x1F),
            0xFC,
        ]
    }
}
