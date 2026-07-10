import type { OpenAPIDocument, TagObject } from "../types";
import { EmptyState, Field, RemoveButton, Section, TextInput } from "./ui";

export function TagsEditor({
  doc,
  onChange,
}: {
  doc: OpenAPIDocument;
  onChange: (doc: OpenAPIDocument) => void;
}) {
  const tags = doc.tags ?? [];

  const setTags = (next: TagObject[]) => {
    onChange({ ...doc, tags: next });
  };

  const updateTag = (index: number, patch: Partial<TagObject>) => {
    setTags(tags.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  };

  const addTag = () => setTags([...tags, { name: "", description: "" }]);

  return (
    <div className="panel-content">
      <Section
        title="Tags"
        actions={
          <button className="btn btn-primary btn-sm" onClick={addTag} type="button">
            + Add Tag
          </button>
        }
      >
        {tags.length === 0 ? (
          <EmptyState
            message="No tags defined yet. Tags group related operations."
            action={
              <button className="btn btn-primary btn-sm" onClick={addTag} type="button">
                + Add Tag
              </button>
            }
          />
        ) : (
          <div className="card-list">
            {tags.map((tag, i) => (
              <div className="card" key={i}>
                <div className="card-row">
                  <Field label="Name">
                    <TextInput
                      value={tag.name ?? ""}
                      onChange={(v) => updateTag(i, { name: v })}
                      placeholder="pets"
                      mono
                    />
                  </Field>
                  <Field label="Description">
                    <TextInput
                      value={tag.description ?? ""}
                      onChange={(v) => updateTag(i, { description: v })}
                      placeholder="Operations about pets"
                    />
                  </Field>
                  <RemoveButton onClick={() => setTags(tags.filter((_, j) => j !== i))} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
