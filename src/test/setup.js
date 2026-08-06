import test from "node:test";
import { resolve, dirname } from "node:path";
import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(__dirname, "fixtures");

try {
  const entries = await readdir(fixturesDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".js")) {
      const mod = await import(resolve(fixturesDir, entry.name));
      Object.assign(globalThis, mod);
    }
  }
} catch {
  /* no fixtures */
}

globalThis.test = test;
globalThis.expect = (actual) => ({
  toBe: (expected) => {
    if (actual !== expected) {
      throw new Error(
        `Expected ${JSON.stringify(actual)} toBe ${JSON.stringify(expected)}`,
      );
    }
  },
  toEqual: (expected) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(
        `Expected ${JSON.stringify(actual)} toEqual ${JSON.stringify(expected)}`,
      );
    }
  },
  toBeTruthy: () => {
    if (!actual) {
      throw new Error(`Expected ${JSON.stringify(actual)} to be truthy`);
    }
  },
  toBeFalsy: () => {
    if (actual) {
      throw new Error(`Expected ${JSON.stringify(actual)} to be falsy`);
    }
  },
  toContain: (expected) => {
    if (typeof actual !== "string" || !actual.includes(expected)) {
      throw new Error(
        `Expected ${JSON.stringify(actual)} toContain ${JSON.stringify(expected)}`,
      );
    }
  },
});
