import type { DocumentSummary } from "../lib/documents";
import type { SaveStatus } from "../lib/persistence";

export function DocumentsPanel({
  documents,
  activeId,
  saveStatus,
  onSelect,
  onCreate,
  onDelete,
}: {
  documents: DocumentSummary[];
  activeId: string | null;
  saveStatus: SaveStatus;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
}) {
  const statusLabel =
    saveStatus === "loading"
      ? "Loading…"
      : saveStatus === "saving"
        ? "Saving…"
        : saveStatus === "saved"
          ? "Saved"
          : saveStatus === "error"
            ? "Save failed"
            : null;

  return (
    <div className="documents-panel">
      <select
        className="select documents-select"
        value={activeId ?? ""}
        onChange={(e) => {
          const id = e.target.value;
          if (id) onSelect(id);
        }}
      >
        {documents.map((doc) => (
          <option key={doc.id} value={doc.id}>
            {doc.title}
          </option>
        ))}
      </select>
      <button className="btn btn-sm" type="button" onClick={onCreate}>
        + New
      </button>
      {documents.length > 1 && activeId !== null && (
        <button
          className="btn btn-cancel btn-sm"
          type="button"
          onClick={() => onDelete(activeId)}
        >
          Delete
        </button>
      )}
      {statusLabel && (
        <span className={`save-status save-status-${saveStatus}`}>{statusLabel}</span>
      )}
    </div>
  );
}
