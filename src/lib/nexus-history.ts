export type NexusEditorState = Record<string, unknown>;

const KEY = "nexus-v-lab.history.v1";
const MAX = 80;

export type HistoryState = {
  past: NexusEditorState[];
  present: NexusEditorState;
  future: NexusEditorState[];
};

export function createHistory(initial: NexusEditorState) {
  let past: NexusEditorState[] = [];
  let present = initial;
  let future: NexusEditorState[] = [];
  return {
    get() { return { past, present, future }; },
    commit(next: NexusEditorState) { past = [...past, present].slice(-MAX); present = next; future = []; persist(past, present, future); return { past, present, future }; },
    undo() { if (!past.length) return { past, present, future }; future = [present, ...future].slice(0, MAX); present = past[past.length - 1]!; past = past.slice(0, -1); persist(past, present, future); return { past, present, future }; },
    redo() { if (!future.length) return { past, present, future }; past = [...past, present].slice(-MAX); present = future[0]!; future = future.slice(1); persist(past, present, future); return { past, present, future }; },
  };
}

export function loadHistory(): HistoryState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<HistoryState>;
    if (!parsed.present || typeof parsed.present !== "object") return null;
    return {
      past: Array.isArray(parsed.past) ? parsed.past as NexusEditorState[] : [],
      present: parsed.present as NexusEditorState,
      future: Array.isArray(parsed.future) ? parsed.future as NexusEditorState[] : [],
    };
  } catch {
    return null;
  }
}

function persist(past: NexusEditorState[], present: NexusEditorState, future: NexusEditorState[]) {
  try { localStorage.setItem(KEY, JSON.stringify({ past, present, future })); } catch { /* history is best-effort */ }
}
