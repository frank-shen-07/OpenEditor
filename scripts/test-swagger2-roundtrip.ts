import { load } from "js-yaml";
import { normalizeDocument } from "../src/lib/normalize";
import { exportSwagger2, serializeDocument } from "../src/lib/exportDocument";

const sample = `
swagger: "2.0"
info:
  title: Test
  version: "1.0"
paths:
  /auth/register:
    post:
      parameters:
        - $ref: '#/x-components/body/Register'
      responses:
        '200':
          description: OK
          schema:
            $ref: '#/x-components/return/Session'
  /simulations/{simulationId}:
    get:
      parameters:
        - $ref: '#/x-components/path/SimulationId'
        - $ref: '#/x-components/header/Session'
      responses:
        '200':
          description: OK
          schema:
            type: object
x-components:
  body:
    Register:
      in: body
      name: body
      required: true
      schema:
        type: object
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
    Session:
      type: object
      properties:
        session:
          type: string
`;

const doc = normalizeDocument(load(sample));
const registerParams = doc.paths?.["/auth/register"]?.post?.parameters ?? [];
const getParams = doc.paths?.["/simulations/{simulationId}"]?.get?.parameters ?? [];
const getBody = doc.paths?.["/simulations/{simulationId}"]?.get?.requestBody;

console.log("register param count:", registerParams.length);
console.log("register refs:", registerParams.map((p) => p.$ref));
console.log("get param count:", getParams.length);
console.log("get refs:", getParams.map((p) => p.$ref));
console.log("get has requestBody:", !!getBody);

const exported = exportSwagger2(doc);
const expRegister = (exported.paths as Json)?.["/auth/register"]?.post?.parameters ?? [];
const expGet = (exported.paths as Json)?.["/simulations/{simulationId}"]?.get?.parameters ?? [];

type Json = Record<string, unknown>;
console.log("export register count:", expRegister.length);
console.log("export get count:", expGet.length);
console.log("export get has body:", expGet.some((p: Json) => p.in === "body"));

if (registerParams.length !== 1) throw new Error("expected 1 register param");
if (getParams.length !== 2) throw new Error("expected 2 get params");
if (getBody) throw new Error("GET should not have requestBody");
if (expRegister.length !== 1) throw new Error("export: expected 1 register param");
if (expGet.length !== 2) throw new Error("export: expected 2 get params");
if (expGet.some((p: Json) => p.in === "body")) throw new Error("export: GET should not have body");

console.log("OK");
