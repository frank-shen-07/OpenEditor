import { useEffect, useState } from "react";
import type { OpenAPIDocument, SchemaObject } from "../types";
import { Chevron, EmptyState, Field } from "./ui";
import { JsonEditor, toJsonText } from "./JsonEditor";

const EDITABLE_CATEGORIES = ["prim", "group"] as const;
type EditableCategory = (typeof EDITABLE_CATEGORIES)[number];

type XComponentsRoot = Record<string, Record<string, SchemaObject>>;

function getXComponents(doc: OpenAPIDocument): XComponentsRoot {
  const root = doc["x-components"];
  if (!root || typeof root !== "object" || Array.isArray(root)) return {};
  return root as XComponentsRoot;
}

export function XComponentsEditor({
  doc,
  onChange,
}: {
  doc: OpenAPIDocument;
  onChange: (doc: OpenAPIDocument) => void;
}) {
  const xComponents = getXComponents(doc);
  const [sectionOpen, setSectionOpen] = useState(true);
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [categoryDraft, setCategoryDraft] = useState<EditableCategory>("group");

  const entries = EDITABLE_CATEGORIES.flatMap((category) =>
    Object.keys(xComponents[category] ?? {}).map((name) => ({ category, name }))
  );

  useEffect(() => {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      for (const key of next) {
        const [category, name] = key.split("::");
        if (!xComponents[category]?.[name]) next.delete(key);
      }
      return next;
    });
  }, [xComponents]);

  const setCategorySchemas = (
    category: EditableCategory,
    schemas: Record<string, SchemaObject>
  ) => {
    onChange({
      ...doc,
      "x-components": {
        ...xComponents,
        [category]: schemas,
      },
    });
  };

  const entryKey = (category: string, name: string) => `${category}::${name}`;

  const addSchema = () => {
    const name = nameDraft.trim();
    if (!name) return;
    const existing = xComponents[categoryDraft] ?? {};
    if (existing[name]) return;
    setCategorySchemas(categoryDraft, {
      ...existing,
      [name]: { type: "object", properties: {} },
    });
    setOpenKeys((prev) => new Set(prev).add(entryKey(categoryDraft, name)));
    setAdding(false);
    setNameDraft("");
  };

  const removeSchema = (category: EditableCategory, name: string) => {
    const next = { ...(xComponents[category] ?? {}) };
    delete next[name];
    setCategorySchemas(category, next);
    setOpenKeys((prev) => {
      const s = new Set(prev);
      s.delete(entryKey(category, name));
      return s;
    });
  };

  const renameSchema = (category: EditableCategory, oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName || xComponents[category]?.[trimmed]) return;
    const current = xComponents[category] ?? {};
    const next: Record<string, SchemaObject> = {};
    for (const [k, v] of Object.entries(current)) {
      next[k === oldName ? trimmed : k] = v;
    }
    setCategorySchemas(category, next);
    setOpenKeys((prev) => {
      const s = new Set(prev);
      const oldKey = entryKey(category, oldName);
      if (s.has(oldKey)) {
        s.delete(oldKey);
        s.add(entryKey(category, trimmed));
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
        <span>x-components</span>
        <Chevron open={sectionOpen} />
      </button>

      {sectionOpen && (
        <div className="models-inner">
          <p className="model-ref">
            Reusable Swagger 2.0 components under <code className="mono">x-components/prim</code> and{" "}
            <code className="mono">x-components/group</code>. New entries are appended on export.
          </p>
          <div className="models-toolbar">
            {adding ? (
              <div className="add-path-bar">
                <select
                  className="input"
                  value={categoryDraft}
                  onChange={(e) => setCategoryDraft(e.target.value as EditableCategory)}
                >
                  {EDITABLE_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
                <input
                  className="input mono"
                  autoFocus
                  type="text"
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
                + Add x-component
              </button>
            )}
          </div>

          {entries.length === 0 && !adding ? (
            <EmptyState
              message="No editable x-components yet."
              action={
                <button
                  className="btn btn-execute btn-sm"
                  type="button"
                  onClick={() => setAdding(true)}
                >
                  + Add x-component
                </button>
              }
            />
          ) : (
            entries.map(({ category, name }) => {
              const schema = xComponents[category]?.[name];
              const key = entryKey(category, name);
              const isOpen = openKeys.has(key);
              return (
                <div key={key} className={`model-container${isOpen ? " is-open" : ""}`}>
                  <button type="button" className="model-title" onClick={() => {
                    setOpenKeys((prev) => {
                      const next = new Set(prev);
                      if (next.has(key)) next.delete(key);
                      else next.add(key);
                      return next;
                    });
                  }}>
                    <span className="model-title-text mono">
                      {category}/{name}
                    </span>
                    <span className="model-hint">object</span>
                    <Chevron open={isOpen} />
                  </button>
                  {isOpen && (
                    <div className="model-box">
                      <div className="model-box-header">
                        <SchemaNameInput
                          key={name}
                          name={name}
                          onRename={(v) => renameSchema(category, name, v)}
                        />
                        <button
                          className="btn btn-cancel btn-sm"
                          type="button"
                          onClick={() => removeSchema(category, name)}
                        >
                          Delete
                        </button>
                      </div>
                      <p className="model-ref">
                        Referenced as{" "}
                        <code className="mono">#/x-components/{category}/{name}</code>
                      </p>
                      <Field label="Schema (JSON)">
                        <JsonEditor
                          key={`xcomp-${category}-${name}`}
                          value={toJsonText(schema)}
                          onValid={(s) =>
                            setCategorySchemas(category, {
                              ...(xComponents[category] ?? {}),
                              [name]: s as SchemaObject,
                            })
                          }
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
