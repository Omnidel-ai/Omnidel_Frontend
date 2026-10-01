import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AdminPage } from "../src/admin";
import type { DemoMaster } from "../src/data/types";

/**
 * The engine behind 23 screens.
 *
 * `AdminPage` is the component every admin master is rendered by, so a change
 * to it changes 23 screens at once — which is the whole argument for it, and
 * also the reason it is the component most worth testing.
 *
 * The descriptor here is deliberately small and made up rather than lifted
 * from `masters.json`: a test that reads real data starts failing when someone
 * edits a row, and a failure that is not a bug teaches people to ignore
 * failures.
 */
const MASTER: DemoMaster = {
  key: "lanes",
  label: "Lanes",
  singular: "Lane",
  module: "Admin",
  section: "Logistics",
  searchPlaceholder: "Search lanes…",
  emptyMessage: "No lanes yet",
  emptyHint: "A lane is a route between two places.",
  columns: [
    { key: "code", header: "Code", width: "120px", type: "code" },
    { key: "name", header: "Lane", width: "minmax(170px, 2fr)" },
    { key: "is_active", header: "Status", width: "120px", type: "status" },
  ],
  fields: [
    { key: "code", label: "Code", type: "text", required: true },
    { key: "name", label: "Lane", type: "text", required: true },
    { key: "is_active", label: "Active", type: "checkbox" },
  ],
  rows: [
    { id: "l1", code: "LN-001", name: "Howrah to Bagnan", is_active: true, is_archived: false },
    { id: "l2", code: "LN-002", name: "Kolkata to Barasat", is_active: true, is_archived: false },
    { id: "l3", code: "LN-003", name: "Sonarpur loop", is_active: false, is_archived: false },
  ],
};

describe("AdminPage", () => {
  it("opens on the active rows, holding the inactive one back", async () => {
    render(<AdminPage master={MASTER} />);

    // The screen opens through its skeleton — the rows are in hand, but the
    // loading state renders first so the real read has somewhere to go.
    expect(await screen.findByText("Howrah to Bagnan")).toBeInTheDocument();
    expect(screen.getByText("Kolkata to Barasat")).toBeInTheDocument();

    // The default view is Active, so the inactive lane is not in the table.
    // That is the behaviour, not an omission: someone opening a master wants
    // what is in use, and the others are one select away.
    expect(screen.queryByText("Sonarpur loop")).not.toBeInTheDocument();
  });

  it("reveals the inactive row when the view is widened", async () => {
    const user = userEvent.setup();
    render(<AdminPage master={MASTER} />);
    await screen.findByText("Howrah to Bagnan");

    // The view control is the application's own listbox, not a native select:
    // a button that opens a list of options.
    await user.click(screen.getByLabelText("View"));
    await user.click(await screen.findByRole("option", { name: "All" }));

    expect(await screen.findByText("Sonarpur loop")).toBeInTheDocument();
    expect(screen.getByText("Howrah to Bagnan")).toBeInTheDocument();
  });

  it("narrows the table as the reviewer types", async () => {
    const user = userEvent.setup();
    render(<AdminPage master={MASTER} />);

    await user.type(screen.getByPlaceholderText("Search lanes…"), "barasat");

    await waitFor(() => {
      expect(screen.getByText("Kolkata to Barasat")).toBeInTheDocument();
      expect(screen.queryByText("Howrah to Bagnan")).not.toBeInTheDocument();
    });
  });

  it("says a search found nothing, in different words from having nothing", async () => {
    const user = userEvent.setup();
    render(<AdminPage master={MASTER} />);

    await user.type(screen.getByPlaceholderText("Search lanes…"), "zzzz");

    // Not "No lanes yet" — there are lanes; this search simply missed.
    await waitFor(() => expect(screen.getByText(/no lanes match/i)).toBeInTheDocument());
    expect(screen.queryByText("No lanes yet")).not.toBeInTheDocument();
  });

  it("opens a form built from the descriptor's fields", async () => {
    const user = userEvent.setup();
    render(<AdminPage master={MASTER} />);

    await user.click(screen.getByRole("button", { name: /add lane/i }));

    const dialog = await screen.findByRole("dialog");
    // Every field the descriptor declares, and no others.
    expect(within(dialog).getByLabelText(/code/i)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/^lane/i)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/active/i)).toBeInTheDocument();
  });

  it("refuses to save a required field left empty", async () => {
    const user = userEvent.setup();
    render(<AdminPage master={MASTER} />);

    await user.click(screen.getByRole("button", { name: /add lane/i }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Create" }));

    // Still open, with the reason — rather than closing and losing the typing.
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(within(dialog).getAllByText(/required/i).length).toBeGreaterThan(0);
  });

  it("adds a row, and shows it in the table", async () => {
    const user = userEvent.setup();
    render(<AdminPage master={MASTER} />);

    await user.click(screen.getByRole("button", { name: /add lane/i }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/code/i), "LN-004");
    await user.type(within(dialog).getByLabelText(/^lane/i), "Bagnan to Uluberia");
    await user.click(within(dialog).getByRole("button", { name: "Create" }));

    await waitFor(() => expect(screen.getByText("Bagnan to Uluberia")).toBeInTheDocument());
  });
});
