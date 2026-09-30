import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createBlobUploadClient } from "./blobClient";
import type { UploadClient } from "./types";

const UploadClientContext = createContext<UploadClient | null>(null);

/**
 * Which client the upload controls use.
 *
 * Without a provider they use the real one, so a screen that just wants to
 * store a file writes nothing. Wrapping a subtree swaps in the mock — which is
 * how the playground shows a slow upload, a cancel and a retry without a Blob
 * store, and how a test would drive them.
 */
export function UploadClientProvider({
  client,
  children,
}: {
  client: UploadClient;
  children: ReactNode;
}) {
  return <UploadClientContext.Provider value={client}>{children}</UploadClientContext.Provider>;
}

export function useUploadClient(): UploadClient {
  const provided = useContext(UploadClientContext);
  // Memoised on the provided value so an unwrapped subtree does not build a
  // new client every render and restart the queue's callbacks with it.
  return useMemo(() => provided ?? createBlobUploadClient(), [provided]);
}
