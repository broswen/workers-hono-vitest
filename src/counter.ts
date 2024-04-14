import { Env } from './env';
import { Hono } from 'hono';

export class Counter implements DurableObject {
	count: number = 0;
	state: DurableObjectState
	app: Hono<{Bindings: Env}>
	constructor(state: DurableObjectState) {
		this.state = state;
		state.blockConcurrencyWhile(async () => {
			this.count = await state.storage.get<number>("count") ?? 0;
		})

		this.app = new Hono<{Bindings: Env}>();
		this.app.get("/counters/:key", async (c) => {
			await this.increment();
			return c.json({
				value: this.count
			})
		})
	}

	fetch(request: Request): Response | Promise<Response> {
		return this.app.fetch(request);
	}
	async increment(by: number = 1) {
		this.count += by;
		await this.state.storage.put("count", this.count);
	}
}
