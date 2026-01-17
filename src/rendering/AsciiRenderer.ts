import { type Grid } from "../domain/Grid.js";

const CHARS = " .:-=+*#%@";

export class AsciiRenderer {
    static getChar(density: number): string {
        // Clamp density between 0 and 1 (or higher for max density)
        // Adjust scaler as needed for visual impact
        const maxDensity = 2.0;
        const normalized = Math.max(0, Math.min(density, maxDensity)) / maxDensity;

        const index = Math.floor(normalized * (CHARS.length - 1));
        return CHARS[index];
    }

    static renderToString(grid: Grid): string {
        let output = "";
        for (let j = 1; j <= grid.height; j++) {
            for (let i = 1; i <= grid.width; i++) {
                const d = grid.density[grid.IX(i, j)];
                output += this.getChar(d);
            }
            output += "\n";
        }
        return output;
    }
}
