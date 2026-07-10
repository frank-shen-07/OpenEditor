-- OpenEditor: per-user API document storage
-- Run this in the Supabase SQL editor (or via supabase db push)

CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled API',
  content JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_updated_at ON public.documents(updated_at DESC);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documents_select_own"
  ON public.documents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "documents_insert_own"
  ON public.documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "documents_update_own"
  ON public.documents FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "documents_delete_own"
  ON public.documents FOR DELETE
  USING (auth.uid() = user_id);
