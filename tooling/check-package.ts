import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as {
  exports: Record<string, string>;
};

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

for (const [name, target] of Object.entries(packageJson.exports)) {
  const path = join(root, target);
  try {
    await stat(path);
  } catch {
    throw new Error(`Package export ${name} points to missing file: ${target}`);
  }
  const declaration = path.replace(/\.js$/, ".d.ts");
  try {
    await stat(declaration);
  } catch {
    throw new Error(
      `Package export ${name} has no declaration file: ${relative(root, declaration)}`,
    );
  }
}

const performanceFiles = await filesUnder(join(root, "dist"));
for (const path of performanceFiles) {
  if (/(?:^|[\\/])trace(?:[\\/]|\.|-)/i.test(relative(join(root, "dist"), path))) {
    throw new Error(
      `Performance distribution contains trace-related file: ${relative(root, path)}`,
    );
  }
  if (!path.endsWith(".js") && !path.endsWith(".d.ts")) continue;
  const contents = await readFile(path, "utf8");
  if (/\b(?:#trace|AStarTraceEvent|TraceSink|onTrace|trace\.emit)\b/.test(contents)) {
    throw new Error(`Performance distribution contains trace references: ${relative(root, path)}`);
  }
}

const traceFiles = await filesUnder(join(root, "dist-trace"));
const traceJavascript = traceFiles.filter((path) => path.endsWith(".js"));
if (traceJavascript.length === 0)
  throw new Error("Trace distribution contains no JavaScript files");
for (const path of traceJavascript) {
  const contents = await readFile(path, "utf8");
  if (contents.split("\n").length > 2) {
    throw new Error(`Trace JavaScript does not appear minified: ${relative(root, path)}`);
  }
}

console.log("Package exports and distribution integrity verified");
