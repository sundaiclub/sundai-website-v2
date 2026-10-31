import Foundation
import XCTest
@testable import PortalKit

#if canImport(Darwin)
import Darwin
#elseif canImport(Glibc)
import Glibc
#endif

final class PortalFrameTests: XCTestCase {
    func testHeaderIsBigEndian() {
        let frame = PortalFrame.encode(type: .video, tag: 7, payload: [0xAA, 0xBB])
        XCTAssertEqual(frame, [0, 0, 0, 1, 0, 0, 0, 101, 0, 0, 0, 7, 0, 0, 0, 2, 0xAA, 0xBB])
    }

    func testDecoderHandlesSplitAndCoalescedFrames() {
        let a = PortalFrame.encode(type: .video, payload: Array(repeating: 1, count: 100))
        let b = PortalFrame.encode(type: .audio, payload: [9, 8, 7])
        let stream = a + b
        var decoder = PortalFrame.Decoder()
        XCTAssertEqual(decoder.feed(Array(stream[0..<10])), [])
        let packets = decoder.feed(Array(stream[10...]))
        XCTAssertEqual(packets.map(\.type), [101, 102])
        XCTAssertEqual(packets[1].payload, [9, 8, 7])
    }
}

final class BitstreamTests: XCTestCase {
    func testAnnexBConversionWithParameterSets() {
        let avcc: [UInt8] = [0, 0, 0, 2, 0x65, 0x01, 0, 0, 0, 1, 0x06]
        let out = H264.annexB(avcc: avcc, nalLengthSize: 4, parameterSets: [[0x67, 0x42], [0x68]])
        XCTAssertEqual(out, [0, 0, 0, 1, 0x67, 0x42, 0, 0, 0, 1, 0x68, 0, 0, 0, 1, 0x65, 0x01, 0, 0, 0, 1, 0x06])
    }

    func testADTSHeader() {
        // 48 kHz mono, 200-byte payload -> frame length 207.
        let header = ADTS.header(payloadLength: 200, sampleRate: 48000, channels: 1)
        XCTAssertEqual(header, [0xFF, 0xF1, 0x4C, 0x40, 0x19, 0xFF, 0xFC])
        let frameLength = (Int(header[3]) & 0x3) << 11 | Int(header[4]) << 3 | Int(header[5]) >> 5
        XCTAssertEqual(frameLength, 207)
    }
}

final class PortalServerTests: XCTestCase {
    func testClientReceivesFramesSentAfterConnecting() throws {
        let port: UInt16 = 23450
        let server = PortalServer(port: port)
        let connected = expectation(description: "connected")
        server.onClientConnected = { connected.fulfill() }
        server.start()

        let fd = try connectWithRetry(port: port)
        defer { close(fd) }
        wait(for: [connected], timeout: 2)

        server.send(type: .video, payload: [1, 2, 3])
        server.send(type: .audio, payload: Array(repeating: 5, count: 5000))

        var decoder = PortalFrame.Decoder()
        var packets: [PortalFrame.Packet] = []
        var buf = [UInt8](repeating: 0, count: 4096)
        while packets.count < 2 {
            let n = recv(fd, &buf, buf.count, 0)
            XCTAssertGreaterThan(n, 0)
            if n <= 0 { break }
            packets += decoder.feed(Array(buf[0..<n]))
        }
        XCTAssertEqual(packets.map(\.type), [101, 102])
        XCTAssertEqual(packets[0].payload, [1, 2, 3])
        XCTAssertEqual(packets[1].payload.count, 5000)
        server.stop()
    }

    private func connectWithRetry(port: UInt16) throws -> Int32 {
        for _ in 0..<50 {
            #if canImport(Darwin)
            let fd = socket(AF_INET, SOCK_STREAM, 0)
            #else
            let fd = socket(AF_INET, Int32(SOCK_STREAM.rawValue), 0)
            #endif
            var addr = sockaddr_in()
            addr.sin_family = sa_family_t(AF_INET)
            addr.sin_port = port.bigEndian
            addr.sin_addr.s_addr = UInt32(0x7F00_0001).bigEndian
            let result = withUnsafePointer(to: &addr) {
                $0.withMemoryRebound(to: sockaddr.self, capacity: 1) {
                    connect(fd, $0, socklen_t(MemoryLayout<sockaddr_in>.size))
                }
            }
            if result == 0 { return fd }
            close(fd)
            usleep(20_000)
        }
        throw NSError(domain: "connect", code: 1)
    }
}
