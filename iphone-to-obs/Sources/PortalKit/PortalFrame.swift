/// Wire format spoken by the obs-ios-camera-source plugin
/// (https://github.com/wtsnz/obs-ios-camera-source, `deps/portal/src/Protocol.cpp`).
///
/// The plugin connects through usbmuxd to TCP port 2345 on the phone and reads a
/// stream of frames. Each frame is a 16-byte header of four big-endian UInt32s
/// (version, type, tag, payloadSize) followed by `payloadSize` bytes.
/// The plugin never writes to the socket.
public enum PortalFrame {
    public static let port: UInt16 = 2345
    public static let headerSize = 16
    public static let version: UInt32 = 1

    public enum PacketType: UInt32, Sendable {
        /// H.264 Annex-B access unit (SPS/PPS in-band before every IDR frame).
        case video = 101
        /// One AAC-LC frame with an ADTS header.
        case audio = 102
    }

    public struct Packet: Equatable, Sendable {
        public var version: UInt32
        public var type: UInt32
        public var tag: UInt32
        public var payload: [UInt8]
    }

    public static func encode(type: PacketType, tag: UInt32 = 0, payload: [UInt8]) -> [UInt8] {
        var out = [UInt8]()
        out.reserveCapacity(headerSize + payload.count)
        for value in [version, type.rawValue, tag, UInt32(payload.count)] {
            out.append(UInt8(truncatingIfNeeded: value >> 24))
            out.append(UInt8(truncatingIfNeeded: value >> 16))
            out.append(UInt8(truncatingIfNeeded: value >> 8))
            out.append(UInt8(truncatingIfNeeded: value))
        }
        out.append(contentsOf: payload)
        return out
    }

    /// Incremental decoder mirroring the plugin's `SimpleDataPacketProtocol`.
    public struct Decoder {
        private var buffer: [UInt8] = []

        public init() {}

        public mutating func feed(_ bytes: [UInt8]) -> [Packet] {
            buffer.append(contentsOf: bytes)
            var packets: [Packet] = []
            var offset = 0
            while buffer.count - offset >= headerSize {
                let fields = (0..<4).map { readUInt32(at: offset + $0 * 4) }
                let end = offset + headerSize + Int(fields[3])
                guard end <= buffer.count else { break }
                packets.append(Packet(
                    version: fields[0],
                    type: fields[1],
                    tag: fields[2],
                    payload: Array(buffer[(offset + headerSize)..<end])
                ))
                offset = end
            }
            buffer.removeFirst(offset)
            return packets
        }

        private func readUInt32(at i: Int) -> UInt32 {
            UInt32(buffer[i]) << 24 | UInt32(buffer[i + 1]) << 16 | UInt32(buffer[i + 2]) << 8 | UInt32(buffer[i + 3])
        }
    }
}
