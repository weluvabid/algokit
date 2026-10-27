export const RED = true;
export const BLACK = false;

export class Node<T> {
  left: Node<T> | null = null;
  right: Node<T> | null = null;
  parent: Node<T> | null = null;
  color = RED;
  subtreeSize = 1;

  constructor(readonly key: T) {}
}

export function sizeOf<T>(node: Node<T> | null): number {
  return node?.subtreeSize ?? 0;
}

export function updateSize<T>(node: Node<T>): void {
  node.subtreeSize = 1 + sizeOf(node.left) + sizeOf(node.right);
}

export function colorOf<T>(node: Node<T> | null): boolean {
  return node?.color ?? BLACK;
}
