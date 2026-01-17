import { Effect, Context, Layer } from "effect";
import { Grid, GridService } from "./Grid.js";
import { type FluidType } from "./FluidTypes.js";

export class FluidSolver {
    constructor(private grid: Grid) { }

    step(dt: number, fluid: FluidType) {
        const { viscosity, diffusion, decay, buoyancy } = fluid;
        const { width, height, size } = this.grid;

        // 1. Velocity step

        // Add external forces (buoyancy)
        this.addBuoyancy(dt, buoyancy);

        // Diffuse velocity
        this.diffuse(1, this.grid.u_prev, this.grid.u, viscosity, dt);
        this.diffuse(2, this.grid.v_prev, this.grid.v, viscosity, dt);

        // Project (clean up divergence)
        this.project(this.grid.u_prev, this.grid.v_prev, this.grid.u, this.grid.v);

        // Advect velocity
        this.advect(1, this.grid.u, this.grid.u_prev, this.grid.u_prev, this.grid.v_prev, dt);
        this.advect(2, this.grid.v, this.grid.v_prev, this.grid.u_prev, this.grid.v_prev, dt);

        // Project again
        this.project(this.grid.u, this.grid.v, this.grid.u_prev, this.grid.v_prev);

        // 2. Density step

        // Diffuse density
        this.diffuse(0, this.grid.dens_prev, this.grid.density, diffusion, dt);

        // Advect density
        this.advect(0, this.grid.density, this.grid.dens_prev, this.grid.u, this.grid.v, dt);

        // Decay density
        this.decay(dt, decay);
    }

    private addBuoyancy(dt: number, buoyancy: number) {
        for (let i = 0; i < this.grid.size; i++) {
            // Simple buoyancy: upward force proportional to density
            // Assuming y is 0 at top, so upward is negative V? Terminal coords usually 0 at top.
            // Yes, Fluid: Rise = Decrease Y.
            // If buoyancy > 0, it should rise.
            const d = this.grid.density[i];
            if (d > 0) {
                this.grid.v[i] -= d * buoyancy * dt;
            }
        }
    }

    private decay(dt: number, rate: number) {
        for (let i = 0; i < this.grid.size; i++) {
            this.grid.density[i] *= (1 - rate);
        }
    }

    // b: 0=scalar, 1=x-component, 2=y-component
    private set_bnd(b: number, x: Float32Array) {
        const N = this.grid.width;
        const M = this.grid.height;

        // Vertical walls
        for (let i = 1; i <= M; i++) {
            x[this.grid.IX(0, i)] = b === 1 ? -x[this.grid.IX(1, i)] : x[this.grid.IX(1, i)];
            x[this.grid.IX(N + 1, i)] = b === 1 ? -x[this.grid.IX(N, i)] : x[this.grid.IX(N, i)];
        }

        // Horizontal walls
        for (let i = 1; i <= N; i++) {
            x[this.grid.IX(i, 0)] = b === 2 ? -x[this.grid.IX(i, 1)] : x[this.grid.IX(i, 1)];
            x[this.grid.IX(i, M + 1)] = b === 2 ? -x[this.grid.IX(i, M)] : x[this.grid.IX(i, M)];
        }

        // Corners
        x[this.grid.IX(0, 0)] = 0.5 * (x[this.grid.IX(1, 0)] + x[this.grid.IX(0, 1)]);
        x[this.grid.IX(0, M + 1)] = 0.5 * (x[this.grid.IX(1, M + 1)] + x[this.grid.IX(0, M)]);
        x[this.grid.IX(N + 1, 0)] = 0.5 * (x[this.grid.IX(N, 0)] + x[this.grid.IX(N + 1, 1)]);
        x[this.grid.IX(N + 1, M + 1)] = 0.5 * (x[this.grid.IX(N, M + 1)] + x[this.grid.IX(N + 1, M)]);
    }

    private diffuse(b: number, x: Float32Array, x0: Float32Array, diff: number, dt: number) {
        const a = dt * diff * this.grid.width * this.grid.height;
        this.lin_solve(b, x, x0, a, 1 + 4 * a);
    }

