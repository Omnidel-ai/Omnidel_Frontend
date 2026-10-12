/**
 * Pure domain definitions and comparison logic for the Acharya Action Decision Layer.
 *
 * Implements independent, peer-level decision evaluation comparing
 * Gemini 3.8 Flash Live against Jev (typesafe/jev-1.13) for tool/page/action selection.
 *
 * This file is purely functional and contains no network, secrets, or framework dependencies.
 */

export const ACTION_TOOLS = [
  "open_profile",
  "open_settings",
  "open_task_list",
  "open_task",
  "start_task",
  "take_break",
  "open_complete",
  "show_proof_text_tab",
  "show_proof_image_tab",
  "set_proof_text",
  "open_learn",
  "switch_tab",
  "create_quiz",
  "open_chat",
  "open_acharya",
  "go_home",
  "go_back",
  "get_task_details",
  "end_conversation",
  "none",
] as const;

export type ActionTool = (typeof ACTION_TOOLS)[number];

export const ACTION_TOOL_CRITERIA: Record<ActionTool, string> = {
  start_task: "Take the karigar into the active/doing view for this task so they can begin work (start timer / begin doing).",
  open_task: "Open one of the karigar's tasks so they can see its overview and details.",
  open_task_list: "Open this Acharya's task list (their board) or switch its lane tabs (todo, doing, review, done). Use for my tasks, task list, show the board, back to the list.",
  get_task_details: "Get a task's details: who assigned it, due date, how many sessions, what it is about, status, and progress.",
  open_learn: "Open the learning view for the current task so the karigar can study tutorials and guides before starting.",
  switch_tab: "Switch to a tab on screen: task, chat, quiz, learn, or comments.",
  open_chat: "Open Chat with this Acharya from board or task.",
  take_break: "On the running timer screen: open the Take a Break sheet.",
  open_complete: "On the running timer screen: open the Mark as Done / complete sheet so they can add proof.",
  show_proof_text_tab: "On the open proof/complete sheet: switch the UI to the Text note tab.",
  show_proof_image_tab: "On the open proof/complete sheet: switch the UI to the Image photos tab.",
  set_proof_text: "Write the karigar's note into the proof Text field.",
  create_quiz: "Create and open a quiz for the current task.",
  open_profile: "Open the karigar's Profile screen (view work card, monthly reports, badges, requests).",
  open_settings: "Open Settings screen or change app settings (language, speech, font, appearance, session).",
  open_acharya: "Open another Acharya's board by name/slug (talk to MahAcharya, Arjun, Vivek).",
  go_home: "Go to the app Home screen — the list of all Acharyas (not this Acharya's board).",
  go_back: "Navigate back to the previous screen.",
  end_conversation: "End the voice conversation because the karigar is done talking.",
  none: "General conversational chit-chat, greetings, or questions not mapping to any action or tool.",
};

export const ACTION_DECISION_INSTRUCTIONS =
  "Select the exact tool to execute or screen to open based on the user's action request.";

/**
 * Modes of operation for the Acharya Decision Layer:
 * - GEMINI_ONLY: Standard production mode; only Gemini Live makes the tool decision.
 * - JEV_ONLY: Jev makes the decision if confidence >= threshold, falling back to Gemini.
 * - GEMINI_AND_JEV_COMPARE: Both Gemini and Jev execute concurrently; Gemini drives the UI action
 *   safely while full comparison telemetry and latencies are recorded.
 */
export type ActionDecisionMode = "GEMINI_ONLY" | "JEV_ONLY" | "GEMINI_AND_JEV_COMPARE";

export function parseActionDecisionMode(raw: string | undefined): ActionDecisionMode {
  const val = (raw || "").trim().toUpperCase();
  if (val === "JEV_ONLY") return "JEV_ONLY";
  if (val === "GEMINI_AND_JEV_COMPARE" || val === "COMPARE" || val === "PARALLEL") {
    return "GEMINI_AND_JEV_COMPARE";
  }
  return "GEMINI_ONLY";
}

export interface ActionDecisionComparison {
  userRequest: string;
  expectedAction?: ActionTool;
  geminiTool: ActionTool;
  jevTool: ActionTool;
  jevConfidence: number;
  jevProbabilities?: Record<string, number>;
  agreement: boolean;
  geminiLatencyMs: number;
  jevLatencyMs: number;
  parallelLatencyMs: number;
  geminiCostUsd: number;
  jevCostUsd: number;
  geminiCorrect?: boolean;
  jevCorrect?: boolean;
  selectedAction: ActionTool;
  mode: ActionDecisionMode;
  geminiError?: string | null;
  jevError?: string | null;
}

export function evaluateActionComparison(params: {
  userRequest: string;
  expectedAction?: ActionTool;
  geminiTool: ActionTool;
  jevTool: ActionTool;
  jevConfidence: number;
  jevProbabilities?: Record<string, number>;
  geminiLatencyMs: number;
  jevLatencyMs: number;
  parallelLatencyMs: number;
  geminiCostUsd: number;
  jevCostUsd: number;
  mode: ActionDecisionMode;
  threshold?: number;
  geminiError?: string | null;
  jevError?: string | null;
}): ActionDecisionComparison {
  const agreement = params.geminiTool === params.jevTool;
  const threshold = params.threshold ?? 0.8;

  let selectedAction: ActionTool = params.geminiTool;
  if (params.mode === "JEV_ONLY") {
    selectedAction = params.jevConfidence >= threshold && !params.jevError ? params.jevTool : params.geminiTool;
  } else {
    // Both GEMINI_ONLY and GEMINI_AND_JEV_COMPARE default to Gemini for production safety
    selectedAction = params.geminiTool;
  }

  const res: ActionDecisionComparison = {
    userRequest: params.userRequest,
    expectedAction: params.expectedAction,
    geminiTool: params.geminiTool,
    jevTool: params.jevTool,
    jevConfidence: params.jevConfidence,
    jevProbabilities: params.jevProbabilities,
    agreement,
    geminiLatencyMs: params.geminiLatencyMs,
    jevLatencyMs: params.jevLatencyMs,
    parallelLatencyMs: params.parallelLatencyMs,
    geminiCostUsd: params.geminiCostUsd,
    jevCostUsd: params.jevCostUsd,
    selectedAction,
    mode: params.mode,
    geminiError: params.geminiError ?? null,
    jevError: params.jevError ?? null,
  };

  if (params.expectedAction) {
    res.geminiCorrect = params.geminiTool === params.expectedAction;
    res.jevCorrect = params.jevTool === params.expectedAction;
  }

  return res;
}
