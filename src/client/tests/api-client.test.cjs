const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");
const { runInNewContext } = require("node:vm");
const ts = require("typescript");

const source = readFileSync(join(__dirname, "../src/lib/api-client.ts"), "utf8");
const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 },
});

function loadApiClient(apiUrl) {
    const context = {
        exports: {},
        process: { env: apiUrl === undefined ? {} : { NEXT_PUBLIC_API_URL: apiUrl } },
        URL,
    };
    runInNewContext(outputText, context);
    return context.exports;
}

test("default browser requests use the shared public API path", () => {
    const { buildApiUrl } = loadApiClient();
    assert.equal(buildApiUrl("/api/v1/auth/login"), "/api/v1/auth/login");
    assert.equal(buildApiUrl("courses/"), "/api/v1/courses/");
    assert.equal(buildApiUrl("/courses/"), "/api/v1/courses/");
});

test("relative API configuration supports query parameters without browser globals", () => {
    const { buildApiUrl } = loadApiClient("/api/v1/");
    assert.equal(
        buildApiUrl("/api/v1/capstones/all?limit=10", {
            search: "robotics & health", active: false, offset: 0,
            ignored: undefined, alsoIgnored: null,
        }),
        "/api/v1/capstones/all?limit=10&search=robotics+%26+health&active=false&offset=0"
    );
});

test("separate local backend remains configurable", () => {
    const { buildApiUrl } = loadApiClient("http://127.0.0.1:8000/api/v1/");
    assert.equal(buildApiUrl("/api/v1/auth/login"), "http://127.0.0.1:8000/api/v1/auth/login");
    assert.equal(buildApiUrl("courses/"), "http://127.0.0.1:8000/api/v1/courses/");
});

test("explicit absolute URLs retain their host and existing query", () => {
    const { buildApiUrl } = loadApiClient();
    assert.equal(
        buildApiUrl("https://api.example.com/api/v1/courses/?active=true", { limit: 5 }),
        "https://api.example.com/api/v1/courses/?active=true&limit=5"
    );
});
