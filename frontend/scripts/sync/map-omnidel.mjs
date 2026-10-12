// OmniDel/src/components/<file> -> OmniDel/frontend/src/components/omnidel/<group>/<file>

const GROUPS = {
  shell: [
    "dashboard-shell.tsx", "sidebar.tsx", "topbar.tsx", "profile-menu.tsx", "notification-bell.tsx",
    "urgent-bell.tsx", "mobile-page-back.tsx", "page-header.tsx", "breadcrumb-trail.tsx", "no-access-screen.tsx",
  ],
  ui: [
    "confirm-dialog.tsx", "toast.tsx", "toaster.tsx", "sub-tabs.tsx", "status-toggle.tsx", "view-toggle.tsx",
    "done-check.tsx", "pin-button.tsx", "image-lightbox.tsx", "link-preview.tsx", "markdown.tsx",
    "block-number-exponent.tsx", "color-palette-picker.tsx",
  ],
  forms: [
    "custom-select.tsx", "searchable-select.tsx", "date-picker.tsx", "member-multi-select.tsx", "user-picker.tsx",
    "label-picker.tsx", "lead-picker.tsx", "acharya-picker.tsx", "acharya-selector.tsx", "recurring-day-picker.tsx",
    "recurring-select.tsx", "master-form.tsx",
  ],
  filters: [
    "multi-filter.tsx", "include-inactive-toggle.tsx", "mobile-filter-scroll.tsx", "boards-workspace-filter.tsx",
    "omnistudio-filter-controls.tsx",
  ],
  table: ["table-ui.tsx", "table-controls.tsx", "table-scroll.tsx", "table-add-button.tsx", "export-csv-modal.tsx"],
  collaboration: [
    "comment-composer.tsx", "comment-actions-menu.tsx", "rich-text-editor.tsx", "textarea-with-mentions.tsx",
    "share-sheet.tsx",
  ],
  boards: [
    "task-board.tsx", "task-calendar.tsx", "task-checklist.tsx", "task-create-modal.tsx", "task-modal.tsx",
    "simple-task-create-modal.tsx", "subtask-template-menu.tsx", "board-edit-button.tsx", "create-board-modal.tsx",
    "new-board-button.tsx", "column-card-create-modal.tsx", "stage-data-capture-panel.tsx", "stage-data-modal.tsx",
    "stage-fields-form.tsx", "stage-fields-manager.tsx", "stage-next-page.tsx",
  ],
  teams: ["team-actions-menu.tsx", "team-pulse-widget.tsx", "worker-avatar.tsx", "worker-detail-view.tsx"],
  dashboard: ["dash-charts.tsx"],
};
const groupOf = new Map();
for (const [g, names] of Object.entries(GROUPS)) for (const n of names) groupOf.set(n, g);

// Existing sub-folders keep their name; the CSV importer joins the table tools.
const FOLDERS = { "import-csv-modal": "table/import-csv-modal" };

export default function map(rel) {
  if (!rel.startsWith("src/components/")) throw new Error("unmapped " + rel);
  const sub = rel.slice("src/components/".length);
  const parts = sub.split("/");
  if (parts.length > 1) {
    const folder = FOLDERS[parts[0]] ?? parts[0];
    return `src/components/omnidel/${folder}/${parts.slice(1).join("/")}`;
  }
  const g = groupOf.get(sub);
  if (!g) throw new Error("no group for " + sub);
  return `src/components/omnidel/${g}/${sub}`;
}
