import { blobViewUrl, kindOf, type StoredFile } from "../blob";
import { checkAgainst, policyFor } from "./blobClient";
import { CancelledError, type UploadClient } from "./types";

export interface MockOptions {
  /** How long a file of any size takes, in milliseconds. */
  duration?: number;
  /**
   * Files whose name matches this fail partway through.
   *
   * The default catches anything with "fail" in its name, so a failure — and
   * the retry that follows it — can be demonstrated by naming a file
   * `fail.png` rather than by unplugging the network.
   */
  failOn?: RegExp;
  /** Where in the upload a failing file gives up, 0–1. */
  failAt?: number;
}

/**
 * An upload client that stores nothing and takes its time about it.
 *
 * The states that matter in an upload control are the ones that are hard to
 * reach on purpose: a bar moving slowly enough to read, a cancel that lands
 * mid-flight, a failure with a retry after it. A real store gives you those on
 * a bad day; this gives you them on demand, which is what makes the control
 * reviewable and testable.
 *
 * It is the same interface as the real client, so the components under test
 * are the components that ship.
 */
export function createMockUploadClient(options: MockOptions = {}): UploadClient {
  const duration = options.duration ?? 2400;
  const failOn = options.failOn ?? /fail/i;
  const failAt = options.failAt ?? 0.45;

  return {
    demo: true,

    policy(area) {
      return policyFor(area);
    },

    check(file, area) {
      return checkAgainst(file, area);
    },

    start(file, opts) {
      const problem = checkAgainst(file, opts.area);
      if (problem) return Promise.reject(new Error(problem.message));

      return new Promise<StoredFile>((resolve, reject) => {
        const started = Date.now();
        const shouldFail = failOn.test(file.name);
        let timer = 0;

        const stop = () => window.clearInterval(timer);

        const onAbort = () => {
          stop();
          reject(new CancelledError());
        };
        opts.signal?.addEventListener("abort", onAbort, { once: true });
        if (opts.signal?.aborted) return onAbort();

        timer = window.setInterval(() => {
          const fraction = Math.min(1, (Date.now() - started) / duration);
          opts.onProgress?.(fraction);

          if (shouldFail && fraction >= failAt) {
            stop();
            opts.signal?.removeEventListener("abort", onAbort);
            reject(new Error("The connection dropped partway through. Try again."));
            return;
          }

          if (fraction >= 1) {
            stop();
            opts.signal?.removeEventListener("abort", onAbort);
            const pathname = `${opts.area}/${opts.slug}/${Date.now()}-${file.name}`;
            resolve({
              // An object URL, so the picture a mock "stored" still renders.
              src: URL.createObjectURL(file),
              url: "",
              pathname,
              name: file.name,
              size: file.size,
              type: file.type,
              kind: kindOf(file) ?? "data",
              demo: true,
            });
          }
        }, 80);
      });
    },

    async remove() {
      // Nothing was stored, so nothing is removed. The control still asks,
      // which is the point: it behaves the same against either client.
    },

    resolveUrl(fileId) {
      return blobViewUrl(fileId);
    },
  };
}
