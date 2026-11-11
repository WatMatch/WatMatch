const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");
const { runInNewContext } = require("node:vm");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const ts = require("typescript");

function loadComponent(path, auth) {
    const { outputText } = ts.transpileModule(readFileSync(join(__dirname, "../src", path), "utf8"), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    });
    const context = {
        exports: {},
        require(name) {
            if (name === "react" || name === "react/jsx-runtime") return require(name);
            if (name === "next/navigation") return { useRouter: () => ({ replace() {} }) };
            if (name === "@/contexts/AuthContext") return { useAuth: () => auth };
            if (name === "@/contexts/UserContext") return { userContext: () => ({ user: { role: "admin", user_id: 1 }, setUser() {} }) };
            if (name === "@/lib/api-client") return { apiFetch: () => assert.fail("Rendering must not fetch or trust cached data"), buildApiUrl: path => path };
            if (name === "lucide-react") return { Loader2: () => null };
            if (name === "@/components/ui/button") return { Button: ({ children }) => React.createElement("button", null, children) };
            if (name === "@/components/ui/workspace") return { Notice: ({ title, children }) => React.createElement("section", null, title, children) };
            if (name === "@clerk/nextjs") return { SignIn: () => { throw new Error("Unconfigured Clerk must not mount"); } };
            throw new Error(`Unexpected import: ${name}`);
        },
    };
    runInNewContext(outputText, context);
    return context.exports.default;
}

test("cached account data cannot render a workspace before the current API check", () => {
    const Guard = loadComponent("components/ProtectedRoute.tsx", { isInitialized: true, isLoggedIn: true, sessionId: "synthetic-session", logout: async () => {} });
    const html = renderToStaticMarkup(React.createElement(Guard, null, React.createElement("p", null, "PRIVATE WORKSPACE")));
    assert.match(html, /Checking your access/);
    assert.doesNotMatch(html, /PRIVATE WORKSPACE/);
});

test("a loading or absent Clerk session cannot render protected content", () => {
    for (const isInitialized of [false, true]) {
        const Guard = loadComponent("components/ProtectedRoute.tsx", { isInitialized, isLoggedIn: false, sessionId: null, logout: async () => {} });
        const html = renderToStaticMarkup(React.createElement(Guard, null, "PRIVATE WORKSPACE"));
        assert.doesNotMatch(html, /PRIVATE WORKSPACE/);
    }
});

test("an unconfigured environment shows a clear message without a demo login", () => {
    const Login = loadComponent("app/login/page.tsx", { isConfigured: false, isInitialized: true, isLoggedIn: false });
    const html = renderToStaticMarkup(React.createElement(Login));
    assert.match(html, /Sign-in is not available/);
    assert.doesNotMatch(html, /<form|<input/);
});
