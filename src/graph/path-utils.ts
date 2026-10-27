export function reconstructPath(
  previous: ReadonlyMap<string, string>,
  start: string,
  goal: string,
): string[] {
  const path = [goal];
  let node = goal;

  while (node !== start) {
    const parent = previous.get(node);

    if (parent === undefined) throw new Error("Broken predecessor chain");

    path.push(parent);
    node = parent;
  }

  path.reverse();

  return path;
}
