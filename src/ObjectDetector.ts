import { 
  ObjectDetector as MPObjectDetector, 
  FilesetResolver,
  Detection 
} from "@mediapipe/tasks-vision";
import { Effect, Context, Layer } from "effect";

// Define the interface for our ObjectDetector service
export interface ObjectDetector {
  readonly detect: (input: HTMLImageElement | HTMLVideoElement) => Effect.Effect<Detection[], Error>;
}

// Create a tag for the service
export const ObjectDetector = Context.GenericTag<ObjectDetector>("@app/ObjectDetector");

// Implementation details
const make = Effect.gen(function* (_) {
  
  // Initialize MediaPipe Vision
  const vision = yield* Effect.tryPromise({
    try: async () => {
      const vision = await FilesetResolver.forVisionTasks(
        // Use CDN for wasm binaries
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );
      return vision;
    },
    catch: (error) => new Error(`Failed to load MediaPipe Vision: ${error}`)
  });

  // Load Object Detector Model
  // efficientdet_lite2 is a good balance of accuracy (better than lite0) and speed.
  const detector = yield* Effect.tryPromise({
    try: async () => {
      return await MPObjectDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite2/float32/1/efficientdet_lite2.tflite",
          delegate: "GPU" // Use WebGL/WebGPU if available
        },
        scoreThreshold: 0.3, // Report more objects, filter by score later if needed
        runningMode: "IMAGE" // Can allow VIDEO too if we switch mode but we are doing single image now
      });
    },
    catch: (error) => new Error(`Failed to create Object Detector: ${error}`)
  });

  return {
    detect: (input: HTMLImageElement | HTMLVideoElement) => Effect.tryPromise({
      try: async () => {
        // MediaPipe detect is synchronous if image is loaded, but we wrap in promise for consistency
        return detector.detect(input).detections;
      },
      catch: (error) => new Error(`Detection failed: ${error}`)
    })
  };
});

// Create a Layer to provide the service
// We can use Layer.effect instead of scoped if we don't need cleanup for now, 
// though MP detector has a .close() method. Ideally we should use scoped to close it.
export const ObjectDetectorLive = Layer.effect(ObjectDetector, make);
