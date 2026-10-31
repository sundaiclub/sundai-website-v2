"""Test receiver for PhoneCam without OBS.

Speaks the same protocol as the obs-ios-camera-source plugin: reads 16-byte
big-endian frame headers (version, type, tag, payload size) and splits the
stream into raw H.264 (type 101) and ADTS AAC (type 102).

Forward the phone's port over USB first, then run this:

    iproxy 2345 2345
    uv run tools/receive.py            # writes capture.h264 / capture.aac
    ffplay -f h264 capture.h264
"""

import argparse
import socket
import struct
import time

HEADER = struct.Struct(">IIII")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=2345)
    parser.add_argument("--seconds", type=float, default=10)
    parser.add_argument("--out", default="capture")
    args = parser.parse_args()

    sock = socket.create_connection((args.host, args.port))
    buffer = b""
    counts = {101: 0, 102: 0}
    keyframes = 0
    deadline = time.monotonic() + args.seconds

    with open(f"{args.out}.h264", "wb") as video, open(f"{args.out}.aac", "wb") as audio:
        while time.monotonic() < deadline:
            chunk = sock.recv(1 << 16)
            if not chunk:
                break
            buffer += chunk
            while len(buffer) >= HEADER.size:
                _version, kind, _tag, size = HEADER.unpack_from(buffer)
                if len(buffer) < HEADER.size + size:
                    break
                payload = buffer[HEADER.size : HEADER.size + size]
                buffer = buffer[HEADER.size + size :]
                counts[kind] = counts.get(kind, 0) + 1
                if kind == 101:
                    video.write(payload)
                    # SPS (NAL type 7) is sent in-band ahead of every key frame.
                    if payload[4] & 0x1F == 7:
                        keyframes += 1
                elif kind == 102:
                    audio.write(payload)

    print(f"video frames: {counts[101]} ({keyframes} key frames), audio frames: {counts[102]}")
    print(f"wrote {args.out}.h264 and {args.out}.aac")


if __name__ == "__main__":
    main()
