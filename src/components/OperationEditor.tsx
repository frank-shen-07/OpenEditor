import { useEffect, useState } from "react";
import type { HttpMethod, MediaTypeObject, OperationObject, ParameterObject, ResponseObject } from "../types";
import { clone } from "../lib/document";
import {
  getDisplayParameters,
  getParameterType,
  METHODS_WITHOUT_BODY,
} from "../lib/normalize";
import { reorderDisplayParameters } from "../lib/parameters";
import {
  appendResponseOrder,
  getResponseOrder,
  removeFromResponseOrder,
  renameInResponseOrder,
  reorderResponses,
} from "../lib/responseOrder";
import { ExampleSchemaEditor } from "./ExampleSchemaEditor";
import { ReorderableBlockList } from "./ReorderableBlockList";
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
  const responseOrder = getResponseOrder(operation);
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
    patch(
      appendResponseOrder(
        { ...operation, responses: { ...responses, [code]: { description: "" } } },
        code
      )
    );
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
    onChange(renameInResponseOrder({ ...operation, responses: next }, oldCode, trimmed));
    return true;
  };

  const updateResponse = (code: string, p: Partial<ResponseObject>) => {
    patch({ responses: { ...responses, [code]: { ...responses[code], ...p } } });
  };

  const removeResponse = (code: string) => {
    setResponseNotice(null);
    const next = { ...responses };
    delete next[code];
    onChange(removeFromResponseOrder({ ...operation, responses: next }, code));
  };

  const reorderResponseBlocks = (from: number, to: number) => {
    onChange(reorderResponses(operation, from, to));
  };

  const reorderParamBlocks = (from: number, to: number) => {
    patch({ parameters: reorderDisplayParameters(operation.parameters ?? [], from, to) });
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
          <EmptyState message="No parameters." />
        ) : (
          <ParametersList
            parameters={parameters}
            onUpdate={updateParam}
            onUpdateType={updateParamType}
            onRemove={removeParam}
            onReorder={reorderParamBlocks}
          />
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
            order={responseOrder}
            responses={responses}
            onRename={renameResponse}
            onUpdate={updateResponse}
            onRemove={removeResponse}
            onReorder={reorderResponseBlocks}
          />
        )}
      </div>
    </div>
  );
}

function paramKey(param: ParameterObject, index: number): string {
  if (typeof param.$ref === "string") return param.$ref;
  const inLoc = param.in ?? "query";
  const name = param.name?.trim();
  if (name) return `${inLoc}:${name}`;
  return `${inLoc}:__${index}`;
}

function paramLocationLabel(inLoc: string | undefined): string {
  switch (inLoc) {
    case "query":
      return "Query";
    case "path":
      return "Path";
    case "header":
      return "Header";
    case "cookie":
      return "Cookie";
    default:
      return inLoc ?? "Param";
  }
}

function paramTitle(param: ParameterObject): string {
  if (typeof param.$ref === "string") {
    const short = param.$ref.split("/").pop();
    return short ?? param.$ref;
  }
  return param.name?.trim() || "(unnamed)";
}

function paramSummary(param: ParameterObject): string {
  const type = getParameterType(param) || "no type";
  const required = param.required ? " · required" : "";
  const description = param.description?.trim();
  if (description) return `${type}${required} · ${description}`;
  return `${type}${required}`;
}

function ParametersList({
  parameters,
  onUpdate,
  onUpdateType,
  onRemove,
  onReorder,
}: {
  parameters: ParameterObject[];
  onUpdate: (index: number, p: Partial<ParameterObject>) => void;
  onUpdateType: (index: number, type: string) => void;
  onRemove: (index: number) => void;
  onReorder: (from: number, to: number) => void;
}) {
  return (
    <ReorderableBlockList
      items={parameters}
      getKey={paramKey}
      onReorder={onReorder}
      renderHeader={(param, { isOpen, toggle, index }) => (
        <>
          <button type="button" className="editor-block-toggle" onClick={toggle}>
            <Chevron open={isOpen} />
            <span className="editor-block-title mono">{paramTitle(param)}</span>
            <span className="editor-block-badge">{paramLocationLabel(param.in)}</span>
            <span className="editor-block-summary">{paramSummary(param)}</span>
          </button>
          <RemoveButton onClick={() => onRemove(index)} />
        </>
      )}
      renderBody={(param, index) => (
        <>
          <div className="card-row">
            <Field label="Name">
              <TextInput
                value={param.name ?? ""}
                onChange={(v) => onUpdate(index, { name: v })}
                mono
              />
            </Field>
            <Field label="Location">
              <Select
                value={param.in ?? "query"}
                onChange={(v) => onUpdate(index, { in: v })}
                options={PARAM_LOCATIONS}
              />
            </Field>
            <Field label="Data type">
              <Select
                value={getParameterType(param)}
                onChange={(v) => onUpdateType(index, v)}
                options={SCHEMA_TYPES}
              />
            </Field>
          </div>
          <div className="card-row">
            <Field label="Description">
              <TextInput
                value={param.description ?? ""}
                onChange={(v) => onUpdate(index, { description: v })}
              />
            </Field>
            <Checkbox
              checked={param.required ?? false}
              onChange={(v) => onUpdate(index, { required: v })}
              label="Required"
            />
          </div>
        </>
      )}
    />
  );
}

function ResponsesList({
  order,
  responses,
  onRename,
  onUpdate,
  onRemove,
  onReorder,
}: {
  order: string[];
  responses: Record<string, ResponseObject>;
  onRename: (oldCode: string, newCode: string) => boolean;
  onUpdate: (code: string, p: Partial<ResponseObject>) => void;
  onRemove: (code: string) => void;
  onReorder: (from: number, to: number) => void;
}) {
  const items = order
    .map((code) => ({ code, response: responses[code] }))
    .filter((item): item is { code: string; response: ResponseObject } => !!item.response);

  return (
    <ReorderableBlockList
      items={items}
      getKey={(item) => item.code}
      onReorder={onReorder}
      renderHeader={({ code, response }, { isOpen, toggle }) => (
        <>
          <button type="button" className="editor-block-toggle" onClick={toggle}>
            <Chevron open={isOpen} />
            <span className="editor-block-title mono">{code}</span>
            <span className="editor-block-summary">
              {response.description?.trim() || "No description"}
            </span>
          </button>
          <RemoveButton onClick={() => onRemove(code)} />
        </>
      )}
      renderBody={({ code, response }) => (
        <>
          <div className="card-row">
            <Field label="Status Code">
              <StatusCodeInput code={code} onRename={(v) => onRename(code, v)} />
            </Field>
            <Field label="Description">
              <TextInput
                value={response.description ?? ""}
                onChange={(v) => onUpdate(code, { description: v })}
              />
            </Field>
          </div>
          <ResponseJsonEditor response={response} onChange={(r) => onUpdate(code, r)} />
        </>
      )}
    />
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
