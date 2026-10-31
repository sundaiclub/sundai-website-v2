#if os(iOS)
import AVFoundation
import SwiftUI
import UIKit

final class PreviewView: UIView {
    override class var layerClass: AnyClass { AVCaptureVideoPreviewLayer.self }
    var previewLayer: AVCaptureVideoPreviewLayer { layer as! AVCaptureVideoPreviewLayer }
}

struct CameraPreview: UIViewRepresentable {
    let model: AppModel

    func makeCoordinator() -> Coordinator { Coordinator(model: model) }

    func makeUIView(context: Context) -> PreviewView {
        let view = PreviewView()
        view.backgroundColor = .black
        view.previewLayer.videoGravity = .resizeAspect
        view.previewLayer.session = model.engine.session
        view.addGestureRecognizer(UITapGestureRecognizer(
            target: context.coordinator,
            action: #selector(Coordinator.tapped(_:))
        ))
        model.attach(previewLayer: view.previewLayer)
        return view
    }

    func updateUIView(_ uiView: PreviewView, context: Context) {}

    @MainActor
    final class Coordinator: NSObject {
        let model: AppModel

        init(model: AppModel) {
            self.model = model
        }

        @objc func tapped(_ recognizer: UITapGestureRecognizer) {
            guard let view = recognizer.view else { return }
            model.focus(atLayerPoint: recognizer.location(in: view))
        }
    }
}
#endif
