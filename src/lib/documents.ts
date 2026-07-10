import type { OpenAPIDocument } from "../types";
import { clone } from "./document";
import { normalizeDocument } from "./normalize";
import { supabase } from "./supabase";
import { DEFAULT_DOCUMENT } from "./sample";

export interface DocumentSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export interface SavedDocument extends DocumentSummary {
  content: OpenAPIDocument;
  sourceYaml: string | null;
}

function rowToSummary(row: {
  id: string;
  title: string;
  updated_at: string;
}): DocumentSummary {
  return { id: row.id, title: row.title, updatedAt: row.updated_at };
}

function rowToDocument(row: {
  id: string;
  title: string;
  content: unknown;
  source_yaml?: string | null;
  updated_at: string;
}): SavedDocument {
  return {
    ...rowToSummary(row),
    content: normalizeDocument(row.content),
    sourceYaml: row.source_yaml ?? null,
  };
}

export async function listDocuments(): Promise<DocumentSummary[]> {
  if (!supabase) throw new Error("Supabase is not configured");

  const { data, error } = await supabase
    .from("documents")
    .select("id, title, updated_at")
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToSummary);
}

export async function getDocument(id: string): Promise<SavedDocument> {
  if (!supabase) throw new Error("Supabase is not configured");

  const { data, error } = await supabase
    .from("documents")
    .select("id, title, content, source_yaml, updated_at")
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);
  return rowToDocument(data);
}

export async function createDocument(
  userId: string,
  title: string,
  content: OpenAPIDocument,
  sourceYaml: string | null = null
): Promise<SavedDocument> {
  if (!supabase) throw new Error("Supabase is not configured");

  const { data, error } = await supabase
    .from("documents")
    .insert({ user_id: userId, title, content, source_yaml: sourceYaml })
    .select("id, title, content, source_yaml, updated_at")
    .single();

  if (error) throw new Error(error.message);
  return rowToDocument(data);
}

export async function updateDocument(
  id: string,
  patch: { title?: string; content?: OpenAPIDocument; sourceYaml?: string | null }
): Promise<SavedDocument> {
  if (!supabase) throw new Error("Supabase is not configured");

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) updates.title = patch.title;
  if (patch.content !== undefined) updates.content = patch.content;
  if (patch.sourceYaml !== undefined) updates.source_yaml = patch.sourceYaml;

  const { data, error } = await supabase
    .from("documents")
    .update(updates)
    .eq("id", id)
    .select("id, title, content, source_yaml, updated_at")
    .single();

  if (error) throw new Error(error.message);
  return rowToDocument(data);
}

export async function deleteDocument(id: string): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured");

  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function ensureDefaultDocument(userId: string): Promise<SavedDocument> {
  const list = await listDocuments();
  if (list.length > 0) return getDocument(list[0].id);
  return createDocument(
    userId,
    DEFAULT_DOCUMENT.info?.title ?? "Untitled API",
    clone(DEFAULT_DOCUMENT)
  );
}
