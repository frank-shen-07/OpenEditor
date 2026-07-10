import { useCallback, useEffect, useRef, useState } from "react";
import type { OpenAPIDocument } from "./types";
import { downloadYaml, parseDocument } from "./lib/document";
import { SAMPLE_DOCUMENT } from "./lib/sample";
import { InfoEditor } from "./components/InfoEditor";
import { ServersEditor } from "./components/ServersEditor";
import { PathsEditor } from "./components/PathsEditor";
import { SchemasEditor } from "./components/SchemasEditor";
import { YamlView } from "./components/YamlView";
import { Chevron } from "./components/ui";

type Theme = "dark" | "light";

function getInitialTheme(): Theme {
  const stored = localStorage.getItem("openeditor-theme");
  if (stored === "light" || stored === "dark") return stored;
  return "dark";
}

export default function App() {
  const [doc, setDoc] = useState<OpenAPIDocument>(SAMPLE_DOCUMENT);
  const [importError, setImportError] = useState<string | null>(null);
  const [yamlOpen, setYamlOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("openeditor-theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  const handleImport = useCallback((file: File) => {
    setImportError(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result as string;
        setDoc(parseDocument(text));
      } catch (e) {
        setImportError((e as Error).message);
      }
    };
    reader.onerror = () => setImportError("Failed to read file");
    reader.readAsText(file);
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImport(file);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleImport(file);
  };

  return (
    <div className="swagger-ui" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      <div className="topbar">
        <div className="wrapper">
          <div className="topbar-wrapper">
            <a className="topbar-logo" href="#" onClick={(e) => e.preventDefault()}>
              <svg className="swagger-logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="30" height="30">
                <path
                  fill="#85ea2d"
                  d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 2.4c5.302 0 9.6 4.298 9.6 9.6s-4.298 9.6-9.6 9.6S2.4 17.302 2.4 12 6.698 2.4 12 2.4zM7.2 8.4h9.6v1.2H7.2V8.4zm0 3h9.6v1.2H7.2v-1.2zm0 3h6v1.2H7.2V14.4z"
                />
              </svg>
              <span>OpenEditor</span>
            </a>
            <div className="topbar-actions">
              <button
                className="btn theme-toggle"
                type="button"
                onClick={toggleTheme}
                title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              >
                {theme === "dark" ? "☀ Light" : "☾ Dark"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".yaml,.yml,.json"
                className="sr-only"
                onChange={onFileChange}
              />
              <button
                className="btn authorize"
                type="button"
                onClick={() => fileInputRef.current?.click()}
              >
                Import
              </button>
              <button
                className="btn"
                type="button"
                onClick={() => {
                  setDoc(SAMPLE_DOCUMENT);
                  setImportError(null);
                }}
              >
                Sample
              </button>
              <button
                className="btn download-url"
                type="button"
                onClick={() => downloadYaml(doc)}
              >
                Download YAML
              </button>
            </div>
          </div>
        </div>
      </div>

      {importError && (
        <div className="errors-wrapper" role="alert">
          <div className="errors">
            <h4>Import failed</h4>
            <span className="message">{importError}</span>
            <button
              className="btn btn-icon"
              type="button"
              onClick={() => setImportError(null)}
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="swagger-container">
        <InfoEditor doc={doc} onChange={setDoc} />
        <ServersEditor doc={doc} onChange={setDoc} />
        <PathsEditor doc={doc} onChange={setDoc} />
        <SchemasEditor doc={doc} onChange={setDoc} />

        <section className={`models yaml-section${yamlOpen ? " is-open" : ""}`}>
          <button
            type="button"
            className="models-control"
            onClick={() => setYamlOpen((v) => !v)}
          >
            <span>Raw YAML</span>
            <Chevron open={yamlOpen} />
          </button>
          {yamlOpen && (
            <div className="yaml-section-body">
              <YamlView doc={doc} onChange={setDoc} />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
