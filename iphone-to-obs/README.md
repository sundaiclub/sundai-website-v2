# PhoneCam

An iPhone app that streams the camera and mic to OBS Studio over USB. It works with
the open-source **iOS Camera for OBS Studio** plugin
([wtsnz/obs-ios-camera-source](https://github.com/wtsnz/obs-ios-camera-source)), so it
can stand in for the paid "Camera for OBS Studio" app. There's no watermark.

The app is built and installed from Linux with [xtool](https://github.com/xtool-org/xtool),
so you don't need a Mac or Xcode.

## How it talks to OBS

This is the protocol from the plugin source (`src/obs-ios-camera-source.cpp`,
`deps/portal/src/Protocol.cpp`):

- The phone listens on TCP port **2345** on `127.0.0.1` (`Sources/PortalKit/PortalServer.swift`).
  The plugin finds the phone through **usbmuxd** and connects to that port over the cable.
  Because the app binds to loopback only, the camera isn't reachable over Wi-Fi.
- Each message has a 16-byte header made of four big-endian `UInt32` values
  (`version`, `type`, `tag`, `payloadSize`), followed by the payload.
- Type `101` carries video: H.264 Annex-B access units with SPS/PPS before every key frame
  and no B-frames. The plugin opens FFmpeg with no extradata, so the stream has to carry
  everything it needs.
- Type `102` carries audio: one ADTS-framed AAC-LC frame per message.
- The plugin never sends anything back to the phone.

## Layout

| Path | What it does |
|---|---|
| `Sources/PortalKit/` | Wire format, Annex-B and ADTS helpers, and the USB socket server. Plain Swift, so it builds and tests on Linux |
| `Sources/PhoneCam/StreamEngine.swift` | Capture session, format and fps selection, frame dropping under backpressure |
| `Sources/PhoneCam/VideoEncoder.swift` | Hardware H.264 encoding with VideoToolbox |
| `Sources/PhoneCam/AudioEncoder.swift` | PCM to AAC conversion with AVAudioConverter |
| `Sources/PhoneCam/AppModel.swift`, `ContentView.swift` | UI and settings; landscape or portrait output kept upright with `RotationCoordinator` |
| `tools/receive.py` | Test receiver that dumps the stream to files, so you can check the app without OBS |

## One-time setup (Arch Linux)

1. **Swift 6.4.** xtool needs it. The swiftly toolchains link `libxml2.so.2`, but Arch now
   ships `.so.16`, so install the legacy library too:

   ```bash
   sudo pacman -S libxml2-legacy usbmuxd libimobiledevice
   ```

   ```bash
   swiftly install 6.4 --use
   ```

2. **Xcode.xip.** Sign in at <https://developer.apple.com/download/all/?q=Xcode> in a
   browser and download Xcode 27.1. xtool uses only the iOS SDK inside it.

3. **xtool.**

   ```bash
   curl -fL "https://github.com/xtool-org/xtool/releases/latest/download/xtool-$(uname -m).AppImage" -o ~/.local/bin/xtool && chmod +x ~/.local/bin/xtool
   ```

   ```bash
   xtool setup
   ```

   For login, a free Apple ID works with the "Password" mode, but apps signed that way
   expire after **7 days** and need to be reinstalled. A paid developer account works with
   the "API Key" mode and signs for a year. When it asks, give it the path to the `Xcode.xip`.

4. **iPhone.** Plug it in, tap *Trust*, then turn on
   *Settings → Privacy & Security → Developer Mode* (the phone restarts).

## Build and install

From this directory, with the phone plugged in:

```bash
xtool dev
```

This builds, signs, installs, and launches the app. The first time it runs, go to
*Settings → General → VPN & Device Management* on the phone and trust your developer certificate.

## Use it with OBS

1. Install the plugin. On Arch, use the AUR package `obs-ios-camera-source-git`, or the
   release from the GitHub repo. The existing Camera for OBS Studio plugin works too.
2. Open PhoneCam, plug in the phone, and add an **iOS Camera** source in OBS.
3. The status pill changes to **LIVE IN OBS**.

Controls:

- Pick the lens, the resolution (720p, 1080p, or 4K), the frame rate (24, 30, or 60), and the bitrate.
- Choose **Landscape** (the default) or **Portrait** output.
- Mute the mic or mirror the image.
- Tap the preview to focus.
- The eye icon hides the controls.

The output stays in the shape you choose, whichever way you hold the phone. The phone's
position only decides which way is up, so turning it around never sends an upside-down
picture. If you hold it the other way, for example upright while sending landscape, the
stream stays landscape and keeps its last upright orientation.

The plugin decodes with FFmpeg in software, so 4K60 can overload the PC. If OBS logs
"Decoding queue overloaded", lower the resolution or frame rate.

## Testing without OBS

```bash
iproxy 2345 2345
```

```bash
uv run tools/receive.py --seconds 10 && ffplay -f h264 capture.h264
```

Protocol unit tests run on Linux:

```bash
swift test
```
