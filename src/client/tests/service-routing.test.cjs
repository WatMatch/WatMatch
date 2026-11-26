const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");
const { runInNewContext } = require("node:vm");
const ts = require("typescript");

function loadService(name, calls) {
    const { outputText } = ts.transpileModule(readFileSync(join(__dirname, `../src/services/${name}.service.ts`), "utf8"), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 },
    });
    const context = { exports: {}, require: () => ({
        buildApiUrl: path => path,
        apiFetch: async (url, options = {}) => { calls.push([url, options.method || "GET"]); return { ok: true, json: async () => ({ data: null }) }; },
    }) };
    runInNewContext(outputText, context);
    return context.exports;
}

test("team and invite requests use canonical API paths without a redirect", async () => {
    const calls = [];
    const service = loadService("teams", calls);
    await service.fetchTeams();
    await service.inviteTeammate(42, "synthetic@example.invalid");
    assert.deepEqual(calls, [["/api/v1/teams/", "GET"], ["/api/v1/invites/", "POST"]]);
});

test("student profile reads and updates use the canonical API path", async () => {
    const calls = [];
    const service = loadService("users", calls);
    await service.fetchStudentProfile();
    await service.updateStudentProfile({ headline: "Synthetic test" });
    assert.deepEqual(calls, [["/api/v1/student-profile/", "GET"], ["/api/v1/student-profile/", "POST"]]);
});
