import { Hono } from 'hono';
import { Env } from './env';
export { Counter } from './counter';


const app = new Hono<{Bindings: Env}>();

app.use(async (c, next) => {
	const start = Date.now();
	await next()
	const elapsed = Date.now() - start;
	c.env.ANALYTICS?.writeDataPoint({
		blobs: [c.req.method, c.req.path, c.env.VERSION],
		doubles: [c.res.status, elapsed]
	});
	if (!c.env.ANALYTICS) {
		console.log({
			blobs: [c.req.method, c.req.path, c.env.VERSION],
			doubles: [c.res.status, elapsed]
		});
	}
})

app.get("/", async (c) => c.text("Hello, World!"));

app.get("/version", async (c) => c.json({version: c.env.VERSION}));

app.get("/counters/:key", async (c) => {
	const key = c.req.param("key");
	const id = c.env.DO.idFromName(key);
	const stub = c.env.DO.get(id);
	return stub.fetch(c.req.url);
});

app.get("/kv/:key", async (c) => {
	const key = c.req.param("key");
	const value = await c.env.KV.get(key);
	if (!value) {
		return c.notFound();
	}
	return c.json({
		value
	});
});

app.put("/kv/:key", async (c) => {
	const key = c.req.param("key");
	const value = await c.req.text();
	c.executionCtx.waitUntil(c.env.KV.put(key, value));
	return c.json({
		value
	});
});

export default {
	fetch: app.fetch
};
