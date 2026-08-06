/* global test, expect */

/**
 * Inlined from common.js for testing (cannot import due to webextension-polyfill)
 */
class InvalidUrlOrTokenError extends Error {
  constructor(message = "You must configure your Miniflux URL and Token") {
    super(message);
    this.name = "InvalidUrlOrTokenError";
  }
}

const validateCredentials = (url, token) => {
  if (!url || !token) {
    throw new InvalidUrlOrTokenError();
  }
};

test("validateCredentials does not throw for valid URL and token", () => {
  let passed = false;
  try {
    validateCredentials("https://example.com", "abc123");
    passed = true;
  } catch {
    // unexpected
  }
  expect(passed).toBe(true);
});

test("validateCredentials throws when URL is empty", () => {
  let threw = false;
  try {
    validateCredentials("", "abc123");
  } catch (e) {
    threw = e instanceof InvalidUrlOrTokenError;
  }
  expect(threw).toBe(true);
});

test("validateCredentials throws when token is empty", () => {
  let threw = false;
  try {
    validateCredentials("https://example.com", "");
  } catch (e) {
    threw = e instanceof InvalidUrlOrTokenError;
  }
  expect(threw).toBe(true);
});

test("validateCredentials throws when both URL and token are empty", () => {
  let threw = false;
  try {
    validateCredentials("", "");
  } catch (e) {
    threw = e instanceof InvalidUrlOrTokenError;
  }
  expect(threw).toBe(true);
});

test("validateCredentials throws when URL is undefined", () => {
  let threw = false;
  try {
    validateCredentials(undefined, "abc123");
  } catch (e) {
    threw = e instanceof InvalidUrlOrTokenError;
  }
  expect(threw).toBe(true);
});

test("validateCredentials throws when token is undefined", () => {
  let threw = false;
  try {
    validateCredentials("https://example.com", undefined);
  } catch (e) {
    threw = e instanceof InvalidUrlOrTokenError;
  }
  expect(threw).toBe(true);
});

test("validateCredentials throws when URL is null", () => {
  let threw = false;
  try {
    validateCredentials(null, "abc123");
  } catch (e) {
    threw = e instanceof InvalidUrlOrTokenError;
  }
  expect(threw).toBe(true);
});

test("validateCredentials throws when token is null", () => {
  let threw = false;
  try {
    validateCredentials("https://example.com", null);
  } catch (e) {
    threw = e instanceof InvalidUrlOrTokenError;
  }
  expect(threw).toBe(true);
});

test("validateCredentials accepts URL with trailing slash", () => {
  let passed = false;
  try {
    validateCredentials("https://example.com/", "token-with-dash");
    passed = true;
  } catch {
    // unexpected
  }
  expect(passed).toBe(true);
});

test("validateCredentials accepts URL with path", () => {
  let passed = false;
  try {
    validateCredentials("https://example.com/subpath", "token");
    passed = true;
  } catch {
    // unexpected
  }
  expect(passed).toBe(true);
});
