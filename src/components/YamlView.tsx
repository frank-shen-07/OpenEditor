import { useEffect, useMemo, useRef, useState } from "react";
import type { OpenAPIDocument } from "../types";
import { getYamlForDisplay } from "../lib/document";
import { parseImport } from "../lib/preserveImport";
import { buildYamlDiff } from "../lib/yamlDiff";

type ViewMode = "edit" | "diff";

export function YamlView({
  doc,
  baselineDoc,
  sourceYaml,
  preserveImport,
  onRawChange,
  onUpdateBaseline,
}: {
  doc: OpenAPIDocument;
  baselineDoc: OpenAPIDocument;
  sourceYaml: string | null;
  preserveImport: boolean;
  onRawChange: (text: string) => void;
  onUpdateBaseline: () => void;
}) {
  const [mode, setMode] = useState<ViewMode>("edit");
  const [hideUnchanged, setHideUnchanged] = useState(false);
  const [draft, setDraft] = useState(() =>
    preserveImport && sourceYaml ? sourceYaml : getYamlForDisplay(doc, sourceYaml)
  );
  const [error, setError] = useState<string | null>(null);
  const selfEdit = useRef(false);

  const exportYaml = useMemo(
    () => getYamlForDisplay(doc, sourceYaml),
    [doc, sourceYaml]
  );

  const editYaml = useMemo(
    () => (preserveImport && sourceYaml ? sourceYaml : exportYaml),
    [preserveImport, sourceYaml, exportYaml]
  );

  useEffect(() => {
    if (selfEdit.current) {
      selfEdit.current = false;
      return;
    }
    setDraft(editYaml);
    setError(null);
  }, [editYaml]);

  const baselineYaml = useMemo(
    () => getYamlForDisplay(baselineDoc, sourceYaml),
    [baselineDoc, sourceYaml]
  );
  const diff = useMemo(
    () => buildYamlDiff(baselineYaml, exportYaml),
    [baselineYaml, exportYaml]
  );

  const visibleLines = hideUnchanged
    ? diff.lines.filter((line) => line.type !== "same")
    : diff.lines;

  const handleChange = (text: string) => {
    setDraft(text);
    try {
      parseImport(text);
      setError(null);
      selfEdit.current = true;
      onRawChange(text);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="yaml-view">
      {preserveImport && sourceYaml && mode === "edit" && (
        <p className="yaml-preserve-notice">
          Showing your imported file. Use the Diff tab to preview new routes and schemas that
          will be appended on download.
        </p>
      )}
      {preserveImport && sourceYaml && mode === "diff" && (
        <p className="yaml-preserve-notice">
          Comparing export output to baseline. Only newly added routes, tags, and schemas appear
          here — edits to existing imported routes stay in the visual editor only.
        </p>
      )}
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
