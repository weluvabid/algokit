import { cp, readFile, rm, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { stripTrace } from "./trace-transform/index.js";

const traceOut = new URL("../dist-trace/", import.meta.url);
const perfOut = new URL("../dist/", import.meta.url);

await rm(traceOut, { recursive: true, force: true });
await rm(perfOut, { recursive: true, force: true });
execFileSync("npx", ["tsc", "-p", "tsconfig.json", "--outDir", "dist-trace"], { stdio: "inherit" });
await cp(traceOut, perfOut, { recursive: true });

const graphPath = new URL("../dist/graph/index.js", import.meta.url);
const graphSource = await readFile(graphPath, "utf8");
const transformed = stripTrace(graphSource, "dist/graph/index.js");
await writeFile(graphPath, transformed.code);

await rm(new URL("../dist/trace/", import.meta.url), { recursive: true, force: true });
