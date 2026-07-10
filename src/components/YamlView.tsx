import { useEffect, useMemo, useRef, useState } from "react";
import type { OpenAPIDocument } from "../types";
import { parseDocument, serializeToYaml } from "../lib/document";
import { buildYamlDiff } from "../lib/yamlDiff";

type ViewMode = "edit" | "diff";

/**
 * Raw YAML editor. Edits are parsed live; valid YAML is applied to the
 * document, invalid YAML shows an error but keeps the draft so the user can
 * finish typing. Diff mode compares the current document to a baseline snapshot.
 */
export function YamlView({
  doc,
  baselineDoc,
  onChange,
  onUpdateBaseline,
}: {
  doc: OpenAPIDocument;
  baselineDoc: OpenAPIDocument;
  onChange: (doc: OpenAPIDocument) => void;
  onUpdateBaseline: () => void;
}) {
  const [mode, setMode] = useState<ViewMode>("edit");
  const [hideUnchanged, setHideUnchanged] = useState(false);
  const [draft, setDraft] = useState(() => serializeToYaml(doc));
  const [error, setError] = useState<string | null>(null);
  const selfEdit = useRef(false);

  useEffect(() => {
    if (selfEdit.current) {
      selfEdit.current = false;
      return;
    }
    setDraft(serializeToYaml(doc));
    setError(null);
  }, [doc]);

  const currentYaml = useMemo(() => serializeToYaml(doc), [doc]);
  const baselineYaml = useMemo(() => serializeToYaml(baselineDoc), [baselineDoc]);
  const diff = useMemo(
    () => buildYamlDiff(baselineYaml, currentYaml),
    [baselineYaml, currentYaml]
  );

  const visibleLines = hideUnchanged
    ? diff.lines.filter((line) => line.type !== "same")
    : diff.lines;

  const handleChange = (text: string) => {
    setDraft(text);
    try {
      const parsed = parseDocument(text);
      setError(null);
      selfEdit.current = true;
      onChange(parsed);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="yaml-view">
      <div className="yaml-toolbar">
        <div className="yaml-toolbar-left">
          <div className="yaml-mode-tabs" role="tablist" aria-label="YAML view mode">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "edit"}
              className={`yaml-mode-tab${mode === "edit" ? " is-active" : ""}`}
              onClick={() => setMode("edit")}
            >
              Edit
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "diff"}
              className={`yaml-mode-tab${mode === "diff" ? " is-active" : ""}`}
              onClick={() => setMode("diff")}
            >
              Diff
            </button>
          </div>
          {mode === "diff" && (
            <span className="yaml-diff-summary">
              {diff.hasChanges ? (
                <>
                  <span className="yaml-diff-stat yaml-diff-stat-added">+{diff.added}</span>
                  <span className="yaml-diff-stat yaml-diff-stat-removed">−{diff.removed}</span>
                </>
              ) : (
                <span className="yaml-diff-stat yaml-diff-stat-none">No changes</span>
              )}
            </span>
          )}
        </div>
        <div className="yaml-toolbar-right">
          {mode === "diff" && (
            <>
              <label className="yaml-diff-toggle">
                <input
                  type="checkbox"
                  checked={hideUnchanged}
                  onChange={(e) => setHideUnchanged(e.target.checked)}
                />
                Hide unchanged
              </label>
              <button className="btn btn-sm" type="button" onClick={onUpdateBaseline}>
                Update baseline
              </button>
            </>
          )}
          {mode === "edit" && error && (
            <span className="yaml-status yaml-status-error">Invalid YAML</span>
          )}
        </div>
      </div>

      {mode === "edit" ? (
        <>
          <textarea
            className="yaml-textarea mono"
            value={draft}
            onChange={(e) => handleChange(e.target.value)}
            spellCheck={false}
          />
          {error && <div className="yaml-error mono">{error}</div>}
        </>
      ) : (
        <div className="yaml-diff-panel mono">
          {!diff.hasChanges ? (
            <p className="yaml-diff-empty">No changes since the last baseline.</p>
          ) : visibleLines.length === 0 ? (
            <p className="yaml-diff-empty">All changes are hidden. Uncheck “Hide unchanged”.</p>
          ) : (
            <pre className="yaml-diff-pre">
              {visibleLines.map((line, i) => (
                <div
                  key={i}
                  className={`yaml-diff-line yaml-diff-line-${line.type}`}
                >
                  <span className="yaml-diff-gutter" aria-hidden>
                    {line.type === "added" ? "+" : line.type === "removed" ? "−" : " "}
                  </span>
                  <span className="yaml-diff-text">{line.text || " "}</span>
                </div>
              ))}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
