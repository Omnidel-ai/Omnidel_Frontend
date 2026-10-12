"use client";

import { useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ActiveTaskSession } from "@/acharya/screens/task/ActiveTaskSession";
import { useAcharyaShell } from "@/components/acharya/shell/AcharyaShell";

/**
 * Active session inside the Acharya shell content box.
 * Header (portrait / name / Start conversation / Chat with…) stays mounted
 * from AcharyaShell — only the timer surface swaps in here.
 */
export default function AcharyaActiveTaskPage() {
  const params = useParams<{ slug: string; taskId: string }>();
  const searchParams = useSearchParams();
  const { setHeader, setActiveTaskContext } = useAcharyaShell();

  const slug = params.slug;
  const taskId = params.taskId;
  const attemptId = searchParams.get("attemptId");
  const checklistItemId = searchParams.get("checklistItemId");
  const taskHref = `/acharyas/${slug}/tasks/${taskId}`;
  const boardHref = `/acharyas/${slug}`;

  useEffect(() => {
    setHeader({ showBack: true });
  }, [setHeader]);

  useEffect(() => {
    setActiveTaskContext({
      taskId,
      chatHref: `${taskHref}?tab=chat`,
    });
    return () => setActiveTaskContext(null);
  }, [setActiveTaskContext, taskId, taskHref]);

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "var(--page)",
      }}
    >
      <ActiveTaskSession
        taskId={taskId}
        initialAttemptId={attemptId}
        initialChecklistItemId={checklistItemId}
        shell
        acharyaSlug={slug}
        returnTo={taskHref}
        doneReturnTo={boardHref}
      />
    </div>
  );
}
