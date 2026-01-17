import { Effect, Context, Layer } from "effect";
import { Grid, GridService } from "./Grid.js";
import { type FluidType } from "./FluidTypes.js";

export class FluidSolver {
    // Vorticity confinement strength (higher = more turbulent)
    private vorticityStrength = 0.3;
    
    constructor(private grid: Grid) { }

    step(dt: number, fluid: FluidType) {
        const { viscosity, diffusion, decay, buoyancy } = fluid;
        const { width, height, size } = this.grid;

        // 1. Velocity step

        // Add external forces (buoyancy)
        this.addBuoyancy(dt, buoyancy);

        // Add vorticity confinement to maintain swirls
        this.addVorticityConfinement(dt);

        // Diffuse velocity with higher accuracy
        this.diffuse(1, this.grid.u_prev, this.grid.u, viscosity, dt);
        this.diffuse(2, this.grid.v_prev, this.grid.v, viscosity, dt);

        // Project (clean up divergence)
        this.project(this.grid.u_prev, this.grid.v_prev, this.grid.u, this.grid.v);

        // Advect velocity with improved accuracy
        this.advect(1, this.grid.u, this.grid.u_prev, this.grid.u_prev, this.grid.v_prev, dt);
        this.advect(2, this.grid.v, this.grid.v_prev, this.grid.u_prev, this.grid.v_prev, dt);

        // Project again with higher accuracy
        this.project(this.grid.u, this.grid.v, this.grid.u_prev, this.grid.v_prev);

        // 2. Density step

        // Diffuse density with higher accuracy
        this.diffuse(0, this.grid.dens_prev, this.grid.density, diffusion, dt);

        // Advect density with improved accuracy
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

    private addVorticityConfinement(dt: number) {
        const N = this.grid.width;
        const M = this.grid.height;
        
        // Temporary arrays for vorticity
        const curl = new Float32Array(this.grid.size);
        
        // 1. Calculate vorticity (curl of velocity field)
        for (let j = 1; j <= M; j++) {
            for (let i = 1; i <= N; i++) {
                const idx = this.grid.IX(i, j);
                const dvdx = (this.grid.v[this.grid.IX(i + 1, j)] - this.grid.v[this.grid.IX(i - 1, j)]) * 0.5;
                const dudy = (this.grid.u[this.grid.IX(i, j + 1)] - this.grid.u[this.grid.IX(i, j - 1)]) * 0.5;
                curl[idx] = dvdx - dudy;
            }
        }
        
        // 2. Calculate gradient of vorticity magnitude
        for (let j = 1; j <= M; j++) {
            for (let i = 1; i <= N; i++) {
                const idx = this.grid.IX(i, j);
                
                // Gradient of absolute vorticity
                const dCx = (Math.abs(curl[this.grid.IX(i + 1, j)]) - Math.abs(curl[this.grid.IX(i - 1, j)])) * 0.5;
                const dCy = (Math.abs(curl[this.grid.IX(i, j + 1)]) - Math.abs(curl[this.grid.IX(i, j - 1)])) * 0.5;
                
                // Normalize gradient
                const length = Math.sqrt(dCx * dCx + dCy * dCy) + 1e-5;
                const Nx = dCx / length;
                const Ny = dCy / length;
                
                // Add force perpendicular to gradient (N × ω)
                const force = this.vorticityStrength * curl[idx];
                this.grid.u[idx] += Ny * force * dt;
                this.grid.v[idx] += -Nx * force * dt;
            }
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

        // Gauss-Seidel relaxation with increased iterations for better accuracy
        // Increased from 20 to 40 iterations for more stable and accurate solving
        for (let k = 0; k < 40; k++) {
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
        
        // Use proper scaling for non-square grids
        const h = 1.0 / Math.max(N, M);

        for (let j = 1; j <= M; j++) {
            for (let i = 1; i <= N; i++) {
                div[this.grid.IX(i, j)] = -0.5 * h * (
                    velocX[this.grid.IX(i + 1, j)] - velocX[this.grid.IX(i - 1, j)] +
                    velocY[this.grid.IX(i, j + 1)] - velocY[this.grid.IX(i, j - 1)]
                );
                p[this.grid.IX(i, j)] = 0;
            }
        }

        this.set_bnd(0, div);
        this.set_bnd(0, p);
        this.lin_solve(0, p, div, 1, 4);

        for (let j = 1; j <= M; j++) {
            for (let i = 1; i <= N; i++) {
                velocX[this.grid.IX(i, j)] -= 0.5 * (p[this.grid.IX(i + 1, j)] - p[this.grid.IX(i - 1, j)]) / h;
                velocY[this.grid.IX(i, j)] -= 0.5 * (p[this.grid.IX(i, j + 1)] - p[this.grid.IX(i, j - 1)]) / h;
            }
        }

        this.set_bnd(1, velocX);
        this.set_bnd(2, velocY);
    }

    private advect(b: number, d: Float32Array, d0: Float32Array, velocX: Float32Array, velocY: Float32Array, dt: number) {
        const N = this.grid.width;
        const M = this.grid.height;

        // Better scaling for stability
        const dt0 = dt * Math.max(N, M);

        for (let j = 1; j <= M; j++) {
            for (let i = 1; i <= N; i++) {
                // Backtrack particle position
                let x = i - dt0 * velocX[this.grid.IX(i, j)];
                let y = j - dt0 * velocY[this.grid.IX(i, j)];

                // Clamp to grid boundaries
                if (x < 0.5) x = 0.5;
                if (x > N + 0.5) x = N + 0.5;
                const i0 = Math.floor(x);
                const i1 = i0 + 1;

                if (y < 0.5) y = 0.5;
                if (y > M + 0.5) y = M + 0.5;
                const j0 = Math.floor(y);
                const j1 = j0 + 1;

                // Bilinear interpolation
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
