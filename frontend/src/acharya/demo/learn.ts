import { TASKS } from "./data";

/**
 * What the Learn and Quiz tabs show in the demo.
 *
 * Production generates both per task with an AI model. The demo has one
 * hand-written lesson and quiz about doing and proving a task well, with the
 * task's title worked in, so every task has something real to read.
 */

interface LessonModule {
  title: string;
  summary: string;
  sections: { heading: string; body: string; keyPoints: string[] }[];
}

interface QuizQuestion {
  q: string;
  options: [string, string, string, string];
  correct: 0 | 1 | 2 | 3;
  explanation: string;
}

function titleOf(taskId: string): string {
  return TASKS.find((t) => t.id === taskId)?.title ?? "this task";
}

export function getDemoLesson(taskId: string): { status: "ready"; modules: LessonModule[] } {
  const title = titleOf(taskId);
  return {
    status: "ready",
    modules: [
      {
        title: "Before you start",
        summary: `Get clear on what "${title}" asks for, so the work is right the first time.`,
        sections: [
          {
            heading: "Read the task twice",
            body: "Most mistakes come from rushing the reading, not the work. Read the description, then say in your own words what *done* looks like.",
            keyPoints: ["Who is it for?", "What must the finished piece look like?", "When is it due?"],
          },
          {
            heading: "Lay out what you need",
            body: "Gather tools and material before the timer starts. A session spent searching for thread is a session lost.",
            keyPoints: ["Tools within reach", "Material measured", "Phone charged for proof photos"],
          },
        ],
      },
      {
        title: "Doing it well",
        summary: "Steady work in one focused session beats three distracted ones.",
        sections: [
          {
            heading: "Work in one session",
            body: "Press **Start** and keep going until the timer ends. Take your break when you need it — you have one per session.",
            keyPoints: ["One task at a time", "Use the break, do not skip it", "Note anything unusual as you go"],
          },
        ],
      },
      {
        title: "Showing your work",
        summary: "Good proof lets your manager score you fairly without visiting the bench.",
        sections: [
          {
            heading: "Photos that tell the story",
            body: "One photo of the whole piece, one close-up of the detail that matters, in daylight. Add a line saying what you did.",
            keyPoints: ["Whole piece", "Close-up of the detail", "One honest sentence"],
          },
        ],
      },
    ],
  };
}

export function getDemoQuiz(taskId: string): { questions: QuizQuestion[] } {
  const title = titleOf(taskId);
  return {
    questions: [
      {
        q: `Before starting "${title}", what should you do first?`,
        options: [
          "Start the timer straight away",
          "Read the task twice and picture what done looks like",
          "Ask a colleague to do it",
          "Take the proof photos",
        ],
        correct: 1,
        explanation: "Reading carefully first is what makes the work right the first time.",
      },
      {
        q: "How many breaks do you get in one work session?",
        options: ["None", "One", "As many as you like", "Three"],
        correct: 1,
        explanation: "Each session allows one break. Use it — do not skip it.",
      },
      {
        q: "Which proof photos help your manager most?",
        options: [
          "One blurry photo taken at night",
          "A selfie at the bench",
          "The whole piece plus a close-up of the key detail, in daylight",
          "No photo, just a message",
        ],
        correct: 2,
        explanation: "The whole piece shows completeness; the close-up shows quality.",
      },
    ],
  };
}
