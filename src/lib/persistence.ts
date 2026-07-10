import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { OpenAPIDocument } from "../types";
import {
  createDocument,
  deleteDocument,
  ensureDefaultDocument,
  getDocument,
  listDocuments,
  updateDocument,
  type DocumentSummary,
} from "./documents";
import { clone } from "./document";

export type SaveStatus = "idle" | "loading" | "saving" | "saved" | "error";

export function useDocumentPersistence(user: { id: string } | null) {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [ready, setReady] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDoc = useRef<OpenAPIDocument | null>(null);
  const latestSourceYaml = useRef<string | null>(null);
  const latestPreserveImport = useRef(false);
  const activeIdRef = useRef<string | null>(null);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  useEffect(() => {
    if (!user) {
      setDocuments([]);
      setActiveId(null);
      setReady(false);
      setSaveStatus("idle");
    }
  }, [user]);

  const loadDocuments = useCallback(async () => {
    if (!user) return null;
    setSaveStatus("loading");
    setReady(false);
    try {
      const document = await ensureDefaultDocument(user.id);
      const list = await listDocuments();
      setDocuments(list);
      setActiveId(document.id);
      setSaveStatus("saved");
      setReady(true);
      return {
        doc: document.content,
        baseline: clone(document.content),
        sourceYaml: document.sourceYaml,
      };
    } catch {
      setSaveStatus("error");
      setReady(false);
      return null;
    }
  }, [user]);

  const selectDocument = useCallback(async (id: string) => {
    setSaveStatus("loading");
    setReady(false);
    try {
      const document = await getDocument(id);
      setActiveId(document.id);
      setSaveStatus("saved");
      setReady(true);
      return {
        doc: document.content,
        baseline: clone(document.content),
        sourceYaml: document.sourceYaml,
      };
    } catch {
      setSaveStatus("error");
      setReady(false);
      return null;
    }
  }, []);

  const createNewDocument = useCallback(
    async (doc: OpenAPIDocument, sourceYaml: string | null = null) => {
      if (!user) return null;
      setSaveStatus("saving");
      try {
        const title = doc.info?.title?.trim() || "Untitled API";
        const document = await createDocument(user.id, title, doc, sourceYaml);
        setDocuments((prev) => [
          { id: document.id, title: document.title, updatedAt: document.updatedAt },
          ...prev,
        ]);
        setActiveId(document.id);
        setSaveStatus("saved");
        setReady(true);
        return document.id;
      } catch {
        setSaveStatus("error");
        return null;
      }
    },
    [user]
  );

  const removeDocument = useCallback(
    async (id: string) => {
      setReady(false);
      await deleteDocument(id);
      const list = await listDocuments();
      setDocuments(list);
      if (list.length === 0 && user) {
        const document = await ensureDefaultDocument(user.id);
        setActiveId(document.id);
        setSaveStatus("saved");
        setReady(true);
        return {
          doc: document.content,
          baseline: clone(document.content),
          sourceYaml: document.sourceYaml,
        };
      }
      if (activeIdRef.current === id && list.length > 0) {
        return selectDocument(list[0].id);
      }
      setReady(true);
      return null;
    },
    [selectDocument, user]
  );

  const queueSave = useCallback(
    (
      doc: OpenAPIDocument,
      meta?: {
        sourceYaml?: string | null;
        preserveImport?: boolean;
      }
    ) => {
      if (!user || !ready || activeIdRef.current === null) return;
      latestDoc.current = doc;
      if (meta?.sourceYaml !== undefined) latestSourceYaml.current = meta.sourceYaml;
      if (meta?.preserveImport !== undefined) {
        latestPreserveImport.current = meta.preserveImport;
      }
      if (saveTimer.current) clearTimeout(saveTimer.current);
      setSaveStatus("saving");
      saveTimer.current = setTimeout(async () => {
        const id = activeIdRef.current;
        const payload = latestDoc.current;
        if (!user || !ready || id === null || !payload) return;
        try {
          const title = payload.info?.title?.trim() || "Untitled API";
          const document = await updateDocument(id, {
            title,
            content: payload,
            sourceYaml: latestPreserveImport.current ? latestSourceYaml.current : null,
          });
          setDocuments((prev) =>
            prev.map((d) =>
              d.id === document.id
                ? { id: document.id, title: document.title, updatedAt: document.updatedAt }
                : d
            )
          );
          setSaveStatus("saved");
        } catch {
          setSaveStatus("error");
        }
      }, 1500);
    },
    [user, ready]
  );

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  return useMemo(
    () => ({
      documents,
      activeId,
      saveStatus,
      loadDocuments,
      selectDocument,
      createDocument: createNewDocument,
      deleteDocument: removeDocument,
      queueSave,
    }),
    [
      documents,
      activeId,
      saveStatus,
      loadDocuments,
      selectDocument,
      createNewDocument,
      removeDocument,
      queueSave,
    ]
  );
}
