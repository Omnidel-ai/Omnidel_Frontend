import { useCallback, useEffect, useRef, useState } from "react";
import type { BlobArea, StoredFile } from "../blob";
import { kindOf } from "../blob";
import { isCancelled, type UploadClient, type UploadTask } from "./types";

export interface UploadQueueOptions {
  client: UploadClient;
  area: BlobArea;
  slug: string;
  /** Many files per record, or one that overwrites itself. */
  multiple?: boolean;
  /** Called once per file that lands. */
  onStored?: (file: StoredFile) => void;
}

export interface UploadQueue {
  /** Every file this session has offered, in the order it was offered. */
  tasks: UploadTask[];
  add: (files: File[] | FileList) => void;
  cancel: (id: string) => void;
  retry: (id: string) => void;
  /** Take a finished or abandoned row off the list. */
  dismiss: (id: string) => void;
  clearFinished: () => void;
  busy: boolean;
}

/**
 * The part of an upload that is not the bytes: the list, and what may be done
 * to each row.
 *
 * Cancel and retry are the reason this exists. Both need something per file
 * that outlives a render — an `AbortController` for cancel, the original
 * `File` for retry — and neither belongs in a component that is also drawing a
 * progress bar. A control renders `tasks` and calls the three verbs.
 *
 * Rejected files still get a row, with the reason on it. A file that vanishes
 * silently when it is the wrong type is a file the person will try again.
 */
export function useUploadQueue({
  client,
  area,
  slug,
  multiple = true,
  onStored,
}: UploadQueueOptions): UploadQueue {
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  /** The live parts, keyed by task id: what to abort, and what to retry with. */
  const live = useRef(new Map<string, { file: File; controller: AbortController }>());
  const seq = useRef(0);

  // An unmount mid-upload should stop the upload, not leave it running against
  // a component that is gone.
  useEffect(() => {
    const running = live.current;
    return () => {
      for (const entry of running.values()) entry.controller.abort();
      running.clear();
    };
  }, []);

  const patch = useCallback((id: string, next: Partial<UploadTask>) => {
    setTasks((current) => current.map((t) => (t.id === id ? { ...t, ...next } : t)));
  }, []);

  const run = useCallback(
    (id: string, file: File) => {
      const controller = new AbortController();
      live.current.set(id, { file, controller });
      patch(id, { status: "uploading", progress: 0, error: undefined });

      client
        .start(file, {
          area,
          slug,
          multiple,
          signal: controller.signal,
          onProgress: (fraction) => patch(id, { progress: fraction }),
        })
        .then((stored) => {
          live.current.delete(id);
          patch(id, { status: "done", progress: 1, result: stored });
          onStored?.(stored);
        })
        .catch((err: unknown) => {
          live.current.delete(id);
          if (isCancelled(err)) {
            patch(id, { status: "cancelled", error: undefined });
            return;
          }
          patch(id, {
            status: "failed",
            error: err instanceof Error ? err.message : String(err),
          });
        });
    },
    [area, client, multiple, onStored, patch, slug],
  );

  const add = useCallback(
    (files: File[] | FileList) => {
      for (const file of Array.from(files)) {
        const id = `u${++seq.current}`;
        const problem = client.check(file, area);
        const task: UploadTask = {
          id,
          name: file.name,
          size: file.size,
          kind: kindOf(file),
          status: problem ? "failed" : "queued",
          progress: 0,
          error: problem?.message,
        };
        setTasks((current) => [...current, task]);
        // A rejected file keeps its row and its reason, but is never started —
        // and `live` still holds it, so Retry can work if the policy is what
        // changed rather than the file.
        if (problem) {
          live.current.set(id, { file, controller: new AbortController() });
        } else {
          run(id, file);
        }
      }
    },
    [area, client, run],
  );

  const cancel = useCallback((id: string) => {
    live.current.get(id)?.controller.abort();
  }, []);

  const retry = useCallback(
    (id: string) => {
      const entry = live.current.get(id);
      if (!entry) return;
      run(id, entry.file);
    },
    [run],
  );

  const dismiss = useCallback((id: string) => {
    live.current.get(id)?.controller.abort();
    live.current.delete(id);
    setTasks((current) => current.filter((t) => t.id !== id));
  }, []);

  const clearFinished = useCallback(() => {
    setTasks((current) => current.filter((t) => t.status === "uploading" || t.status === "queued"));
  }, []);

  return {
    tasks,
    add,
    cancel,
    retry,
    dismiss,
    clearFinished,
    busy: tasks.some((t) => t.status === "uploading" || t.status === "queued"),
  };
}
