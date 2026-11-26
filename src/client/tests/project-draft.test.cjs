const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");
const { runInNewContext } = require("node:vm");
const { createFormControl } = require("react-hook-form");
const ts = require("typescript");

const path = join(__dirname, "../src/app/project-form/project-draft.ts");
const { outputText } = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 },
});

function fixture(t) {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const drafts = new Map();
    const window = new EventTarget();
    window.localStorage = {
        setItem: (key, text) => drafts.set(key, JSON.parse(text)),
        removeItem: (key) => drafts.delete(key),
    };
    const context = { exports: {}, window, setTimeout, clearTimeout };
    runInNewContext(outputText, context);
    const form = createFormControl({ defaultValues: { projectTitle: "" } });
    const unsubscribe = form.subscribe({ formState: { values: true }, callback() {} });
    t.after(unsubscribe);
    const reports = [];
    function open(key) {
        return context.exports.watchProjectDraft(form.watch, key, () => {}, (result) => reports.push(result));
    }
    const edit = (title) => form.setValue("projectTitle", title);
    return { drafts, window, form, reports, open, edit };
}

test("leaving within 500 ms writes the latest edit in the existing draft format", (t) => {
    const { open, edit, drafts, reports } = fixture(t);
    const draft = open("student-a/project-1");
    edit("First");
    edit("Final edit");
    draft.dispose();
    const stored = drafts.get("student-a/project-1");
    assert.equal(stored.version, 1);
    assert.equal(stored.values.projectTitle, "Final edit");
    assert.ok(Number.isFinite(Date.parse(stored.savedAt)));
    t.mock.timers.tick(500);
    assert.deepEqual(reports, []); // No UI update after unmount.
});

test("normal edits debounce for 500 ms after the most recent edit", (t) => {
    const { open, edit, drafts, reports } = fixture(t);
    const draft = open("project");
    edit("First");
    t.mock.timers.tick(499);
    edit("Second");
    t.mock.timers.tick(499);
    assert.equal(drafts.size, 0);
    t.mock.timers.tick(1);
    assert.equal(drafts.get("project").values.projectTitle, "Second");
    assert.equal(reports.length, 1);
    draft.dispose();
});

test("a full page navigation flushes once before React unmounts", (t) => {
    const { open, edit, drafts, reports, window } = fixture(t);
    const draft = open("project");
    edit("New title");
    window.dispatchEvent(new Event("pagehide"));
    assert.equal(drafts.get("project").values.projectTitle, "New title");
    draft.dispose();
    t.mock.timers.tick(500);
    assert.equal(reports.length, 1);
});

test("clearing a saved draft discards pending edits until the next edit", (t) => {
    const { open, edit, drafts, form, window } = fixture(t);
    const draft = open("project");
    edit("Saved");
    t.mock.timers.tick(500);
    edit("Pending");
    assert.equal(draft.clear(), true);
    form.reset({ projectTitle: "" });
    window.dispatchEvent(new Event("pagehide"));
    t.mock.timers.tick(500);
    assert.equal(drafts.size, 0);
    edit("Fresh edit");
    draft.dispose();
    assert.equal(drafts.get("project").values.projectTitle, "Fresh edit");
});

test("a late successful submission clears only the original project's draft", (t) => {
    const { open, edit, drafts, form } = fixture(t);
    const original = open("student-a/project-1");
    edit("A");
    original.dispose();
    form.reset({ projectTitle: "" });
    const next = open("student-b/project-2");
    edit("B");
    assert.equal(drafts.get("student-a/project-1").values.projectTitle, "A");
    assert.equal(original.clear(), true);
    next.dispose();
    assert.equal(drafts.size, 1);
    assert.equal(drafts.get("student-b/project-2").values.projectTitle, "B");
});

test("storage errors stay contained and an unsaved edit can be retried on exit", (t) => {
    const { open, edit, drafts, reports, window } = fixture(t);
    const draft = open("project");
    const storage = window.localStorage;
    Object.defineProperty(window, "localStorage", {
        configurable: true, get() { throw new Error("Storage denied"); },
    });
    edit("Retained");
    t.mock.timers.tick(500);
    assert.deepEqual(reports, [null]);
    Object.defineProperty(window, "localStorage", { value: storage });
    draft.dispose();
    assert.equal(drafts.get("project").values.projectTitle, "Retained");
    storage.removeItem = () => { throw new Error("Storage denied"); };
    assert.equal(draft.clear(), false);
});
