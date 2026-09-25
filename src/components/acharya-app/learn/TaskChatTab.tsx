"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import type { Lang } from "@/lib/store";
import type { AcharyaThreadHandle, StatusProposal } from "@/components/AcharyaThread";
import { isAnamLiveAvatarEnabled } from "@/lib/acharya-capabilities";

const AcharyaThread = dynamic(() => import("@/components/AcharyaThread"), {
  loading: () => (
    <div className="flex-1 flex items-center justify-center text-sm text-muted">
      Loading chat…
    </div>
  ),
  ssr: false,
});

const AnamAvatarPanel = dynamic(() => import("@/components/AnamAvatarPanel"), {
  ssr: false,
});

interface TaskShape {
  id: string;
  title: string;
  description: string | null;
  statusSlug: string;
  acharyaSlug?: string;
  acharyaName?: string;
  acharyaInitial?: string;
  acharyaAvatarUrl?: string | null;
}

interface Props {
  task: TaskShape;
  workspaceSlug: string;
  lang: Lang;
  returnTo?: string;
  doneReturnTo?: string;
}

const STATUS_VERB: Record<StatusProposal["status"], string> = {
  planned: "move this task back to planned",
  doing: "start working on this task",
  done: "mark this task as done",
};

export function TaskChatTab({ task, workspaceSlug, lang, returnTo, doneReturnTo }: Props) {
  const router = useRouter();
  const [taskStatus, setTaskStatus] = useState(task.statusSlug);
  const [proposal, setProposal] = useState<StatusProposal | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [anamAvailable, setAnamAvailable] = useState(false);
  const [anamProbeDone, setAnamProbeDone] = useState(false);
  const [anamRequested, setAnamRequested] = useState(false);
  const threadRef = useRef<AcharyaThreadHandle>(null);
  const storeLang = useStore((s) => s.lang);
  const activeLang = lang || storeLang;

  const acharyaName = task.acharyaName ?? "Acharya";
  const acharyaInitial = task.acharyaInitial ?? acharyaName.charAt(0).toUpperCase();
  const acharyaSlug = task.acharyaSlug;
  const acharyaAvatarUrl = task.acharyaAvatarUrl;
  // Live Anam avatar is Vivek-only for now (local config). Hide the entry point
  // everywhere else so non-Vivek boards never show Avatar / mint tokens.
  const anamAllowed = isAnamLiveAvatarEnabled(acharyaSlug);

  async function requestAnamPanel() {
    if (!anamAllowed) return;
    if (!workspaceSlug?.trim()) {
      alert(activeLang === "bn" ? "এই কাজের জন্য ওয়ার্কস্পেস পাওয়া যায়নি, তাই অ্যাভাটার চালু করা যাচ্ছে না।" : activeLang === "hi" ? "इस कार्य के लिए वर्कस्पेस नहीं मिला, इसलिए अवतार शुरू नहीं हो पा रहा है।" : "Workspace is missing for this task, so live avatar cannot start.");
      return;
    }
    setAnamRequested(true);
    if (anamProbeDone) return;
    try {
      const qs = new URLSearchParams({ workspace: workspaceSlug });
      if (acharyaSlug) qs.set("acharya", acharyaSlug);
      const r = await fetch(`/api/work/anam/availability?${qs.toString()}`);
      const data = await r.json().catch(() => null);
      setAnamAvailable(Boolean(data?.available));
      if (!data?.available) {
        alert(activeLang === "bn" ? "এই ওয়ার্কস্পেসে লাইভ অ্যাভাটার এখন উপলব্ধ নয়।" : activeLang === "hi" ? "इस वर्कस्पेस में लाइव अवतार अभी उपलब्ध नहीं है।" : "Live avatar is not available for this workspace right now.");
      }
    } catch {
      setAnamAvailable(false);
      alert(activeLang === "bn" ? "অ্যাভাটার চালু করতে সমস্যা হয়েছে, আবার চেষ্টা করুন।" : activeLang === "hi" ? "अवतार शुरू करने में समस्या हुई, फिर से कोशिश करें।" : "Could not start live avatar. Please try again.");
    } finally {
      setAnamProbeDone(true);
    }
  }

  async function applyProposal(p: StatusProposal) {
    if (confirming) return;
    setConfirming(true);
    const previous = taskStatus;
    setTaskStatus(p.status);
    try {
      const r = await fetch(`/api/work/tasks/${p.taskId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: p.status }),
      });
      if (!r.ok) throw new Error(`status ${r.status}`);
      await fetch(`/api/work/tasks/${p.taskId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: `[${p.status}] ${p.summary}` }),
      }).catch(() => null);
      setProposal(null);
      if (p.status === "doing") {
        const params = new URLSearchParams();
        if (returnTo) params.set("returnTo", returnTo);
        if (doneReturnTo) params.set("doneReturnTo", doneReturnTo);
        const qs = params.toString();
        router.push(`/tasks/${p.taskId}/active${qs ? `?${qs}` : ""}`);
      }
    } catch {
      setTaskStatus(previous);
      alert("Couldn't update status. Try again.");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      {anamAllowed && anamRequested && anamAvailable && (
        <AnamAvatarPanel
          workspaceSlug={workspaceSlug}
          taskId={task.id}
          acharyaSlug={acharyaSlug}
          acharyaName={acharyaName}
          acharyaInitial={acharyaInitial}
          acharyaAvatarUrl={acharyaAvatarUrl ?? undefined}
          lang={activeLang}
          openFullscreenOnMount
          onVoiceUserUtterance={(text) => { void threadRef.current?.sendUserMessage(text, { skipAppend: true }); }}
        />
      )}
      <AcharyaThread
        ref={threadRef}
        workspaceSlug={workspaceSlug}
        acharyaSlug={acharyaSlug}
        acharyaName={acharyaName}
        acharyaInitial={acharyaInitial}
        acharyaAvatarUrl={acharyaAvatarUrl ?? undefined}
        taskId={task.id}
        lang={activeLang}
        onOpenAvatar={anamAllowed ? () => { void requestAnamPanel(); } : undefined}
        onProposal={setProposal}
      />

      {proposal && (
        <ConfirmModal
          proposal={proposal}
          confirming={confirming}
          onCancel={() => setProposal(null)}
          onConfirm={() => void applyProposal(proposal)}
        />
      )}
    </div>
  );
}

