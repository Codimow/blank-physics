import { Effect, Schedule, Layer, Queue, Stream, Console } from "effect";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { GridService, makeGridLayer } from "./domain/Grid.js";
import { FluidSolverService, makeFluidSolverLayer } from "./domain/FluidSolver.js";
import { TerminalService, makeTerminalLayer } from "./rendering/Terminal.js";
import { InputHandlerService, makeInputHandlerLayer, type UserEvent } from "./input/InputHandler.js";
import { AsciiRenderer } from "./rendering/AsciiRenderer.js";
import * as FluidTypes from "./domain/FluidTypes.js";
import tk from "terminal-kit";

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

// Create a dynamic grid initialization based on terminal dimensions
const program = Effect.gen(function* (_) {
    // Create terminal layer and get dimensions
    const term = tk.terminal;
    const width = term.width;
    const height = term.height;
    
    // Create layers with actual terminal dimensions
    const GridLive = makeGridLayer(width, height);
    const SolverLive = makeFluidSolverLayer.pipe(Layer.provide(GridLive));
    const TerminalLive = makeTerminalLayer;
    const InputLive = makeInputHandlerLayer.pipe(Layer.provide(TerminalLive));
    
    const AppLayer = Layer.mergeAll(
        GridLive,
        SolverLive,
        TerminalLive,
        InputLive
    );
    
    // Run simulation with dynamically sized grid
    yield* _(Simulation.pipe(Effect.provide(AppLayer)));
});

NodeRuntime.runMain(program);
