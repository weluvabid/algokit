import * as trace from "#trace";
import type { TraceSink } from "#trace";
import { BLACK, RED, Node, colorOf, sizeOf, updateSize } from "./node.js";

export interface OrderedTreeTraceEvent<T> {
  readonly type: "insert" | "delete" | "rotate-left" | "rotate-right";
  readonly key: T;
  readonly size: number;
}

export interface OrderedTreeOptions<T> {
  readonly onTrace?: TraceSink<OrderedTreeTraceEvent<T>>;
}

/** A unique-key red-black tree with zero-based select and lower-bound rank. */
export class OrderedTree<T> implements Iterable<T> {
  #root: Node<T> | null = null;
  #size = 0;
  readonly #compare: (a: T, b: T) => number;
  readonly #onTrace: TraceSink<OrderedTreeTraceEvent<T>> | undefined;

  constructor(compare: (a: T, b: T) => number, options: OrderedTreeOptions<T> = {}) {
    this.#compare = compare;
    this.#onTrace = options.onTrace;
  }

  get size(): number {
    return this.#size;
  }

  get isEmpty(): boolean {
    return this.#size === 0;
  }

  has(key: T): boolean {
    return this.#find(key) !== null;
  }

  insert(key: T): boolean {
    let parent: Node<T> | null = null;
    let current = this.#root;

    while (current !== null) {
      parent = current;
      const comparison = this.#compare(key, current.key);

      if (comparison === 0) return false;

      current = comparison < 0 ? current.left : current.right;
    }

    const node = new Node(key);
    node.parent = parent;

    if (parent === null) this.#root = node;
    else if (this.#compare(key, parent.key) < 0) parent.left = node;
    else parent.right = node;

    for (let ancestor = parent; ancestor !== null; ancestor = ancestor.parent) updateSize(ancestor);

    this.#size++;
    this.#insertFixup(node);
    trace.emit(this.#onTrace, { type: "insert", key, size: this.#size });

    return true;
  }

  delete(key: T): boolean {
    const target = this.#find(key);

    if (target === null) return false;

    let moved = target;
    let removedColor = moved.color;
    let fixNode: Node<T> | null;
    let fixParent: Node<T> | null;

    if (target.left === null) {
      fixNode = target.right;
      fixParent = target.parent;
      this.#transplant(target, target.right);
      this.#updateAncestors(fixParent);
    } else if (target.right === null) {
      fixNode = target.left;
      fixParent = target.parent;
      this.#transplant(target, target.left);
      this.#updateAncestors(fixParent);
    } else {
      moved = this.#minimum(target.right)!;
      removedColor = moved.color;
      fixNode = moved.right;

      if (moved.parent === target) {
        fixParent = moved;

        if (fixNode !== null) fixNode.parent = moved;
      } else {
        fixParent = moved.parent;
        this.#transplant(moved, moved.right);
        this.#updateAncestors(fixParent);
        moved.right = target.right;
        moved.right.parent = moved;
      }

      this.#transplant(target, moved);
      moved.left = target.left;
      moved.left.parent = moved;
      moved.color = target.color;
      updateSize(moved);
      this.#updateAncestors(moved.parent);
    }

    this.#size--;

    if (removedColor === BLACK) this.#deleteFixup(fixNode, fixParent);

    this.#updateAncestors(fixNode ?? fixParent);
    trace.emit(this.#onTrace, { type: "delete", key, size: this.#size });

    return true;
  }

  /** Number of stored keys strictly less than key. */
  rank(key: T): number {
    let rank = 0;
    let current = this.#root;

    while (current !== null) {
      const comparison = this.#compare(key, current.key);

      if (comparison <= 0) current = current.left;
      else {
        rank += sizeOf(current.left) + 1;
        current = current.right;
      }
    }

    return rank;
  }

  /** Returns the key at a zero-based sorted position, or undefined when out of range. */
  select(index: number): T | undefined {
    if (!Number.isInteger(index) || index < 0 || index >= this.#size) return undefined;

    let current = this.#root;
    let target = index;

    while (current !== null) {
      const leftSize = sizeOf(current.left);

      if (target < leftSize) current = current.left;
      else if (target === leftSize) return current.key;
      else {
        target -= leftSize + 1;
        current = current.right;
      }
    }

    return undefined;
  }

  min(): T | undefined {
    return this.#minimum(this.#root)?.key;
  }

  max(): T | undefined {
    let current = this.#root;

    if (current === null) return undefined;

    while (current.right !== null) current = current.right;

    return current.key;
  }

  clear(): void {
    this.#root = null;
    this.#size = 0;
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
      yield current.key;
      current = current.right;
    }
  }

  #find(key: T): Node<T> | null {
    let current = this.#root;

    while (current !== null) {
      const comparison = this.#compare(key, current.key);

      if (comparison === 0) return current;

      current = comparison < 0 ? current.left : current.right;
    }

    return null;
  }

  #minimum(node: Node<T> | null): Node<T> | null {
    if (node === null) return null;

    while (node.left !== null) node = node.left;

    return node;
  }

  #transplant(oldNode: Node<T>, newNode: Node<T> | null): void {
    if (oldNode.parent === null) this.#root = newNode;
    else if (oldNode === oldNode.parent.left) oldNode.parent.left = newNode;
    else oldNode.parent.right = newNode;

    if (newNode !== null) newNode.parent = oldNode.parent;
  }

