import { useEffect, useState } from "react";
import type { HttpMethod, MediaTypeObject, OperationObject, ParameterObject, ResponseObject } from "../types";
import { clone } from "../lib/document";
import {
  getDisplayParameters,
  getParameterType,
  METHODS_WITHOUT_BODY,
} from "../lib/normalize";
import { ExampleSchemaEditor } from "./ExampleSchemaEditor";
import {
  Checkbox,
  Chevron,
  EmptyState,
  Field,
  RemoveButton,
  Select,
  TextArea,
  TextInput,
} from "./ui";

const PARAM_LOCATIONS = [
  { value: "query", label: "Query — ?name=value in URL" },
  { value: "path", label: "Path — /resource/{id}" },
  { value: "header", label: "Header" },
  { value: "cookie", label: "Cookie" },
];

const SCHEMA_TYPES = ["", "string", "number", "integer", "boolean", "array", "object"].map(
  (v) => ({ value: v, label: v === "" ? "(none)" : v })
);

const COMMON_STATUS_CODES = ["200", "201", "204", "400", "401", "403", "404", "409", "500"];

function reorderResponseKeys(
  responses: Record<string, ResponseObject>,
  order: string[],
  from: number,
  to: number
): Record<string, ResponseObject> {
  const nextOrder = [...order];
  const [moved] = nextOrder.splice(from, 1);
  nextOrder.splice(to, 0, moved);
  const reordered: Record<string, ResponseObject> = {};
  for (const code of nextOrder) {
    if (responses[code]) reordered[code] = responses[code];
  }
  return reordered;
}

