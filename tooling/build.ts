import { cp, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
// @ts-expect-error -- Build-time TS imports are resolved by the build tooling.
import { stripTrace } from "./trace-transform";

const root = fileURLToPath(new URL("../", import.meta.url));
const work = join(root, ".algokit-build");
const source = join(work, "source");
const performanceSource = join(work, "performance-source");
const performanceOut = join(work, "dist-next");
const traceOut = join(work, "dist-trace-next");

async function filesUnder(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? filesUnder(path) : [path];
    }),
  );
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

  await rm(join(performanceSource, "trace"), { recursive: true, force: true });

  const performanceFiles = await filesUnder(performanceSource);
  const performanceJavascript = performanceFiles.filter((path) => path.endsWith(".js"));
  const declarations = performanceFiles.filter(
    (path) => path.endsWith(".d.ts") || path.endsWith(".d.ts.map"),
  );
  let removedCalls = 0;

  for (const path of performanceJavascript) {
    const input = await readFile(path, "utf8");
    const transformed: { code: string; removedCalls: number } = stripTrace(
      input,
      relative(root, path),
    );
    removedCalls += transformed.removedCalls;
    await writeFile(path, transformed.code);
  }

  if (removedCalls === 0) {
    throw new Error("Performance build did not remove any trace calls");
  }

  for (const declaration of declarations) {
    if (declaration.endsWith(".d.ts.map")) continue;
    const input = await readFile(declaration, "utf8");
    const output = input
      .replace(/^import\s+type\s+\{\s*TraceSink\s*\}\s+from\s+["']#trace["'];?\s*\n?/gm, "")
      .replace(/^export interface AStarTraceEvent \{[\s\S]*?^\}\n?/m, "")
      .replace(/^\s*readonly onTrace\?: TraceSink<AStarTraceEvent>;\n/gm, "");
    await writeFile(declaration, output);
  }

  await build({
    entryPoints: performanceJavascript,
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
    if (declaration.endsWith(".d.ts.map")) continue;
    const destination = join(performanceOut, relative(performanceSource, declaration));
    await mkdir(join(destination, ".."), { recursive: true });
    await cp(declaration, destination);
  }

  const traceFiles = await filesUnder(traceOut);
  const traceJavascript = traceFiles.filter((path) => path.endsWith(".js"));
  await build({
    entryPoints: traceJavascript,
    outbase: traceOut,
    outdir: traceOut + "-minified",
    bundle: false,
    format: "esm",
    target: "es2022",
    minify: true,
    sourcemap: "external",
    legalComments: "none",
    logLevel: "info",
  });
  const minifiedTrace = traceOut + "-minified";
  for (const path of traceFiles.filter((file) => file.endsWith(".d.ts"))) {
    const destination = join(minifiedTrace, relative(traceOut, path));
    await mkdir(join(destination, ".."), { recursive: true });
    await cp(path, destination);
  }
  await rm(traceOut, { recursive: true, force: true });
  await rename(minifiedTrace, traceOut);

  const builtFiles = await filesUnder(performanceOut);
  if (builtFiles.some((path) => /(?:^|\/)trace(?:\/|\.|-)/i.test(relative(performanceOut, path)))) {
    throw new Error("Performance distribution contains trace-related files");
  }
  for (const path of builtFiles.filter((file) => file.endsWith(".js") || file.endsWith(".d.ts"))) {
    const contents = await readFile(path, "utf8");
    if (
      contents.includes("#trace") ||
      contents.includes("trace.emit") ||
      contents.includes("AStarTraceEvent") ||
      contents.includes("onTrace")
    ) {
      throw new Error(
        `Performance distribution contains trace references: ${relative(performanceOut, path)}`,
      );
    }
  }

  await rm(join(root, "dist"), { recursive: true, force: true });
  await rm(join(root, "dist-trace"), { recursive: true, force: true });
  await rename(performanceOut, join(root, "dist"));
  await rename(traceOut, join(root, "dist-trace"));
} finally {
  await rm(work, { recursive: true, force: true });
}
