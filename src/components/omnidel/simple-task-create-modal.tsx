"use client";

/**
 * Simple task modal — create + edit.
 * Fields stay minimal (title, desc, list, acharya, assignees, due).
 * Files + Comments & Notes match the normal task modal (accordion + right column).
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { CustomSelect } from "@/components/omnidel/custom-select";
import { MemberMultiSelect } from "@/components/omnidel/member-multi-select";
import { AcharyaPicker } from "@/components/omnidel/acharya-picker";
import { ShareButton } from "@/components/omnidel/share-sheet";
import { buildTaskShareContent, type ShareableTask } from "@/lib/omnipulse/task-share";
import { RichTextEditor, isRichTextEmpty, isTiptapDoc } from "@/components/omnidel/rich-text-editor";
import { DatePicker } from "@/components/omnidel/date-picker";
import { CommentComposer, COMMENT_EMPTY_DOC, type ComposerAttachment } from "@/components/omnidel/comment-composer";
import { CommentActionsMenu } from "@/components/omnidel/comment-actions-menu";
import { ConfirmDialog } from "@/components/omnidel/confirm-dialog";
import { ImageLightbox, type LightboxImage } from "@/components/omnidel/image-lightbox";
import { useIsMobile } from "@/lib/client/use-is-mobile";
import { usePermissions } from "@/lib/client/permissions";
import { clampToMaxLength, TASK_TITLE_MAX } from "@/lib/field-limits";
import { cachedJson, invalidateCached } from "@/lib/client/options-cache";
import { resolveSimpleTaskTypeIdFromOptions } from "@/lib/simple-task";
import { uploadPipelineFile } from "@/lib/client/upload-blob-file";
import { blobViewUrl } from "@/lib/client/blob-url";
import { Markdown } from "@/components/omnidel/markdown";
import { useTr } from "@/lib/client/language";

/** Mirrors server COMMENT_EDIT_WINDOW_MS — author can edit/delete within 15 min. */
const COMMENT_EDIT_WINDOW_MS = 15 * 60 * 1000;

interface BoardListOption {
  id: string;
  name: string;
  sort_order: number;
}

interface TaskNote {
  id: string;
  author_user_id?: string | null;
  author_name?: string | null;
  note_type: string;
  content: string | null;
  attachments?: Array<{ url?: string; name?: string; type?: string; size?: number }> | null;
  created_on: string;
  edited_at?: string | null;
}

interface PendingFile {
  key: string;
  file: File;
}

interface Attachment {
  url: string;
  name: string;
  size: number;
  type: string;
  docType?: string;
}

interface FileNoteRow {
  noteId: string;
  att: Attachment;
  uploadedAt: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Create only — called after a new task is created (and optional files/comment posted). */
  onCreated?: (newTaskId: string) => void;
  /** Edit only — refresh board after save / file / comment mutations. */
  onMutate?: () => void;
  boardId: string;
  /** When set, modal is edit mode for this task. */
  taskId?: string | null;
  initialListId?: string;
  initialDueDate?: string;
  users?: { id: string; name: string }[];
  canManage?: boolean;
}

