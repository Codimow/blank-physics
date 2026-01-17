import { Effect, Context, Layer } from "effect";

export class Grid {
    readonly size: number;
    // Current state
    readonly u: Float32Array; // x-velocity
    readonly v: Float32Array; // y-velocity
    readonly density: Float32Array;

    // Previous state (for solver)
    readonly u_prev: Float32Array;
    readonly v_prev: Float32Array;
    readonly dens_prev: Float32Array;

    constructor(readonly width: number, readonly height: number) {
        this.size = (width + 2) * (height + 2);
        this.u = new Float32Array(this.size);
        this.v = new Float32Array(this.size);
        this.density = new Float32Array(this.size);
        this.u_prev = new Float32Array(this.size);
        this.v_prev = new Float32Array(this.size);
        this.dens_prev = new Float32Array(this.size);
    }

    // 1D index from 2D coordinates with boundary padding
    IX(x: number, y: number): number {
        // Clamp to ensure safety
        const safeX = Math.max(0, Math.min(x, this.width + 1));
        const safeY = Math.max(0, Math.min(y, this.height + 1));
        return safeX + (safeY * (this.width + 2));
    }

    addDensity(x: number, y: number, amount: number) {
        this.density[this.IX(x, y)] += amount;
    }

    addVelocity(x: number, y: number, amountX: number, amountY: number) {
        const idx = this.IX(x, y);
        this.u[idx] += amountX;
        this.v[idx] += amountY;
    }

    clear() {
        this.u.fill(0);
        this.v.fill(0);
        this.density.fill(0);
        this.u_prev.fill(0);
        this.v_prev.fill(0);
        this.dens_prev.fill(0);
    }
}

// Effect Service definition
export class GridService extends Context.Tag("GridService")<
    GridService,
    Grid
>() { }

export const makeGridLayer = (width: number, height: number) =>
    Layer.succeed(
        GridService,
        new Grid(width, height)
    );
