import type { OpenAPIDocument } from "../types";

export const SAMPLE_DOCUMENT: OpenAPIDocument = {
  openapi: "3.0.3",
  info: {
    title: "OpenAPI file editor",
    version: "1.0.0",
    description:
      "A sample API for managing pets in a store. Edit anything here or import your own document.",
  },
  servers: [
    { url: "https://api.example.com/v1", description: "Production" },
    { url: "https://staging.api.example.com/v1", description: "Staging" },
  ],
  tags: [
    { name: "pets", description: "Operations about pets" },
    { name: "orders", description: "Store orders" },
  ],
  paths: {
    "/pets": {
      get: {
        tags: ["pets"],
        summary: "List all pets",
        operationId: "listPets",
        parameters: [
          {
            name: "limit",
            in: "query",
            description: "Maximum number of pets to return",
            required: false,
            schema: { type: "integer", format: "int32" },
          },
        ],
        responses: {
          "200": {
            description: "A paged array of pets",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/Pet" } },
              },
            },
          },
        },
      },
      post: {
        tags: ["pets"],
        summary: "Create a pet",
        operationId: "createPet",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/NewPet" },
            },
          },
        },
        responses: {
          "201": {
            description: "Pet created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Pet" },
              },
            },
          },
        },
      },
    },
    "/pets/{petId}": {
      get: {
        tags: ["pets"],
        summary: "Get a pet by ID",
        operationId: "getPetById",
        parameters: [
          {
            name: "petId",
            in: "path",
            description: "ID of the pet to fetch",
            required: true,
            schema: { type: "integer", format: "int64" },
          },
        ],
        responses: {
          "200": {
            description: "The requested pet",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Pet" },
              },
            },
          },
          "404": { description: "Pet not found" },
        },
      },
      delete: {
        tags: ["pets"],
        summary: "Delete a pet",
        operationId: "deletePet",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "petId",
            in: "path",
            required: true,
            schema: { type: "integer", format: "int64" },
          },
        ],
        responses: {
          "204": { description: "Pet deleted" },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  components: {
    schemas: {
      Pet: {
        type: "object",
        required: ["id", "name"],
        properties: {
          id: { type: "integer", format: "int64" },
          name: { type: "string" },
          tag: { type: "string" },
          status: { type: "string", enum: ["available", "pending", "sold"] },
        },
      },
      NewPet: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string" },
          tag: { type: "string" },
        },
      },
    },
  },
};
