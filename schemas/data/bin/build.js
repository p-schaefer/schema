import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { readFile, writeFile } from "fs/promises";

import $RefParser from "json-schema-ref-parser";
import { default as Ajv } from "ajv";
import standaloneCode from "ajv/dist/standalone/index.js";

import ajvFormats from "ajv-formats";
// import ajvFormatsDraft2019 from 'ajv-formats-draft2019'
import transformKeyword from "ajv-keywords/dist/definitions/transform.js";
import ajvErrors from "ajv-errors";

const __dirname = dirname(fileURLToPath(import.meta.url));

const version = await readFile(join(__dirname, "../package.json"))
  .then((res) => JSON.parse(res).version)
  .catch(() => "0.0.0");

console.log("Compile: JSON Schema & CSV Template");

const process = async (src, delKeys = ["$generated"], minify = false, ajv) => {
  console.log("process", version, src, delKeys, minify);
  let schema = {}; // JSON.parse(fs.readFileSync(path.join(__dirname, `/../src/${src}.json`)))
  try {
    schema = await $RefParser.dereference(
      join(__dirname, `/../src/${src}.json`)
    ); // deprecate if/when possible
    schema.version = version
  } catch (e) {
    console.error(e);
  }

  delKeys.forEach((delKey) => {
    deleteKey(schema, delKey);
  });

  const json = JSON.stringify(schema, null, minify ? 0 : 2);

  await writeFile(join(__dirname, `/../${src}/index.json`), json, {
    encoding: "utf8",
  });
  await writeFile(
    join(__dirname, `/../${src}/index.json.js`),
    "export default " + json,
    { encoding: "utf8" }
  );

  const validate = ajv.compile(schema);
  const code = standaloneCode(ajv, validate);
  ajv.removeSchema();

  await writeFile(join(__dirname, `/../${src}/index.js`), code, {
    encoding: "utf8",
  });
};

const deleteKey = (obj, delKey) => {
  if (typeof obj !== "object") return;
  for (const key in obj) {
    if (key === delKey) {
      delete obj[key];
    }
    if (Array.isArray(obj[key])) {
      for (const value of obj[key]) {
        deleteKey(value, delKey);
      }
    } else if (typeof obj[key] === "object") {
      deleteKey(obj[key], delKey);
    }
  }
};

// const csv = async () => {
//   const object = require(path.join(__dirname, `/../src/primary.json`))
//   let csv = `"` + Object.keys(object.properties).join(`","`) + `"` + '\r\n'
//   await writeFile(path.join(__dirname, `/../dist/csv/headers.csv`), csv, {encoding: 'utf8'})
// }
//
// csv()

// Primary
const ajvPrimary = new Ajv({
  strict: false,
  coerceTypes: false, // Keep it strict
  allErrors: true,
  useDefaults: "empty",
  keywords: [transformKeyword()],
  code: {
    source: true,
    //esm: true
  },
});
ajvFormats(ajvPrimary, ["date"]);
// ajvFormatsDraft2019(ajvPrimary, [])
// ajvErrors(ajvPrimary)
process("primary", ["$generated", "errorMessage"], false, ajvPrimary);

// Frontend
const ajvFrontend = new Ajv({
  strict: false,
  coerceTypes: true,
  allErrors: true,
  useDefaults: "empty",
  keywords: [transformKeyword()],
  code: {
    source: true,
    //esm: true
  },
});
ajvFormats(ajvFrontend, ["date"]);
// ajvFormatsDraft2019(ajvFrontend, [])
ajvErrors(ajvFrontend);
process("frontend", ["$generated", "title", "description"], true, ajvFrontend);

// Backend
const ajvBackend = new Ajv({
  strict: false,
  coerceTypes: true,
  allErrors: true,
  useDefaults: "empty",
  loopEnum: 1500,
  keywords: [transformKeyword()],
  code: {
    source: true,
    //esm: true
  },
});
ajvFormats(ajvBackend, ["date"]);
// ajvFormatsDraft2019(ajvBackend, [])
process(
  "backend",
  ["$generated", "errorMessage", "title", "description"],
  true,
  ajvBackend
);

// Quality Control
const ajvQualityControl = new Ajv({
  strict: false,
  coerceTypes: false, // will already be coerced types
  allErrors: true,
  useDefaults: "empty",
  keywords: [transformKeyword()],
  code: {
    source: true,
    //esm: true
  },
});
ajvFormats(ajvQualityControl, ["date"]);
// ajvFormatsDraft2019(ajvQualityControl, [])
ajvErrors(ajvQualityControl);
process("quality-control", ["$generated"], true, ajvQualityControl);
