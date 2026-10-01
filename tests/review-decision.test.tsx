import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import {
  ScoreDecision,
  decisionProblem,
  formatScoreOutOfTen,
  type ScoreDecisionValue,
} from "../src/omnipulse/ScoreDecision";

/**
 * The decision a reviewer makes: take the acharya's score, or give your own.
 *
 * Worth testing rather than eyeballing, because the control has a rule that is
 * easy to break without noticing — a task the acharya never scored has nothing
 * to accept, so the choice has to collapse rather than offering a button that
 * does nothing.
 */

function Harness({
  acharyaScore = 0.92,
  isSimpleTask = false,
}: {
  acharyaScore?: number | null;
  isSimpleTask?: boolean;
}) {
  const [value, setValue] = useState<ScoreDecisionValue>({
    mode: isSimpleTask ? "revise" : "accept",
    score: 9.2,
    feedback: "",
  });
  return (
    <>
      <ScoreDecision
        acharyaScore={acharyaScore}
        isSimpleTask={isSimpleTask}
        value={value}
        onChange={setValue}
      />
      {/* What the screen would act on, surfaced so a test can read it. */}
      <output data-testid="mode">{value.mode}</output>
      <output data-testid="score">{String(value.score)}</output>
      <output data-testid="feedback">{value.feedback}</output>
    </>
  );
}

describe("ScoreDecision", () => {
  it("opens on the acharya's score, with no input to fill in", () => {
    render(<Harness />);

    expect(screen.getByText("9.2/10")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use Acharya" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // Agreement is the common case, so it asks for nothing.
    expect(screen.queryByLabelText(/your score/i)).not.toBeInTheDocument();
  });

  it("reveals the input when the reviewer chooses to enter their own", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Enter my score" }));

    expect(screen.getByTestId("mode")).toHaveTextContent("revise");
    const input = screen.getByLabelText(/your score/i);
    expect(input).toBeInTheDocument();
    // It starts at the acharya's number: most overrides are an adjustment.
    expect(input).toHaveValue(9.2);
  });

  it("carries the reviewer's score back to the caller", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Enter my score" }));
    const input = screen.getByLabelText(/your score/i);
    await user.clear(input);
    await user.type(input, "7.5");

    expect(screen.getByTestId("score")).toHaveTextContent("7.5");
  });

  it("says so when a score is out of range, rather than accepting it", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Enter my score" }));
    const input = screen.getByLabelText(/your score/i);
    await user.clear(input);
    await user.type(input, "12");

    expect(await screen.findByRole("alert")).toHaveTextContent("between 0 and 10");
  });

  it("collapses the choice for a task the acharya never scored", () => {
    render(<Harness acharyaScore={null} isSimpleTask />);

    // Nothing to accept, so that button is not offered at all.
    expect(screen.queryByRole("button", { name: "Use Acharya" })).not.toBeInTheDocument();
    expect(screen.getByText(/did not score this one/i)).toBeInTheDocument();
    // And the input is there from the start.
    expect(screen.getByLabelText(/your score/i)).toBeInTheDocument();
  });

  it("keeps feedback optional, and counts what is typed", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.getByText("0/200")).toBeInTheDocument();
    await user.type(screen.getByLabelText(/feedback/i), "Good angles.");
    expect(screen.getByTestId("feedback")).toHaveTextContent("Good angles.");
    expect(screen.getByText("12/200")).toBeInTheDocument();
  });
});

describe("the decision's own rules", () => {
  it("formats a stored score the way the application shows it", () => {
    expect(formatScoreOutOfTen(0.92)).toBe("9.2/10");
    expect(formatScoreOutOfTen(null)).toBe("—");
  });

  it("lets an accepted score through without validating an unused input", () => {
    expect(decisionProblem({ mode: "accept", score: NaN, feedback: "" }, false)).toBeNull();
  });

  it("refuses a revised score outside 0–10", () => {
    expect(decisionProblem({ mode: "revise", score: 11, feedback: "" }, false)).toMatch(/0 and 10/);
    expect(decisionProblem({ mode: "revise", score: 7, feedback: "" }, false)).toBeNull();
  });

  it("validates a simple task even when the mode says accept", () => {
    // There is no acharya score to accept, so the number must still be good.
    expect(decisionProblem({ mode: "accept", score: 99, feedback: "" }, true)).toMatch(/0 and 10/);
  });
});
