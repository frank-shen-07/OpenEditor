import { useEffect, useMemo, useState } from "react";
import {
  HTTP_METHODS,
  type HttpMethod,
  type OpenAPIDocument,
  type OperationObject,
  type PathItemObject,
  type TagObject,
} from "../types";
import { getAllTagNames, groupOperationsByTag } from "../lib/paths";
import { isImportedPath } from "../lib/preserveImport";
import { isOperationSecured } from "../lib/security";
import { Chevron, EmptyState, Field, LockIcon, MethodBadge, Select } from "./ui";
import { OperationEditor } from "./OperationEditor";

interface OpKey {
  path: string;
  method: HttpMethod;
}

function opKey({ path, method }: OpKey) {
  return `${path}:${method}`;
}

const METHOD_OPTIONS = HTTP_METHODS.map((m) => ({ value: m, label: m.toUpperCase() }));

export function PathsEditor({
  doc,
  onChange,
  preserveImport = false,
}: {
  doc: OpenAPIDocument;
  onChange: (doc: OpenAPIDocument) => void;
  preserveImport?: boolean;
}) {
  const paths = doc.paths ?? {};
  const tagGroups = useMemo(() => groupOperationsByTag(doc), [doc]);

  const [openTags, setOpenTags] = useState<Set<string>>(
    () => new Set(tagGroups.map((g) => g.name))
  );
  const [openOps, setOpenOps] = useState<Set<string>>(new Set());
  const [addingPath, setAddingPath] = useState(false);
  const [addingTag, setAddingTag] = useState(false);
  const [newPathDraft, setNewPathDraft] = useState("");
  const [newPathMethod, setNewPathMethod] = useState<HttpMethod>("get");
  const [newPathTag, setNewPathTag] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [newTagDesc, setNewTagDesc] = useState("");

  const tagSelectOptions = [
    { value: "", label: "(no tag)" },
    ...getAllTagNames(doc).map((t) => ({ value: t, label: t })),
  ];

  const setPaths = (next: Record<string, PathItemObject>) => {
    onChange({ ...doc, paths: next });
  };

  const setTags = (next: TagObject[]) => {
    if (preserveImport) return;
    onChange({ ...doc, tags: next });
  };

  const updateTagDescription = (tagName: string, description: string) => {
    if (preserveImport) return;
    const tags = doc.tags ?? [];
    const idx = tags.findIndex((t) => t.name === tagName);
    if (idx >= 0) {
      const next = [...tags];
      next[idx] = { ...next[idx], description };
      setTags(next);
    } else {
      setTags([...tags, { name: tagName, description }]);
    }
  };

  const renameTag = (oldName: string, newName: string) => {
    if (preserveImport) return;
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return;
    if ((doc.tags ?? []).some((t) => t.name === trimmed)) return;

    const tags = (doc.tags ?? []).map((t) =>
      t.name === oldName ? { ...t, name: trimmed } : t
    );
    if (!tags.some((t) => t.name === trimmed)) {
      tags.push({ name: trimmed, description: "" });
    }

    const nextPaths = { ...paths };
    for (const [path, item] of Object.entries(nextPaths)) {
      const nextItem = { ...item };
      for (const method of HTTP_METHODS) {
        const op = nextItem[method];
        if (op?.tags?.includes(oldName)) {
          nextItem[method] = {
            ...op,
            tags: op.tags.map((t) => (t === oldName ? trimmed : t)),
          };
        }
      }
      nextPaths[path] = nextItem;
    }

    onChange({ ...doc, tags, paths: nextPaths });
    setOpenTags((prev) => {
      const next = new Set(prev);
      if (next.has(oldName)) {
        next.delete(oldName);
        next.add(trimmed);
      }
      return next;
    });
  };

  const removeTag = (tagName: string) => {
    if (preserveImport) return;
    setTags((doc.tags ?? []).filter((t) => t.name !== tagName));
    setOpenTags((prev) => {
      const next = new Set(prev);
      next.delete(tagName);
      return next;
    });
  };

  const toggleTag = (name: string) => {
    setOpenTags((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const toggleOp = (key: string) => {
    setOpenOps((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const cancelAddPath = () => {
    setAddingPath(false);
    setNewPathDraft("");
    setNewPathMethod("get");
    setNewPathTag("");
  };

  const addPath = () => {
    const name = newPathDraft.trim();
    if (!name) return;
    const normalized = name.startsWith("/") ? name : `/${name}`;
    const op: OperationObject = {
      summary: "",
      responses: { "200": { description: "OK" } },
      ...(newPathTag ? { tags: [newPathTag] } : {}),
    };
    const existing = paths[normalized] ?? {};
    setPaths({ ...paths, [normalized]: { ...existing, [newPathMethod]: op } });
    if (newPathTag) {
      setOpenTags((prev) => new Set(prev).add(newPathTag));
    }
    setOpenOps((prev) => new Set(prev).add(opKey({ path: normalized, method: newPathMethod })));
    cancelAddPath();
  };

  const cancelAddTag = () => {
    setAddingTag(false);
    setNewTagName("");
    setNewTagDesc("");
  };

  const addTag = () => {
    const name = newTagName.trim();
    if (!name) return;
    if (!(doc.tags ?? []).some((t) => t.name === name)) {
      setTags([...(doc.tags ?? []), { name, description: newTagDesc.trim() }]);
    }
    setOpenTags((prev) => new Set(prev).add(name));
    cancelAddTag();
  };

  const addOperation = (path: string, method: HttpMethod) => {
    if (preserveImport && isImportedPath(doc, path)) return;
    const item = paths[path] ?? {};
    if (item[method]) {
      setOpenOps((prev) => new Set(prev).add(opKey({ path, method })));
      return;
    }
    const op: OperationObject = { summary: "", responses: { "200": { description: "OK" } } };
    setPaths({ ...paths, [path]: { ...item, [method]: op } });
    setOpenOps((prev) => new Set(prev).add(opKey({ path, method })));
  };

  const removeOperation = (path: string, method: HttpMethod) => {
    if (preserveImport && isImportedPath(doc, path)) return;
    const item = { ...paths[path] };
    delete item[method];
    const nextPaths = { ...paths, [path]: item };
    if (!HTTP_METHODS.some((m) => item[m])) {
      delete nextPaths[path];
    }
    setPaths(nextPaths);
    setOpenOps((prev) => {
      const next = new Set(prev);
      next.delete(opKey({ path, method }));
      return next;
    });
  };

  const updateOperation = (path: string, method: HttpMethod, op: OperationObject) => {
    if (preserveImport && isImportedPath(doc, path)) return;
    const item = paths[path] ?? {};
    setPaths({ ...paths, [path]: { ...item, [method]: op } });
  };

  return (
    <div className="paths-section">
      <div className="editor-actions">
        {addingPath ? (
          <div className="editor-action-panel">
            <h4 className="editor-action-title">New endpoint</h4>
            <p className="editor-action-hint">
              An endpoint is a URL path plus an HTTP method (GET, POST, etc.).
            </p>
            <div className="editor-action-fields">
              <Field label="Path" hint="Must start with /">
                <input
                  className="input mono"
                  autoFocus
                  type="text"
                  value={newPathDraft}
                  onChange={(e) => setNewPathDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addPath();
                    if (e.key === "Escape") cancelAddPath();
                  }}
                />
              </Field>
              <Field label="Method">
                <Select
                  value={newPathMethod}
                  onChange={(v) => setNewPathMethod(v as HttpMethod)}
                  options={METHOD_OPTIONS}
                />
              </Field>
              <Field label="Tag" hint="Optional — which group to show this under">
                <Select
                  value={newPathTag}
                  onChange={setNewPathTag}
                  options={tagSelectOptions}
                />
              </Field>
            </div>
            <div className="editor-action-buttons">
              <button className="btn btn-execute" onClick={addPath} type="button">
                Create endpoint
              </button>
              <button className="btn btn-cancel" type="button" onClick={cancelAddPath}>
                Cancel
              </button>
            </div>
          </div>
        ) : addingTag ? (
          <div className="editor-action-panel">
            <h4 className="editor-action-title">New tag group</h4>
            <p className="editor-action-hint">
              Tags group related endpoints in the list below (like folders). They don&apos;t create
              endpoints by themselves — assign a tag when creating or editing an endpoint.
            </p>
            <div className="editor-action-fields">
              <Field label="Tag name" hint="e.g. pets, orders, auth">
                <input
                  className="input mono"
                  autoFocus
                  type="text"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addTag();
                    if (e.key === "Escape") cancelAddTag();
                  }}
                />
              </Field>
              <Field label="Description" hint="Optional">
                <input
                  className="input"
                  type="text"
                  value={newTagDesc}
                  onChange={(e) => setNewTagDesc(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addTag();
                    if (e.key === "Escape") cancelAddTag();
                  }}
                />
              </Field>
            </div>
            <div className="editor-action-buttons">
              <button className="btn btn-execute" onClick={addTag} type="button">
                Create tag
              </button>
              <button className="btn btn-cancel" type="button" onClick={cancelAddTag}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="editor-action-buttons">
            <button className="btn btn-execute" type="button" onClick={() => setAddingPath(true)}>
              + New endpoint
            </button>
            <button className="btn" type="button" onClick={() => setAddingTag(true)}>
              + New tag group
            </button>
          </div>
        )}
      </div>

      {tagGroups.length === 0 ? (
        <EmptyState
          message="No endpoints yet. Click “New endpoint” above to add your first API path."
          action={
            <button className="btn btn-execute" type="button" onClick={() => setAddingPath(true)}>
              + New endpoint
            </button>
          }
        />
      ) : (
        tagGroups.map((group) => {
          const isTagOpen = openTags.has(group.name);
          const isDefinedTag = (doc.tags ?? []).some((t) => t.name === group.name);
          return (
            <div
              key={group.name}
              className={`opblock-tag-section${isTagOpen ? " is-open" : ""}`}
            >
              <button
                type="button"
                className="opblock-tag no-desc"
                onClick={() => toggleTag(group.name)}
              >
                <span>
                  <span>{group.name}</span>
                  <small>
                    <span>
                      {group.operations.length}{" "}
                      {group.operations.length === 1 ? "endpoint" : "endpoints"}
                    </span>
                  </small>
                </span>
                <Chevron open={isTagOpen} />
              </button>

              {isTagOpen && (
                <div className="opblock-tag-meta">
                  {isDefinedTag ? (
                    <>
                      <Field label="Tag name">
                        <TagNameInput
                          name={group.name}
                          onRename={(v) => renameTag(group.name, v)}
                        />
                      </Field>
                      <Field label="Description">
                        <input
                          className="input tag-desc-inline"
                          type="text"
                          value={group.description ?? ""}
                          onChange={(e) => updateTagDescription(group.name, e.target.value)}
                        />
                      </Field>
                      {group.operations.length === 0 && group.name !== "default" && (
                        <button
                          className="btn btn-cancel btn-sm"
                          type="button"
                          onClick={() => removeTag(group.name)}
                        >
                          Remove empty tag
                        </button>
                      )}
                    </>
                  ) : group.name === "default" ? (
                    <p className="tag-meta-note">
                      Endpoints with no tag assigned appear here. Set a tag on an operation to move
                      it into a named group.
                    </p>
                  ) : null}
                </div>
              )}

              {isTagOpen && group.operations.length === 0 && group.name !== "default" && (
                <div className="tag-empty-state">
                  No endpoints in this group yet. Create one with “New endpoint” and assign this
                  tag, or add the tag to an existing operation&apos;s Tags field.
                </div>
              )}

              {isTagOpen &&
                group.operations.map(({ path, method, operation }) => {
                  const key = opKey({ path, method });
                  const isOpOpen = openOps.has(key);
                  return (
                    <div
                      key={key}
                      className={`opblock opblock-${method}${isOpOpen ? " is-open" : ""}`}
                    >
                      <button
                        type="button"
                        className={`opblock-summary opblock-summary-${method}`}
                        onClick={() => toggleOp(key)}
                      >
                        <div className="opblock-summary-method-description">
                          <MethodBadge method={method} />
                          <span className="opblock-summary-path mono">{path}</span>
                          <span className="opblock-summary-description">
                            {operation.summary || operation.operationId || "(untitled)"}
                          </span>
                          {operation.deprecated && (
                            <span className="opblock-summary-deprecated">deprecated</span>
                          )}
                        </div>
                        <div className="opblock-summary-controls">
                          {isOperationSecured(doc, operation) && <LockIcon />}
                          <Chevron open={isOpOpen} />
                        </div>
                      </button>

                      {isOpOpen && (
                        <div className="opblock-body">
                          <div className="opblock-section">
                            <div className="opblock-section-header">
                              <h4>Edit Operation</h4>
                              <div className="opblock-section-header-actions">
                                <AddMethodMenu
                                  path={path}
                                  existing={HTTP_METHODS.filter((m) => paths[path]?.[m])}
                                  onAdd={(m) => addOperation(path, m)}
                                />
                                <button
                                  className="btn btn-cancel btn-sm"
                                  type="button"
                                  onClick={() => removeOperation(path, method)}
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                            <OperationEditor
                              key={key}
                              method={method}
                              operation={operation}
                              readOnly={preserveImport && isImportedPath(doc, path)}
                              onChange={(op) => updateOperation(path, method, op)}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          );
        })
      )}
    </div>
  );
}

function TagNameInput({ name, onRename }: { name: string; onRename: (v: string) => void }) {
  const [draft, setDraft] = useState(name);

  useEffect(() => setDraft(name), [name]);

  return (
    <input
      className="input mono"
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

function AddMethodMenu({
  existing,
  onAdd,
}: {
  path: string;
  existing: HttpMethod[];
  onAdd: (m: HttpMethod) => void;
}) {
  const [open, setOpen] = useState(false);
  const remaining = HTTP_METHODS.filter((m) => !existing.includes(m));

  if (remaining.length === 0) return null;

  return (
    <div className="method-menu">
      <button
        className="btn btn-sm"
        type="button"
        title="Add operation"
        onClick={() => setOpen((v) => !v)}
      >
        + Method
      </button>
      {open && (
        <>
          <div className="method-menu-backdrop" onClick={() => setOpen(false)} />
          <div className="method-menu-popover">
            {remaining.map((m) => (
              <button
                key={m}
                type="button"
                className="method-menu-item"
                onClick={() => {
                  onAdd(m);
                  setOpen(false);
                }}
              >
                <MethodBadge method={m} />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
