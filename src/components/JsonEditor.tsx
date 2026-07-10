import { useEffect, useState } from "react";

/**
 * Free-form JSON editor. Keeps local draft state so the user can type invalid
 * intermediate JSON; only valid JSON is propagated upstream.
 */
export function JsonEditor({
  value,
  onValid,
  requireObject = true,
  minRows = 6,
}: {
  value: string;
  onValid: (parsed: unknown) => void;
  requireObject?: boolean;
  minRows?: number;
}) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(value);
    setError(null);
  }, [value]);

  const handleChange = (text: string) => {
    setDraft(text);
    if (!text.trim()) {
      setError(null);
      onValid(requireObject ? {} : null);
      return;
    }
    try {
      const parsed = JSON.parse(text);
      if (requireObject) {
        if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
          setError("Must be a JSON object");
          return;
        }
      }
      setError(null);
      onValid(parsed);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const rows = Math.min(20, Math.max(minRows, draft.split("\n").length + 1));

  return (
    <div className="json-editor">
      <textarea
        className={`json-editor-textarea mono${error ? " input-error" : ""}`}
        value={draft}
        rows={rows}
        onChange={(e) => handleChange(e.target.value)}
        spellCheck={false}
      />
      {error && <span className="error-text">{error}</span>}
    </div>
  );
}

export function toJsonText(value: unknown): string {
  if (value === undefined || value === null) return "";
  return JSON.stringify(value, null, 2);
}
