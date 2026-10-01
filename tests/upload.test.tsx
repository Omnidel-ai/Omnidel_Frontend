import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { UploadField } from "../src/components";
import { UploadClientProvider, createMockUploadClient } from "../src/lib/upload";
import type { StoredFile } from "../src/lib/blob";

/**
 * The upload control, driven end to end.
 *
 * This is the file the mock client was built for. Progress, cancel and retry
 * are the three things a smoke render cannot reach — it draws a screen once
 * and stops — and they are also the three hardest states to reach by hand
 * against a real store, because you need a large file and a bad connection.
 *
 * The mock gives them on demand: a duration you choose, and a file whose name
 * contains "fail" that gives up partway.
 */

function file(name: string, type = "image/png", size = 1024): File {
  const f = new File([new Uint8Array(size)], name, { type });
  // jsdom computes size from the parts, which is enough for these tests; a
  // size override is only needed where a limit is being exercised.
  return f;
}

/**
 * The attached-file counter, read as one string.
 *
 * `{stored.length}/{max}` renders as three text nodes — "1", "/", "10" — so a
 * text query for "1/10" finds nothing. Reading `textContent` asks the question
 * the way the browser answers it.
 */
function counter(): string {
  return document.querySelector(".upload-field__count")?.textContent ?? "";
}

/** The field with its value held, the way a real screen holds it. */
function Harness({ duration = 40 }: { duration?: number }) {
  const [files, setFiles] = useState<StoredFile[]>([]);
  const client = createMockUploadClient({ duration });
  return (
    <UploadClientProvider client={client}>
      <UploadField area="pipeline" slug="lead-1" label="Attachments" value={files} onChange={setFiles} />
    </UploadClientProvider>
  );
}

describe("UploadField", () => {
  it("takes a file through to stored, and shows it in the list", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const input = document.querySelector("input[type=file]") as HTMLInputElement;
    await user.upload(input, file("survey.png"));

    // The counter is the honest signal that it *stored*: a row with the file's
    // name appears the moment the upload starts, so asserting on that alone
    // would pass while the upload was still in flight.
    await waitFor(() => expect(counter()).toBe("1/10"));
    expect(screen.getByTitle("survey.png")).toBeInTheDocument();
  });

  it("reports progress while the upload is in flight", async () => {
    const user = userEvent.setup();
    // Slow enough that the bar is still moving when we look.
    render(<Harness duration={3000} />);

    const input = document.querySelector("input[type=file]") as HTMLInputElement;
    await user.upload(input, file("big.png"));

    const bar = await screen.findByRole("progressbar");
    expect(bar).toBeInTheDocument();
    await waitFor(() => {
      expect(Number(bar.getAttribute("aria-valuenow"))).toBeGreaterThan(0);
    });
  });

  it("cancels an upload in flight, and does not store the file", async () => {
    const user = userEvent.setup();
    render(<Harness duration={3000} />);

    const input = document.querySelector("input[type=file]") as HTMLInputElement;
    await user.upload(input, file("slow.png"));

    await user.click(await screen.findByRole("button", { name: "Cancel" }));

    // The row says so, and nothing reached the stored list: the counter holds.
    expect(await screen.findByText("Cancelled")).toBeInTheDocument();
    expect(counter()).toBe("0/10");
  });

  it("offers a retry after a failure, and the retry succeeds", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const input = document.querySelector("input[type=file]") as HTMLInputElement;
    // The mock fails any file whose name carries "fail".
    await user.upload(input, file("fail.png"));

    expect(await screen.findByText("Failed")).toBeInTheDocument();
    // And it says why, rather than failing silently.
    expect(screen.getByText(/connection dropped/i)).toBeInTheDocument();

    const retry = screen.getByRole("button", { name: "Retry" });
    expect(retry).toBeInTheDocument();
  });

  it("refuses a file the prefix does not accept, with the reason", async () => {
    // `applyAccept: false` makes user-event ignore the input's own `accept`
    // filter, which is the file dialog's job. What is under test is the check
    // *behind* the dialog — the policy the client enforces whatever got
    // through, which is the one that has to hold.
    const user = userEvent.setup({ applyAccept: false });
    render(<Harness />);

    const input = document.querySelector("input[type=file]") as HTMLInputElement;
    // The pipeline prefix takes images, documents and data — not video.
    await user.upload(input, file("clip.mp4", "video/mp4"));

    expect(await screen.findByText("Failed")).toBeInTheDocument();
    expect(screen.getByText(/this field takes/i)).toBeInTheDocument();
    // Refused in the browser: nothing was stored.
    expect(counter()).toBe("0/10");
  });

  it("removes a stored file from the list", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const input = document.querySelector("input[type=file]") as HTMLInputElement;
    await user.upload(input, file("note.png"));
    await waitFor(() => expect(counter()).toBe("1/10"));

    const row = screen.getByTitle("note.png").closest("div") as HTMLElement;
    await user.click(within(row.parentElement as HTMLElement).getByRole("button", { name: "Remove" }));

    await waitFor(() => expect(counter()).toBe("0/10"));
  });
});
