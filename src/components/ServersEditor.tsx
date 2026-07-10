import type { OpenAPIDocument, ServerObject } from "../types";
import { EmptyState, Field, RemoveButton, TextInput } from "./ui";

export function ServersEditor({
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
                    placeholder="https://api.example.com/v1"
                    mono
                  />
                </Field>
                <Field label="Description">
                  <TextInput
                    value={server.description ?? ""}
                    onChange={(v) => updateServer(i, { description: v })}
                    placeholder="Production server"
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
