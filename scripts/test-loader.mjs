// Node ESM customization hook used only by `npm test` (see
// scripts/test-loader-register.mjs and the "test" script in package.json).
//
// It exists to let node:test import the project's .ts/.tsx source files
// directly, the same way the TypeScript compiler and Next.js's bundler
// already do:
//   - resolve(): the project's tsconfig uses `moduleResolution: "bundler"`,
//     so source files import each other without a file extension
//     (`from "../data"`). Node's own ESM resolver requires the extension, so
//     this retries a failed resolution with .ts, .tsx or (for a package like
//     `next/link`, whose package.json has no "exports" map for ESM extension
//     inference) plain .js appended.
//   - load(): Node's built-in TypeScript support (--experimental-strip-types)
//     only erases type syntax; it cannot transform JSX, so it can't load
//     .tsx files such as components.tsx. This uses the `typescript` package,
//     already a devDependency, to transpile .ts/.tsx to plain ESM instead.
//
// None of this touches the production build: `next build`/`next dev` resolve
// and compile source with their own bundler, completely independently of
// this file.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const TS_EXTENSIONS = [".ts", ".tsx"];
const FALLBACK_EXTENSIONS = [".ts", ".tsx", ".js"];

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (err?.code === "ERR_MODULE_NOT_FOUND") {
      for (const ext of FALLBACK_EXTENSIONS) {
        try {
          return await nextResolve(specifier + ext, context);
        } catch {
          // try the next extension
        }
      }
    }
    throw err;
  }
}

export async function load(url, context, nextLoad) {
  // node:test's experimental module mocking appends a `?node-test-mock=N`
  // query string to the URL of a module it is asked to mock (even the
  // "real" load it delegates to internally), so the extension check has to
  // look at the pathname, not the raw url.
  const cleanUrl = url.split("?")[0].split("#")[0];
  if (TS_EXTENSIONS.some((ext) => cleanUrl.endsWith(ext))) {
    const path = fileURLToPath(cleanUrl);
    const source = readFileSync(path, "utf8");
    const { outputText } = ts.transpileModule(source, {
      fileName: path,
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
        verbatimModuleSyntax: false,
      },
    });
    return { format: "module", source: outputText, shortCircuit: true };
  }
  return nextLoad(url, context);
}
