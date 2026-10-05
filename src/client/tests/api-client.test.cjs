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

function loadSessionClient(fetchImpl) {
    const values = new Map([
        ['accessToken', 'old-access'], ['refreshToken', 'old-refresh'],
        ['userData', JSON.stringify({ user_id: 4, role: 'instructor' })],
    ]);
    const navigations = [];
    const context = {
        exports: {}, process: { env: {} }, URL, setTimeout,
        fetch: fetchImpl,
        localStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) },
        window: { location: { assign: url => navigations.push(url), replace: url => navigations.push(url), href: '' } },
    };
    runInNewContext(outputText, context);
    return { ...context.exports, values, navigations, context };
}

const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

test('switching stores returned tokens and role, then reloads the dashboard', async () => {
    const client = loadSessionClient(async (url, options) => {
        assert.equal(url, '/api/v1/auth/switch-role');
        assert.equal(JSON.parse(options.body).role, 'mentor');
        assert.equal(options.headers.Authorization, 'Bearer old-access');
        return jsonResponse({ data: { access_token: 'mentor-access', refresh_token: 'mentor-refresh', user: { user_id: 4, role: 'mentor' } } });
    });
    await client.switchActiveRole('mentor');
    assert.equal(client.values.get('accessToken'), 'mentor-access');
    assert.equal(client.values.get('refreshToken'), 'mentor-refresh');
    assert.equal(JSON.parse(client.values.get('userData')).role, 'mentor');
    assert.deepEqual(client.navigations, ['/dashboard']);
});

test('denied switch preserves the current session and allows a retry', async () => {
    const client = loadSessionClient(async () => jsonResponse({ detail: 'Role is not assigned' }, 403));
    await assert.rejects(client.switchActiveRole('mentor'), /Role is not assigned/);
    await assert.rejects(client.switchActiveRole('mentor'), /Role is not assigned/);
    assert.equal(client.values.get('accessToken'), 'old-access');
    assert.equal(JSON.parse(client.values.get('userData')).role, 'instructor');
    assert.deepEqual(client.navigations, []);
});

test('revoked active role clears browser credentials and returns to login', async () => {
    const client = loadSessionClient(async () => jsonResponse({ detail: 'Active role is no longer assigned. Please log in again.' }, 403));
    await client.apiFetch('/api/v1/auth/me');
    assert.equal(client.values.size, 0);
    assert.equal(client.context.window.location.href, '/login');
});

test('token refresh preserves the selected role and retries with the new token', async () => {
    let requestCount = 0;
    const client = loadSessionClient(async (url, options) => {
        if (url.endsWith('/refresh')) return jsonResponse({ data: { access_token: 'fresh-access', refresh_token: 'fresh-refresh', user: { user_id: 4, role: 'mentor' } } });
        if (requestCount++ === 0) return jsonResponse({}, 401);
        assert.equal(options.headers.Authorization, 'Bearer fresh-access');
        return jsonResponse({ success: true });
    });
    client.values.set('userData', JSON.stringify({ user_id: 4, role: 'mentor' }));
    const response = await client.apiFetch('/api/v1/auth/me');
    assert.equal(response.status, 200);
    assert.equal(JSON.parse(client.values.get('userData')).role, 'mentor');
});

test('responses from the previous workspace are discarded during a switch', async () => {
    let resolveOld;
    const client = loadSessionClient(async url => {
        if (url.endsWith('/switch-role')) return jsonResponse({ data: { access_token: 'mentor-access', refresh_token: 'mentor-refresh', user: { user_id: 4, role: 'mentor' } } });
        return new Promise(resolve => { resolveOld = resolve; });
    });
    const oldRequest = client.apiFetch('/api/v1/capstones/review');
    await client.switchActiveRole('mentor');
    resolveOld(jsonResponse({ old: 'instructor data' }));
    await assert.rejects(oldRequest, /workspace changed/);
});

test('a refresh superseded by another tab does not erase the new session', async () => {
    let client;
    client = loadSessionClient(async url => {
        if (url.endsWith('/refresh')) {
            client.values.set('accessToken', 'other-tab-access');
            client.values.set('refreshToken', 'other-tab-refresh');
            return jsonResponse({}, 401);
        }
        return jsonResponse({}, 401);
    });
    await assert.rejects(client.apiFetch('/api/v1/auth/me'), /refresh token/);
    assert.equal(client.values.get('accessToken'), 'other-tab-access');
    assert.deepEqual(client.navigations, ['/dashboard']);
    assert.equal(client.context.window.location.href, '');
});