  #updateAncestors(node: Node<T> | null): void {
    while (node !== null) {
      updateSize(node);
      node = node.parent;
    }
  }

  #rotateLeft(node: Node<T>): void {
    const pivot = node.right;

    if (pivot === null) throw new Error("Invalid left rotation");

    node.right = pivot.left;

    if (pivot.left !== null) pivot.left.parent = node;

    pivot.parent = node.parent;

    if (node.parent === null) this.#root = pivot;
    else if (node === node.parent.left) node.parent.left = pivot;
    else node.parent.right = pivot;

    pivot.left = node;
    node.parent = pivot;
    updateSize(node);
    updateSize(pivot);
    trace.emit(this.#onTrace, { type: "rotate-left", key: node.key, size: this.#size });
  }

  #rotateRight(node: Node<T>): void {
    const pivot = node.left;

    if (pivot === null) throw new Error("Invalid right rotation");

    node.left = pivot.right;

    if (pivot.right !== null) pivot.right.parent = node;

    pivot.parent = node.parent;

    if (node.parent === null) this.#root = pivot;
    else if (node === node.parent.right) node.parent.right = pivot;
    else node.parent.left = pivot;

    pivot.right = node;
    node.parent = pivot;
    updateSize(node);
    updateSize(pivot);
    trace.emit(this.#onTrace, { type: "rotate-right", key: node.key, size: this.#size });
  }

  #insertFixup(node: Node<T>): void {
    let current = node;

    while (current.parent?.color === RED) {
      const parent = current.parent;
      const grandparent = parent.parent;

      if (grandparent === null) break;

      if (parent === grandparent.left) {
        const uncle = grandparent.right;

        if (colorOf(uncle) === RED) {
          parent.color = BLACK;
          uncle!.color = BLACK;
          grandparent.color = RED;
          current = grandparent;
        } else {
          if (current === parent.right) {
            current = parent;
            this.#rotateLeft(current);
          }

          current.parent!.color = BLACK;
          current.parent!.parent!.color = RED;
          this.#rotateRight(current.parent!.parent!);
        }
      } else {
        const uncle = grandparent.left;

        if (colorOf(uncle) === RED) {
          parent.color = BLACK;
          uncle!.color = BLACK;
          grandparent.color = RED;
          current = grandparent;
        } else {
          if (current === parent.left) {
            current = parent;
            this.#rotateRight(current);
          }

          current.parent!.color = BLACK;
          current.parent!.parent!.color = RED;
          this.#rotateLeft(current.parent!.parent!);
        }
      }
    }

    if (this.#root !== null) this.#root.color = BLACK;

    this.#updateAncestors(node);
  }

  #deleteFixup(node: Node<T> | null, parent: Node<T> | null): void {
    let current = node;
    let currentParent = parent;

    while (current !== this.#root && colorOf(current) === BLACK) {
      if (currentParent === null) break;

      if (current === currentParent.left) {
        let sibling = currentParent.right;

        if (colorOf(sibling) === RED) {
          sibling!.color = BLACK;
          currentParent.color = RED;
          this.#rotateLeft(currentParent);
          sibling = currentParent.right;
        }

        if (colorOf(sibling?.left ?? null) === BLACK && colorOf(sibling?.right ?? null) === BLACK) {
          if (sibling !== null) sibling.color = RED;

          current = currentParent;
          currentParent = current.parent;
        } else {
          if (colorOf(sibling?.right ?? null) === BLACK) {
            if (sibling?.left !== null && sibling?.left !== undefined) sibling.left.color = BLACK;

            if (sibling !== null) {
              sibling.color = RED;
              this.#rotateRight(sibling);
            }

            sibling = currentParent.right;
          }

          if (sibling !== null) sibling.color = currentParent.color;

          currentParent.color = BLACK;

          if (sibling?.right !== null && sibling?.right !== undefined) sibling.right.color = BLACK;

          this.#rotateLeft(currentParent);
          current = this.#root;
          currentParent = null;
        }
      } else {
        let sibling = currentParent.left;

        if (colorOf(sibling) === RED) {
          sibling!.color = BLACK;
          currentParent.color = RED;
          this.#rotateRight(currentParent);
          sibling = currentParent.left;
        }

        if (colorOf(sibling?.right ?? null) === BLACK && colorOf(sibling?.left ?? null) === BLACK) {
          if (sibling !== null) sibling.color = RED;

          current = currentParent;
          currentParent = current.parent;
        } else {
          if (colorOf(sibling?.left ?? null) === BLACK) {
            if (sibling?.right !== null && sibling?.right !== undefined)
              sibling.right.color = BLACK;

            if (sibling !== null) {
              sibling.color = RED;
              this.#rotateLeft(sibling);
            }

            sibling = currentParent.left;
          }

          if (sibling !== null) sibling.color = currentParent.color;

          currentParent.color = BLACK;

          if (sibling?.left !== null && sibling?.left !== undefined) sibling.left.color = BLACK;

          this.#rotateRight(currentParent);
          current = this.#root;
          currentParent = null;
        }
      }
    }

    if (current !== null) current.color = BLACK;
  }
}
