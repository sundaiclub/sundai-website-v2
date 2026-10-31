// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "PhoneCam",
    platforms: [
        .iOS(.v17),
        .macOS(.v14),
    ],
    products: [
        // An xtool project should contain exactly one library product,
        // representing the main app.
        .library(
            name: "PhoneCam",
            targets: ["PhoneCam"]
        ),
    ],
    targets: [
        // Wire protocol + USB socket server. Platform-independent so it can be
        // built and tested on Linux with `swift test`.
        .target(
            name: "PortalKit"
        ),
        .target(
            name: "PhoneCam",
            dependencies: ["PortalKit"]
        ),
        .testTarget(
            name: "PortalKitTests",
            dependencies: ["PortalKit"]
        ),
    ],
    swiftLanguageModes: [.v5]
)
