import { useEffect, useRef, useState } from "react";
import type { DocumentSummary } from "../lib/documents";
import type { SaveStatus } from "../lib/persistence";
import { Chevron } from "./ui";

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
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const active = documents.find((d) => d.id === activeId);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

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
    <div className="documents-menu" ref={rootRef}>
      <button
        type="button"
        className={`documents-menu-trigger${open ? " is-open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="documents-menu-trigger-text">
          <span className="documents-menu-kicker">Current spec</span>
          <span className="documents-menu-name">{active?.title ?? "Untitled API"}</span>
        </span>
        {statusLabel && (
          <span className={`save-status save-status-${saveStatus}`}>{statusLabel}</span>
        )}
        <Chevron open={open} />
      </button>

      {open && (
        <div className="documents-menu-panel" role="listbox">
          <p className="documents-menu-heading">Your saved specs</p>
          <ul className="documents-menu-list">
            {documents.map((doc) => {
              const isActive = doc.id === activeId;
              return (
                <li key={doc.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    className={`documents-menu-item${isActive ? " is-active" : ""}`}
                    onClick={() => {
                      onSelect(doc.id);
                      setOpen(false);
                    }}
                  >
                    <span className="documents-menu-item-title">{doc.title}</span>
                    {isActive && <span className="documents-menu-item-badge">Open</span>}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="documents-menu-hint">
            Spec names match the API title at the top of the editor.
          </p>
          <div className="documents-menu-footer">
            <button
              className="btn btn-execute btn-sm documents-menu-new"
              type="button"
              onClick={() => {
                onCreate();
                setOpen(false);
              }}
            >
              + New spec
            </button>
            {documents.length > 1 && activeId !== null && (
              <button
                className="btn btn-cancel btn-sm"
                type="button"
                onClick={() => {
                  if (window.confirm(`Delete “${active?.title ?? "this spec"}”? This cannot be undone.`)) {
                    onDelete(activeId);
                    setOpen(false);
                  }
                }}
              >
                Delete current
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
