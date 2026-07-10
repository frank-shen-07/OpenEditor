import type { InfoObject, OpenAPIDocument } from "../types";
import { TextArea } from "./ui";

export function InfoEditor({
  doc,
  onChange,
}: {
  doc: OpenAPIDocument;
  onChange: (doc: OpenAPIDocument) => void;
}) {
  const info: InfoObject = doc.info ?? {};

  const setInfo = (patch: Partial<InfoObject>) => {
    onChange({ ...doc, info: { ...info, ...patch } });
  };

  return (
    <section className="info">
      <div className="info-mainline">
        <hgroup className="main">
          <h2 className="title">
            <input
              className="info-title-input"
              type="text"
              value={info.title ?? ""}
              onChange={(e) => setInfo({ title: e.target.value })}
              placeholder="OpenAPI file editor"
            />
          </h2>
          <span className="version">
            <input
              className="info-version-input"
              type="text"
              value={info.version ?? ""}
              onChange={(e) => setInfo({ version: e.target.value })}
              placeholder="1.0.0"
            />
          </span>
          <span className="openapi-version">
            OAS{" "}
            <input
              className="info-oas-input mono"
              type="text"
              value={doc.openapi ?? ""}
              onChange={(e) => onChange({ ...doc, openapi: e.target.value })}
              placeholder="3.0.3"
            />
          </span>
        </hgroup>
      </div>

      <div className="info-description">
        <TextArea
          value={info.description ?? ""}
          onChange={(v) => setInfo({ description: v })}
          placeholder="API description (supports markdown)"
          rows={4}
        />
      </div>
    </section>
  );
}