    private lin_solve(b: number, x: Float32Array, x0: Float32Array, a: number, c: number) {
        const N = this.grid.width;
        const M = this.grid.height;

        // Gauss-Seidel relaxation
        // 20 iterations is a standard trade-off for real-time
        for (let k = 0; k < 20; k++) {
            for (let j = 1; j <= M; j++) {
                for (let i = 1; i <= N; i++) {
                    x[this.grid.IX(i, j)] = (x0[this.grid.IX(i, j)] + a * (
                        x[this.grid.IX(i + 1, j)] +
                        x[this.grid.IX(i - 1, j)] +
                        x[this.grid.IX(i, j + 1)] +
                        x[this.grid.IX(i, j - 1)]
                    )) / c;
                }
            }
            this.set_bnd(b, x);
        }
    }

    private project(velocX: Float32Array, velocY: Float32Array, p: Float32Array, div: Float32Array) {
        const N = this.grid.width;
        const M = this.grid.height;

        for (let j = 1; j <= M; j++) {
            for (let i = 1; i <= N; i++) {
                div[this.grid.IX(i, j)] = -0.5 * (
                    velocX[this.grid.IX(i + 1, j)] - velocX[this.grid.IX(i - 1, j)] +
                    velocY[this.grid.IX(i, j + 1)] - velocY[this.grid.IX(i, j - 1)]
                ) / N; // assuming square cells? Or average N/M
                p[this.grid.IX(i, j)] = 0;
            }
        }

        this.set_bnd(0, div);
        this.set_bnd(0, p);
        this.lin_solve(0, p, div, 1, 4);

        for (let j = 1; j <= M; j++) {
            for (let i = 1; i <= N; i++) {
                velocX[this.grid.IX(i, j)] -= 0.5 * (p[this.grid.IX(i + 1, j)] - p[this.grid.IX(i - 1, j)]) * N;
                velocY[this.grid.IX(i, j)] -= 0.5 * (p[this.grid.IX(i, j + 1)] - p[this.grid.IX(i, j - 1)]) * M;
            }
        }

        this.set_bnd(1, velocX);
        this.set_bnd(2, velocY);
    }

    private advect(b: number, d: Float32Array, d0: Float32Array, velocX: Float32Array, velocY: Float32Array, dt: number) {
        const N = this.grid.width;
        const M = this.grid.height;

        const dt0 = dt * N; // Assuming dx=dy=1/N normalized? 
        // Usually dt0 = dt * N

        for (let j = 1; j <= M; j++) {
            for (let i = 1; i <= N; i++) {
                let x = i - dt0 * velocX[this.grid.IX(i, j)];
                let y = j - dt0 * velocY[this.grid.IX(i, j)];

                if (x < 0.5) x = 0.5;
                if (x > N + 0.5) x = N + 0.5;
                const i0 = Math.floor(x);
                const i1 = i0 + 1;

                if (y < 0.5) y = 0.5;
                if (y > M + 0.5) y = M + 0.5;
                const j0 = Math.floor(y);
                const j1 = j0 + 1;

                const s1 = x - i0;
                const s0 = 1.0 - s1;
                const t1 = y - j0;
                const t0 = 1.0 - t1;

                d[this.grid.IX(i, j)] =
                    s0 * (t0 * d0[this.grid.IX(i0, j0)] + t1 * d0[this.grid.IX(i0, j1)]) +
                    s1 * (t0 * d0[this.grid.IX(i1, j0)] + t1 * d0[this.grid.IX(i1, j1)]);
            }
        }
        this.set_bnd(b, d);
    }
}

// Effect Service
export class FluidSolverService extends Context.Tag("FluidSolverService")<
    FluidSolverService,
    FluidSolver
>() { }

export const makeFluidSolverLayer = Layer.effect(
    FluidSolverService,
    Effect.map(GridService, (grid) => new FluidSolver(grid))
);
