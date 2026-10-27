import { cp, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
// @ts-ignore
import { stripTrace } from "./trace-transform";

const root = fileURLToPath(new URL("../", import.meta.url));
const work = join(root, ".algokit-build");
const source = join(work, "source");
const performanceSource = join(work, "performance-source");
const performanceOut = join(work, "dist-next");
const traceOut = join(work, "dist-trace-next");

async function filesUnder(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  }));
  return files.flat();
}

await rm(work, { recursive: true, force: true });
await mkdir(work, { recursive: true });

try {
  await import("node:child_process").then(({ execFileSync }) => {
    execFileSync("npx", ["tsc", "-p", "tsconfig.json", "--outDir", source], {
      cwd: root,
      stdio: "inherit",
    });
  });

  await cp(source, traceOut, { recursive: true });
  await cp(source, performanceSource, { recursive: true });

  const graphPath = join(performanceSource, "graph", "index.js");
  const graphSource = await readFile(graphPath, "utf8");
  const transformed = stripTrace(graphSource, relative(root, graphPath));
  if (transformed.removedCalls === 0) {
    throw new Error("Performance build did not remove any trace calls from the graph module");
  }
  if (transformed.code.includes("#trace") || transformed.code.includes("trace.emit")) {
    throw new Error("Trace references remain after instrumentation removal");
  }
  await writeFile(graphPath, transformed.code);

  const generated = await filesUnder(performanceSource);
  const javascript = generated.filter((path) => path.endsWith(".js"));
  const declarations = generated.filter((path) => path.endsWith(".d.ts") || path.endsWith(".d.ts.map"));

  await build({
    entryPoints: javascript,
    outbase: performanceSource,
    outdir: performanceOut,
    bundle: false,
    format: "esm",
    target: "es2022",
    minify: true,
    sourcemap: "external",
    legalComments: "none",
    logLevel: "info",
  });

  for (const declaration of declarations) {
    const destination = join(performanceOut, relative(performanceSource, declaration));
    await mkdir(join(destination, ".."), { recursive: true });
    await cp(declaration, destination);
  }

  const builtGraph = await readFile(join(performanceOut, "graph", "index.js"), "utf8");
  if (builtGraph.includes("#trace") || builtGraph.includes("trace.emit")) {
    throw new Error("Minified performance graph contains trace instrumentation");
  }

  await rm(join(root, "dist"), { recursive: true, force: true });
  await rm(join(root, "dist-trace"), { recursive: true, force: true });
  await rename(performanceOut, join(root, "dist"));
  await rename(traceOut, join(root, "dist-trace"));
} finally {
  await rm(work, { recursive: true, force: true });
}
