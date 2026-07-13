import { load } from "js-yaml";
import { normalizeDocument } from "../src/lib/normalize";
import { exportSwagger2, serializeDocument } from "../src/lib/exportDocument";

const connectionsExample = {
  connections: [
    {
      createdAt: 1704067200,
      displayName: "My Simulation",
      connectionId: 42,
      supportLevel: 2,
    },
  ],
};

const sample = `
swagger: "2.0"
info:
  title: Test
  version: "1.0"
paths:
  /connections:
    get:
      responses:
        "200":
          description: OK
          schema:
            type: object
            properties:
              connections:
                type: array
                items:
                  type: object
                  properties:
                    createdAt:
                      type: integer
                    displayName:
                      type: string
                    connectionId:
                      type: integer
                    supportLevel:
                      type: integer
`;

const doc = normalizeDocument(load(sample));
const getOp = doc.paths?.["/connections"]?.get;
if (!getOp) throw new Error("missing GET /connections");

getOp.responses = {
  "200": {
    description: "OK",
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: {
            connections: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  createdAt: { type: "integer" },
                  displayName: { type: "string" },
                  connectionId: { type: "integer" },
                  supportLevel: { type: "integer" },
                },
              },
            },
          },
        },
        example: connectionsExample,
      },
    },
  },
};

const exported = exportSwagger2(doc);
const resp = (exported.paths as Record<string, { get?: { responses?: Record<string, unknown> } }>)[
  "/connections"
]?.get?.responses?.["200"] as Record<string, unknown> | undefined;

if (!resp) throw new Error("missing exported response");

const schemaExample = (resp.schema as { example?: unknown })?.example;
const examplesValue = (
  resp.examples as Record<string, { value?: unknown }> | undefined
)?.["application/json"]?.value;

if (JSON.stringify(schemaExample) !== JSON.stringify(connectionsExample)) {
  throw new Error("schema.example mismatch");
}
if (JSON.stringify(examplesValue) !== JSON.stringify(connectionsExample)) {
  throw new Error("examples.application/json.value mismatch");
}

const yaml = serializeDocument(doc);
if (!yaml.includes("displayName")) throw new Error("serialized YAML missing example values");
if (yaml.includes('"string"') && yaml.includes("displayName")) {
  throw new Error("serialized YAML should not use schema placeholder strings for displayName");
}

const importWithExamples = `
swagger: "2.0"
info:
  title: Test
  version: "1.0"
paths:
  /connections:
    get:
      responses:
        "200":
          description: OK
          schema:
            type: object
          examples:
            application/json:
              value:
                connections:
                  - createdAt: 1
                    displayName: Imported
                    connectionId: 9
                    supportLevel: 1
`;

const imported = normalizeDocument(load(importWithExamples));
const media = imported.paths?.["/connections"]?.get?.responses?.["200"]?.content?.[
  "application/json"
];
const ex = media?.example as { connections?: Array<{ displayName?: string }> } | undefined;
if (ex?.connections?.[0]?.displayName !== "Imported") {
  throw new Error(`imported example mismatch: ${JSON.stringify(media?.example)}`);
}

console.log("OK");
