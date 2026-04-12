type Status = "unknown" | "healthy" | "degraded";
type State = { status: Status; consecutiveFailures: number };
type Listener = (s: State) => void;

const FAILURE_THRESHOLD = 3;
let state: State = { status: "unknown", consecutiveFailures: 0 };
const listeners = new Set<Listener>();

function setState(next: State): void {
  state = next;
  listeners.forEach((l) => l(state));
}

export const healthTracker = {
  record(ok: boolean, _status: number): void {
    if (ok) setState({ status: "healthy", consecutiveFailures: 0 });
    else this.recordFailure();
  },
  recordFailure(): void {
    const n = state.consecutiveFailures + 1;
    setState({
      status: n >= FAILURE_THRESHOLD ? "degraded" : state.status,
      consecutiveFailures: n,
    });
  },
  getState(): State { return state; },
  subscribe(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  reset(): void {
    state = { status: "unknown", consecutiveFailures: 0 };
    listeners.clear();
  },
};
