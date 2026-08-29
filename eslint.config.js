import pluginJs from "@eslint/js";
import json from "@eslint/json";

/** @type {import('eslint').Linter.Config[]} */
export default [
  { ...pluginJs.configs.recommended, files: ["**/*.js"] },
  {
    plugins: {
      json,
    },
  },
  {
    files: ["**/*.json"],
    language: "json/json",
    rules: {
      "json/no-duplicate-keys": "error",
    },
  },
];