function ConfirmModal({
  proposal,
  confirming,
  onCancel,
  onConfirm,
}: {
  proposal: StatusProposal;
  confirming: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const verb = STATUS_VERB[proposal.status];
  const isDone = proposal.status === "done";
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center px-3 pb-3 sm:pb-0"
      aria-modal="true"
      role="dialog"
    >
      <button
        type="button"
        aria-label="Cancel"
        onClick={onCancel}
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm fade-in"
      />
      <div
        className="relative w-full max-w-sm bg-surface rounded-md border border-line slide-up"
        style={{ boxShadow: "var(--shadow-md)" }}
      >
        <div className="px-5 pt-5">
          <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-muted">Confirm</p>
          <h3 className="font-serif italic text-xl text-ink mt-1 leading-tight" style={{ fontWeight: 500 }}>
            {`Should I ${verb}?`}
          </h3>
          <p className="text-[13.5px] text-ink-soft mt-2 leading-relaxed">{proposal.summary}</p>
        </div>
        <div className="px-3 pb-3 pt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={confirming}
            className="press flex-1 px-3 py-2.5 rounded text-sm font-semibold border border-line text-ink-soft hover:bg-surface-sunk disabled:opacity-50 transition-colors"
          >
            Not yet
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirming}
            className="press flex-1 px-3 py-2.5 rounded text-sm font-bold disabled:opacity-50 transition-colors"
            style={{
              background: isDone ? "var(--green)" : "var(--green-deep)",
              color: "var(--surface)",
            }}
          >
            {confirming ? "Updating…" : isDone ? "Yes, mark done" : "Yes, start"}
          </button>
        </div>
      </div>
    </div>
  );
}
