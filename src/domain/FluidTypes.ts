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
    viscosity: 0.0001,
    diffusion: 0.0001,
    decay: 0.001,
    color: "blue",
    buoyancy: -0.1 // Flows down slightly or neutral
};

export const Smoke: FluidType = {
    name: "Smoke",
    viscosity: 0.01,
    diffusion: 0.0001,
    decay: 0.005,
    color: "gray",
    buoyancy: 0.5
};

export const Fire: FluidType = {
    name: "Fire",
    viscosity: 0.001,
    diffusion: 0.0001,
    decay: 0.03, // Burns out fast
    color: "red",
    buoyancy: 2.0
};
