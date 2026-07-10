import type { InfoObject, OpenAPIDocument } from "../types";
import { getSpecVersion, isSwagger2, specVersionLabel } from "../lib/specVersion";
import { TextArea } from "./ui";

export function InfoEditor({
  doc,
  onChange,
  onUpgradeToOpenApi3,
}: {
  doc: OpenAPIDocument;
  onChange: (doc: OpenAPIDocument) => void;
  onUpgradeToOpenApi3?: () => void;
}) {
  const info: InfoObject = doc.info ?? {};
  const specVersion = getSpecVersion(doc);
  const swagger2 = isSwagger2(doc);

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
            />
          </h2>
          <span className="version">
            <input
              className="info-version-input"
              type="text"
              value={info.version ?? ""}
              onChange={(e) => setInfo({ version: e.target.value })}
            />
          </span>
          <span className="openapi-version spec-version-badge">
            {swagger2 ? (
              <>
                {specVersionLabel(specVersion)}
                {onUpgradeToOpenApi3 && (
                  <button
                    className="btn btn-sm spec-upgrade-btn"
                    type="button"
                    onClick={onUpgradeToOpenApi3}
                    title="Convert this document to OpenAPI 3 format"
                  >
                    Upgrade to OAS 3
                  </button>
                )}
              </>
            ) : (
              <>
                OAS{" "}
                <input
                  className="info-oas-input mono"
                  type="text"
                  value={doc.openapi ?? ""}
                  onChange={(e) => onChange({ ...doc, openapi: e.target.value })}
                />
              </>
            )}
          </span>
        </hgroup>
      </div>

      <div className="info-description">
        <TextArea
          value={info.description ?? ""}
          onChange={(v) => setInfo({ description: v })}
          rows={4}
        />
      </div>
    </section>
  );
}
