import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';
import * as blazeface from '@tensorflow-models/blazeface';
import { Effect, Context, Layer } from "effect";

// Define the interface for our FaceDetector service
export interface FaceDetector {
  readonly detect: (input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement) => Effect.Effect<blazeface.NormalizedFace[], Error>;
}

// Create a tag for the service
export const FaceDetector = Context.GenericTag<FaceDetector>("@app/FaceDetector");

// Implementation details
const make = Effect.gen(function* (_) {
  // Initialize backend
  yield* Effect.tryPromise({
    try: async () => {
      await tf.ready();
      await tf.setBackend('webgl');
    },
    catch: (error) => new Error(`TFJS Backend Error: ${error}`)
  });

  // Load model with settings for better accuracy
  const model = yield* Effect.tryPromise({
    try: () => blazeface.load({
      maxFaces: 10,
      iouThreshold: 0.3, // Lower IoU to prevent merging distinct faces too aggressively
      scoreThreshold: 0.5 // Lower score detecting more faces, filter later if needed
    }),
    catch: (error) => new Error(`Failed to load BlazeFace model: ${error}`)
  });

  return {
    detect: (input) => Effect.tryPromise({
      try: async () => {
        // Estimate faces
        // We can't easily change load-time params here, but we use the loaded model.
        return await model.estimateFaces(input, false);
      },
      catch: (error) => new Error(`Detection failed: ${error}`)
    })
  };
});

// Create a Layer to provide the service
export const FaceDetectorLive = Layer.effect(FaceDetector, make);
