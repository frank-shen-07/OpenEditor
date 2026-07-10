import { useEffect, useState } from "react";
import type { OpenAPIDocument, SchemaObject } from "../types";
import { Chevron, EmptyState, Field } from "./ui";
import { SchemaJsonEditor } from "./OperationEditor";

export function SchemasEditor({
  doc,
  onChange,
}: {
  doc: OpenAPIDocument;
  onChange: (doc: OpenAPIDocument) => void;
}) {
  const schemas = doc.components?.schemas ?? {};
  const names = Object.keys(schemas);

  const [sectionOpen, setSectionOpen] = useState(true);
  const [openSchemas, setOpenSchemas] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  useEffect(() => {
    const schemaNames = Object.keys(schemas);
    setOpenSchemas((prev) => {
      const next = new Set(prev);
      if (next.size === 0 && schemaNames.length > 0) {
        next.add(schemaNames[0]);
      }
      for (const name of next) {
        if (!schemas[name]) next.delete(name);
      }
      return next;
    });
  }, [schemas]);

  const setSchemas = (next: Record<string, SchemaObject>) => {
    onChange({ ...doc, components: { ...(doc.components ?? {}), schemas: next } });
  };

  const toggleSchema = (name: string) => {
    setOpenSchemas((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const addSchema = () => {
    const name = nameDraft.trim();
    if (!name) return;
    if (!schemas[name]) {
      setSchemas({
        ...schemas,
        [name]: { type: "object", properties: {} },
      });
    }
    setOpenSchemas((prev) => new Set(prev).add(name));
    setAdding(false);
    setNameDraft("");
  };

  const removeSchema = (name: string) => {
    const next = { ...schemas };
    delete next[name];
    setSchemas(next);
    setOpenSchemas((prev) => {
      const s = new Set(prev);
      s.delete(name);
      return s;
    });
  };

  const renameSchema = (oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName || schemas[trimmed]) return;
    const next: Record<string, SchemaObject> = {};
    for (const [k, v] of Object.entries(schemas)) {
      next[k === oldName ? trimmed : k] = v;
    }
    setSchemas(next);
    setOpenSchemas((prev) => {
      const s = new Set(prev);
      if (s.has(oldName)) {
        s.delete(oldName);
        s.add(trimmed);
      }
      return s;
    });
  };

  return (
    <section className={`models${sectionOpen ? " is-open" : ""}`}>
      <button
        type="button"
        className="models-control"
        onClick={() => setSectionOpen((v) => !v)}
      >
        <span>Schemas</span>
        <Chevron open={sectionOpen} />
      </button>

      {sectionOpen && (
        <div className="models-inner">
          <div className="models-toolbar">
            {adding ? (
              <div className="add-path-bar">
                <input
                  className="input mono"
                  autoFocus
                  type="text"
                  placeholder="Pet"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addSchema();
                    if (e.key === "Escape") {
                      setAdding(false);
                      setNameDraft("");
                    }
                  }}
                />
                <button className="btn btn-execute btn-sm" onClick={addSchema} type="button">
                  Add
                </button>
                <button
                  className="btn btn-cancel btn-sm"
                  type="button"
                  onClick={() => {
                    setAdding(false);
                    setNameDraft("");
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button className="btn btn-execute btn-sm" type="button" onClick={() => setAdding(true)}>
                + Add Schema
              </button>
            )}
          </div>

          {names.length === 0 && !adding ? (
            <EmptyState
              message="No schemas defined."
              action={
                <button
                  className="btn btn-execute btn-sm"
                  type="button"
                  onClick={() => setAdding(true)}
                >
                  + Add Schema
                </button>
              }
            />
          ) : (
            names.map((name) => {
              const schema = schemas[name];
              const isOpen = openSchemas.has(name);
              return (
                <div key={name} className={`model-container${isOpen ? " is-open" : ""}`}>
                  <button
                    type="button"
                    className="model-title"
                    onClick={() => toggleSchema(name)}
                  >
                    <span className="model-title-text mono">{name}</span>
                    <span className="model-hint">object</span>
                    <Chevron open={isOpen} />
                  </button>
                  {isOpen && (
                    <div className="model-box">
                      <div className="model-box-header">
                        <SchemaNameInput
                          key={name}
                          name={name}
                          onRename={(v) => renameSchema(name, v)}
                        />
                        <button
                          className="btn btn-cancel btn-sm"
                          type="button"
                          onClick={() => removeSchema(name)}
                        >
                          Delete
                        </button>
                      </div>
                      <p className="model-ref">
                        Referenced as{" "}
                        <code className="mono">#/components/schemas/{name}</code>
                      </p>
                      <Field label="Schema Definition (JSON)">
                        <SchemaJsonEditor
                          key={`schema-${name}`}
                          value={JSON.stringify(schema, null, 2)}
                          onValid={(s) => setSchemas({ ...schemas, [name]: s })}
                        />
                      </Field>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </section>
  );
}

function SchemaNameInput({ name, onRename }: { name: string; onRename: (v: string) => void }) {
  const [draft, setDraft] = useState(name);

  useEffect(() => setDraft(name), [name]);

  return (
    <input
      className="input mono model-name-input"
      type="text"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => onRename(draft)}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
}
