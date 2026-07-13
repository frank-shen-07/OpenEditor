import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { HttpMethod, MediaTypeObject, OperationObject, ParameterObject, ResponseObject } from "../types";
import { clone } from "../lib/document";
import {
  getDisplayParameters,
  getParameterType,
  METHODS_WITHOUT_BODY,
} from "../lib/normalize";
import {
  appendResponseOrder,
  getResponseOrder,
  removeFromResponseOrder,
  renameInResponseOrder,
  reorderResponses,
} from "../lib/responseOrder";
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

const RESPONSE_LIST_GAP = 8;

function getResponseShiftY(
  index: number,
  dragIndex: number | null,
  insertAt: number | null,
  blockHeight: number,
): number {
  if (dragIndex === null || insertAt === null || index === dragIndex) return 0;
  const shift = blockHeight + RESPONSE_LIST_GAP;
  if (dragIndex < insertAt && index > dragIndex && index < insertAt) return -shift;
  if (dragIndex > insertAt && index >= insertAt && index < dragIndex) return shift;
  return 0;
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
  const [openCodes, setOpenCodes] = useState<Set<string>>(() => new Set());
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [insertAt, setInsertAt] = useState<number | null>(null);
  const [dropLineY, setDropLineY] = useState<number | null>(null);
  const prevOrderRef = useRef(order);
  const listRef = useRef<HTMLDivElement>(null);
  const dragBlockHeightRef = useRef(0);
  const flipTopsRef = useRef<Map<string, number> | null>(null);
  const dragRafRef = useRef<number | null>(null);
  const pendingClientYRef = useRef(0);

  useEffect(() => {
    const prevOrder = prevOrderRef.current;
    setOpenCodes((prev) => {
      const next = new Set(prev);
      for (const code of prevOrder) {
        if (!order.includes(code)) next.delete(code);
      }
      for (const code of order) {
        if (!prevOrder.includes(code)) next.add(code);
      }
      return next;
    });
    prevOrderRef.current = order;
  }, [order.join("|")]);

  useLayoutEffect(() => {
    const first = flipTopsRef.current;
    if (!first) return;
    flipTopsRef.current = null;

    const list = listRef.current;
    if (!list) return;

    for (const code of order) {
      const block = list.querySelector<HTMLElement>(`[data-response-block][data-code="${code}"]`);
      const wrap = block?.parentElement as HTMLElement | null;
      if (!wrap) continue;
      const firstTop = first.get(code);
      if (firstTop === undefined) continue;
      const lastTop = wrap.offsetTop;
      const dy = firstTop - lastTop;
      if (Math.abs(dy) < 1) continue;

      wrap.style.transition = "none";
      wrap.style.transform = `translateY(${dy}px)`;
      requestAnimationFrame(() => {
        wrap.style.transition = "transform 0.38s cubic-bezier(0.22, 1, 0.36, 1)";
        wrap.style.transform = "";
        const cleanup = () => {
          wrap.style.transition = "";
          wrap.removeEventListener("transitionend", cleanup);
        };
        wrap.addEventListener("transitionend", cleanup);
      });
    }
  }, [order.join("|")]);

  const toggleOpen = (code: string) => {
    setOpenCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const clearDragState = () => {
    if (dragRafRef.current !== null) {
      cancelAnimationFrame(dragRafRef.current);
      dragRafRef.current = null;
    }
    setDragIndex(null);
    setInsertAt(null);
    setDropLineY(null);
  };

  const updateDropLineY = (nextInsert: number) => {
    const list = listRef.current;
    if (!list) return;
    const listTop = list.getBoundingClientRect().top;
    const wraps = Array.from(list.querySelectorAll<HTMLElement>(".response-block-wrap"));
    if (wraps.length === 0) {
      setDropLineY(0);
      return;
    }
    if (nextInsert <= 0) {
      setDropLineY(wraps[0].getBoundingClientRect().top - listTop - 2);
      return;
    }
    if (nextInsert >= wraps.length) {
      const last = wraps[wraps.length - 1];
      setDropLineY(last.getBoundingClientRect().bottom - listTop + 2);
      return;
    }
    setDropLineY(wraps[nextInsert].getBoundingClientRect().top - listTop - 2);
  };

  useLayoutEffect(() => {
    if (insertAt === null || dragIndex === null) return;
    updateDropLineY(insertAt);
  }, [insertAt, dragIndex, order.join("|")]);

  const updateInsertAt = (clientY: number) => {
    const list = listRef.current;
    if (!list) return;
    const blocks = Array.from(list.querySelectorAll<HTMLElement>("[data-response-block]"));
    let nextInsert = order.length;
    for (let i = 0; i < blocks.length; i++) {
      const rect = blocks[i].getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) {
        nextInsert = i;
        break;
      }
    }
    setInsertAt((prev) => (prev === nextInsert ? prev : nextInsert));
    updateDropLineY(nextInsert);
  };

  const scheduleInsertUpdate = (clientY: number) => {
    pendingClientYRef.current = clientY;
    if (dragRafRef.current !== null) return;
    dragRafRef.current = requestAnimationFrame(() => {
      dragRafRef.current = null;
      updateInsertAt(pendingClientYRef.current);
    });
  };

  const captureFlipPositions = () => {
    const list = listRef.current;
    if (!list) return;
    const tops = new Map<string, number>();
    for (const code of order) {
      const block = list.querySelector<HTMLElement>(`[data-response-block][data-code="${code}"]`);
      const wrap = block?.parentElement as HTMLElement | null;
      if (wrap) tops.set(code, wrap.offsetTop);
    }
    flipTopsRef.current = tops;
  };

  const handleDrop = (from: number) => {
    if (Number.isNaN(from) || insertAt === null) {
      clearDragState();
      return;
    }
    if (insertAt === from || insertAt === from + 1) {
      clearDragState();
      return;
    }
    const to = insertAt > from ? insertAt - 1 : insertAt;
    captureFlipPositions();
    onReorder(from, to);
    clearDragState();
  };

  const isDragging = dragIndex !== null;
  const dragBlockHeight = dragBlockHeightRef.current;

  return (
    <div
      ref={listRef}
      className={`response-block-list${isDragging ? " is-dragging" : ""}`}
      style={
        isDragging && dropLineY !== null
          ? ({ "--response-drop-line-y": `${dropLineY}px` } as React.CSSProperties)
          : undefined
      }
      onDragOver={(e) => {
        if (dragIndex === null) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        scheduleInsertUpdate(e.clientY);
      }}
      onDragLeave={(e) => {
        if (!listRef.current?.contains(e.relatedTarget as Node)) {
          setInsertAt(null);
          setDropLineY(null);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        const from = Number(e.dataTransfer.getData("application/x-response-index"));
        handleDrop(from);
      }}
    >
      {order.map((code, index) => {
        const resp = responses[code];
        if (!resp) return null;
        const isOpen = openCodes.has(code) && dragIndex !== index;
        const isDraggingBlock = dragIndex === index;
        const shiftY = getResponseShiftY(index, dragIndex, insertAt, dragBlockHeight);

        return (
          <div
            key={code}
            className={`response-block-wrap${isDragging ? " is-shifting" : ""}`}
            style={shiftY ? { transform: `translateY(${shiftY}px)` } : undefined}
          >
            <div
              data-response-block
              data-code={code}
              className={`response-block${isOpen ? " is-open" : ""}${isDraggingBlock ? " is-dragging" : ""}`}
            >
              <div className="response-block-header">
                <div
                  role="button"
                  tabIndex={0}
                  className="response-drag-handle"
                  title="Drag to reorder"
                  draggable
                  onDragStart={(e) => {
                    const wrap = (e.currentTarget as HTMLElement).closest(".response-block-wrap");
                    dragBlockHeightRef.current = wrap?.getBoundingClientRect().height ?? 52;
                    setDragIndex(index);
                    setInsertAt(index);
                    updateDropLineY(index);
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("application/x-response-index", String(index));
                    const img = new Image();
                    img.src =
                      "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
                    e.dataTransfer.setDragImage(img, 0, 0);
                  }}
                  onDragEnd={clearDragState}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") e.preventDefault();
                  }}
                >
                  ⋮⋮
                </div>
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
            </div>
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
