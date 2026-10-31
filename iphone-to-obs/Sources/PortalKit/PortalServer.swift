import Dispatch
import Foundation

#if canImport(Darwin)
import Darwin
#elseif canImport(Glibc)
import Glibc
#endif

/// TCP server the OBS plugin connects to through usbmuxd.
///
/// Listens on 127.0.0.1 only: usbmuxd tunnels USB connections to the device's
/// loopback interface, so the camera is never exposed on Wi-Fi.
/// Holds at most one client; a new connection replaces the previous one
/// (the plugin reconnects with a fresh socket after errors).
public final class PortalServer: @unchecked Sendable {
    public enum State: Equatable, Sendable {
        case stopped
        case listening
        case connected
        case failed(String)
    }

    /// Called on an internal queue.
    public var onStateChange: (@Sendable (State) -> Void)?
    /// Called on an internal queue whenever a new client connects.
    public var onClientConnected: (@Sendable () -> Void)?

    private let port: UInt16
    /// Owns every fd and performs the (blocking) writes, so a socket is never
    /// closed while a write to it is in flight.
    private let queue = DispatchQueue(label: "portal.server", qos: .userInteractive)
    private var listenFD: Int32 = -1
    private var clientFD: Int32 = -1
    private var acceptSource: DispatchSourceRead?

    private let counterLock = NSLock()
    private var queuedBytes = 0
    private var sentBytes = 0

    public init(port: UInt16 = PortalFrame.port) {
        self.port = port
    }

    deinit {
        if clientFD >= 0 { close(clientFD) }
        acceptSource?.cancel()
    }

    /// Bytes handed to `send` that have not been written to the socket yet.
    public var pendingBytes: Int {
        counterLock.lock()
        defer { counterLock.unlock() }
        return queuedBytes
    }

    /// Total bytes written since the last call.
    public func takeSentBytes() -> Int {
        counterLock.lock()
        defer { counterLock.unlock() }
        let value = sentBytes
        sentBytes = 0
        return value
    }

    public func start() {
        queue.async { self.startListening() }
    }

    public func stop() {
        queue.async {
            self.closeClient()
            self.acceptSource?.cancel()
            self.acceptSource = nil
            self.listenFD = -1
            self.onStateChange?(.stopped)
        }
    }

    public func send(type: PortalFrame.PacketType, payload: [UInt8]) {
        let frame = PortalFrame.encode(type: type, payload: payload)
        adjustQueued(frame.count)
        queue.async {
            defer { self.adjustQueued(-frame.count) }
            guard self.clientFD >= 0 else { return }
            if self.writeAll(frame) {
                self.counterLock.lock()
                self.sentBytes += frame.count
                self.counterLock.unlock()
            } else {
                self.closeClient()
                self.onStateChange?(.listening)
            }
        }
    }

    // MARK: - Socket plumbing (on `queue`)

    private func startListening() {
        guard acceptSource == nil else { return }

        #if canImport(Darwin)
        let fd = socket(AF_INET, SOCK_STREAM, 0)
        #else
        let fd = socket(AF_INET, Int32(SOCK_STREAM.rawValue), 0)
        #endif
        guard fd >= 0 else { return fail("socket() failed: \(errno)") }

        var yes: Int32 = 1
        setsockopt(fd, SOL_SOCKET, SO_REUSEADDR, &yes, socklen_t(MemoryLayout<Int32>.size))

        var addr = sockaddr_in()
        #if canImport(Darwin)
        addr.sin_len = UInt8(MemoryLayout<sockaddr_in>.size)
        #endif
        addr.sin_family = sa_family_t(AF_INET)
        addr.sin_port = port.bigEndian
        addr.sin_addr.s_addr = UInt32(0x7F00_0001).bigEndian
        let bound = withUnsafePointer(to: &addr) {
            $0.withMemoryRebound(to: sockaddr.self, capacity: 1) {
                bind(fd, $0, socklen_t(MemoryLayout<sockaddr_in>.size))
            }
        }
        guard bound == 0 else {
            close(fd)
            return fail("bind() to port \(port) failed: \(errno)")
        }
        guard listen(fd, 4) == 0 else {
            close(fd)
            return fail("listen() failed: \(errno)")
        }
        _ = fcntl(fd, F_SETFL, fcntl(fd, F_GETFL) | O_NONBLOCK)

        listenFD = fd
        let source = DispatchSource.makeReadSource(fileDescriptor: fd, queue: queue)
        source.setEventHandler { [weak self] in self?.acceptClient() }
        source.setCancelHandler { close(fd) }
        source.resume()
        acceptSource = source
        onStateChange?(.listening)
    }

    private func acceptClient() {
        let fd = accept(listenFD, nil, nil)
        guard fd >= 0 else { return }

        // Accepted sockets inherit O_NONBLOCK on Darwin; writes here are blocking.
        _ = fcntl(fd, F_SETFL, fcntl(fd, F_GETFL) & ~O_NONBLOCK)
        var yes: Int32 = 1
        setsockopt(fd, Int32(IPPROTO_TCP), TCP_NODELAY, &yes, socklen_t(MemoryLayout<Int32>.size))
        #if canImport(Darwin)
        setsockopt(fd, SOL_SOCKET, SO_NOSIGPIPE, &yes, socklen_t(MemoryLayout<Int32>.size))
        #endif
        // A peer that stops reading must not wedge the encoder forever.
        var timeout = timeval(tv_sec: 2, tv_usec: 0)
        setsockopt(fd, SOL_SOCKET, SO_SNDTIMEO, &timeout, socklen_t(MemoryLayout<timeval>.size))

        closeClient()
        clientFD = fd
        onStateChange?(.connected)
        onClientConnected?()
    }

    private func closeClient() {
        guard clientFD >= 0 else { return }
        close(clientFD)
        clientFD = -1
    }

    private func writeAll(_ bytes: [UInt8]) -> Bool {
        return bytes.withUnsafeBytes { raw in
            var offset = 0
            while offset < raw.count {
                #if canImport(Darwin)
                let n = Darwin.send(clientFD, raw.baseAddress! + offset, raw.count - offset, 0)
                #else
                let n = Glibc.send(clientFD, raw.baseAddress! + offset, raw.count - offset, Int32(MSG_NOSIGNAL))
                #endif
                if n > 0 {
                    offset += n
                } else if n < 0 && errno == EINTR {
                    continue
                } else {
                    return false
                }
            }
            return true
        }
    }

    private func adjustQueued(_ delta: Int) {
        counterLock.lock()
        queuedBytes += delta
        counterLock.unlock()
    }

    private func fail(_ message: String) {
        onStateChange?(.failed(message))
    }
}
