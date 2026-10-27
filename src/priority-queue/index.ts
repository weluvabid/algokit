export class PriorityQueue<T> {
  readonly #heap: T[] = [];
  readonly #compare: (a: T, b: T) => number;

  constructor(compare: (a: T, b: T) => number) {
    this.#compare = compare;
  }

  get size(): number {
    return this.#heap.length;
  }

  get isEmpty(): boolean {
    return this.#heap.length === 0;
  }

  peek(): T | undefined {
    return this.#heap[0];
  }

  push(value: T): void {
    const heap = this.#heap;
    let index = heap.length;
    heap.push(value);

    while (index > 0) {
      const parent = (index - 1) >>> 1;
      const parentValue = heap[parent]!;
      if (this.#compare(value, parentValue) >= 0) break;
      heap[index] = parentValue;
      index = parent;
    }

    heap[index] = value;
  }

  pop(): T | undefined {
    const heap = this.#heap;
    const size = heap.length;
    if (size === 0) return undefined;

    const root = heap[0]!;
    const last = heap.pop()!;
    if (size === 1) return root;

    let index = 0;
    const newSize = heap.length;
    while (true) {
      const left = index * 2 + 1;
      if (left >= newSize) break;
      const right = left + 1;
      let child = left;
      if (right < newSize && this.#compare(heap[right]!, heap[left]!) < 0) {
        child = right;
      }
      if (this.#compare(heap[child]!, last) >= 0) break;
      heap[index] = heap[child]!;
      index = child;
    }

    heap[index] = last;
    return root;
  }
}
