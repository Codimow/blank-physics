import { Effect, Context, Layer } from "effect";
import tk from "terminal-kit";

// Define the shape of our Terminal service
export interface Terminal {
    readonly term: tk.Terminal;
    readonly clear: Effect.Effect<void>;
    readonly width: Effect.Effect<number>;
    readonly height: Effect.Effect<number>;
}

export class TerminalService extends Context.Tag("TerminalService")<
    TerminalService,
    Terminal
>() { }

// Create a resource layer
export const makeTerminalLayer = Layer.scoped(
    TerminalService,
    Effect.acquireRelease(
        Effect.sync(() => {
            const term = tk.terminal;
            term.fullscreen(true);
            term.grabInput({ mouse: 'drag' });
            term.hideCursor(true);
            return {
                term,
                clear: Effect.sync(() => term.clear()),
                width: Effect.sync(() => term.width),
                height: Effect.sync(() => term.height),
            } as Terminal;
        }),
        (terminal) =>
            Effect.sync(() => {
                terminal.term.hideCursor(false);
                terminal.term.grabInput(false);
                terminal.term.fullscreen(false);
                // data release or cleanup if needed
                terminal.term.processExit(0);
            })
    )
);
