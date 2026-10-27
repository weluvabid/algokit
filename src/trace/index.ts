export type TraceSink<E = unknown> = (event: E) => void;

export interface TraceRecorder<E> {
  readonly events: readonly E[];
  readonly emit: TraceSink<E>;
  clear(): void;
}

export function emit<E>(sink: TraceSink<E> | undefined, event: E): void {
  sink?.(event);
}

export function createTraceRecorder<E>(): TraceRecorder<E> {
  const events: E[] = [];
  return {
    get events() {
      return events;
    },
    emit(event) {
      events.push(event);
    },
    clear() {
      events.length = 0;
    },
  };
}
