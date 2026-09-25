"use client";

import type { Lang } from "@/lib/store";
import { TaskCourseView } from "@/components/learn/TaskCourseView";

interface TaskShape {
  id: string;
  title: string;
  description: string | null;
  workspaceSlug?: string;
}

interface Props {
  task: TaskShape;
  workspaceSlug: string;
  acharyaSlug: string;
  lang: Lang;
}

/**
 * Learn surface: direct Acharya course only. External web/Google resources are
 * intentionally hidden from the worker UI for now.
 */
export function TaskLearnTab({ task, acharyaSlug, lang }: Props) {
  return <TaskCourseView task={task} acharyaSlug={acharyaSlug} lang={lang} />;
}
