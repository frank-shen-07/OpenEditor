import { useEffect, useState } from "react";
import type {
  MediaTypeObject,
  OperationObject,
  ParameterObject,
  ResponseObject,
} from "../types";
import { clone } from "../lib/document";
import {
  Checkbox,
  EmptyState,
  Field,
  RemoveButton,
  Select,
  TextArea,
  TextInput,
} from "./ui";

const PARAM_LOCATIONS = ["query", "path", "header", "cookie"].map((v) => ({
  value: v,
  label: v,
}));

const SCHEMA_TYPES = ["", "string", "number", "integer", "boolean", "array", "object"].map(
  (v) => ({ value: v, label: v === "" ? "(none)" : v })
);

const COMMON_STATUS_CODES = ["200", "201", "204", "400", "401", "403", "404", "409", "500"];

export function OperationEditor({
  operation,
  availableTags,
  onChange,
}: {
  operation: OperationObject;
  availableTags: string[];
  onChange: (op: OperationObject) => void;
}) {
  const patch = (p: Partial<OperationObject>) => onChange({ ...operation, ...p });

  const parameters = operation.parameters ?? [];
  const responses = operation.responses ?? {};

  const updateParam = (index: number, p: Partial<ParameterObject>) => {
    patch({
      parameters: parameters.map((param, i) => (i === index ? { ...param, ...p } : param)),
    });
  };

  const updateParamSchemaType = (index: number, type: string) => {
    const param = clone(parameters[index]);
    if (type) {
      param.schema = { ...(param.schema ?? {}), type };
    } else if (param.schema) {
      delete param.schema.type;
    }
    patch({ parameters: parameters.map((p, i) => (i === index ? param : p)) });
  };

  const addParam = () => {
    patch({
      parameters: [...parameters, { name: "", in: "query", required: false, schema: { type: "string" } }],
    });
  };

  const addResponse = () => {
    const used = new Set(Object.keys(responses));
    const code = COMMON_STATUS_CODES.find((c) => !used.has(c)) ?? "default";
    patch({ responses: { ...responses, [code]: { description: "" } } });
  };

  const renameResponse = (oldCode: string, newCode: string) => {
    if (newCode === oldCode) return;
    const next: Record<string, ResponseObject> = {};
    for (const [code, resp] of Object.entries(responses)) {
      next[code === oldCode ? newCode : code] = resp;
    }
    patch({ responses: next });
  };

  const updateResponse = (code: string, p: Partial<ResponseObject>) => {
    patch({ responses: { ...responses, [code]: { ...responses[code], ...p } } });
  };

  const removeResponse = (code: string) => {
    const next = { ...responses };
    delete next[code];
    patch({ responses: next });
  };

  const requestBodyJson = getRequestBodySchemaText(operation);

  return (
    <div className="operation-editor">
      <div className="form-grid">
        <Field label="Summary">
          <TextInput
            value={operation.summary ?? ""}
            onChange={(v) => patch({ summary: v })}
            placeholder="List all pets"
          />
        </Field>
        <Field label="Operation ID">
          <TextInput
            value={operation.operationId ?? ""}
            onChange={(v) => patch({ operationId: v })}
            placeholder="listPets"
            mono
          />
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
            placeholder={availableTags.slice(0, 3).join(", ") || "pets, orders"}
            mono
          />
        </Field>
      </div>
      <Field label="Description">
        <TextArea
          value={operation.description ?? ""}
          onChange={(v) => patch({ description: v })}
          placeholder="Longer explanation of this operation"
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
                      placeholder="limit"
                      mono
                    />
                  </Field>
                  <Field label="In">
                    <Select
                      value={param.in ?? "query"}
                      onChange={(v) => updateParam(i, { in: v })}
                      options={PARAM_LOCATIONS}
                    />
                  </Field>
                  <Field label="Type">
                    <Select
                      value={param.schema?.type ?? ""}
                      onChange={(v) => updateParamSchemaType(i, v)}
                      options={SCHEMA_TYPES}
                    />
                  </Field>
                  <RemoveButton
                    onClick={() => patch({ parameters: parameters.filter((_, j) => j !== i) })}
                  />
                </div>
                <div className="card-row">
                  <Field label="Description">
                    <TextInput
                      value={param.description ?? ""}
                      onChange={(v) => updateParam(i, { description: v })}
                      placeholder="Maximum number of items to return"
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
                    content: { "application/json": { schema: { type: "object" } } },
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
                  placeholder="Pet to add to the store"
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
            <Field
              label="Schema (JSON)"
              hint='Schema for application/json content, e.g. {"$ref": "#/components/schemas/Pet"}'
            >
              <SchemaJsonEditor
                value={requestBodyJson}
                onValid={(schema) =>
                  patch({
                    requestBody: {
                      ...operation.requestBody,
                      content: {
                        ...(operation.requestBody?.content ?? {}),
                        "application/json": {
                          ...((operation.requestBody?.content ?? {})["application/json"] ?? {}),
                          schema,
                        },
                      },
                    },
                  })
                }
              />
            </Field>
          </div>
        )}
      </div>

      <div className="subsection">
        <div className="opblock-section-header">
          <h4>Responses</h4>
          <button className="btn btn-sm" onClick={addResponse} type="button">
            + Add Response
          </button>
        </div>
        {Object.keys(responses).length === 0 ? (
          <EmptyState message="No responses defined. Every operation should define at least one." />
        ) : (
          <div className="card-list">
            {Object.entries(responses).map(([code, resp]) => (
              <div className="card card-compact" key={code}>
                <div className="card-row">
                  <Field label="Status Code">
                    <StatusCodeInput code={code} onRename={(v) => renameResponse(code, v)} />
                  </Field>
                  <Field label="Description">
                    <TextInput
                      value={resp.description ?? ""}
                      onChange={(v) => updateResponse(code, { description: v })}
                      placeholder="Successful response"
                    />
                  </Field>
                  <RemoveButton onClick={() => removeResponse(code)} />
                </div>
                <ResponseSchemaEditor
                  response={resp}
                  onChange={(r) => updateResponse(code, r)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Text input that only commits the rename on blur/Enter to avoid key churn while typing. */
function StatusCodeInput({ code, onRename }: { code: string; onRename: (v: string) => void }) {
  const [draft, setDraft] = useState(code);

  useEffect(() => setDraft(code), [code]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== code) onRename(trimmed);
    else setDraft(code);
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

function getRequestBodySchemaText(operation: OperationObject): string {
  const schema = operation.requestBody?.content?.["application/json"]?.schema;
  return schema ? JSON.stringify(schema, null, 2) : "";
}

function ResponseSchemaEditor({
  response,
  onChange,
}: {
  response: ResponseObject;
  onChange: (r: Partial<ResponseObject>) => void;
}) {
  const media: MediaTypeObject | undefined = response.content?.["application/json"];
  const hasSchema = media?.schema !== undefined;

  if (!hasSchema) {
    return (
      <button
        className="btn btn-sm self-start"
        type="button"
        onClick={() =>
          onChange({
            content: {
              ...(response.content ?? {}),
              "application/json": { schema: { type: "object" } },
            },
          })
        }
      >
        + Add JSON Schema
      </button>
    );
  }

  return (
    <Field label="Schema (JSON)" hint="Schema for application/json content">
      <SchemaJsonEditor
        value={JSON.stringify(media!.schema, null, 2)}
        onValid={(schema) =>
          onChange({
            content: {
              ...(response.content ?? {}),
              "application/json": { ...media, schema },
            },
          })
        }
      />
    </Field>
  );
}

/**
 * Free-form JSON editor for schema fragments. Keeps local draft state so the
 * user can type invalid intermediate JSON; only valid JSON is propagated.
 */
export function SchemaJsonEditor({
  value,
  onValid,
}: {
  value: string;
  onValid: (schema: Record<string, unknown>) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(value);
    setError(null);
  }, [value]);

  const handleChange = (text: string) => {
    setDraft(text);
    try {
      const parsed = JSON.parse(text);
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        setError("Schema must be a JSON object");
        return;
      }
      setError(null);
      onValid(parsed as Record<string, unknown>);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="schema-json-editor">
      <textarea
        className={`input textarea mono${error ? " input-error" : ""}`}
        value={draft}
        rows={Math.min(14, Math.max(4, draft.split("\n").length + 1))}
        onChange={(e) => handleChange(e.target.value)}
        spellCheck={false}
      />
      {error && <span className="error-text">{error}</span>}
    </div>
  );
}