export function OperationEditor({
  operation,
  method,
  onChange,
}: {
  operation: OperationObject;
  method: HttpMethod;
  onChange: (op: OperationObject) => void;
}) {
  const patch = (p: Partial<OperationObject>) => onChange({ ...operation, ...p });

  const parameters = getDisplayParameters(operation.parameters);
  const responses = operation.responses ?? {};
  const showRequestBody = !METHODS_WITHOUT_BODY.has(method);
  const requestMedia = operation.requestBody?.content?.["application/json"];
  const [responseNotice, setResponseNotice] = useState<string | null>(null);

  const updateParam = (index: number, p: Partial<ParameterObject>) => {
    const all = operation.parameters ?? [];
    const display = getDisplayParameters(all);
    const target = display[index];
    const realIndex = all.indexOf(target);
    if (realIndex < 0) return;
    patch({
      parameters: all.map((param, i) => (i === realIndex ? { ...param, ...p } : param)),
    });
  };

  const updateParamType = (index: number, type: string) => {
    const all = operation.parameters ?? [];
    const display = getDisplayParameters(all);
    const target = display[index];
    const realIndex = all.indexOf(target);
    if (realIndex < 0) return;

    const param = clone(all[realIndex]) as ParameterObject & Record<string, unknown>;
    delete param.type;
    if (type) {
      param.schema = { ...(param.schema ?? {}), type };
    } else if (param.schema) {
      delete param.schema.type;
    }
    patch({ parameters: all.map((p, i) => (i === realIndex ? param : p)) });
  };

  const removeParam = (index: number) => {
    const all = operation.parameters ?? [];
    const display = getDisplayParameters(all);
    const target = display[index];
    patch({ parameters: all.filter((p) => p !== target) });
  };

  const addParam = () => {
    patch({
      parameters: [
        ...(operation.parameters ?? []),
        { name: "", in: "query", required: false, schema: { type: "string" } },
      ],
    });
  };

  const addResponse = () => {
    setResponseNotice(null);
    const used = new Set(Object.keys(responses));
    const code = COMMON_STATUS_CODES.find((c) => !used.has(c)) ?? "default";
    if (used.has(code)) {
      setResponseNotice(
        `Status code “${code}” is already defined. Each HTTP status code can only appear once per operation.`
      );
      return;
    }
    patch({ responses: { ...responses, [code]: { description: "" } } });
  };

  const renameResponse = (oldCode: string, newCode: string): boolean => {
    const trimmed = newCode.trim();
    if (!trimmed || trimmed === oldCode) return true;
    if (trimmed in responses) {
      setResponseNotice(
        `Status code “${trimmed}” is already used. OpenAPI allows only one response per status code.`
      );
      return false;
    }
    setResponseNotice(null);
    const next: Record<string, ResponseObject> = {};
    for (const [code, resp] of Object.entries(responses)) {
      next[code === oldCode ? trimmed : code] = resp;
    }
    patch({ responses: next });
    return true;
  };

  const updateResponse = (code: string, p: Partial<ResponseObject>) => {
    patch({ responses: { ...responses, [code]: { ...responses[code], ...p } } });
  };

  const removeResponse = (code: string) => {
    setResponseNotice(null);
    const next = { ...responses };
    delete next[code];
    patch({ responses: next });
  };

  const reorderResponses = (from: number, to: number) => {
    const order = Object.keys(responses);
    if (from === to || from < 0 || to < 0 || from >= order.length || to >= order.length) return;
    patch({ responses: reorderResponseKeys(responses, order, from, to) });
  };

  const updateRequestBodyMedia = (media: MediaTypeObject) => {
    patch({
      requestBody: {
        ...operation.requestBody,
        content: {
          ...(operation.requestBody?.content ?? {}),
          "application/json": media,
        },
      },
    });
  };

  return (
    <div className="operation-editor">
      <div className="form-grid">
        <Field label="Summary">
          <TextInput value={operation.summary ?? ""} onChange={(v) => patch({ summary: v })} />
        </Field>
        <Field label="Tags" hint="Comma-separated">
          <TextInput
            value={(operation.tags ?? []).join(", ")}
            onChange={(v) =>
              patch({
                tags: v
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean),
              })
            }
            mono
          />
        </Field>
      </div>
      <Field label="Description">
        <TextArea
          value={operation.description ?? ""}
          onChange={(v) => patch({ description: v })}
          rows={2}
        />
      </Field>
      <Checkbox
        checked={operation.deprecated ?? false}
        onChange={(v) => {
          const next = { ...operation };
          if (v) next.deprecated = true;
          else delete next.deprecated;
          onChange(next);
        }}
        label="Deprecated"
      />

      <div className="subsection">
        <div className="opblock-section-header">
          <h4>Parameters</h4>
          <button className="btn btn-sm" onClick={addParam} type="button">
            + Add Parameter
          </button>
        </div>
        {parameters.length === 0 ? (
          <p className="muted">No parameters.</p>
        ) : (
          <div className="card-list">
            {parameters.map((param, i) => (
              <div className="card card-compact" key={i}>
                <div className="card-row">
                  <Field label="Name">
                    <TextInput
                      value={param.name ?? ""}
                      onChange={(v) => updateParam(i, { name: v })}
                      mono
                    />
                  </Field>
                  <Field label="Location">
                    <Select
                      value={param.in ?? "query"}
                      onChange={(v) => updateParam(i, { in: v })}
                      options={PARAM_LOCATIONS}
                    />
                  </Field>
                  <Field label="Data type">
                    <Select
                      value={getParameterType(param)}
                      onChange={(v) => updateParamType(i, v)}
                      options={SCHEMA_TYPES}
                    />
                  </Field>
                  <RemoveButton onClick={() => removeParam(i)} />
                </div>
                <div className="card-row">
                  <Field label="Description">
                    <TextInput
                      value={param.description ?? ""}
                      onChange={(v) => updateParam(i, { description: v })}
                    />
                  </Field>
                  <Checkbox
                    checked={param.required ?? false}
                    onChange={(v) => updateParam(i, { required: v })}
                    label="Required"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showRequestBody && (
        <div className="subsection">
          <div className="opblock-section-header">
            <h4>Request Body</h4>
            {operation.requestBody ? (
              <button
                className="btn btn-sm"
                type="button"
                onClick={() => {
                  const next = { ...operation };
                  delete next.requestBody;
                  onChange(next);
                }}
              >
                Remove
              </button>
            ) : (
              <button
                className="btn btn-sm"
                type="button"
                onClick={() =>
                  patch({
                    requestBody: {
                      required: true,
                      content: {
                        "application/json": {
                          schema: { type: "object", properties: {} },
                          example: {},
                        },
                      },
                    },
                  })
                }
              >
                + Add Request Body
              </button>
            )}
          </div>
          {operation.requestBody && (
            <div className="card card-compact">
              <div className="card-row">
                <Field label="Description">
                  <TextInput
                    value={operation.requestBody.description ?? ""}
                    onChange={(v) =>
                      patch({ requestBody: { ...operation.requestBody, description: v } })
                    }
                  />
                </Field>
                <Checkbox
                  checked={operation.requestBody.required ?? false}
                  onChange={(v) =>
                    patch({ requestBody: { ...operation.requestBody, required: v } })
                  }
                  label="Required"
                />
              </div>
              <ExampleSchemaEditor
                example={requestMedia?.example}
                schema={requestMedia?.schema}
                requireObject
                hint="Paste a real request body from your API, e.g. {&quot;studentId&quot;: &quot;z5555555&quot;}"
                onExampleChange={(example) =>
                  updateRequestBodyMedia({
                    ...(requestMedia ?? {}),
                    example,
                  })
                }
                onSchemaChange={(schema) =>
                  updateRequestBodyMedia({
                    ...(requestMedia ?? {}),
                    schema,
                  })
                }
              />
            </div>
          )}
        </div>
      )}

      <div className="subsection">
        <div className="opblock-section-header">
          <h4>Responses</h4>
          <button className="btn btn-sm" onClick={addResponse} type="button">
            + Add Response
          </button>
        </div>
        {responseNotice && <p className="response-notice">{responseNotice}</p>}
        {Object.keys(responses).length === 0 ? (
          <EmptyState message="No responses defined. Every operation should define at least one." />
        ) : (
          <ResponsesList
            responses={responses}
            onRename={renameResponse}
            onUpdate={updateResponse}
            onRemove={removeResponse}
            onReorder={reorderResponses}
          />
        )}
      </div>
    </div>
  );
}

function ResponsesList({
  responses,
  onRename,
  onUpdate,
  onRemove,
  onReorder,
}: {
  responses: Record<string, ResponseObject>;
  onRename: (oldCode: string, newCode: string) => boolean;
  onUpdate: (code: string, p: Partial<ResponseObject>) => void;
  onRemove: (code: string) => void;
  onReorder: (from: number, to: number) => void;
}) {
  const codes = Object.keys(responses);
  const [openCodes, setOpenCodes] = useState<Set<string>>(() => new Set(codes));
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  useEffect(() => {
    setOpenCodes((prev) => {
      const next = new Set(prev);
      for (const code of codes) next.add(code);
      for (const code of [...next]) {
        if (!codes.includes(code)) next.delete(code);
      }
      return next;
    });
  }, [codes.join("|")]);

  const toggleOpen = (code: string) => {
    setOpenCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const handleDrop = (to: number) => {
    if (dragIndex === null || dragIndex === to) {
      setDragIndex(null);
      setDropIndex(null);
      return;
    }
    onReorder(dragIndex, to);
    setDragIndex(null);
    setDropIndex(null);
  };

  return (
    <div className="response-block-list">
      {codes.map((code, index) => {
        const resp = responses[code]!;
        const isOpen = openCodes.has(code);
        const isDragging = dragIndex === index;
        const isDropTarget = dropIndex === index && dragIndex !== null && dragIndex !== index;

        return (
          <div
            key={code}
            className={`response-block${isOpen ? " is-open" : ""}${isDragging ? " is-dragging" : ""}${isDropTarget ? " is-drop-target" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDropIndex(index);
            }}
            onDragLeave={() => {
              if (dropIndex === index) setDropIndex(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              handleDrop(index);
            }}
          >
            <div className="response-block-header">
              <button
                type="button"
                className="response-drag-handle"
                title="Drag to reorder"
                draggable
                onDragStart={(e) => {
                  setDragIndex(index);
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", String(index));
                }}
                onDragEnd={() => {
                  setDragIndex(null);
                  setDropIndex(null);
                }}
              >
                ⋮⋮
              </button>
              <button
                type="button"
                className="response-block-toggle"
                onClick={() => toggleOpen(code)}
              >
                <Chevron open={isOpen} />
                <span className="response-block-code mono">{code}</span>
                <span className="response-block-summary">
                  {resp.description?.trim() || "No description"}
                </span>
              </button>
              <RemoveButton onClick={() => onRemove(code)} />
            </div>
            {isOpen && (
              <div className="response-block-body">
                <div className="card-row">
                  <Field label="Status Code">
                    <StatusCodeInput code={code} onRename={(v) => onRename(code, v)} />
                  </Field>
                  <Field label="Description">
                    <TextInput
                      value={resp.description ?? ""}
                      onChange={(v) => onUpdate(code, { description: v })}
                    />
                  </Field>
                </div>
                <ResponseJsonEditor response={resp} onChange={(r) => onUpdate(code, r)} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StatusCodeInput({
  code,
  onRename,
}: {
  code: string;
  onRename: (v: string) => boolean;
}) {
  const [draft, setDraft] = useState(code);

  useEffect(() => setDraft(code), [code]);

  const commit = () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      setDraft(code);
      return;
    }
    if (trimmed !== code && !onRename(trimmed)) {
      setDraft(code);
      return;
    }
    if (trimmed !== code) setDraft(trimmed);
  };

  return (
    <input
      className="input mono"
      type="text"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

function ResponseJsonEditor({
  response,
  onChange,
}: {
  response: ResponseObject;
  onChange: (r: Partial<ResponseObject>) => void;
}) {
  const legacySchema = (response as ResponseObject & { schema?: unknown }).schema;
  const media: MediaTypeObject =
    response.content?.["application/json"] ??
    (legacySchema ? { schema: legacySchema as MediaTypeObject["schema"] } : {});

  const updateMedia = (patch: Partial<MediaTypeObject>) => {
    const next = { ...media, ...patch };
    const content = { ...(response.content ?? {}), "application/json": next };
    const cleaned = { ...response, content } as ResponseObject & { schema?: unknown };
    delete cleaned.schema;
    onChange(cleaned);
  };

  return (
    <ExampleSchemaEditor
      example={media.example}
      schema={media.schema}
      requireObject={false}
      hint="Paste a real response from your Express/NestJS backend"
      onExampleChange={(example) => updateMedia({ example })}
      onSchemaChange={(schema) => updateMedia({ schema })}
    />
  );
}
