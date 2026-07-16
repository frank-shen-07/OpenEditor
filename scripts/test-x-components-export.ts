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
`;

const { doc, sourceYaml } = parseImport(source);

const designedOp = normalizeDocument({
  ...doc,
  paths: {
    ...doc.paths,
    "/simulations/{simulationId}/connections": {
      get: {
        tags: ["Iteration 2 (Designed)"],
        summary: "Lists all social support connections in the simulation",
        description: "Lists all social support connections in the simulation ordered by connectionId.",
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
      delete: {
        tags: ["Iteration 2 (Designed)"],
        summary: "Deletes a social support connection",
        parameters: [
          { in: "header", name: "session", required: true, type: "string" },
          { in: "path", name: "simulationId", required: true, type: "integer" },
          { in: "path", name: "connectionId", required: true, type: "integer" },
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
    },
  },
}).paths?.["/simulations/{simulationId}/connections"];

if (!designedOp) throw new Error("missing designed path");

const withNewPath = mergeImportAnchor(doc, {
  ...doc,
  paths: {
    ...doc.paths,
    "/simulations/{simulationId}/connections": designedOp,
  },
});

const exported = buildExportYaml(sourceYaml, withNewPath);
const connectionsBlock = exported.slice(exported.indexOf("/simulations/{simulationId}/connections:"));

const checks: Array<[string, boolean]> = [
  ["session header ref", connectionsBlock.includes("$ref: '#/x-components/header/Session'")],
  ["simulationId path ref", connectionsBlock.includes("$ref: '#/x-components/path/SimulationId'")],
  ["401 error ref", connectionsBlock.includes("$ref: '#/x-components/return/Error'")],
  ["empty delete ref", connectionsBlock.includes("$ref: '#/x-components/return/Empty'")],
  ["inline session header absent", !connectionsBlock.includes("name: session\n          required: true\n          type: string")],
  ["custom connectionId stays inline", connectionsBlock.includes("name: connectionId")],
];

for (const [label, ok] of checks) {
  if (!ok) {
    console.error("FAIL:", label);
    console.error(connectionsBlock);
    process.exit(1);
  }
}

console.log("OK - designed routes export x-component $refs");
console.log(
  dump(
    {
      sample: connectionsBlock
        .split("\n")
        .slice(0, 40)
        .join("\n"),
    },
    { lineWidth: 120 }
  )
);
