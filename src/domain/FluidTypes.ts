// import type { Color } from "terminal-kit";


export interface FluidType {
    readonly name: string;
    readonly viscosity: number;
    readonly diffusion: number;
    readonly decay: number; // How fast density dissipates
    readonly color: string;
    readonly buoyancy: number; // upward force factor
}

export const Water: FluidType = {
    name: "Water",
    viscosity: 0.00005,  // Very low viscosity for smooth flow
    diffusion: 0.00002,   // Minimal diffusion
    decay: 0.0005,        // Slow decay
    color: "blue",
    buoyancy: -0.05       // Slight downward tendency
};

export const Smoke: FluidType = {
    name: "Smoke",
    viscosity: 0.00001,   // Very low viscosity (smoke is light)
    diffusion: 0.0002,    // Higher diffusion (spreads out)
    decay: 0.008,         // Moderate decay
    color: "gray",
    buoyancy: 1.2         // Strong upward motion
};

export const Fire: FluidType = {
    name: "Fire",
    viscosity: 0.00002,   // Low viscosity for dynamic movement
    diffusion: 0.0001,    // Moderate diffusion
    decay: 0.02,          // Burns out quickly
    color: "red",
    buoyancy: 3.0         // Very strong upward motion
};
