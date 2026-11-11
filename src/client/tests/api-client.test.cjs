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

function loadApiClient(apiUrl, browser = {}) {
    const context = {
        exports: {},
        process: { env: apiUrl === undefined ? {} : { NEXT_PUBLIC_API_URL: apiUrl } },
        URL,
        ...browser,
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

function sessionClient(fetch) {
    const values = new Map([["accessToken", "old-access"], ["refreshToken", "old-refresh"], ["userData", "{}"]]);
    const localStorage = {
        getItem: key => values.get(key) ?? null,
        removeItem: key => values.delete(key),
        setItem: (key, value) => values.set(key, value),
    };
    const client = loadApiClient(undefined, { fetch, localStorage, AbortSignal, window: { location: {} } });
    return { values, client };
}

test("logout posts the current token once before clearing the session", async () => {
    let count = 0;
    let finish;
    const { client, values } = sessionClient(async (url, options) => {
        assert.equal(url, "/api/v1/auth/logout");
        assert.equal(options.method, "POST");
        assert.equal(JSON.parse(options.body).refresh_token, values.get("refreshToken"));
        count++;
        await new Promise(resolve => { finish = resolve; });
        return Response.json({ success: true });
    });
    const one = client.revokeBrowserSession();
    const two = client.revokeBrowserSession();
    finish();
    assert.equal(await one, true);
    assert.equal(await two, true);
    assert.equal(values.size, 0);
    assert.equal(await client.revokeBrowserSession(), true);
    assert.equal(count, 1);
});

test("offline and unsuccessful server logout both report failure and clear the browser", async () => {
    for (const fetch of [async () => { throw new TypeError("Offline"); },
        async () => new Response("", { status: 503 }), async () => Response.json({ success: false })]) {
        const { client, values } = sessionClient(fetch);
        assert.equal(await client.revokeBrowserSession(), false);
        assert.equal(values.size, 0);
    }
});

test("logout waits for a pending refresh and revokes its replacement", async () => {
    let releaseRefresh;
    let refreshing;
    const started = new Promise(resolve => { refreshing = resolve; });
    const sent = [];
    const { client, values } = sessionClient(async (url, options) => {
        if (url === "/api/v1/auth/refresh") {
            refreshing();
            await new Promise(resolve => { releaseRefresh = resolve; });
            return Response.json({ data: { access_token: "new-access", refresh_token: "new-refresh" } });
        }
        if (url === "/api/v1/auth/logout") {
            sent.push(JSON.parse(options.body).refresh_token);
            return Response.json({ success: true });
        }
        return new Response("", { status: 401 });
    });
    const read = client.apiFetch("/api/v1/auth/me");
    await started;
    const logout = client.revokeBrowserSession();
    releaseRefresh();
    assert.equal((await read).status, 401);
    assert.equal(await logout, true);
    assert.deepEqual(sent, ["new-refresh"]);
    assert.equal(values.size, 0);
});

test("Discover reads the department from a relative catalog request", () => {
    const client = loadApiClient();
    const url = client.buildApiUrl("/api/v1/capstones/all", { department: "Software Engineering" });
    assert.equal(client.parseApiUrl(url).searchParams.get("department"), "Software Engineering");
});
