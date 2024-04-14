// test/index.spec.ts
import { env, createExecutionContext, waitOnExecutionContext, SELF, runInDurableObject} from "cloudflare:test";
import { describe, it, expect } from "vitest";
import worker, { Counter } from '../src/index';

// For now, you'll need to do something like this to get a correctly-typed
// `Request` to pass to `worker.fetch()`.
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe("Hello World worker", () => {
  it("responds with Hello World! (unit style)", async () => {
    const request = new IncomingRequest("http://example.com/");
    // Create an empty context to pass to `worker.fetch()`.
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    // Wait for all `Promise`s passed to `ctx.waitUntil()` to settle before running test assertions
    await waitOnExecutionContext(ctx);
    expect(await response.text()).toMatchInlineSnapshot(`"Hello, World!"`);
  });

  it("responds with Hello World! (integration style)", async () => {
   const response = await SELF.fetch("https://example.com/");
   expect(await response.text()).toMatchInlineSnapshot(`"Hello, World!"`);
 });
});

describe("KV works in tests", () => {
	it("should return not found for empty KV", async () => {
		const request = new IncomingRequest("http://example.com/kv/test");
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toMatchInlineSnapshot(`404`);
	})
	it("should return set KV", async () => {
		await env.KV.put("test", "testing")
		const request = new IncomingRequest("http://example.com/kv/test");
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toMatchInlineSnapshot(`200`);
		expect(await response.json()).toMatchInlineSnapshot(`
			{
			  "value": "testing",
			}
		`);
	})
	it("should return on previously PUT KV", async () => {
		let request = new IncomingRequest("http://example.com/kv/test", {method: "PUT", body: "testing"});
		let ctx = createExecutionContext();
		await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		request = new IncomingRequest("http://example.com/kv/test", {method: "PUT", body: "testing"});
		ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toMatchInlineSnapshot(`200`);
	})
})

describe("DO counter should work", () => {
	it('should return 1 on new counter', async () => {
		const request = new IncomingRequest("http://example.com/counters/a");
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(await response.json()).toMatchInlineSnapshot(`
			{
			  "value": 1,
			}
		`);
	});

	it('should return 1 on new standalone durable object counter', async () => {
		const request = new IncomingRequest("http://example.com/counters/a");
		const id = env.DO.idFromName("a");
		const stub = env.DO.get(id);
		const response = await stub.fetch(request);
		expect(await response.json()).toMatchInlineSnapshot(`
			{
			  "value": 1,
			}
		`);
	});

	it('should increment 1 to existing counter', async () => {
		const id = env.DO.idFromName("a");
		const stub = env.DO.get(id);
		await runInDurableObject(stub, (instance: Counter) => {
			instance.increment();
		})

		const request = new IncomingRequest("http://example.com/counters/a");
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(await response.json()).toMatchInlineSnapshot(`
			{
			  "value": 2,
			}
		`);
	});
})


describe("version endpoint", () => {
	it('should return the version in json', async () => {
		const response = await SELF.fetch("http://example.com/version");
		expect(await response.json()).toMatchInlineSnapshot(`
			{
			  "version": "${env.VERSION}",
			}
		`);
	});
})
