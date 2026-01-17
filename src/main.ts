<<<<<<< HEAD
import "./style.css";
import * as Effect from "effect/Effect";
import * as Console from "effect/Console";
import { ObjectDetector, ObjectDetectorLive } from "./ObjectDetector.js";

// --- UI Construction ---
const setupUI = () => {
  const app = document.querySelector<HTMLDivElement>("#app")!;
  
  app.innerHTML = `
    <!-- Background Orbs -->
    <div class="ambient-orb orb-1"></div>
    <div class="ambient-orb orb-2"></div>

    <header>
      <div class="brand">
        <div class="brand-icon"></div>
        Blank<span style="font-weight:300; opacity:0.7">Detector</span>
      </div>
      
      <div class="status-badge">
        <div id="status-dot" class="status-dot"></div>
        <span id="status-text">Initializing...</span>
      </div>
    </header>

    <main>
      <div class="glass-panel">
        
        <div id="upload-area" class="upload-area">
          <input type="file" id="file-input" accept="image/*" />
          <div class="upload-icon">📁</div>
          <div class="upload-text">Drag & Drop or Click to Upload Image</div>
          <div class="upload-subtext">Supports JPG, PNG, WEBP</div>
        </div>

        <div id="stage" class="detector-stage">
          <img id="source-image" />
          <canvas id="overlay"></canvas>
          <div id="loader" class="loader"></div>
        </div>

        <div id="object-count" class="face-count"></div>
        
      </div>
    </main>
  `;

  return {
    uploadArea: document.getElementById("upload-area") as HTMLDivElement,
    fileInput: document.getElementById("file-input") as HTMLInputElement,
    stage: document.getElementById("stage") as HTMLDivElement,
    image: document.getElementById("source-image") as HTMLImageElement,
    canvas: document.getElementById("overlay") as HTMLCanvasElement,
    loader: document.getElementById("loader") as HTMLDivElement,
    objectCount: document.getElementById("object-count") as HTMLDivElement,
    statusDot: document.getElementById("status-dot") as HTMLDivElement,
    statusText: document.getElementById("status-text") as HTMLSpanElement
  };
};

const ui = setupUI();

// --- Main Logic ---

const MainLive = Effect.gen(function* (_) {
  const detector = yield* _(ObjectDetector);
  
  yield* _(Console.log("Object Detector Service Ready"));
  updateStatus("ready", "Ready to Detect");

  // Helper to handle File
  const handleFile = (file: File) => Effect.gen(function* (_) {
    if (!file.type.startsWith('image/')) {
        updateStatus("error", "Invalid file type");
        return;
    }

    // Reset UI
    ui.stage.classList.remove("has-image");
    ui.objectCount.classList.remove("visible");
    ui.loader.style.display = "block";
    updateStatus("loading", "Processing...");

    // Read file
    const imageUrl = URL.createObjectURL(file);
    ui.image.src = imageUrl;

    // Wait for image load
    yield* _(Effect.promise(() => new Promise((resolve, reject) => {
        ui.image.onload = () => {
            ui.stage.classList.add("has-image");
            resolve(true);
        };
        ui.image.onerror = () => reject("Failed to load image");
    })));

    // Detect
    updateStatus("loading", "Scanning Objects...");
    
    // Tiny delay to let UI render
    yield* _(Effect.sleep("100 millis"));

    // Run detection
    try {
        const predictions = yield* _(detector.detect(ui.image) as Effect.Effect<any[], Error>);
        console.log("Objects detected:", predictions);
        drawPredictions(predictions);
        
        const count = predictions.length;
        ui.objectCount.textContent = `${count} Object${count !== 1 ? 's' : ''} Detected`;
        ui.objectCount.classList.add("visible");
        ui.loader.style.display = "none";
        updateStatus("active", "Complete");
    } catch (err) {
        console.error(err);
        updateStatus("error", "Detection Failed");
        ui.loader.style.display = "none";
    }
  });

  // UI Event Listeners
  ui.uploadArea.onclick = () => ui.fileInput.click();

  ui.fileInput.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        Effect.runPromise(handleFile(file));
    }
  };

  ui.uploadArea.ondragover = (e) => {
    e.preventDefault();
    ui.uploadArea.classList.add("dragover");
  };

  ui.uploadArea.ondragleave = () => {
    ui.uploadArea.classList.remove("dragover");
  };

  ui.uploadArea.ondrop = (e) => {
    e.preventDefault();
    ui.uploadArea.classList.remove("dragover");
    const file = e.dataTransfer?.files[0];
    if (file) {
        Effect.runPromise(handleFile(file));
    }
  };


  const drawPredictions = (predictions: any[]) => {
    ui.canvas.width = ui.image.naturalWidth;
    ui.canvas.height = ui.image.naturalHeight;
    
    const ctx = ui.canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, ui.canvas.width, ui.canvas.height);

    // Dynamic Font scaling
    const scale = ui.image.naturalWidth / 800;
    const lineWidth = Math.max(2, 4 * scale);
    const fontSize = Math.max(14, 20 * scale);
    const padding = 6 * scale;

    predictions.forEach(prediction => {
      // MediaPipe format: boundingBox: { originX, originY, width, height }
      const { originX, originY, width, height } = prediction.boundingBox;
      
      // Get best category (usually the first one has highest score)
      const category = prediction.categories[0];
      const text = `${category.categoryName} (${Math.round(category.score * 100)}%)`;

      // Select Color based on class name hash (for variety)
      const color = getColorForString(category.categoryName);

      // Draw Box
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.shadowColor = color;
      ctx.shadowBlur = 10 * scale;
      
      ctx.beginPath();
      ctx.rect(originX, originY, width, height);
      ctx.stroke();

      // Draw Label Background
      ctx.font = `600 ${fontSize}px Inter, sans-serif`;
      const textMetrics = ctx.measureText(text);
      const textWidth = textMetrics.width;
      const textHeight = fontSize; // approx

      ctx.fillStyle = color;
      ctx.fillRect(originX, originY - textHeight - padding * 2, textWidth + padding * 2, textHeight + padding * 2);

      // Draw Label Text
      ctx.fillStyle = "#000000";
      ctx.fillText(text, originX + padding, originY - padding);
    });
  };

});

