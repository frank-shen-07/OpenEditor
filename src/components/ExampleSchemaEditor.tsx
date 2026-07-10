import { useState } from "react";
import type { SchemaObject } from "../types";
import { generateSchemaFromExample, isEmptySchema } from "../lib/schemaFromExample";
import { JsonEditor, toJsonText } from "./JsonEditor";
import { Chevron, Field } from "./ui";

export function ExampleSchemaEditor({
  example,
  schema,
  onExampleChange,
  onSchemaChange,
  requireObject = true,
  hint,
}: {
  example: unknown;
  schema?: SchemaObject;
  onExampleChange: (example: unknown) => void;
  onSchemaChange: (schema: SchemaObject) => void;
  requireObject?: boolean;
  hint?: string;
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const applyGeneratedSchema = (value: unknown): boolean => {
    if (value === undefined || (requireObject && value === null)) {
      setGenError("Add a JSON example first");
      return false;
    }
    if (requireObject && typeof value === "object" && value !== null && !Array.isArray(value)) {
      // Empty object is valid — generates { type: "object", properties: {} }
    } else if (requireObject && (typeof value !== "object" || value === null || Array.isArray(value))) {
      setGenError("Example must be a JSON object");
      return false;
    }

    const generated = generateSchemaFromExample(value);
    if (!generated) {
      setGenError("Could not generate schema from example");
      return false;
    }

    onSchemaChange(generated);
    setGenError(null);
    return true;
  };

  const handleExampleValid = (value: unknown) => {
    onExampleChange(value);
    if (isEmptySchema(schema)) {
      applyGeneratedSchema(value);
    }
  };

  return (
    <>
      <Field
        label="Example (JSON)"
        hint={hint ?? "Paste a real request/response from your API — types are inferred automatically"}
      >
        <div className="example-schema-editor">
          <JsonEditor
            value={toJsonText(example)}
            requireObject={requireObject}
            onValid={handleExampleValid}
          />
          <div className="example-schema-actions">
            <button
              className="btn btn-sm btn-execute"
              type="button"
              onClick={() => applyGeneratedSchema(example)}
            >
              Generate schema from example
            </button>
            {genError && <span className="error-text">{genError}</span>}
          </div>
        </div>
      </Field>

      <div className={`advanced-section${advancedOpen ? " is-open" : ""}`}>
        <button
          type="button"
          className="advanced-section-toggle"
          onClick={() => setAdvancedOpen((v) => !v)}
        >
          <span>Advanced — Schema (JSON)</span>
          <Chevron open={advancedOpen} />
        </button>
        {advancedOpen && (
          <div className="advanced-section-body">
            <Field label="Schema (JSON)" hint="JSON Schema for validation. Usually auto-generated from the example above.">
              <JsonEditor
                value={toJsonText(schema)}
                requireObject
                onValid={(value) => onSchemaChange(value as SchemaObject)}
              />
            </Field>
          </div>
        )}
      </div>
    </>
  );
}
