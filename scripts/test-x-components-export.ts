import { dump } from "js-yaml";
import { normalizeDocument } from "../src/lib/normalize";
import {
  buildExportYaml,
  mergeImportAnchor,
  parseImport,
} from "../src/lib/preserveImport";

const source = `
swagger: "2.0"
info:
  title: Unigotchi API
  version: 1.0.0
paths:
  /simulations/{simulationId}:
    get:
      operationId: simulationGet
      summary: Get simulation status
      tags:
        - "Iteration 2 (Prescribed Core)"
      parameters:
        - $ref: '#/x-components/path/SimulationId'
        - $ref: '#/x-components/header/Session'
      responses:
        '200':
          description: OK
          schema:
            $ref: '#/x-components/return/SimulationStatus'
        '401':
          description: UNAUTHORISED
          schema:
            $ref: '#/x-components/return/Error'
  /clear:
    delete:
      operationId: clear
      security: []
      summary: Reset application state
      responses:
        '200':
          description: OK
          schema:
            $ref: '#/x-components/return/Empty'
x-components:
  path:
    SimulationId:
      in: path
      name: simulationId
      required: true
      type: integer
  header:
    Session:
      in: header
      name: session
      required: true
      type: string
  body:
    UniverseCreate:
      in: body
      name: body
      required: true
      schema:
        type: object
        required:
          - universeName
          - universeData
        properties:
          universeName:
            type: string
          universeData:
            type: object
  return:
    SimulationStatus:
      type: object
      properties:
        simulationStatus:
          type: string
    Error:
      properties:
        error:
          type: string
        message:
          type: string
    Empty:
      type: object
  group:
    User:
      type: object
      properties:
        name:
          type: string
`;

const { doc, sourceYaml } = parseImport(source);

const connectionPostBody = {
  type: "object" as const,
  required: ["displayName", "supportLevel"],
  properties: {
    displayName: { type: "string" },
    supportLevel: { type: "integer" },
  },
};

const designedPath = normalizeDocument({
  ...doc,
  paths: {
    ...doc.paths,
    "/simulations/{simulationId}/connections": {
      get: {
        tags: ["Iteration 2 (Designed)"],
        summary: "Lists all social support connections in the simulation",
        parameters: [
          { in: "header", name: "session", required: true, type: "string" },
          { in: "path", name: "simulationId", required: true, type: "integer" },
        ],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["connections"],
                  properties: {
                    connections: { type: "array", items: { type: "object" } },
                  },
                },
              },
            },
          },
          "401": {
            description: "UNAUTHORISED",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["error", "message"],
                  properties: {
                    error: { type: "string" },
                    message: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Iteration 2 (Designed)"],
        summary: "Creates a new social support connection",
        parameters: [
          { in: "header", name: "session", required: true, type: "string" },
          { in: "path", name: "simulationId", required: true, type: "integer" },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: connectionPostBody,
            },
          },
        },
        responses: {
          "200": { description: "OK" },
          "400": {
            description: "Bad request",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["error", "message"],
                  properties: {
                    error: { type: "string" },
                    message: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
      delete: {
        tags: ["Iteration 2 (Designed)"],
        summary: "Deletes a social support connection",
        parameters: [
          { in: "header", name: "session", required: true, type: "string" },
          { in: "path", name: "simulationId", required: true, type: "integer" },
        ],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: { type: "object", properties: {} },
              },
            },
          },
        },
      },
    },
  },
}).paths?.["/simulations/{simulationId}/connections"];

if (!designedPath) throw new Error("missing designed path");

const withNewGroupSchema = mergeImportAnchor(doc, {
  ...doc,
  paths: {
    ...doc.paths,
    "/simulations/{simulationId}/connections": designedPath,
  },
  "x-components": {
    ...(doc["x-components"] as object),
    group: {
      ...((doc["x-components"] as { group?: Record<string, unknown> })?.group ?? {}),
      Connection:
        {
          type: "object",
          properties: {
            connectionId: { type: "integer" },
            displayName: { type: "string" },
            supportLevel: { type: "integer" },
            createdAt: { type: "integer" },
          },
        },
    },
  },
});

const exported = buildExportYaml(sourceYaml, withNewGroupSchema);
const connectionsBlock = exported.slice(exported.indexOf("/simulations/{simulationId}/connections:"));

const checks: Array<[string, boolean]> = [
  ["session header ref", connectionsBlock.includes("$ref: '#/x-components/header/Session'")],
  ["simulationId path ref", connectionsBlock.includes("$ref: '#/x-components/path/SimulationId'")],
  ["401 error ref", connectionsBlock.includes("$ref: '#/x-components/return/Error'")],
  ["empty delete ref", connectionsBlock.includes("$ref: '#/x-components/return/Empty'")],
  ["POST body stays inline", connectionsBlock.includes("displayName:") && connectionsBlock.includes("supportLevel:")],
  ["POST body not UniverseCreate", !connectionsBlock.includes("$ref: '#/x-components/body/UniverseCreate'")],
  ["new group schema exported", exported.includes("Connection:") && exported.includes("connectionId:")],
];

for (const [label, ok] of checks) {
  if (!ok) {
    console.error("FAIL:", label);
    console.error(connectionsBlock);
    process.exit(1);
  }
}

console.log("OK - designed routes export x-component $refs and preserve custom bodies");
console.log(
  dump(
    {
      postParameters: connectionsBlock.match(/post:[\s\S]*?responses:/)?.[0],
    },
    { lineWidth: 120 }
  )
);