// Stable color generation
function getColorForString(str: string) {
    // Simple hash
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    // Convert to HSL
    const h = Math.abs(hash) % 360;
    return `hsl(${h}, 90%, 70%)`;
}

// Helper
function updateStatus(state: "loading" | "ready" | "active" | "error", text: string) {
  ui.statusText.textContent = text;
  ui.statusDot.className = "status-dot";
  if (state === "loading") ui.statusDot.classList.add("loading");
  if (state === "active") ui.statusDot.classList.add("active");
  if (state === "error") ui.statusDot.style.backgroundColor = "var(--error-color)";
}

// Run the application
Effect.runPromise(
  MainLive.pipe(
    Effect.provide(ObjectDetectorLive)
  )
).catch(err => {
  console.error("Program crashed", err);
});
=======
import { Effect, Schedule, Layer, Queue, Stream, Console } from "effect";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { GridService, makeGridLayer } from "./domain/Grid.js";
import { FluidSolverService, makeFluidSolverLayer } from "./domain/FluidSolver.js";
import { TerminalService, makeTerminalLayer } from "./rendering/Terminal.js";
import { InputHandlerService, makeInputHandlerLayer, type UserEvent } from "./input/InputHandler.js";
import { AsciiRenderer } from "./rendering/AsciiRenderer.js";
import * as FluidTypes from "./domain/FluidTypes.js";

// Simulation State
interface SimState {
    currentFluid: number; // 0, 1, 2
}

const Simulation = Effect.gen(function* (_) {
    const terminal = yield* _(TerminalService);
    const grid = yield* _(GridService);
    const solver = yield* _(FluidSolverService);
    const inputHandler = yield* _(InputHandlerService);

    // Queue to buffer inputs between frames
    const inputQueue = yield* _(Queue.unbounded<UserEvent>());

    // Fork input processing to push to queue
    yield* _(
        Stream.runForEach(inputHandler.events, (evt) => Queue.offer(inputQueue, evt)),
        Effect.fork
    );

    const state = { currentFluid: 0 };
    const fluids = [FluidTypes.Water, FluidTypes.Smoke, FluidTypes.Fire];

    // Main Loop
    const tick = Effect.gen(function* (_) {
        // 1. Process Input
        const events = yield* _(Queue.takeAll(inputQueue));

        for (const evt of events) {
            switch (evt._tag) {
                case "Quit":
                    return yield* _(Effect.interrupt); // Stop everything
                case "Clear":
                    grid.clear();
                    break;
                case "SwitchFluid":
                    state.currentFluid = evt.index;
                    break;
                case "AddSource":
                    // Add density and velocity
                    // Add to a small radius? For now single point
                    grid.addDensity(evt.x, evt.y, 100);
                    // Maybe add velocity towards center or random?
                    // Let's add velocity upwards/random for fun or just density
                    grid.addVelocity(evt.x, evt.y, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5);
                    break;
            }
        }

        // 2. Physics Step
        solver.step(0.1, fluids[state.currentFluid]);

        // 3. Render
        const frame = AsciiRenderer.renderToString(grid);

        // Move cursor to top-left and draw
        yield* _(Effect.promise(() => {
            terminal.term.moveTo(1, 1);
            terminal.term(frame);
            return Promise.resolve();
        }));
    });

    // Run loop at ~30 FPS
    yield* _(
        tick,
        Effect.repeat(Schedule.spaced("33 millis"))
    );
});

// Construct the dependency graph
const MainLayer = Layer.mergeAll(
    makeGridLayer(60, 30), // fixed size for now, or detect later
    makeFluidSolverLayer,
    makeTerminalLayer,
    makeInputHandlerLayer
).pipe(
    Layer.provide(makeGridLayer(80, 40)) // Overwrite grid size if needed or provide here
);
// Initial grid layer needs to be provided to FluidSolver and Simulation
// Layer composition:
// Grid -> FluidSolver
// Grid -> Simulation
// Terminal -> InputHandler
// Terminal -> Simulation

const GridLive = makeGridLayer(80, 40);
const SolverLive = makeFluidSolverLayer.pipe(Layer.provide(GridLive));
const TerminalLive = makeTerminalLayer;
const InputLive = makeInputHandlerLayer.pipe(Layer.provide(TerminalLive));

const AppLayer = Layer.mergeAll(
    GridLive,
    SolverLive,
    TerminalLive,
    InputLive
);

const program = Simulation.pipe(
    Effect.provide(AppLayer)
);

NodeRuntime.runMain(program);
>>>>>>> f4c0368 (Initial commit)
