/**
 * Persist in-progress proof / Mark-done UI + draft (text + photos) across refresh.
 * Phase flags live in sessionStorage; image bytes in IndexedDB (sessionStorage is too small).
 */

export type ProofPhaseReason = "break" | "expired" | "session" | "subtask";

export type ProofDraftImage = {
  name: string;
  type: string;
  dataUrl: string;
};

export type ProofPhaseState = {
  phase: "complete" | "update";
  reason?: ProofPhaseReason;
  /** /complete in flight or Acharya evaluating */
  evaluating?: boolean;
  text?: string;
  tab?: "image" | "text";
  updatedAt: number;
};

export type ProofDraft = ProofPhaseState & {
  images?: ProofDraftImage[];
};

const DB_NAME = "acharya-proof-drafts";
const DB_VERSION = 1;
const STORE = "drafts";
/** Soft cap per image data URL (~4.5MB) so one bad camera shot doesn't blow the store. */
const MAX_IMAGE_DATA_URL_CHARS = 4_500_000;

function phaseKey(taskId: string, attemptId: string) {
  return `acharya:proof-phase:${taskId}:${attemptId}`;
}

function draftId(taskId: string, attemptId: string) {
  return `${taskId}:${attemptId}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("indexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("indexedDB open failed"));
  });
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

export async function dataUrlToFile(
  dataUrl: string,
  name: string,
  type: string,
): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], name || "proof.jpg", { type: type || blob.type || "image/jpeg" });
}

export async function filesToDraftImages(
  items: Array<{ file: File; preview?: string }>,
): Promise<ProofDraftImage[]> {
  const out: ProofDraftImage[] = [];
  for (const item of items.slice(0, 5)) {
    try {
      const dataUrl = await fileToDataUrl(item.file);
      if (!dataUrl || dataUrl.length > MAX_IMAGE_DATA_URL_CHARS) continue;
      out.push({
        name: item.file.name || "proof.jpg",
        type: item.file.type || "image/jpeg",
        dataUrl,
      });
    } catch {
      /* skip unreadable file */
    }
  }
  return out;
}

export function saveProofPhase(
  taskId: string,
  attemptId: string | null | undefined,
  patch: Omit<ProofPhaseState, "updatedAt"> & { updatedAt?: number },
): void {
  if (typeof window === "undefined" || !taskId || !attemptId) return;
  try {
    const prev = loadProofPhase(taskId, attemptId);
    const next: ProofPhaseState = {
      phase: patch.phase,
      reason: patch.reason ?? prev?.reason,
      evaluating: patch.evaluating ?? prev?.evaluating ?? false,
      text: patch.text !== undefined ? patch.text : prev?.text,
      tab: patch.tab ?? prev?.tab,
      updatedAt: patch.updatedAt ?? Date.now(),
    };
    sessionStorage.setItem(phaseKey(taskId, attemptId), JSON.stringify(next));
  } catch {
    /* private mode / quota */
  }
}

export function loadProofPhase(
  taskId: string,
  attemptId: string | null | undefined,
): ProofPhaseState | null {
  if (typeof window === "undefined" || !taskId || !attemptId) return null;
  try {
    const raw = sessionStorage.getItem(phaseKey(taskId, attemptId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ProofPhaseState;
    if (parsed?.phase !== "complete" && parsed?.phase !== "update") return null;
    if (typeof parsed.updatedAt === "number" && Date.now() - parsed.updatedAt > 6 * 60 * 60 * 1000) {
      clearProofPhase(taskId, attemptId);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearProofPhase(
  taskId: string,
  attemptId: string | null | undefined,
): void {
  if (typeof window === "undefined" || !taskId || !attemptId) return;
  try {
    sessionStorage.removeItem(phaseKey(taskId, attemptId));
  } catch {
    /* ignore */
  }
  void clearProofDraftImages(taskId, attemptId);
}

/** Close the sheet without wiping text/photos (Cancel). Mount will not auto-reopen. */
export function dismissProofPhase(
  taskId: string,
  attemptId: string | null | undefined,
): void {
  if (typeof window === "undefined" || !taskId || !attemptId) return;
  try {
    sessionStorage.removeItem(phaseKey(taskId, attemptId));
  } catch {
    /* ignore */
  }
}

/** Full draft (phase + images). Prefer this when restoring Mark Done form fields. */
export async function saveProofDraft(
  taskId: string,
  attemptId: string | null | undefined,
  draft: {
    phase: "complete" | "update";
    reason?: ProofPhaseReason;
    evaluating?: boolean;
    text?: string;
    tab?: "image" | "text";
    images?: ProofDraftImage[];
  },
): Promise<void> {
  if (!taskId || !attemptId) return;
  saveProofPhase(taskId, attemptId, {
    phase: draft.phase,
    reason: draft.reason,
    evaluating: draft.evaluating,
    text: draft.text,
    tab: draft.tab,
  });
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("idb write failed"));
      tx.objectStore(STORE).put({
        id: draftId(taskId, attemptId),
        text: draft.text ?? "",
        tab: draft.tab ?? "image",
        images: draft.images ?? [],
        updatedAt: Date.now(),
      });
    });
    db.close();
  } catch {
    /* idb unavailable — text/phase still in sessionStorage */
  }
}

export async function loadProofDraft(
  taskId: string,
  attemptId: string | null | undefined,
): Promise<ProofDraft | null> {
  if (!taskId || !attemptId) return null;
  const phase = loadProofPhase(taskId, attemptId);
  type DraftRow = {
    text?: string;
    tab?: "image" | "text";
    images?: ProofDraftImage[];
    updatedAt?: number;
  };
  let row: DraftRow | null = null;
  try {
    const db = await openDb();
    row = await new Promise<DraftRow | null>((resolve) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(draftId(taskId, attemptId));
      req.onsuccess = () => {
        resolve((req.result as DraftRow | undefined) ?? null);
      };
      req.onerror = () => resolve(null);
    });
    db.close();
  } catch {
    row = null;
  }

  const images = Array.isArray(row?.images) ? row.images : [];
  const text = typeof row?.text === "string" ? row.text : phase?.text;
  const tab = row?.tab === "text" || row?.tab === "image" ? row.tab : phase?.tab;
  const updatedAt = row?.updatedAt ?? phase?.updatedAt ?? Date.now();
  if (updatedAt && Date.now() - updatedAt > 6 * 60 * 60 * 1000) {
    clearProofPhase(taskId, attemptId);
    return null;
  }
  // Return a draft when we have phase (auto-reopen) OR saved form fields.
  if (!phase && !text && images.length === 0) return null;
  return {
    phase: phase?.phase ?? "complete",
    reason: phase?.reason,
    evaluating: phase?.evaluating,
    text,
    tab,
    images,
    updatedAt,
  };
}

async function clearProofDraftImages(
  taskId: string,
  attemptId: string | null | undefined,
): Promise<void> {
  if (!taskId || !attemptId) return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.objectStore(STORE).delete(draftId(taskId, attemptId));
    });
    db.close();
  } catch {
    /* ignore */
  }
}
