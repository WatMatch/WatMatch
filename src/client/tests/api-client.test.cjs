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

function loadApiClient(apiUrl, overrides = {}) {
    const context = {
        exports: {},
        process: { env: apiUrl === undefined ? {} : { NEXT_PUBLIC_API_URL: apiUrl } },
        URL,
        Headers,
        Response,
        window: { location: { origin: "http://127.0.0.1:8080" } },
        ...overrides,
    };
    runInNewContext(outputText, context);
    return context.exports;
}

test("the verified workspace is a request precondition, not a caller-selected role", async () => {
    const roles = [];
    const api = loadApiClient(undefined, { fetch: async (_, options) => {
        roles.push(options.headers.get("X-WatMatch-Workspace"));
        return new Response("{}");
    } });
    api.registerSessionTokenGetter(async () => "fixture", "session-one");
    api.rememberVerifiedWorkspace("mentor");
    await api.apiFetch("/api/v1/auth/me", { headers: { "X-WatMatch-Workspace": "instructor" } });
    api.registerSessionTokenGetter(async () => "second", "session-two");
    await api.apiFetch("/api/v1/auth/me");
    assert.deepEqual(roles, ["mentor", null]);
});

test("a successful role change invalidates older requests and notifies only this session's tabs", async () => {
    const events = [], navigations = [];
    let finishOld;
    const api = loadApiClient(undefined, {
        window: { location: { origin: "http://127.0.0.1:8080", replace: url => navigations.push(url) } },
        localStorage: { setItem: key => events.push(key), removeItem() {} },
        fetch: async (url, options) => {
            if (url.endsWith("/switch-role")) {
                assert.equal(options.method, "POST");
                return Response.json({ data: { active_role: "mentor" } });
            }
            return new Promise(resolve => { finishOld = resolve; });
        },
    });
    api.registerSessionTokenGetter(async () => "fixture", "session-one");
    const old = api.apiFetch("/api/v1/old-workspace");
    await api.switchActiveRole("mentor");
    finishOld(new Response("{}"));
    await assert.rejects(old, /workspace changed/);
    assert.deepEqual(events, ["watmatch.workspace.session-one"]);
    assert.deepEqual(navigations, ["/dashboard"]);
});

test("cross-tab changes reload only the matching session and the listener is cleaned up", () => {
    let listener, reloaded = 0;
    const api = loadApiClient(undefined, { window: {
        location: { replace: () => { reloaded++; } },
        addEventListener: (_, handler) => { listener = handler; },
        removeEventListener: (_, handler) => { assert.equal(handler, listener); listener = undefined; },
    } });
    const unsubscribe = api.listenForWorkspaceChanges("session-one");
    listener({ key: "watmatch.workspace.session-two", newValue: "changed" });
    listener({ key: "watmatch.workspace.session-one", newValue: null });
    assert.equal(reloaded, 0);
    listener({ key: "watmatch.workspace.session-one", newValue: "changed" });
    assert.equal(reloaded, 1);
    unsubscribe();
    assert.equal(listener, undefined);
});

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

test("relative catalog keys can be parsed without a browser", () => {
    const { parseApiUrl } = loadApiClient();
    const key = parseApiUrl("/api/v1/capstones/past?page=2&saved_only=true");
    assert.equal(key.pathname, "/api/v1/capstones/past");
    assert.equal(key.searchParams.get("page"), "2");
});

test("requests wait for a registered session provider", async () => {
    const api = loadApiClient(undefined, { fetch: () => assert.fail("Must not fetch before Clerk is ready") });
    await assert.rejects(api.apiFetch("/api/v1/auth/me"), /Sign-in is not ready/);
});

test("each API request gets its current token from Clerk", async () => {
    const calls = [];
    const api = loadApiClient(undefined, { fetch: async (url, options) => {
        calls.push({ url, options });
        return new Response("{}", { status: 200 });
    }});
    let issued = 0;
    api.registerSessionTokenGetter(async () => `token-${++issued}`);
    await api.apiFetch("/api/v1/auth/me", { headers: { Authorization: "Bearer stale", "X-Example": "present" } });
    await api.apiFetch("/api/v1/courses/");
    assert.equal(calls[0].options.headers.get("Authorization"), "Bearer token-1");
    assert.equal(calls[1].options.headers.get("Authorization"), "Bearer token-2");
    assert.equal(calls[0].options.headers.get("X-Example"), "present");
    assert.equal(calls[0].options.redirect, "error");
    assert.equal(calls[0].options.credentials, "omit");
});

test("tokens are never requested or sent outside the configured API origin and path", async () => {
    const api = loadApiClient(undefined, { fetch: () => assert.fail("Untrusted URL must not be fetched") });
    api.registerSessionTokenGetter(() => assert.fail("Untrusted URL must not request a token"));
    for (const url of ["https://evil.example/api/v1/users", "//evil.example/api/v1/users", "/other-service", "/api/v10/users", "/api/v1/../private", "http://user:password@127.0.0.1:8080/api/v1/users"]) {
        await assert.rejects(api.apiFetch(url), /outside the configured WatMatch API/);
    }
});

test("an explicit backend origin is allowed but the page origin is not substituted", async () => {
    let count = 0;
    const api = loadApiClient("http://127.0.0.1:8000/api/v1", { fetch: async () => { count++; return new Response("{}"); } });
    api.registerSessionTokenGetter(async () => "synthetic-token");
    await api.apiFetch(api.buildApiUrl("courses/"));
    await assert.rejects(api.apiFetch("/api/v1/courses/"), /outside the configured WatMatch API/);
    assert.equal(count, 1);
});

test("sign-out or account change cancels an in-flight token lookup", async () => {
    const api = loadApiClient(undefined, { fetch: () => assert.fail("Old session must not make a request") });
    let complete;
    const unregister = api.registerSessionTokenGetter(() => new Promise(resolve => { complete = resolve; }));
    const pending = api.apiFetch("/api/v1/auth/me");
    unregister();
    complete("old-session-token");
    await assert.rejects(pending, /session changed/);
});

test("cleanup from a previous provider cannot remove the current provider", async () => {
    let token;
    const api = loadApiClient(undefined, { fetch: async (_url, options) => { token = options.headers.get("Authorization"); return new Response("{}"); } });
    const oldCleanup = api.registerSessionTokenGetter(async () => "old");
    api.registerSessionTokenGetter(async () => "current");
    oldCleanup();
    await api.apiFetch("/api/v1/auth/me");
    assert.equal(token, "Bearer current");
});

test("401 responses never replay a request or use the legacy refresh endpoint", async () => {
    for (const method of ["GET", "POST", "PATCH", "DELETE"]) {
        let count = 0;
        const api = loadApiClient(undefined, { fetch: async () => { count++; return new Response("{}", { status: 401 }); } });
        api.registerSessionTokenGetter(async () => "expired-synthetic-token");
        assert.equal((await api.apiFetch("/api/v1/teams", { method })).status, 401);
        assert.equal(count, 1);
    }
});

test("an absent Clerk session does not reuse caller or legacy credentials", async () => {
    let headers;
    const api = loadApiClient(undefined, { fetch: async (_url, options) => { headers = options.headers; return new Response("{}", { status: 401 }); } });
    api.registerSessionTokenGetter(async () => null);
    await api.apiFetch("/api/v1/auth/me", { headers: { authorization: "Bearer stale-local-token" } });
    assert.equal(headers.get("Authorization"), null);
});
