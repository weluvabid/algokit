import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";

export async function filesUnder(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? filesUnder(path) : [path];
    }),
  );
  return files.flat();
}

/** Fail if the performance distribution contains trace artifacts or references. */
export async function assertPerformanceDistribution(directory: string): Promise<string[]> {
  const files = await filesUnder(directory);
  for (const path of files) {
    const relativePath = relative(directory, path);
    if (/(?:^|[\\/])trace(?:[\\/]|\.|-)/i.test(relativePath)) {
      throw new Error(`Performance distribution contains trace-related file: ${relativePath}`);
    }
    if (!path.endsWith(".js") && !path.endsWith(".d.ts")) continue;
    const contents = await readFile(path, "utf8");
    if (/(?:#trace|trace\.emit)/.test(contents)) {
      throw new Error(`Performance distribution contains trace references: ${relativePath}`);
    }
  }
  return files;
}
