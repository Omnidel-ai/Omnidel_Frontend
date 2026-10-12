"use client";

import type { AnamClient } from "@anam-ai/js-sdk";

/** Wait after stopStreaming so Anam frees the concurrent-session slot. */
const RELEASE_GRACE_MS = 3000;

let activeClient: AnamClient | null = null;
let lastReleasedAt = 0;
let operationChain: Promise<void> = Promise.resolve();

/** @internal — call only from within runExclusiveAnam or releaseGlobalAnamClient */
export async function releaseInsideLock(): Promise<void> {
  const client = activeClient;
  activeClient = null;
  if (!client) {
    lastReleasedAt = Date.now();
    return;
  }
  try {
    await client.stopStreaming();
  } catch {
    /* ignore teardown errors */
  }
  lastReleasedAt = Date.now();
}

export async function releaseGlobalAnamClient(): Promise<void> {
  return runExclusiveAnam(releaseInsideLock);
}

export async function waitForAnamSlot(): Promise<void> {
  const elapsed = Date.now() - lastReleasedAt;
  if (elapsed < RELEASE_GRACE_MS) {
    await new Promise((resolve) => setTimeout(resolve, RELEASE_GRACE_MS - elapsed));
  }
}

/** Release any in-flight session and wait for Anam's concurrency slot. Call before connect. */
export async function prepareAnamConnect(): Promise<void> {
  return runExclusiveAnam(async () => {
    await releaseInsideLock();
    await waitForAnamSlot();
  });
}

/** Serialize connect/disconnect — prevents Strict Mode or dual hooks from opening two sessions. */
export function runExclusiveAnam<T>(fn: () => Promise<T>): Promise<T> {
  const next = operationChain.then(fn);
  operationChain = next.then(
    () => {},
    () => {},
  );
  return next;
}

export function setGlobalAnamClient(client: AnamClient | null) {
  activeClient = client;
}

export function hasGlobalAnamClient(): boolean {
  return activeClient !== null;
}

export function isAnamConcurrencyError(err: unknown): boolean {
  if (err instanceof Error && /concurrency limit/i.test(err.message)) return true;
  if (err && typeof err === "object" && "message" in err) {
    return /concurrency limit/i.test(String((err as { message: unknown }).message));
  }
  return false;
}
