import type { OpenAPIDocument, ServerObject } from "../types";
import { isSwagger2 } from "../lib/specVersion";
import { swagger2Servers } from "../lib/normalize";
import { EmptyState, Field, RemoveButton, TextInput } from "./ui";

export function ServersEditor({
  doc,
  onChange,
}: {
  doc: OpenAPIDocument;
  onChange: (doc: OpenAPIDocument) => void;
}) {
  if (isSwagger2(doc)) {
    return <Swagger2ServersEditor doc={doc} onChange={onChange} />;
  }

  return <OpenApiServersEditor doc={doc} onChange={onChange} />;
}

function Swagger2ServersEditor({
  doc,
  onChange,
}: {
  doc: OpenAPIDocument;
  onChange: (doc: OpenAPIDocument) => void;
}) {
  const schemes = Array.isArray(doc.schemes) ? (doc.schemes as string[]) : ["http"];
  const host = typeof doc.host === "string" ? doc.host : "";
  const basePath = typeof doc.basePath === "string" ? doc.basePath : "";

  const patchSwagger2 = (patch: Partial<{ schemes: string[]; host: string; basePath: string }>) => {
    const next = {
      ...doc,
      schemes: patch.schemes ?? schemes,
      host: patch.host ?? host,
      basePath: patch.basePath ?? basePath,
    };
    next.servers = swagger2Servers(next);
    onChange(next);
  };

  return (
    <section className="scheme-container">
      <div className="schemes-server-container">
        <div className="schemes-header">
          <span className="schemes-title">Server (Swagger 2.0)</span>
        </div>
        <div className="servers-list">
          <div className="server-card">
            <Field label="Schemes (comma-separated)">
              <TextInput
                value={schemes.join(", ")}
                onChange={(v) =>
                  patchSwagger2({
                    schemes: v
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                mono
              />
            </Field>
            <Field label="Host">
              <TextInput
                value={host}
                onChange={(v) => patchSwagger2({ host: v })}
                mono
              />
            </Field>
            <Field label="Base path">
              <TextInput
                value={basePath}
                onChange={(v) => patchSwagger2({ basePath: v })}
                mono
              />
            </Field>
          </div>
        </div>
      </div>
    </section>
  );
}

function OpenApiServersEditor({
  doc,
  onChange,
}: {
  doc: OpenAPIDocument;
  onChange: (doc: OpenAPIDocument) => void;
}) {
  const servers = doc.servers ?? [];

  const setServers = (next: ServerObject[]) => {
    onChange({ ...doc, servers: next });
  };

  const updateServer = (index: number, patch: Partial<ServerObject>) => {
    setServers(servers.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const addServer = () => setServers([...servers, { url: "", description: "" }]);

  return (
    <section className="scheme-container">
      <div className="schemes-server-container">
        <div className="schemes-header">
          <span className="schemes-title">Servers</span>
          <button className="btn btn-execute btn-sm" onClick={addServer} type="button">
            + Add Server
          </button>
        </div>

        {servers.length === 0 ? (
          <EmptyState
            message="No servers defined."
            action={
              <button className="btn btn-execute btn-sm" onClick={addServer} type="button">
                + Add Server
              </button>
            }
          />
        ) : (
          <div className="servers-list">
            {servers.map((server, i) => (
              <div className="server-card" key={i}>
                <Field label="URL">
                  <TextInput
                    value={server.url ?? ""}
                    onChange={(v) => updateServer(i, { url: v })}
                    mono
                  />
                </Field>
                <Field label="Description">
                  <TextInput
                    value={server.description ?? ""}
                    onChange={(v) => updateServer(i, { description: v })}
                  />
                </Field>
                <RemoveButton onClick={() => setServers(servers.filter((_, j) => j !== i))} />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
