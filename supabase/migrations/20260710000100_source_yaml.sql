-- Preserve imported YAML formatting (comments, section headers, key order)
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS source_yaml TEXT;
