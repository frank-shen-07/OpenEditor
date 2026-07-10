import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import type { OpenAPIDocument } from "../types";
import { downloadYaml, parseDocument, clone } from "../lib/document";
import { DEFAULT_DOCUMENT, SAMPLE_DOCUMENT } from "../lib/sample";
import { useAuth } from "../context/AuthContext";
import { useDocumentPersistence } from "../lib/persistence";
import { InfoEditor } from "../components/InfoEditor";
import { ServersEditor } from "../components/ServersEditor";
import { PathsEditor } from "../components/PathsEditor";
import { SchemasEditor } from "../components/SchemasEditor";
import { YamlView } from "../components/YamlView";
import { DocumentsPanel } from "../components/DocumentsPanel";
import { Logo, ThemeToggle } from "../components/Chrome";
import { UserMenu } from "../components/UserMenu";
import { Chevron } from "../components/ui";
import { useTheme } from "../hooks/useTheme";

export function EditorPage() {
  const { user, loading: authLoading, authAvailable } = useAuth();
  const persistence = useDocumentPersistence(user);
  const { theme, toggleTheme } = useTheme();
  const [doc, setDoc] = useState<OpenAPIDocument>(DEFAULT_DOCUMENT);
  const [baselineDoc, setBaselineDoc] = useState<OpenAPIDocument>(() => clone(DEFAULT_DOCUMENT));
  const [importError, setImportError] = useState<string | null>(null);
  const [yamlOpen, setYamlOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadedUserId = useRef<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      loadedUserId.current = null;
      setDoc(DEFAULT_DOCUMENT);
      setBaselineDoc(clone(DEFAULT_DOCUMENT));
      return;
    }

    if (loadedUserId.current === user.id) return;
    loadedUserId.current = user.id;

    persistence.loadDocuments().then((result) => {
      if (result) {
        setDoc(result.doc);
        setBaselineDoc(result.baseline);
      }
    });
  }, [user, authLoading, persistence.loadDocuments]);

  useEffect(() => {
    if (user) {
      persistence.queueSave(doc);
    }
  }, [doc, user, persistence.queueSave]);

  const applyDocument = useCallback((next: OpenAPIDocument) => {
    setDoc(next);
    setBaselineDoc(clone(next));
  }, []);

  const handleImport = useCallback((file: File) => {
    setImportError(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result as string;
        applyDocument(parseDocument(text));
      } catch (e) {
        setImportError((e as Error).message);
      }
    };
    reader.onerror = () => setImportError("Failed to read file");
    reader.readAsText(file);
  }, [applyDocument]);

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

  const handleSelectDocument = async (id: string) => {
    const result = await persistence.selectDocument(id);
    if (result) applyDocument(result.doc);
  };

  const handleCreateDocument = async () => {
    const fresh = clone(DEFAULT_DOCUMENT);
    const id = await persistence.createDocument(fresh);
    if (id) applyDocument(fresh);
  };

  const handleDeleteDocument = async (id: string) => {
    const result = await persistence.deleteDocument(id);
    if (result) applyDocument(result.doc);
  };

  if (authLoading) {
    return (
      <div className="page-loading">
        <span className="muted">Loading…</span>
      </div>
    );
  }

  if (authAvailable && !user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="swagger-ui" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      <div className="topbar">
        <div className="wrapper">
          <div className="topbar-wrapper">
            <Logo to="/" />
            <div className="topbar-actions">
              {user && persistence.documents.length > 0 && (
                <DocumentsPanel
                  documents={persistence.documents}
                  activeId={persistence.activeId}
                  saveStatus={persistence.saveStatus}
                  onSelect={handleSelectDocument}
                  onCreate={handleCreateDocument}
                  onDelete={handleDeleteDocument}
                />
              )}
              <UserMenu />
              {!user && (
                <Link className="btn authorize btn-sm" to="/auth">
                  Log in
                </Link>
              )}
              <ThemeToggle theme={theme} onToggle={toggleTheme} />
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
                  applyDocument(SAMPLE_DOCUMENT);
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
              <YamlView
                doc={doc}
                baselineDoc={baselineDoc}
                onChange={setDoc}
                onUpdateBaseline={() => setBaselineDoc(clone(doc))}
              />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
