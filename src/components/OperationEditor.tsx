import { useEffect, useState } from "react";
import type { HttpMethod, MediaTypeObject, OperationObject, ParameterObject, ResponseObject } from "../types";
import { clone } from "../lib/document";
import {
  getDisplayParameters,
  getParameterType,
  METHODS_WITHOUT_BODY,
} from "../lib/normalize";
import { JsonEditor, toJsonText } from "./JsonEditor";
import {
  Checkbox,
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
              <Field label="Example (JSON)" hint="Plain JSON request body, e.g. {&quot;studentId&quot;: &quot;z5555555&quot;}">
                <JsonEditor
                  value={toJsonText(requestMedia?.example)}
                  requireObject
                  onValid={(example) =>
                    updateRequestBodyMedia({
                      ...(requestMedia ?? {}),
                      example: example as Record<string, unknown>,
                    })
                  }
                />
              </Field>
              <Field label="Schema (JSON)" hint="JSON Schema definition for validation">
                <JsonEditor
                  value={toJsonText(requestMedia?.schema)}
                  requireObject
                  onValid={(schema) =>
                    updateRequestBodyMedia({
                      ...(requestMedia ?? {}),
                      schema: schema as MediaTypeObject["schema"],
                    })
                  }
                />
              </Field>
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
                    />
                  </Field>
                  <RemoveButton onClick={() => removeResponse(code)} />
                </div>
                <ResponseJsonEditor response={resp} onChange={(r) => updateResponse(code, r)} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

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
    <>
      <Field label="Example (JSON)" hint="Plain JSON response body">
        <JsonEditor
          value={toJsonText(media.example)}
          requireObject
          onValid={(example) => updateMedia({ example: example as Record<string, unknown> })}
        />
      </Field>
      <Field label="Schema (JSON)" hint="JSON Schema definition for validation">
        <JsonEditor
          value={toJsonText(media.schema)}
          requireObject
          onValid={(schema) => updateMedia({ schema: schema as MediaTypeObject["schema"] })}
        />
      </Field>
    </>
  );
}
