import * as trace from "#trace";
import type { TraceSink } from "#trace";

export interface ImplicitTreapTraceEvent {
  readonly type: "insert" | "remove" | "set";
  readonly index: number;
  readonly size: number;
}

export interface ImplicitTreapOptions {
  readonly seed?: number;
  readonly onTrace?: TraceSink<ImplicitTreapTraceEvent>;
}

class Node<T> {
  left: Node<T> | null = null;
  right: Node<T> | null = null;
  subtreeSize = 1;

  constructor(
    public value: T,
    readonly priority: number,
  ) {}
}

function sizeOf<T>(node: Node<T> | null): number {
  return node?.subtreeSize ?? 0;
}

function update<T>(node: Node<T>): void {
  node.subtreeSize = 1 + sizeOf(node.left) + sizeOf(node.right);
}

function split<T>(root: Node<T> | null, count: number): [Node<T> | null, Node<T> | null] {
  if (root === null) return [null, null];

  if (sizeOf(root.left) >= count) {
    const [left, right] = split(root.left, count);
    root.left = right;
    update(root);

    return [left, root];
  }

  const [left, right] = split(root.right, count - sizeOf(root.left) - 1);
  root.right = left;
  update(root);

  return [root, right];
}

function merge<T>(left: Node<T> | null, right: Node<T> | null): Node<T> | null {
  if (left === null) return right;

  if (right === null) return left;

  if (left.priority >= right.priority) {
    left.right = merge(left.right, right);
    update(left);

    return left;
  }

  right.left = merge(left, right.left);
  update(right);

  return right;
}

/** A sequence supporting indexed insert, access, update, and removal in expected O(log n). */
export class ImplicitTreap<T> implements Iterable<T> {
  #root: Node<T> | null = null;
  #state: number;
  readonly #onTrace: TraceSink<ImplicitTreapTraceEvent> | undefined;

  constructor(values: Iterable<T> = [], options: ImplicitTreapOptions = {}) {
    this.#state = (options.seed ?? 0x9e3779b9) >>> 0 || 0x9e3779b9;
    this.#onTrace = options.onTrace;

    for (const value of values)
      this.#root = merge(this.#root, new Node(value, this.#nextPriority()));
  }

  get size(): number {
    return sizeOf(this.#root);
  }

  get isEmpty(): boolean {
    return this.#root === null;
  }

  get(index: number): T | undefined {
    if (!Number.isInteger(index) || index < 0 || index >= this.size) return undefined;

    let current = this.#root;
    let target = index;

    while (current !== null) {
      const leftSize = sizeOf(current.left);

      if (target < leftSize) current = current.left;
      else if (target === leftSize) return current.value;
      else {
        target -= leftSize + 1;
        current = current.right;
      }
    }

    return undefined;
  }

  set(index: number, value: T): T {
    this.#assertExistingIndex(index);
    const node = this.#nodeAt(index)!;
    const previous = node.value;
    node.value = value;
    trace.emit(this.#onTrace, { type: "set", index, size: this.size });

    return previous;
  }

  insert(index: number, value: T): void {
    this.#assertInsertIndex(index);
    const [left, right] = split(this.#root, index);
    const node = new Node(value, this.#nextPriority());
    this.#root = merge(merge(left, node), right);
    trace.emit(this.#onTrace, { type: "insert", index, size: this.size });
  }

  push(value: T): void {
    this.insert(this.size, value);
  }

  remove(index: number): T {
    this.#assertExistingIndex(index);
    const [left, rest] = split(this.#root, index);
    const [removed, right] = split(rest, 1);

    if (removed === null) throw new Error("Treap index invariant violated");

    this.#root = merge(left, right);
    trace.emit(this.#onTrace, { type: "remove", index, size: this.size });

    return removed.value;
  }

  toArray(): T[] {
    return [...this];
  }

  *[Symbol.iterator](): Iterator<T> {
    const stack: Node<T>[] = [];
    let current = this.#root;

    while (current !== null || stack.length > 0) {
      while (current !== null) {
        stack.push(current);
        current = current.left;
      }

      current = stack.pop()!;
      yield current.value;
      current = current.right;
    }
  }

  #nodeAt(index: number): Node<T> | null {
    let current = this.#root;
    let target = index;

    while (current !== null) {
      const leftSize = sizeOf(current.left);

      if (target < leftSize) current = current.left;
      else if (target === leftSize) return current;
      else {
        target -= leftSize + 1;
        current = current.right;
      }
    }

    return null;
  }

  #assertExistingIndex(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index >= this.size) {
      throw new RangeError("Index must refer to an existing element");
    }
  }

  #assertInsertIndex(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index > this.size) {
      throw new RangeError("Insert index must be between zero and size inclusive");
    }
  }

  #nextPriority(): number {
    this.#state ^= this.#state << 13;
    this.#state ^= this.#state >>> 17;
    this.#state ^= this.#state << 5;

    return this.#state >>> 0;
  }
}
