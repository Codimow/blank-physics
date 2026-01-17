import { Effect, Context, Layer, Stream, Chunk } from "effect";
import { TerminalService } from "../rendering/Terminal.js";

export type UserEvent =
    | { _tag: "Quit" }
    | { _tag: "Clear" }
    | { _tag: "AddSource"; x: number; y: number }
    | { _tag: "SwitchFluid"; index: number };

export interface InputHandler {
    readonly events: Stream.Stream<UserEvent>;
}

export class InputHandlerService extends Context.Tag("InputHandlerService")<
    InputHandlerService,
    InputHandler
>() { }

export const makeInputHandlerLayer = Layer.effect(
    InputHandlerService,
    Effect.gen(function* (_) {
        const { term } = yield* _(TerminalService);

        const events = Stream.async<UserEvent>((emit) => {
            const onKey = (name: string) => {
                if (name === "CTRL_C" || name === "q") {
                    emit.single({ _tag: "Quit" });
                } else if (name === "c") {
                    emit.single({ _tag: "Clear" });
                } else if (["1", "2", "3"].includes(name)) {
                    emit.single({ _tag: "SwitchFluid", index: parseInt(name) - 1 });
                }
            };

            const onMouse = (name: string, data: any) => {
                if (name === "MOUSE_LEFT_BUTTON_PRESSED" || name === 'MOUSE_MOTION') {
                    // Terminal kit mouse coordinates are 1-based usually
                    emit.single({ _tag: "AddSource", x: data.x, y: data.y });
                }
            };

            term.on("key", onKey);
            term.on("mouse", onMouse);

            return Effect.sync(() => {
                term.off("key", onKey);
                term.off("mouse", onMouse);
            });
        });

        return { events };
    })
);
