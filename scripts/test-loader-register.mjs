// Registers scripts/test-loader.mjs as an ESM customization hook. Loaded via
// `node --import ./scripts/test-loader-register.mjs` from the "test" script
// in package.json — see that file for why it's needed.
import { register } from "node:module";

register("./test-loader.mjs", import.meta.url);
