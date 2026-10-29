import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFile } from "node:fs/promises";
import test from "node:test";
import herdrBridge from "../src/index.ts";

const envKeys = ["HERDR_ENV", "HERDR_SOCKET_PATH", "HERDR_PANE_ID"];

function createHarness(t, { mode = "tui", env = {} } = {}) {
  const previous = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries({
    HERDR_ENV: "1",
    HERDR_SOCKET_PATH: "/example/herdr.sock",
    HERDR_PANE_ID: "example:p1",
    ...env,
  })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  const handlers = new Map();
  const bus = new EventEmitter();
  const reports = [];
  bus.on("herdr:blocked", (report) => reports.push(report));
  const api = {
    on(name, handler) {
      const list = handlers.get(name) ?? [];
      list.push(handler);
      handlers.set(name, list);
      return () => list.splice(list.indexOf(handler), 1);
    },
    events: {
      emit: (name, data) => { bus.emit(name, data); },
      on(name, handler) {
        bus.on(name, handler);
        return () => bus.off(name, handler);
      },
    },
  };
  const ctx = { mode, hasUI: mode === "tui" || mode === "rpc" };
  async function fire(type, data = {}) {
    for (const handler of handlers.get(type) ?? []) {
      await handler({ type, ...data }, ctx);
    }
  }
  herdrBridge(api);
  return { api, ctx, fire, handlers, reports };
}

for (const [label, env] of [
  ["outside Herdr", { HERDR_ENV: undefined }],
  ["Herdr disabled", { HERDR_ENV: "0" }],
  ["missing socket", { HERDR_SOCKET_PATH: undefined }],
  ["empty socket", { HERDR_SOCKET_PATH: "" }],
  ["missing pane", { HERDR_PANE_ID: undefined }],
  ["empty pane", { HERDR_PANE_ID: "" }],
]) {
  test(`registers nothing when ${label}`, (t) => {
    const h = createHarness(t, { env });
    assert.equal(h.handlers.size, 0);
    assert.deepEqual(h.reports, []);
  });
}

for (const mode of ["rpc", "json", "print"]) {
  test(`does not report prompts in ${mode} mode`, async (t) => {
    const h = createHarness(t, { mode });
    await h.fire("session_start");
    await h.fire("ui_prompt_start", { kind: "custom" });
    await h.fire("ui_prompt_end", { kind: "custom" });
    await h.fire("session_shutdown");
    assert.deepEqual(h.reports, []);
  });
}

test("ignores prompts before session startup", async (t) => {
  const h = createHarness(t);
  await h.fire("ui_prompt_start", { kind: "custom" });
  await h.fire("ui_prompt_end", { kind: "custom" });
  assert.deepEqual(h.reports, []);
});

for (const kind of ["select", "confirm", "input", "editor", "custom"]) {
  test(`bridges a ${kind} prompt without forwarding its content`, async (t) => {
    const h = createHarness(t);
    await h.fire("session_start");
    await h.fire("ui_prompt_start", { kind, title: "DO_NOT_FORWARD /example/project" });
    await h.fire("ui_prompt_end", { kind });
    assert.deepEqual(h.reports, [
      { active: true, label: "Waiting for your response" },
      { active: false },
    ]);
  });
}

test("balances repeated prompt cycles", async (t) => {
  const h = createHarness(t);
  await h.fire("session_start");
  for (let i = 0; i < 3; i++) {
    await h.fire("ui_prompt_start", { kind: "custom" });
    await h.fire("ui_prompt_end", { kind: "custom" });
  }
  assert.deepEqual(h.reports.map((r) => r.active), [true, false, true, false, true, false]);
});

test("does not double-count duplicate boundaries or send unmatched clears", async (t) => {
  const h = createHarness(t);
  await h.fire("session_start");
  await h.fire("ui_prompt_end");
  await h.fire("ui_prompt_start");
  await h.fire("ui_prompt_start");
  await h.fire("ui_prompt_end");
  await h.fire("ui_prompt_end");
  await h.fire("session_shutdown");
  assert.deepEqual(h.reports.map((r) => r.active), [true, false]);
});

test("shutdown clears an open prompt once and ignores late events", async (t) => {
  const h = createHarness(t);
  await h.fire("session_start");
  await h.fire("ui_prompt_start");
  await h.fire("session_shutdown");
  await h.fire("session_shutdown");
  await h.fire("ui_prompt_start");
  await h.fire("ui_prompt_end");
  assert.deepEqual(h.reports.map((r) => r.active), [true, false]);
});

test("session replacement clears the old block and permits a new one", async (t) => {
  const h = createHarness(t);
  await h.fire("session_start");
  await h.fire("ui_prompt_start");
  await h.fire("session_start");
  await h.fire("ui_prompt_start");
  await h.fire("ui_prompt_end");
  assert.deepEqual(h.reports.map((r) => r.active), [true, false, true, false]);
});

test("clears before a session changes from TUI to RPC", async (t) => {
  const h = createHarness(t);
  await h.fire("session_start");
  await h.fire("ui_prompt_start");
  h.ctx.mode = "rpc";
  await h.fire("session_start");
  await h.fire("ui_prompt_start");
  await h.fire("ui_prompt_end");
  assert.deepEqual(h.reports.map((r) => r.active), [true, false]);
});

test("guards the prompt context mode as well as the session mode", async (t) => {
  const h = createHarness(t);
  await h.fire("session_start");
  h.ctx.mode = "rpc";
  await h.fire("ui_prompt_start");
  assert.deepEqual(h.reports, []);
});

test("does not register lifecycle state reporters, tools or notification commands", (t) => {
  const h = createHarness(t);
  assert.deepEqual([...h.handlers.keys()].sort(), [
    "session_shutdown", "session_start", "ui_prompt_end", "ui_prompt_start",
  ]);
});

test("preserves blockers belonging to another producer", async (t) => {
  const h = createHarness(t);
  let blockers = 0;
  // Contract model of the managed Herdr integration's shared blocker counter.
  h.api.events.on("herdr:blocked", (report) => {
    blockers = report.active ? blockers + 1 : Math.max(0, blockers - 1);
  });
  await h.fire("session_start");
  h.api.events.emit("herdr:blocked", { active: true, label: "Other producer" });
  await h.fire("ui_prompt_start");
  assert.equal(blockers, 2);
  await h.fire("ui_prompt_end");
  assert.equal(blockers, 1);
  await h.fire("ui_prompt_end");
  await h.fire("session_shutdown");
  assert.equal(blockers, 1);
  h.api.events.emit("herdr:blocked", { active: false });
  assert.equal(blockers, 0);
});

test("declares one Pi entry point and a narrow npm file allowlist", async () => {
  const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.deepEqual(manifest.pi, { extensions: ["./src/index.ts"] });
  assert.deepEqual(manifest.files, ["src/index.ts", "README.md", "LICENSE"]);
  assert.deepEqual(manifest.dependencies ?? {}, {});
  assert.deepEqual(manifest.peerDependencies, { "@earendil-works/pi-coding-agent": "*" });
  assert.equal(manifest.scripts.install, undefined);
  assert.equal(manifest.scripts.postinstall, undefined);
});
