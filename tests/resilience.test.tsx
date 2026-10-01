import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ErrorBoundary, Table, type Column } from "../src/components";

/**
 * The two behaviours that only exist in a browser.
 *
 * `ErrorBoundary` cannot be covered by the smoke render at all — React's
 * server renderer rethrows instead of letting a boundary catch — so this file
 * is the only place it is checked. And a table's search is interaction by
 * definition: the markup is identical before and after typing.
 */

/** Throws on render, so the boundary has something to catch. */
function Boom({ message = "boom" }: { message?: string }): never {
  throw new Error(message);
}

describe("ErrorBoundary", () => {
  // The boundary logs the crash on purpose. A test run full of red stack
  // traces hides the real failures, so it is silenced here and only here.
  let spy: ReturnType<typeof vi.spyOn>;
  beforeAll(() => {
    spy = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterAll(() => spy.mockRestore());

  it("shows the children when nothing is wrong", () => {
    render(
      <ErrorBoundary>
        <p>the screen</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText("the screen")).toBeInTheDocument();
  });

  it("catches a crash and says what happened, instead of blanking", () => {
    render(
      <ErrorBoundary>
        <Boom message="could not read rows" />
      </ErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("This screen stopped working.")).toBeInTheDocument();
    // The reason is shown rather than swallowed.
    expect(screen.getByText("could not read rows")).toBeInTheDocument();
    // And it says the rest of the workspace survived, which is the point.
    expect(screen.getByText(/navigation still works/i)).toBeInTheDocument();
  });

  it("recovers when the cause has gone away", async () => {
    const user = userEvent.setup();

    function Flaky() {
      const [broken, setBroken] = useState(true);
      return (
        <>
          <button type="button" onClick={() => setBroken(false)}>
            fix it
          </button>
          <ErrorBoundary>{broken ? <Boom /> : <p>working again</p>}</ErrorBoundary>
        </>
      );
    }

    render(<Flaky />);
    expect(screen.getByRole("alert")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "fix it" }));
    await user.click(screen.getByRole("button", { name: /try this screen again/i }));

    expect(screen.getByText("working again")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("uses a caller's own fallback when one is given", () => {
    render(
      <ErrorBoundary fallback={(error) => <p>custom: {error.message}</p>}>
        <Boom message="nope" />
      </ErrorBoundary>,
    );
    expect(screen.getByText("custom: nope")).toBeInTheDocument();
  });
});

interface Row {
  id: string;
  name: string;
  city: string;
}

const COLUMNS: Column<Row>[] = [
  { key: "name", header: "Name", width: "1fr" },
  { key: "city", header: "City", width: "1fr" },
];

const ROWS: Row[] = [
  { id: "1", name: "Rahul Mondal", city: "Kolkata" },
  { id: "2", name: "Sneha Pal", city: "Howrah" },
];

describe("Table", () => {
  it("draws the rows it is given", () => {
    render(<Table columns={COLUMNS} data={ROWS} rowKey={(r) => r.id} />);
    expect(screen.getByText("Rahul Mondal")).toBeInTheDocument();
    expect(screen.getByText("Sneha Pal")).toBeInTheDocument();
  });

  it("tells the difference between having nothing and finding nothing", () => {
    const { rerender } = render(
      <Table
        columns={COLUMNS}
        data={[]}
        rowKey={(r) => r.id}
        emptyVariant="empty"
        emptyMessage="No kaarigars yet"
      />,
    );
    expect(screen.getByText("No kaarigars yet")).toBeInTheDocument();

    // The same empty table, but after a search — a different situation, and
    // the one most applications get wrong by showing the same words.
    rerender(
      <Table
        columns={COLUMNS}
        data={[]}
        rowKey={(r) => r.id}
        emptyVariant="no-results"
        emptyMessage="No kaarigars match “xyz”"
      />,
    );
    expect(screen.getByText("No kaarigars match “xyz”")).toBeInTheDocument();
  });

  it("shows a skeleton while loading, and no rows", () => {
    const { container } = render(
      <Table columns={COLUMNS} data={ROWS} rowKey={(r) => r.id} loading />,
    );
    expect(container.querySelector(".skeleton-bar")).toBeInTheDocument();
    expect(screen.queryByText("Rahul Mondal")).not.toBeInTheDocument();
  });
});
