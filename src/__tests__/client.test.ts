import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Orch8Client, Orch8Error } from "../client.js";

const BASE = "https://engine.test";

function mockFetchJson(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
    json: () => Promise.resolve(body),
  } as unknown as Response);
}

function mockFetch204() {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 204,
    text: () => Promise.resolve(""),
    json: () => Promise.reject(new Error("No body")),
  } as unknown as Response);
}

let client: Orch8Client;
let originalFetch: typeof globalThis.fetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
  client = new Orch8Client({ baseUrl: BASE });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("Orch8Client", () => {
  describe("constructor", () => {
    it("strips trailing slash from baseUrl", async () => {
      const c = new Orch8Client({ baseUrl: "https://host.com/" });
      globalThis.fetch = mockFetchJson(200, { status: "ok" });
      await c.health();
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://host.com/health/ready",
        expect.anything(),
      );
    });
  });

  describe("headers", () => {
    it("sends Content-Type and Accept", async () => {
      globalThis.fetch = mockFetchJson(200, []);
      await client.listSequences();
      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[1].headers["Content-Type"]).toBe("application/json");
      expect(call[1].headers["Accept"]).toBe("application/json");
    });

    it("sends X-Tenant-Id when tenantId is set", async () => {
      const c = new Orch8Client({ baseUrl: BASE, tenantId: "t1" });
      globalThis.fetch = mockFetchJson(200, []);
      await c.listSequences();
      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[1].headers["X-Tenant-Id"]).toBe("t1");
    });

    it("does not send X-Tenant-Id when tenantId is unset", async () => {
      globalThis.fetch = mockFetchJson(200, []);
      await client.listSequences();
      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[1].headers["X-Tenant-Id"]).toBeUndefined();
    });

    it("merges custom headers", async () => {
      const c = new Orch8Client({
        baseUrl: BASE,
        headers: { "X-Custom": "val" },
      });
      globalThis.fetch = mockFetchJson(200, []);
      await c.listSequences();
      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[1].headers["X-Custom"]).toBe("val");
    });
  });

  describe("request methods", () => {
    it("GET uses correct method", async () => {
      globalThis.fetch = mockFetchJson(200, { id: "s1" });
      await client.getSequence("s1");
      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toBe(`${BASE}/sequences/s1`);
      expect(call[1].method).toBe("GET");
      expect(call[1].body).toBeUndefined();
    });

    it("POST sends JSON body", async () => {
      globalThis.fetch = mockFetchJson(200, { id: "i1" });
      await client.createInstance({ sequence_name: "test", namespace: "default" });
      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toBe(`${BASE}/instances`);
      expect(call[1].method).toBe("POST");
      expect(JSON.parse(call[1].body)).toEqual({
        sequence_name: "test",
        namespace: "default",
      });
    });

    it("PATCH sends JSON body", async () => {
      globalThis.fetch = mockFetchJson(200, undefined);
      await client.updateInstanceState("i1", { state: "cancelled" });
      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toBe(`${BASE}/instances/i1/state`);
      expect(call[1].method).toBe("PATCH");
    });

    it("PUT sends JSON body", async () => {
      globalThis.fetch = mockFetchJson(200, { id: "c1" });
      await client.updateCron("c1", { enabled: false });
      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toBe(`${BASE}/cron/c1`);
      expect(call[1].method).toBe("PUT");
    });

    it("DELETE uses correct method", async () => {
      globalThis.fetch = mockFetchJson(200, undefined);
      await client.deleteSequence("s1");
      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toBe(`${BASE}/sequences/s1`);
      expect(call[1].method).toBe("DELETE");
    });

    it("handles 204 (no content)", async () => {
      globalThis.fetch = mockFetch204();
      const result = await client.deprecateSequence("s1");
      expect(result).toBeUndefined();
    });

    it("handles empty string body", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(""),
      } as unknown as Response);
      const result = await client.deprecateSequence("s1");
      expect(result).toBeUndefined();
    });
  });

  describe("error handling", () => {
    it("throws Orch8Error on non-ok response with JSON body", async () => {
      globalThis.fetch = mockFetchJson(404, { error: "not found" });
      await expect(client.getSequence("missing")).rejects.toThrow(Orch8Error);
      try {
        await client.getSequence("missing");
      } catch (e) {
        const err = e as Orch8Error;
        expect(err.status).toBe(404);
        expect(err.body).toEqual({ error: "not found" });
        expect(err.path).toBe("/sequences/missing");
        expect(err.message).toContain("404");
      }
    });

    it("throws Orch8Error with text body when JSON parse fails", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error("parse error")),
        text: () => Promise.resolve("Internal Server Error"),
      } as unknown as Response);
      try {
        await client.health();
      } catch (e) {
        const err = e as Orch8Error;
        expect(err.status).toBe(500);
        expect(err.body).toBe("Internal Server Error");
      }
    });

    it("Orch8Error has correct name", () => {
      const err = new Orch8Error(400, "bad", "/test");
      expect(err.name).toBe("Orch8Error");
      expect(err instanceof Error).toBe(true);
    });
  });

  describe("query parameters", () => {
    it("listSequences appends filter params", async () => {
      globalThis.fetch = mockFetchJson(200, []);
      await client.listSequences({ tenant_id: "t1", namespace: "ns" });
      const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(url).toContain("tenant_id=t1");
      expect(url).toContain("namespace=ns");
    });

    it("listSequences omits params when no filter", async () => {
      globalThis.fetch = mockFetchJson(200, []);
      await client.listSequences();
      const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(url).toBe(`${BASE}/sequences`);
    });

    it("getSequenceByName builds correct URL", async () => {
      globalThis.fetch = mockFetchJson(200, { id: "s1" });
      await client.getSequenceByName("t1", "ns", "my-seq", 3);
      const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(url).toContain("tenant_id=t1");
      expect(url).toContain("namespace=ns");
      expect(url).toContain("name=my-seq");
      expect(url).toContain("version=3");
    });

    it("listCron appends tenant_id when provided", async () => {
      globalThis.fetch = mockFetchJson(200, []);
      await client.listCron("t1");
      const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(url).toContain("tenant_id=t1");
    });

    it("listDLQ builds correct path with filter", async () => {
      globalThis.fetch = mockFetchJson(200, []);
      await client.listDLQ({ state: "failed" });
      const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(url).toBe(`${BASE}/instances/dlq?state=failed`);
    });
  });

  describe("sequences API", () => {
    it("createSequence POSTs to /sequences", async () => {
      globalThis.fetch = mockFetchJson(200, { id: "s1", name: "test" });
      const result = await client.createSequence({ name: "test", blocks: [] });
      expect(result).toEqual({ id: "s1", name: "test" });
    });

    it("listSequenceVersions builds params correctly", async () => {
      globalThis.fetch = mockFetchJson(200, []);
      await client.listSequenceVersions("t1", "ns", "seq");
      const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(url).toContain("/sequences/versions?");
      expect(url).toContain("name=seq");
    });

    it("migrateInstance posts to correct path", async () => {
      globalThis.fetch = mockFetchJson(200, { id: "i1" });
      await client.migrateInstance({ instance_id: "i1", target_version: 2 });
      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toBe(`${BASE}/sequences/migrate-instance`);
      expect(call[1].method).toBe("POST");
    });
  });

  describe("instances API", () => {
    it("batchCreateInstances sends array in wrapper", async () => {
      globalThis.fetch = mockFetchJson(200, { created: 2 });
      await client.batchCreateInstances([{ name: "a" }, { name: "b" }]);
      const body = JSON.parse(
        (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body,
      );
      expect(body.instances).toHaveLength(2);
    });

    it("sendSignal returns signal_id", async () => {
      globalThis.fetch = mockFetchJson(200, { signal_id: "sig1" });
      const result = await client.sendSignal("i1", { signal_type: "cancel" });
      expect(result.signal_id).toBe("sig1");
    });

    it("getOutputs GETs correct path", async () => {
      globalThis.fetch = mockFetchJson(200, []);
      await client.getOutputs("i1");
      const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(url).toBe(`${BASE}/instances/i1/outputs`);
    });

    it("getExecutionTree GETs correct path", async () => {
      globalThis.fetch = mockFetchJson(200, []);
      await client.getExecutionTree("i1");
      const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(url).toBe(`${BASE}/instances/i1/tree`);
    });

    it("retryInstance POSTs to correct path", async () => {
      globalThis.fetch = mockFetchJson(200, { id: "i1", state: "running" });
      await client.retryInstance("i1");
      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toBe(`${BASE}/instances/i1/retry`);
      expect(call[1].method).toBe("POST");
    });

    it("injectBlocks POSTs to correct path", async () => {
      globalThis.fetch = mockFetchJson(200, undefined);
      await client.injectBlocks("i1", { blocks: [{ type: "step" }] });
      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toBe(`${BASE}/instances/i1/inject-blocks`);
    });

    it("bulkUpdateState PATCHes correct path", async () => {
      globalThis.fetch = mockFetchJson(200, { updated: 5 });
      const r = await client.bulkUpdateState({ state: "cancelled", filter: {} });
      expect(r.updated).toBe(5);
      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toBe(`${BASE}/instances/bulk/state`);
      expect(call[1].method).toBe("PATCH");
    });

    it("bulkReschedule PATCHes correct path", async () => {
      globalThis.fetch = mockFetchJson(200, { updated: 3 });
      await client.bulkReschedule({ delay_ms: 5000 });
      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toBe(`${BASE}/instances/bulk/reschedule`);
    });
  });

  describe("checkpoints API", () => {
    it("listCheckpoints GETs correct path", async () => {
      globalThis.fetch = mockFetchJson(200, []);
      await client.listCheckpoints("i1");
      const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(url).toBe(`${BASE}/instances/i1/checkpoints`);
    });

    it("saveCheckpoint POSTs to correct path", async () => {
      globalThis.fetch = mockFetchJson(200, { id: "cp1" });
      await client.saveCheckpoint("i1", { data: "test" });
      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toBe(`${BASE}/instances/i1/checkpoints`);
      expect(call[1].method).toBe("POST");
    });

    it("getLatestCheckpoint GETs correct path", async () => {
      globalThis.fetch = mockFetchJson(200, { id: "cp1" });
      await client.getLatestCheckpoint("i1");
      const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(url).toBe(`${BASE}/instances/i1/checkpoints/latest`);
    });

    it("pruneCheckpoints POSTs to correct path", async () => {
      globalThis.fetch = mockFetch204();
      await client.pruneCheckpoints("i1", { keep: 3 });
      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toBe(`${BASE}/instances/i1/checkpoints/prune`);
      expect(call[1].method).toBe("POST");
    });
  });

  describe("workers API", () => {
    it("pollTasks POSTs correctly", async () => {
      globalThis.fetch = mockFetchJson(200, []);
      await client.pollTasks({ worker_id: "w1", queues: ["default"] });
      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toBe(`${BASE}/workers/tasks/poll`);
      expect(call[1].method).toBe("POST");
    });

    it("completeTask POSTs to correct path", async () => {
      globalThis.fetch = mockFetchJson(200, undefined);
      await client.completeTask("t1", { output: "done" });
      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toBe(`${BASE}/workers/tasks/t1/complete`);
    });

    it("failTask POSTs to correct path", async () => {
      globalThis.fetch = mockFetchJson(200, undefined);
      await client.failTask("t1", { error: "boom" });
      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toBe(`${BASE}/workers/tasks/t1/fail`);
    });

    it("heartbeatTask POSTs to correct path", async () => {
      globalThis.fetch = mockFetchJson(200, undefined);
      await client.heartbeatTask("t1", {});
      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toBe(`${BASE}/workers/tasks/t1/heartbeat`);
    });

    it("getWorkerTaskStats GETs correct path", async () => {
      globalThis.fetch = mockFetchJson(200, { pending: 5 });
      const result = await client.getWorkerTaskStats();
      expect(result).toEqual({ pending: 5 });
    });
  });

  describe("circuit breakers API", () => {
    it("listCircuitBreakers GETs correct path", async () => {
      globalThis.fetch = mockFetchJson(200, []);
      await client.listCircuitBreakers();
      const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(url).toBe(`${BASE}/circuit-breakers`);
    });

    it("resetCircuitBreaker POSTs to correct path", async () => {
      globalThis.fetch = mockFetchJson(200, undefined);
      await client.resetCircuitBreaker("my-handler");
      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toBe(`${BASE}/circuit-breakers/my-handler/reset`);
      expect(call[1].method).toBe("POST");
    });

    it("tenant circuit breaker paths are correct", async () => {
      globalThis.fetch = mockFetchJson(200, []);
      await client.listTenantCircuitBreakers("t1");
      const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(url).toBe(`${BASE}/tenants/t1/circuit-breakers`);
    });

    it("resetTenantCircuitBreaker POSTs to correct path", async () => {
      globalThis.fetch = mockFetchJson(200, undefined);
      await client.resetTenantCircuitBreaker("t1", "handler");
      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toBe(`${BASE}/tenants/t1/circuit-breakers/handler/reset`);
    });
  });

  describe("triggers API", () => {
    it("createTrigger POSTs correctly", async () => {
      globalThis.fetch = mockFetchJson(200, { slug: "trig1" });
      await client.createTrigger({ slug: "trig1" });
      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toBe(`${BASE}/triggers`);
      expect(call[1].method).toBe("POST");
    });

    it("fireTrigger POSTs to correct path", async () => {
      globalThis.fetch = mockFetchJson(200, { instance_id: "i1", trigger: "trig1", sequence_name: "seq" });
      const result = await client.fireTrigger("trig1", { payload: "test" });
      expect(result.instance_id).toBe("i1");
      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toBe(`${BASE}/triggers/trig1/fire`);
    });

    it("deleteTrigger DELETEs correct path", async () => {
      globalThis.fetch = mockFetchJson(200, undefined);
      await client.deleteTrigger("trig1");
      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toBe(`${BASE}/triggers/trig1`);
      expect(call[1].method).toBe("DELETE");
    });
  });

  describe("plugins API", () => {
    it("createPlugin POSTs correctly", async () => {
      globalThis.fetch = mockFetchJson(200, { name: "p1" });
      await client.createPlugin({ name: "p1" });
      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toBe(`${BASE}/plugins`);
    });

    it("updatePlugin PATCHes correctly", async () => {
      globalThis.fetch = mockFetchJson(200, { name: "p1" });
      await client.updatePlugin("p1", { enabled: false });
      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toBe(`${BASE}/plugins/p1`);
      expect(call[1].method).toBe("PATCH");
    });
  });

  describe("sessions API", () => {
    it("getSessionByKey builds correct path", async () => {
      globalThis.fetch = mockFetchJson(200, { id: "s1" });
      await client.getSessionByKey("t1", "my-key");
      const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(url).toBe(`${BASE}/sessions/by-key/t1/my-key`);
    });

    it("updateSessionData PATCHes correct path", async () => {
      globalThis.fetch = mockFetchJson(200, { id: "s1" });
      await client.updateSessionData("s1", { foo: "bar" });
      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toBe(`${BASE}/sessions/s1/data`);
      expect(call[1].method).toBe("PATCH");
    });

    it("listSessionInstances GETs correct path", async () => {
      globalThis.fetch = mockFetchJson(200, []);
      await client.listSessionInstances("s1");
      const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(url).toBe(`${BASE}/sessions/s1/instances`);
    });
  });

  describe("resource pools API", () => {
    it("createPool POSTs correctly", async () => {
      globalThis.fetch = mockFetchJson(200, { id: "p1" });
      await client.createPool({ name: "pool", max_size: 10 });
      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toBe(`${BASE}/pools`);
      expect(call[1].method).toBe("POST");
    });

    it("createPoolResource POSTs to nested path", async () => {
      globalThis.fetch = mockFetchJson(200, { id: "r1" });
      await client.createPoolResource("p1", { key: "r1" });
      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toBe(`${BASE}/pools/p1/resources`);
    });

    it("updatePoolResource PUTs to nested path", async () => {
      globalThis.fetch = mockFetchJson(200, { id: "r1" });
      await client.updatePoolResource("p1", "r1", { state: "locked" });
      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toBe(`${BASE}/pools/p1/resources/r1`);
      expect(call[1].method).toBe("PUT");
    });

    it("deletePoolResource DELETEs nested path", async () => {
      globalThis.fetch = mockFetchJson(200, undefined);
      await client.deletePoolResource("p1", "r1");
      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toBe(`${BASE}/pools/p1/resources/r1`);
      expect(call[1].method).toBe("DELETE");
    });
  });

  describe("credentials API", () => {
    it("updateCredential PATCHes correctly", async () => {
      globalThis.fetch = mockFetchJson(200, { id: "c1" });
      await client.updateCredential("c1", { name: "updated" });
      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toBe(`${BASE}/credentials/c1`);
      expect(call[1].method).toBe("PATCH");
    });
  });

  describe("streamInstance", () => {
    it("yields parsed SSE data events", async () => {
      const chunks = [
        "data: {\"state\":\"running\"}\n\n",
        "data: {\"state\":\"completed\"}\n\ndata: [DONE]\n\n",
      ];
      let chunkIndex = 0;

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        body: {
          getReader: () => ({
            read: () => {
              if (chunkIndex < chunks.length) {
                const encoder = new TextEncoder();
                return Promise.resolve({
                  done: false,
                  value: encoder.encode(chunks[chunkIndex++]),
                });
              }
              return Promise.resolve({ done: true, value: undefined });
            },
            releaseLock: vi.fn(),
          }),
        },
      } as unknown as Response);

      const events: Record<string, unknown>[] = [];
      for await (const event of client.streamInstance("i1")) {
        events.push(event);
      }
      expect(events).toEqual([
        { state: "running" },
        { state: "completed" },
      ]);
    });

    it("throws Orch8Error on non-ok response", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: "not found" }),
        text: () => Promise.resolve("not found"),
      } as unknown as Response);

      await expect(async () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _ of client.streamInstance("bad")) {
          // should not reach
        }
      }).rejects.toThrow(Orch8Error);
    });

    it("uses Accept: text/event-stream header", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        body: {
          getReader: () => ({
            read: () => Promise.resolve({ done: true, value: undefined }),
            releaseLock: vi.fn(),
          }),
        },
      } as unknown as Response);

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of client.streamInstance("i1")) {
        // drain
      }

      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[1].headers["Accept"]).toBe("text/event-stream");
    });

    it("skips non-JSON data lines", async () => {
      const chunks = ["data: not-json\n\ndata: {\"ok\":true}\n\n"];
      let chunkIndex = 0;

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        body: {
          getReader: () => ({
            read: () => {
              if (chunkIndex < chunks.length) {
                const encoder = new TextEncoder();
                return Promise.resolve({
                  done: false,
                  value: encoder.encode(chunks[chunkIndex++]),
                });
              }
              return Promise.resolve({ done: true, value: undefined });
            },
            releaseLock: vi.fn(),
          }),
        },
      } as unknown as Response);

      const events: Record<string, unknown>[] = [];
      for await (const event of client.streamInstance("i1")) {
        events.push(event);
      }
      expect(events).toEqual([{ ok: true }]);
    });

    it("handles null body gracefully", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        body: null,
      } as unknown as Response);

      const events: Record<string, unknown>[] = [];
      for await (const event of client.streamInstance("i1")) {
        events.push(event);
      }
      expect(events).toEqual([]);
    });
  });
});
