const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");
const { runInNewContext } = require("node:vm");
const ts = require("typescript");

const source = ts.transpileModule(readFileSync(join(__dirname, "../src/hooks/useInterest.ts"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

// Exercise the actual hook and deferred service promises with one mounted account.
// The fixture runs only the mount effect, and lets each assertion read the next render.
function mountHistory(fetchUserInterests, submitInterest, enabled = true) {
    const slots = [];
    let cursor;
    let mountEffect;
    const hooks = {
        useState(initial) {
            const i = cursor++;
            if (!(i in slots)) slots[i] = initial;
            return [slots[i], value => { slots[i] = typeof value === "function" ? value(slots[i]) : value; }];
        },
        useRef(initial) {
            const i = cursor++;
            return slots[i] ??= { current: initial };
        },
        useCallback: callback => callback,
        useMemo: calculate => calculate(),
        useEffect(effect) { mountEffect = effect; },
    };
    const context = {
        exports: {}, Error,
        require(name) {
            if (name === "react") return hooks;
            if (name === "@/services/users.service") return { fetchUserInterests };
            if (name === "@/services/interests.service") return { submitInterest };
            throw new Error("Unexpected import: " + name);
        },
    };
    runInNewContext(source, context);
    const read = () => {
        cursor = 0;
        return context.exports.useInterest({ enabled });
    };
    read();
    const unmount = mountEffect();
    return { read, unmount };
}

const settle = () => new Promise(resolve => setImmediate(resolve));

test("history retry is single-flight, survives repeated failures and preserves independent submission errors", async () => {
    const reads = [];
    const { read } = mountHistory(
        () => new Promise((resolve, reject) => reads.push({ resolve, reject })),
        async () => { throw new Error("Submission failed"); },
    );
    reads[0].reject(new Error());
    await settle();
    assert.equal(read().historyError, "Could not load your interest history.");
    await read().submitInterest("8", "test note");
    assert.equal(read().error, "Submission failed");

    const retry = read().retryHistory();
    await read().retryHistory();
    assert.equal(reads.length, 2);
    assert.equal(read().isLoading, true);
    reads[1].reject(new Error());
    await retry;
    assert.ok(read().historyError);
    assert.equal(read().isLoading, false);

    const next = read().retryHistory();
    reads[2].resolve({ data: [{ capstone_id: 7, message: "Prior note" }] });
    await next;
    assert.equal(read().historyError, null);
    assert.deepEqual([...read().interestedProjects], ["7"]);
    assert.equal(read().interestMessages["7"], "Prior note");
    assert.equal(read().error, "Submission failed");
});

test("a late history snapshot preserves a newer submission", async () => {
    let finish;
    const { read } = mountHistory(
        () => new Promise(resolve => { finish = resolve; }),
        async () => {},
    );
    await read().submitInterest("3", "New note");
    finish({ data: [{ capstone_id: 3, message: "Old note" }, { capstone_id: 4 }] });
    await settle();
    assert.equal(read().interestMessages["3"], "New note");
    assert.deepEqual([...read().interestedProjects], ["3", "4"]);
});

test("a read that finishes after unmount is ignored; a disabled account never reads", async () => {
    let finish;
    const previous = mountHistory(() => new Promise(resolve => { finish = resolve; }));
    previous.unmount();
    finish({ data: [{ capstone_id: 2, message: "Old account" }] });
    await settle();
    assert.equal(previous.read().interestedProjects.size, 0);

    const { read } = mountHistory(() => assert.fail("History read while disabled"), undefined, false);
    await read().retryHistory();
    assert.equal(read().historyError, null);
    assert.equal(read().isLoading, false);
});