export function SimpleTaskCreateModal({
  open,
  onClose,
  onCreated,
  onMutate,
  boardId,
  taskId = null,
  initialListId,
  initialDueDate,
  users: usersProp,
  canManage = true,
}: Props) {
  const tr = useTr();
  const isEdit = Boolean(taskId);
  const isMobile = useIsMobile();
  const { userId, isAdmin } = usePermissions();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [listId, setListId] = useState("");
  const [boardLists, setBoardLists] = useState<BoardListOption[]>([]);
  const [acharyaId, setAcharyaId] = useState<string | null>(null);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState("");
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [simpleTypeId, setSimpleTypeId] = useState<string | null>(null);
  const [typeError, setTypeError] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusLabel, setStatusLabel] = useState<string | null>(null);
  // Saved snapshot of the fields the share message quotes — deliberately NOT
  // the live inputs, so an unsaved edit never goes out next to a link that
  // still shows the old value. Refreshed after a successful save.
  const [shareTask, setShareTask] = useState<ShareableTask | null>(null);
  const [shareOrigin, setShareOrigin] = useState("");
  // window.location.origin only exists on the client; reading it in an effect
  // (not during render) keeps SSR and the first client render identical.
  useEffect(() => { setShareOrigin(window.location.origin); }, []);
  const shareContent = useMemo(
    () => (shareTask ? buildTaskShareContent(shareTask, shareOrigin) : null),
    [shareTask, shareOrigin],
  );

  // Create: staged files / comment. Edit: live notes from API.
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [createComment, setCreateComment] = useState(COMMENT_EMPTY_DOC);
  const [createCommentAtts, setCreateCommentAtts] = useState<ComposerAttachment[]>([]);
  const [notes, setNotes] = useState<TaskNote[]>([]);
  const [uploading, setUploading] = useState(false);
  const [fileDeletingId, setFileDeletingId] = useState<string | null>(null);
  const [noteError, setNoteError] = useState("");
  const [showAddComment, setShowAddComment] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(true);
  const [commentContent, setCommentContent] = useState(COMMENT_EMPTY_DOC);
  const [commentAttachments, setCommentAttachments] = useState<ComposerAttachment[]>([]);
  const [savingComment, setSavingComment] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState(COMMENT_EMPTY_DOC);
  const [editAttachments, setEditAttachments] = useState<ComposerAttachment[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null);
  const [deletingNote, setDeletingNote] = useState(false);
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [dirty, setDirty] = useState(false);

  const fileNoteRows: FileNoteRow[] = (() => {
    const files: FileNoteRow[] = [];
    const seen = new Set<string>();
    for (const note of notes) {
      if (note.note_type !== "file" || !Array.isArray(note.attachments)) continue;
      for (const att of note.attachments) {
        const normalized = normalizeAttachment(att, note.content);
        if (!normalized.url || seen.has(normalized.url)) continue;
        seen.add(normalized.url);
        files.push({ noteId: note.id, att: normalized, uploadedAt: note.created_on });
      }
    }
    return files;
  })();
  const commentNotes = notes.filter((n) => n.note_type !== "file");
  const filesCount = isEdit ? fileNoteRows.length : pendingFiles.length;

  const fetchBoardMentions = useCallback(async (query: string) => {
    if (!boardId) return [];
    try {
      const res = await fetch(
        `/api/omnipulse/boards/${boardId}/mentions?q=${encodeURIComponent(query)}`,
      );
      if (!res.ok) return [];
      const data = await res.json();
      return data.items || [];
    } catch (err) {
      console.error("[mentions] board fetch failed:", err);
      return [];
    }
  }, [boardId]);

  const resetCreateForm = useCallback(() => {
    setTitle("");
    setDescription("");
    setAcharyaId(null);
    setAssigneeIds([]);
    setDueDate(initialDueDate || "");
    setPendingFiles([]);
    setCreateComment(COMMENT_EMPTY_DOC);
    setCreateCommentAtts([]);
    setNotes([]);
    setStatusLabel(null);
    setShareTask(null);
    setError("");
    setTypeError("");
    setNoteError("");
    setSaving(false);
    setDirty(false);
    setShowAddComment(false);
    setCommentsOpen(true);
    setCommentContent(COMMENT_EMPTY_DOC);
    setCommentAttachments([]);
    setFileDeletingId(null);
    setEditingNoteId(null);
    setEditContent(COMMENT_EMPTY_DOC);
    setEditAttachments([]);
    setEditError("");
    setDeleteNoteId(null);
  }, [initialDueDate]);

  useEffect(() => {
    if (!open || !isEdit) return;
    const t = window.setInterval(() => setNowTs(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, [open, isEdit]);

  useEffect(() => {
    if (!open) return;

    invalidateCached("/api/omnipulse/tasks/options");
    cachedJson<{
      users?: { id: string; name: string }[];
      taskTypes?: { id: string; slug?: string | null; name_en?: string }[];
      simple_task_type_id?: string | null;
    }>("/api/omnipulse/tasks/options", 0).then((opt) => {
      if (!usersProp) setUsers(opt.users ?? []);
      const id =
        (opt.simple_task_type_id && String(opt.simple_task_type_id).trim()) ||
        resolveSimpleTaskTypeIdFromOptions(opt.taskTypes ?? []);
      setSimpleTypeId(id);
      if (!id) {
        setTypeError(
          "Create a “Simple Task” under Admin → Task Types (slug: simple or simple_task). No env UUID is required — the app picks the id from this server’s task types.",
        );
      }
    }).catch(() => {
      setTypeError("Could not load task types.");
    });

    fetch(`/api/omnipulse/boards/${boardId}/lists`)
      .then((r) => r.json())
      .then((data) => {
        const lists = (data.items ?? data.lists ?? []) as BoardListOption[];
        const sorted = [...lists].sort((a, b) => a.sort_order - b.sort_order);
        setBoardLists(sorted);
        if (!taskId) {
          const prefer = initialListId && sorted.some((l) => l.id === initialListId)
            ? initialListId
            : sorted[0]?.id ?? "";
          setListId(prefer);
        }
      })
      .catch(() => setBoardLists([]));
  }, [open, boardId, initialListId, taskId, usersProp]);

  useEffect(() => {
    if (usersProp) setUsers(usersProp);
  }, [usersProp]);

  useEffect(() => {
    if (!open) return;
    if (!taskId) {
      resetCreateForm();
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");
    setNoteError("");
    setDirty(false);
    setShowAddComment(false);

    Promise.all([
      fetch(`/api/omnipulse/tasks/${taskId}`).then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error((data as { error?: string }).error || "Failed to load task");
        return data as { item?: Record<string, unknown> };
      }),
      fetch(`/api/omnipulse/tasks/${taskId}/notes?per_page=200`).then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error((data as { error?: string }).error || "Failed to load notes");
        return data as { items?: TaskNote[] };
      }),
    ])
      .then(([taskRes, notesRes]) => {
        if (cancelled) return;
        const item = taskRes.item || {};
        setTitle(String(item.title || ""));
        setDescription(typeof item.description === "string" ? item.description : "");
        setListId(typeof item.list_id === "string" ? item.list_id : "");
        setAcharyaId(typeof item.acharya_id === "string" ? item.acharya_id : null);
        const assignees = Array.isArray(item.assignees)
          ? (item.assignees as { id: string }[]).map((a) => a.id)
          : (typeof item.assigned_to === "string" && item.assigned_to ? [item.assigned_to] : []);
        setAssigneeIds(assignees);
        setDueDate(typeof item.due_date === "string" && item.due_date ? item.due_date.slice(0, 10) : "");
        setStatusLabel(
          typeof item.status_label === "string"
            ? item.status_label
            : typeof item.list_name === "string"
              ? item.list_name
              : null,
        );
        setNotes(Array.isArray(notesRes.items) ? notesRes.items : []);
        setShareTask({
          id: taskId,
          title: String(item.title || ""),
          board_id: typeof item.board_id === "string" ? item.board_id : boardId,
          board_name: typeof item.board_name === "string" ? item.board_name : null,
          list_name: typeof item.list_name === "string" ? item.list_name : null,
          status: typeof item.status === "string" ? item.status : null,
          status_label: typeof item.status_label === "string" ? item.status_label : null,
          priority: typeof item.priority === "string" ? item.priority : null,
          due_date: typeof item.due_date === "string" ? item.due_date : null,
          assignees: Array.isArray(item.assignees) ? (item.assignees as { id: string; name: string }[]) : null,
          assigned_to_name: typeof item.assigned_to_name === "string" ? item.assigned_to_name : null,
          project_name: typeof item.project_name === "string" ? item.project_name : null,
        });
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load task");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [open, taskId, boardId, resetCreateForm]);

  function markDirty() {
    if (isEdit) setDirty(true);
  }

  async function postFileNote(targetTaskId: string, file: File) {
    const att = await uploadPipelineFile(file);
    const noteRes = await fetch(`/api/omnipulse/tasks/${targetTaskId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        note_type: "file",
        content: `[document] ${att.name}`,
        attachments: [{ ...att, docType: "document" }],
      }),
    });
    if (!noteRes.ok) {
      const d = await noteRes.json().catch(() => ({}));
      throw new Error((d as { error?: string }).error || `Failed to attach ${file.name}`);
    }
    return (await noteRes.json()) as { item: TaskNote };
  }

  async function postCommentNote(
    targetTaskId: string,
    content: string,
    attachments: ComposerAttachment[] = [],
  ) {
    const images = attachments.filter((a) => a.type?.startsWith("image/"));
    const noteRes = await fetch(`/api/omnipulse/tasks/${targetTaskId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        note_type: "note",
        content,
        attachments: images,
      }),
    });
    if (!noteRes.ok) {
      const d = await noteRes.json().catch(() => ({}));
      throw new Error((d as { error?: string }).error || "Failed to post comment");
    }
    return (await noteRes.json()) as { item: TaskNote };
  }

  async function handleCreate() {
    setError("");
    const t = title.trim();
    if (!t) {
      setError("Title is required.");
      return;
    }
    if (!listId) {
      setError("Pick a list (card).");
      return;
    }
    if (!acharyaId) {
      setError("Pick an Acharya.");
      return;
    }
    if (assigneeIds.length === 0) {
      setError("Assign at least one person.");
      return;
    }
    if (!simpleTypeId) {
      setError(typeError || "Simple Task type is not configured.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/omnipulse/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: t,
          description: description.trim() || null,
          board_id: boardId,
          list_id: listId,
          task_type_id: simpleTypeId,
          acharya_id: acharyaId,
          assignee_ids: assigneeIds,
          due_date: dueDate || null,
          priority: "medium",
          session_count: 1,
          session_count_auto: false,
          break_allowance_total: 0,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error || "Failed to create task.");
        return;
      }
      const newId = (data as { item?: { id?: string }; id?: string }).item?.id
        ?? (data as { id?: string }).id;
      if (!newId) {
        setError("Created but no task id returned.");
        return;
      }

      // Attach staged files + optional first comment after the task exists.
      for (const pf of pendingFiles) {
        try {
          await postFileNote(newId, pf.file);
        } catch (err) {
          console.error("[simple-task] post-create file failed:", err);
        }
      }
      if (!isRichTextEmpty(createComment) || createCommentAtts.length > 0) {
        try {
          await postCommentNote(newId, createComment, createCommentAtts);
        } catch (err) {
          console.error("[simple-task] post-create comment failed:", err);
        }
      }

      onCreated?.(newId);
      onClose();
    } catch {
      setError("Network error creating task.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    if (!taskId || !canManage) return;
    setError("");
    const t = title.trim();
    if (!t) {
      setError("Title is required.");
      return;
    }
    if (!listId) {
      setError("Pick a list (card).");
      return;
    }
    if (!acharyaId) {
      setError("Pick an Acharya.");
      return;
    }
    if (assigneeIds.length === 0) {
      setError("Assign at least one person.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/omnipulse/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: t,
          description: description.trim() || null,
          list_id: listId,
          acharya_id: acharyaId,
          assignee_ids: assigneeIds,
          due_date: dueDate || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error || "Failed to save task.");
        return;
      }
      setDirty(false);
      // Keep the share snapshot on the values that just landed in the DB.
      setShareTask((prev) => prev && {
        ...prev,
        title: t,
        due_date: dueDate || null,
        list_name: boardLists.find((l) => l.id === listId)?.name ?? prev.list_name,
        assignees: assigneeIds.map((id) => ({ id, name: users.find((u) => u.id === id)?.name || "" })),
      });
      onMutate?.();
    } catch {
      setError("Network error saving task.");
    } finally {
      setSaving(false);
    }
  }

  async function handleEditFileUpload(files: FileList | null) {
    if (!taskId || !files || files.length === 0 || !canManage) return;
    setUploading(true);
    setNoteError("");
    for (const file of Array.from(files)) {
      try {
        const { item } = await postFileNote(taskId, file);
        setNotes((prev) => [item, ...prev]);
        onMutate?.();
      } catch (err) {
        setNoteError(err instanceof Error ? err.message : "Upload failed");
      }
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function removeFileNote(noteId: string, url: string) {
    if (!taskId || !canManage) return;
    setFileDeletingId(noteId);
    setNoteError("");
    const res = await fetch(`/api/omnipulse/tasks/${taskId}/attachments`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setNoteError((data as { error?: string }).error || "Failed to delete file");
      setFileDeletingId(null);
      return;
    }
    if ((data as { deleteBlob?: boolean }).deleteBlob !== false) {
      try {
        await fetch("/api/uploads", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
      } catch {
        /* best-effort blob cleanup */
      }
    }
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
    setFileDeletingId(null);
    onMutate?.();
  }

  async function addEditComment() {
    if (!taskId || savingComment) return;
    if (isRichTextEmpty(commentContent) && commentAttachments.length === 0) {
      setNoteError("Comment is required");
      return;
    }
    setSavingComment(true);
    setNoteError("");
    try {
      const { item } = await postCommentNote(taskId, commentContent, commentAttachments);
      setNotes((prev) => [item, ...prev]);
      setCommentContent(COMMENT_EMPTY_DOC);
      setCommentAttachments([]);
      setShowAddComment(false);
      onMutate?.();
    } catch (err) {
      setNoteError(err instanceof Error ? err.message : "Failed to add comment");
    } finally {
      setSavingComment(false);
    }
  }

  function withinCommentWindow(createdOn: string): boolean {
    return nowTs - new Date(createdOn).getTime() <= COMMENT_EDIT_WINDOW_MS;
  }
  function canEditComment(note: TaskNote): boolean {
    return note.note_type === "note" && note.author_user_id === userId && withinCommentWindow(note.created_on);
  }
  function canDeleteComment(note: TaskNote): boolean {
    if (note.note_type !== "note") return false;
    if (isAdmin || canManage) return true;
    return note.author_user_id === userId && withinCommentWindow(note.created_on);
  }

  function startEditComment(note: TaskNote) {
    setEditingNoteId(note.id);
    setEditContent(note.content || COMMENT_EMPTY_DOC);
    setEditAttachments([]);
    setEditError("");
  }

  function cancelEditComment() {
    setEditingNoteId(null);
    setEditContent(COMMENT_EMPTY_DOC);
    setEditAttachments([]);
    setEditError("");
  }

  async function saveEditComment(noteId: string) {
    if (!taskId) return;
    setEditError("");
    if (isRichTextEmpty(editContent) && editAttachments.length === 0) {
      setEditError("Comment is required");
      return;
    }
    setSavingEdit(true);
    try {
      if (!isRichTextEmpty(editContent)) {
        const res = await fetch(`/api/omnipulse/tasks/${taskId}/notes/${noteId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: editContent.trim() }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setEditError((data as { error?: string }).error || "Failed to edit comment");
          return;
        }
        setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, ...(data as { item: TaskNote }).item } : n)));
      }
      cancelEditComment();
      onMutate?.();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to edit comment");
    } finally {
      setSavingEdit(false);
    }
  }

  async function confirmDeleteComment() {
    const noteId = deleteNoteId;
    if (!noteId || !taskId) return;
    const comment = notes.find((n) => n.id === noteId);
    setDeletingNote(true);
    setNoteError("");
    try {
      const res = await fetch(`/api/omnipulse/tasks/${taskId}/notes/${noteId}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setNoteError((d as { error?: string }).error || "Failed to delete comment");
        return;
      }
      for (const att of comment?.attachments || []) {
        if (!att?.url) continue;
        try {
          await fetch("/api/uploads", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: att.url }),
          });
        } catch {
          /* best-effort */
        }
      }
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      setDeleteNoteId(null);
      onMutate?.();
    } finally {
      setDeletingNote(false);
    }
  }

  if (!open) return null;

  const busy = saving || loading || uploading || savingComment || savingEdit || deletingNote;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? "Simple task" : "New simple task"}
      style={overlayStyle}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) {
          if (isEdit && dirty) {
            if (!window.confirm("Discard unsaved changes?")) return;
          }
          onClose();
        }
      }}
    >
      <div style={{
        ...panelStyle,
        width: isMobile ? "100%" : 1080,
        maxHeight: isMobile ? "100dvh" : "92vh",
      }}>
        <header style={headerStyle}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={eyebrowStyle}>{tr("SIMPLE TASK")}</div>
            <h2 style={titleStyle}>
              {isEdit ? (title.trim() || tr("Simple task")) : tr("New simple task")}
            </h2>
            {isEdit && statusLabel ? (
              <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span className="tag" style={{ background: "var(--surface-sunk)", color: "var(--ink-soft)" }}>
                  {statusLabel}
                </span>
                <span className="tag" style={{ background: "var(--green-wash)", color: "var(--green-deep)" }}>
                  {tr("Simple task")}
                </span>
              </div>
            ) : null}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            {isEdit && canManage && dirty ? (
              <button
                type="button"
                onClick={handleSave}
                disabled={busy}
                style={primaryBtn}
              >
                {saving ? tr("Saving…") : tr("Save")}
              </button>
            ) : null}
            {/* Share — read-only, so viewers get it too (no canManage gate). */}
            {isEdit && !loading && shareContent && (
              <ShareButton
                content={shareContent}
                iconOnly
                buttonLabel="Share task"
                note="This link opens the task inside OmniPulse. Whoever you send it to still signs in and still needs access to this board."
                // Match this header's borderless × rather than the bordered
                // icon button the task modal uses.
                buttonStyle={{ border: "none", background: "transparent", color: "var(--ink-mute)", width: "auto", height: "auto", padding: 4 }}
              />
            )}
            <button
              type="button"
              onClick={() => {
                if (isEdit && dirty && !window.confirm("Discard unsaved changes?")) return;
                onClose();
              }}
              disabled={busy && !isEdit}
              style={closeBtnStyle}
              aria-label={tr("Close")}
            >
              ×
            </button>
          </div>
        </header>

        <div style={bodyStyle} className="themed-scroll-y">
          {loading ? (
            <div style={{ color: "var(--ink-mute)", fontSize: 13, padding: "24px 0", textAlign: "center" }}>
              {tr("Loading…")}
            </div>
          ) : (
            <>
              {(error || typeError) && (
                <div style={errorStyle}>{error || typeError}</div>
              )}

              <div style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1.5fr) minmax(0, 1fr)",
                gap: isMobile ? 18 : 24,
                alignItems: "flex-start",
              }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
              <Field label={tr("Title")}>
                <input
                  value={title}
                  onChange={(e) => {
                    setTitle(clampToMaxLength(e.target.value, TASK_TITLE_MAX));
                    markDirty();
                  }}
                  placeholder={tr("What needs doing?")}
                  style={inputStyle}
                  autoFocus={!isEdit}
                  disabled={isEdit && !canManage}
                />
              </Field>

              <Field label={tr("Description")}>
                <RichTextEditor
                  content={description}
                  onChange={(v) => {
                    setDescription(v);
                    markDirty();
                  }}
                  placeholder={tr("Optional details…")}
                  readOnly={isEdit && !canManage}
                />
              </Field>

              <Field label={tr("List")}>
                <CustomSelect
                  value={listId}
                  onChange={(v) => {
                    setListId(v);
                    markDirty();
                  }}
                  options={boardLists.map((l) => ({ value: l.id, label: l.name }))}
                  placeholder={tr("Choose list")}
                  disabled={isEdit && !canManage}
                />
              </Field>

              <Field label={tr("Acharya")}>
                <AcharyaPicker
                  value={acharyaId}
                  onChange={(v) => {
                    setAcharyaId(v);
                    markDirty();
                  }}
                  label=""
                  disabled={isEdit && !canManage}
                />
              </Field>

              <Field label={tr("Assignees")}>
                <MemberMultiSelect
                  value={assigneeIds}
                  onChange={(v) => {
                    setAssigneeIds(v);
                    markDirty();
                  }}
                  placeholder={tr("Assign someone")}
                  options={users}
                  disabled={isEdit && !canManage}
                />
              </Field>

              <Field label={tr("Due date")}>
                <DatePicker
                  value={dueDate}
                  onChange={(v) => {
                    setDueDate(v);
                    markDirty();
                  }}
                  placeholder="dd-mm-yyyy"
                  disabled={isEdit && !canManage}
                />
              </Field>

              {/* Files — same Accordion pattern as normal task modal */}
              <AccordionSection
                title={<>{tr("Files")} <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-mute)", marginLeft: 4 }}>({filesCount})</span></>}
                actions={
                  canManage ? (
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        style={{ display: "none" }}
                        onChange={(e) => {
                          if (isEdit) {
                            void handleEditFileUpload(e.target.files);
                            return;
                          }
                          const list = e.target.files;
                          if (!list) return;
                          setPendingFiles((prev) => [
                            ...prev,
                            ...Array.from(list).map((file) => ({
                              key: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
                              file,
                            })),
                          ]);
                          e.target.value = "";
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        style={addBtnSmStyle}
                      >
                        {uploading ? tr("Uploading...") : tr("+ Add File")}
                      </button>
                    </div>
                  ) : undefined
                }
              >
                {noteError && !showAddComment ? (
                  <div style={{ color: "var(--crit)", fontSize: 12, marginBottom: 10 }}>{noteError}</div>
                ) : null}
                {isEdit ? (
                  fileNoteRows.length === 0 ? (
                    <div style={{ fontSize: 13, color: "var(--ink-mute)", padding: "4px 0" }}>{tr("No files attached yet")}</div>
                  ) : (
                    <SimpleTaskFilesList
                      fileNotes={fileNoteRows}
                      fileDeletingId={fileDeletingId}
                      canManage={canManage}
                      onRemove={removeFileNote}
                    />
                  )
                ) : pendingFiles.length === 0 ? (
                  <div style={{ fontSize: 13, color: "var(--ink-mute)", padding: "4px 0" }}>{tr("No files attached yet")}</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {pendingFiles.map((pf) => (
                      <div key={pf.key} style={fileRowStyle}>
                        <div style={fileThumbBtnStyle}>
                          <span style={fileThumbExtStyle}>
                            {(pf.file.name.split(".").pop() || "FILE").toUpperCase().slice(0, 4)}
                          </span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={fileNameStyle}>{pf.file.name}</div>
                          <div style={fileMetaStyle}>
                            {tr("Pending upload")}
                            <span style={{ opacity: 0.55 }}> · </span>
                            {fmtSize(pf.file.size)}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPendingFiles((prev) => prev.filter((x) => x.key !== pf.key))}
                          style={textBtnStyle}
                        >
                          {tr("Remove")}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </AccordionSection>
              </div>

              {/* RIGHT — Comments & Notes column (matches normal task modal) */}
              <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <div style={{
                  display: "flex", alignItems: "center",
                  justifyContent: "space-between", gap: 8,
                  marginBottom: commentsOpen ? 12 : 0,
                  transition: "margin-bottom 0.22s ease",
                  flexShrink: 0,
                }}>
                  <button
                    type="button"
                    aria-expanded={commentsOpen}
                    onClick={() => setCommentsOpen((o) => !o)}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      background: "none", border: "none", padding: 0,
                      cursor: "pointer", color: "inherit", fontFamily: "inherit",
                      textAlign: "left",
                    }}
                  >
                    <span style={{ fontFamily: "var(--serif)", fontSize: 14, color: "var(--ink)", fontWeight: 400 }}>
                      {tr("Comments & Notes")}
                    </span>
                    <ChevronIcon open={commentsOpen} />
                  </button>
                  {isEdit && !showAddComment ? (
                    <button type="button" onClick={() => setShowAddComment(true)} style={addBtnSmStyle}>
                      {tr("+ Add Comment")}
                    </button>
                  ) : null}
                </div>

                <div style={{
                  display: "grid",
                  gridTemplateRows: commentsOpen ? "1fr" : "0fr",
                  transition: "grid-template-rows 0.22s ease",
                }}>
                  <div style={{ overflow: "hidden" }}>
                    {!isEdit ? (
                      <div>
                        <CommentComposer
                          value={createComment}
                          onChange={setCreateComment}
                          attachments={createCommentAtts}
                          onAttachmentsChange={setCreateCommentAtts}
                          insertMarkdownRefs={false}
                          stageDocuments
                          onSubmit={() => {}}
                          onCancel={() => {
                            setCreateComment(COMMENT_EMPTY_DOC);
                            setCreateCommentAtts([]);
                          }}
                          posting={false}
                          error=""
                          submitLabel={tr("Add comment")}
                          fetchMentions={boardId ? fetchBoardMentions : undefined}
                        />
                        <p style={{
                          margin: "8px 0 0",
                          fontSize: 12,
                          lineHeight: 1.4,
                          color: "var(--ink-mute)",
                        }}>
                          {tr("Comments are posted only after you click")} <strong style={{ fontWeight: 600, color: "var(--ink-soft)" }}>{tr("Create simple task")}</strong>{tr(". If you cancel or close without creating, this draft will not be saved.")}
                        </p>
                      </div>
                    ) : (
                      <>
                        {showAddComment ? (
                          <CommentComposer
                            value={commentContent}
                            onChange={setCommentContent}
                            attachments={commentAttachments}
                            onAttachmentsChange={setCommentAttachments}
                            insertMarkdownRefs={false}
                            stageDocuments
                            onSubmit={() => void addEditComment()}
                            onCancel={() => {
                              setShowAddComment(false);
                              setCommentContent(COMMENT_EMPTY_DOC);
                              setCommentAttachments([]);
                              setNoteError("");
                            }}
                            posting={savingComment}
                            error={noteError}
                            autoFocus
                            fetchMentions={boardId ? fetchBoardMentions : undefined}
                          />
                        ) : null}

                        {commentNotes.length === 0 && !showAddComment ? (
                          <div style={{ fontSize: 13, color: "var(--ink-mute)", padding: "4px 0" }}>{tr("No comments yet")}</div>
                        ) : (
                          <div style={{ display: "grid", gap: 10, marginTop: showAddComment ? 12 : 0 }}>
                            {commentNotes.map((note) => {
                              const isUserComment = note.note_type === "note";
                              const isEditing = editingNoteId === note.id;
                              const showEdit = isUserComment && canEditComment(note);
                              const showDelete = isUserComment && canDeleteComment(note);
                              return (
                                <div key={note.id} style={{
                                  borderWidth: 1, borderStyle: "solid", borderColor: "var(--rule)",
                                  borderRadius: "var(--r-sm)",
                                  padding: "12px 14px", background: "var(--page)",
                                  overflowX: "hidden",
                                  minWidth: 0,
                                }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                                    {!isUserComment ? (
                                      <span className="tag" style={noteTypeStyle(note.note_type)}>
                                        {note.note_type.replace(/_/g, " ")}
                                      </span>
                                    ) : null}
                                    <span style={{ fontSize: 12, fontWeight: 600 }}>{note.author_name || tr("System")}</span>
                                    <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-mute)" }}>
                                      {fmtDateTime(note.created_on)}
                                    </span>
                                    {note.edited_at ? (
                                      <span
                                        title={`Edited ${fmtDateTime(note.edited_at)}`}
                                        style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-mute)", fontStyle: "italic" }}
                                      >
                                        {tr("(edited)")}
                                      </span>
                                    ) : null}
                                    {!isEditing && (showEdit || showDelete) ? (
                                      <span style={{ marginLeft: "auto", display: "inline-flex" }}>
                                        <CommentActionsMenu
                                          showEdit={showEdit}
                                          showDelete={showDelete}
                                          onEdit={() => startEditComment(note)}
                                          onDelete={() => setDeleteNoteId(note.id)}
                                        />
                                      </span>
                                    ) : null}
                                  </div>
                                  {isEditing ? (
                                    <CommentComposer
                                      value={editContent}
                                      onChange={setEditContent}
                                      attachments={editAttachments}
                                      onAttachmentsChange={setEditAttachments}
                                      insertMarkdownRefs={false}
                                      stageDocuments
                                      onSubmit={() => void saveEditComment(note.id)}
                                      onCancel={cancelEditComment}
                                      posting={savingEdit}
                                      error={editError}
                                      autoFocus
                                      submitLabel={tr("Save")}
                                      fetchMentions={boardId ? fetchBoardMentions : undefined}
                                    />
                                  ) : isUserComment ? (
                                    <div style={commentBodyStyle}>
                                      {(note.attachments?.length ?? 0) > 0 ? (
                                        <CommentAttachments
                                          attachments={(note.attachments || []).flatMap((a) => {
                                            const n = normalizeAttachment(a, note.content);
                                            return n.url ? [n] : [];
                                          })}
                                        />
                                      ) : null}
                                      {isTiptapDoc(note.content) ? (
                                        !isRichTextEmpty(note.content) ? (
                                          <RichTextEditor
                                            content={note.content || ""}
                                            onChange={() => {}}
                                            readOnly
                                            plain
                                          />
                                        ) : null
                                      ) : (
                                        note.content ? <Markdown source={note.content} /> : null
                                      )}
                                    </div>
                                  ) : (
                                    <div style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap", color: "var(--ink)" }}>
                                      {note.content}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
              </div>
            </>
          )}
        </div>

        {!isEdit ? (
          <footer style={footerStyle}>
            <button type="button" onClick={onClose} disabled={saving} style={secondaryBtn}>
              {tr("Cancel")}
            </button>
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={saving || !!typeError}
              style={primaryBtn}
            >
              {saving ? tr("Creating…") : tr("Create simple task")}
            </button>
          </footer>
        ) : null}
      </div>

      <ConfirmDialog
        open={deleteNoteId !== null}
        title={tr("Delete this comment?")}
        description="This comment and any files uploaded with it will be removed. This can't be undone."
        confirmLabel={deletingNote ? "Deleting…" : "Delete"}
        cancelLabel={tr("Cancel")}
        confirmTone="danger"
        busy={deletingNote}
        onCancel={() => { if (!deletingNote) setDeleteNoteId(null); }}
        onConfirm={() => void confirmDeleteComment()}
      />
    </div>
  );
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "var(--overlay)",
  zIndex: 1200,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const panelStyle: CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--rule-strong)",
  borderRadius: "var(--r-md)",
  boxShadow: "var(--shadow-md)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
  padding: "16px 18px",
  borderBottom: "1px solid var(--rule)",
};

const eyebrowStyle: CSSProperties = {
  fontFamily: "var(--mono)",
  fontSize: 10,
  letterSpacing: "0.08em",
  color: "var(--ink-mute)",
  marginBottom: 4,
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontFamily: "var(--serif)",
  fontSize: 22,
  fontWeight: 600,
  color: "var(--ink)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const closeBtnStyle: CSSProperties = {
  border: "none",
  background: "transparent",
  fontSize: 22,
  lineHeight: 1,
  cursor: "pointer",
  color: "var(--ink-mute)",
  padding: 4,
};

const bodyStyle: CSSProperties = {
  padding: "16px 18px",
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
  gap: 14,
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={fieldCaptionStyle}>{label}</div>
      {children}
    </div>
  );
}

const fieldCaptionStyle: CSSProperties = {
  fontFamily: "var(--mono)",
  fontSize: 11,
  letterSpacing: "0.04em",
  color: "var(--ink-mute)",
  textTransform: "uppercase",
};

const inputStyle: CSSProperties = {
  padding: "8px 10px",
  fontFamily: "var(--sans)",
  fontSize: 14,
  color: "var(--ink)",
  background: "var(--page)",
  border: "1px solid var(--rule-strong)",
  borderRadius: "var(--r-sm)",
};

const errorStyle: CSSProperties = {
  padding: "8px 10px",
  background: "var(--crit-wash)",
  color: "var(--crit)",
  fontFamily: "var(--sans)",
  fontSize: 13,
  borderRadius: "var(--r-sm)",
  textTransform: "none",
  letterSpacing: "normal",
};

const footerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
  padding: "12px 18px",
  borderTop: "1px solid var(--rule)",
};

const secondaryBtn: CSSProperties = {
  padding: "8px 14px",
  fontSize: 13,
  fontFamily: "var(--sans)",
  background: "var(--surface-sunk)",
  border: "1px solid var(--rule-strong)",
  borderRadius: "var(--r-sm)",
  cursor: "pointer",
  color: "var(--ink)",
};

const primaryBtn: CSSProperties = {
  padding: "8px 14px",
  fontSize: 13,
  fontFamily: "var(--sans)",
  fontWeight: 500,
  background: "var(--green-deep)",
  border: "1px solid var(--green-deep)",
  borderRadius: "var(--r-sm)",
  cursor: "pointer",
  color: "var(--surface)",
};

const addBtnSmStyle: CSSProperties = {
  padding: "6px 12px",
  fontSize: 12,
  fontWeight: 500,
  background: "var(--green-deep)",
  color: "#f4efdf",
  border: "1px solid var(--green-deep)",
  borderRadius: "var(--r-sm)",
  cursor: "pointer",
  fontFamily: "var(--sans)",
};

const textBtnStyle: CSSProperties = {
  border: "none",
  background: "transparent",
  color: "var(--crit)",
  fontSize: 12,
  cursor: "pointer",
  fontFamily: "var(--sans)",
  flexShrink: 0,
};

const fileRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "8px 4px",
  minWidth: 0,
  borderRadius: "var(--r-sm)",
};

const fileThumbBtnStyle: CSSProperties = {
  flexShrink: 0,
  width: 56,
  height: 44,
  padding: 0,
  border: "1px solid var(--rule)",
  borderRadius: "var(--r-sm)",
  overflow: "hidden",
  background: "var(--surface-sunk)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const fileThumbImgStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  display: "block",
};

const fileThumbExtStyle: CSSProperties = {
  fontFamily: "var(--mono)",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.04em",
  color: "var(--ink-soft)",
};

const fileNameStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "var(--ink)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  cursor: "pointer",
  lineHeight: 1.35,
};

const fileMetaStyle: CSSProperties = {
  marginTop: 2,
  fontSize: 11,
  fontFamily: "var(--mono)",
  color: "var(--ink-mute)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  lineHeight: 1.35,
};

const commentBodyStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  minWidth: 0,
};

const commentImagesRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

const commentImageBtnStyle: CSSProperties = {
  display: "block",
  padding: 0,
  border: "none",
  borderRadius: "var(--r-sm)",
  overflow: "hidden",
  background: "transparent",
  cursor: "zoom-in",
  lineHeight: 0,
};

const commentImageStyle: CSSProperties = {
  display: "block",
  maxWidth: "100%",
  maxHeight: 260,
  objectFit: "contain",
  borderRadius: "var(--r-sm)",
};

const commentFilesRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

const commentFileChipStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  maxWidth: 220,
  padding: "4px 8px",
  borderRadius: "var(--r-sm)",
  border: "1px solid var(--rule)",
  background: "var(--surface-sunk)",
  textDecoration: "none",
  color: "var(--ink-soft)",
  fontSize: 12,
  fontFamily: "var(--sans)",
};

function AccordionSection({
  title,
  children,
  defaultOpen = true,
  actions,
}: {
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  actions?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const headerId = `${panelId}h`;

  return (
    <section>
      <div style={{
        display: "flex", alignItems: "center",
        justifyContent: "space-between", gap: 8,
        marginBottom: open ? 12 : 0,
        transition: "margin-bottom 0.22s ease",
        flexShrink: 0,
      }}>
        <button
          type="button"
          id={headerId}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((o) => !o)}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "none", border: "none", padding: 0,
            cursor: "pointer", color: "inherit", fontFamily: "inherit",
            textAlign: "left",
          }}
        >
          <span style={{ fontFamily: "var(--serif)", fontSize: 18, color: "var(--ink)", fontWeight: 600 }}>
            {title}
          </span>
          <ChevronIcon open={open} />
        </button>
        {actions != null ? <div style={{ flexShrink: 0 }}>{actions}</div> : null}
      </div>
      <div
        id={panelId}
        role="region"
        aria-labelledby={headerId}
        style={{
          display: "grid",
          gridTemplateRows: open ? "1fr" : "0fr",
          transition: "grid-template-rows 0.22s ease",
        }}
      >
        <div style={{ overflow: "hidden", paddingBottom: 2 }}>
          {children}
        </div>
      </div>
    </section>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width={14} height={14} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
      style={{
        flexShrink: 0,
        color: "var(--ink-mute)",
        transform: open ? "rotate(0deg)" : "rotate(-90deg)",
        transition: "transform 0.22s ease",
      }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function noteTypeStyle(type: string): { background: string; color: string } {
  if (type === "file") return { background: "var(--ochre-wash)", color: "var(--ochre)" };
  if (type === "file_delete") return { background: "var(--crit-wash, var(--surface-sunk))", color: "var(--crit)" };
  if (type === "reassign") return { background: "var(--amber-wash)", color: "var(--amber)" };
  if (type === "status_change") return { background: "var(--ok-wash)", color: "var(--ok)" };
  if (type === "session_start") return { background: "var(--green-wash)", color: "var(--green-deep)" };
  if (type === "session_complete") return { background: "var(--ok-wash)", color: "var(--ok)" };
  if (type === "break") return { background: "var(--ochre-wash)", color: "var(--ochre)" };
  if (type === "subtask_complete") return { background: "var(--amber-wash)", color: "var(--amber)" };
  if (type === "system") return { background: "var(--surface-sunk)", color: "var(--ink-soft)" };
  if (type === "review_pending") return { background: "var(--surface-sunk)", color: "var(--ink-soft)" };
  if (type === "evaluation_result") return { background: "var(--ok-wash)", color: "var(--ok)" };
  if (type === "attempt_complete") return { background: "var(--green-wash)", color: "var(--green-deep)" };
  if (type === "attempt_start") return { background: "var(--green-wash)", color: "var(--green-deep)" };
  if (type === "list_change") return { background: "var(--ok-wash)", color: "var(--ok)" };
  return { background: "var(--green-wash)", color: "var(--green-deep)" };
}

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(type: string) {
  if (type.startsWith("image/")) return "IMG";
  if (type === "application/pdf") return "PDF";
  if (type.includes("spreadsheet") || type.includes("excel") || type === "text/csv") return "XLS";
  if (type.includes("word") || type.includes("document")) return "DOC";
  return "FILE";
}

function fileTypeLabel(att: Attachment): string {
  if (att.type?.startsWith("image/")) {
    const sub = att.type.slice(6).toUpperCase();
    if (sub === "JPEG") return "JPG";
    return sub || "IMG";
  }
  const fromName = (att.name || "").split(".").pop()?.toUpperCase();
  if (fromName && fromName !== att.name.toUpperCase()) return fromName.slice(0, 5);
  return fileIcon(att.type || "");
}

function fmtAddedAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return `Added ${fmtDateTime(iso)}`;
  const sec = Math.floor(ms / 1000);
  if (sec < 45) return "Added just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `Added ${min} minute${min === 1 ? "" : "s"} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `Added ${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `Added ${day} day${day === 1 ? "" : "s"} ago`;
  return `Added ${fmtDateTime(iso)}`;
}

function fileNameFromNoteContent(content: string): string | null {
  const m = content.match(/^\[[^\]]+\]\s*(.+)$/);
  return m?.[1]?.trim() || null;
}

function fileNameFromUrl(url: string): string | null {
  if (!url) return null;
  try {
    const last = new URL(url).pathname.split("/").pop();
    return last ? last.replace(/^\d+-/, "") : null;
  } catch {
    const last = url.split("/").pop();
    return last ? last.replace(/^\d+-/, "") : null;
  }
}

function normalizeAttachment(att: unknown, content?: string | null): Attachment {
  const a = (att && typeof att === "object" ? att : {}) as Record<string, unknown>;
  const url = typeof a.url === "string" ? a.url : "";
  const name =
    (typeof a.name === "string" && a.name.trim()) ||
    (typeof a.filename === "string" && a.filename.trim()) ||
    (content ? fileNameFromNoteContent(content) : null) ||
    fileNameFromUrl(url) ||
    "Untitled file";
  const type =
    (typeof a.type === "string" && a.type) ||
    (typeof a.mime_type === "string" && a.mime_type) ||
    (typeof a.mime === "string" && a.mime) ||
    "";
  const size = typeof a.size === "number" ? a.size : Number(a.size) || 0;
  return {
    url,
    name,
    size,
    type,
    docType: typeof a.docType === "string" ? a.docType : undefined,
  };
}

function isFileImage(att: Attachment): boolean {
  if (att.type?.startsWith("image/")) return true;
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/i.test(att.name || att.url || "");
}

function viewUrl(blobUrl: string) {
  return `/api/uploads/view?url=${encodeURIComponent(blobUrl)}`;
}

function SimpleTaskFilesList({
  fileNotes,
  fileDeletingId,
  canManage,
  onRemove,
}: {
  fileNotes: FileNoteRow[];
  fileDeletingId: string | null;
  canManage: boolean;
  onRemove: (noteId: string, url: string) => void | Promise<void>;
}) {
  const tr = useTr();
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<FileNoteRow | null>(null);

  const imageFiles = fileNotes.filter((fn) => isFileImage(fn.att));
  const lightboxImages: LightboxImage[] = imageFiles.map((fn) => ({
    src: blobViewUrl(fn.att.url),
    alt: fn.att.name || "attachment",
  }));

  function openFile(fn: FileNoteRow) {
    if (isFileImage(fn.att)) {
      const idx = imageFiles.findIndex((f) => f.att.url === fn.att.url);
      setPreviewIdx(idx >= 0 ? idx : 0);
      return;
    }
    window.open(viewUrl(fn.att.url), "_blank", "noopener,noreferrer");
  }

  return (
    <div style={{ width: "100%", minWidth: 0 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {fileNotes.map((fn) => {
          const image = isFileImage(fn.att);
          const typeLabel = fileTypeLabel(fn.att);
          const deleting = fileDeletingId === fn.noteId;
          return (
            <div key={`${fn.noteId}:${fn.att.url}`} style={fileRowStyle}>
              <button
                type="button"
                onClick={() => openFile(fn)}
                style={fileThumbBtnStyle}
                aria-label={image ? `Preview ${fn.att.name}` : `Open ${fn.att.name}`}
                title={fn.att.name}
              >
                {image ? (
                  <img
                    src={blobViewUrl(fn.att.url)}
                    alt=""
                    style={fileThumbImgStyle}
                    draggable={false}
                  />
                ) : (
                  <span style={fileThumbExtStyle}>{typeLabel.slice(0, 4)}</span>
                )}
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={fileNameStyle}
                  title={fn.att.name}
                  onClick={() => openFile(fn)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openFile(fn);
                    }
                  }}
                >
                  {fn.att.name}
                </div>
                <div style={fileMetaStyle} title={fmtDateTime(fn.uploadedAt)}>
                  {fmtAddedAgo(fn.uploadedAt)}
                  <span style={{ opacity: 0.55 }}> · </span>
                  {typeLabel}
                  <span style={{ opacity: 0.55 }}> · </span>
                  {fmtSize(fn.att.size)}
                </div>
              </div>
              {canManage ? (
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setPendingDelete(fn)}
                  style={textBtnStyle}
                >
                  {deleting ? "…" : tr("Remove")}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      {previewIdx !== null && lightboxImages.length > 0 ? (
        <ImageLightbox
          images={lightboxImages}
          index={previewIdx}
          onIndexChange={setPreviewIdx}
          onClose={() => setPreviewIdx(null)}
        />
      ) : null}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={tr("Delete this file?")}
        description={
          pendingDelete
            ? `"${pendingDelete.att.name}" will be removed from this task. This can't be undone.`
            : undefined
        }
        confirmLabel={
          pendingDelete && fileDeletingId === pendingDelete.noteId ? "Deleting…" : "Delete"
        }
        cancelLabel={tr("Cancel")}
        confirmTone="danger"
        busy={Boolean(pendingDelete && fileDeletingId === pendingDelete.noteId)}
        onCancel={() => {
          if (pendingDelete && fileDeletingId === pendingDelete.noteId) return;
          setPendingDelete(null);
        }}
        onConfirm={async () => {
          if (!pendingDelete) return;
          await onRemove(pendingDelete.noteId, pendingDelete.att.url);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}

function isCommentImageAttachment(a: { url?: string; name?: string; type?: string; mime?: string }) {
  if (a.type?.startsWith("image/")) return true;
  if (a.mime?.startsWith("image/")) return true;
  return /\.(png|jpe?g|webp|gif|heic|heif)(\?|#|$)/i.test(a.url || a.name || "");
}

function CommentAttachments({ attachments }: { attachments: Attachment[] }) {
  const seenUrls = new Set<string>();
  const images: Attachment[] = [];
  const files: Attachment[] = [];
  for (const a of attachments || []) {
    if (!a?.url || seenUrls.has(a.url)) continue;
    seenUrls.add(a.url);
    if (isCommentImageAttachment(a)) images.push(a);
    else files.push(a);
  }
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);
  if (images.length === 0 && files.length === 0) return null;

  const lightboxImages: LightboxImage[] = images.map((a) => ({
    src: blobViewUrl(a.url),
    alt: a.name || "attachment",
  }));

  return (
    <>
      {images.length > 0 ? (
        <div style={commentImagesRowStyle}>
          {images.map((a, i) => (
            <button
              key={a.url}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setPreviewIdx(i);
              }}
              style={commentImageBtnStyle}
              aria-label={`Preview ${a.name || "image"}`}
              title={a.name || "Preview image"}
            >
              <img
                src={blobViewUrl(a.url)}
                alt={a.name || "attachment"}
                style={commentImageStyle}
                draggable={false}
              />
            </button>
          ))}
        </div>
      ) : null}
      {files.length > 0 ? (
        <div style={commentFilesRowStyle}>
          {files.map((a) => (
            <a
              key={a.url}
              href={blobViewUrl(a.url)}
              target="_blank"
              rel="noopener noreferrer"
              style={commentFileChipStyle}
              title={a.name || "attachment"}
            >
              <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--green-deep)", fontWeight: 600 }}>
                {(a.name?.split(".").pop() || "FILE").toUpperCase().slice(0, 4)}
              </span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {a.name || "attachment"}
              </span>
            </a>
          ))}
        </div>
      ) : null}
      {previewIdx !== null && lightboxImages.length > 0 ? (
        <ImageLightbox
          images={lightboxImages}
          index={previewIdx}
          onIndexChange={setPreviewIdx}
          onClose={() => setPreviewIdx(null)}
        />
      ) : null}
    </>
  );
}
