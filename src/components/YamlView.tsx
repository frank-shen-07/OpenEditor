import { useEffect, useRef, useState } from "react";
import type { OpenAPIDocument } from "../types";
import { parseDocument, serializeToYaml } from "../lib/document";

/**
 * Raw YAML editor. Edits are parsed live; valid YAML is applied to the
 * document, invalid YAML shows an error but keeps the draft so the user can
 * finish typing.
 */
export function YamlView({
  doc,
  onChange,
}: {
  doc: OpenAPIDocument;
  onChange: (doc: OpenAPIDocument) => void;
}) {
  const [draft, setDraft] = useState(() => serializeToYaml(doc));
  const [error, setError] = useState<string | null>(null);
  // Tracks whether the latest doc change came from this editor, so we don't
  // clobber the user's cursor/text with a re-serialized version.
  const selfEdit = useRef(false);

  useEffect(() => {
    if (selfEdit.current) {
      selfEdit.current = false;
      return;
    }
    setDraft(serializeToYaml(doc));
    setError(null);
  }, [doc]);

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
      <textarea
        className="yaml-textarea mono"
        value={draft}
        onChange={(e) => handleChange(e.target.value)}
        spellCheck={false}
      />
      {error && <div className="yaml-error mono">{error}</div>}
    </div>
  );
}
