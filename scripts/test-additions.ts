import { readFileSync } from "fs";
import {
  buildExportYaml,
  mergeImportAnchor,
  parseImport,
} from "../src/lib/preserveImport";

const source = readFileSync(
  "/Users/frankshen/.cursor/projects/Users-frankshen-Documents-GitHub-OpenEditor/uploads/unigotchi-api-L1-L1183-0.yaml",
  "utf8"
);

const { doc, sourceYaml } = parseImport(source);
const withNewPath = mergeImportAnchor(doc, {
  ...doc,
  paths: {
    ...doc.paths,
    "/wellbeing/tips": {
      get: {
        summary: "Get wellbeing tips",
        responses: { "200": { description: "OK" } },
      },
    },
  },
});

const exported = buildExportYaml(sourceYaml, withNewPath);
if (!exported.includes("/wellbeing/tips")) {
  throw new Error("new path not in export");
}
// Must appear before x-components (inside paths)
const tipsIdx = exported.indexOf("/wellbeing/tips");
const xCompIdx = exported.indexOf("x-components:");
if (tipsIdx < 0 || xCompIdx < 0 || tipsIdx > xCompIdx) {
  throw new Error(`path not inserted before x-components (tips@${tipsIdx}, x@${xCompIdx})`);
}
console.log("OK - path appended inside paths section");
