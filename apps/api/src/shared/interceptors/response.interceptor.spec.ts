import {
	MessagedResponse,
	ResponseFormatInterceptor,
} from "@/shared/interceptors/response.interceptor";
import { PaginatedResponse } from "@/shared/utils/pagination.util";
import { CallHandler, ExecutionContext } from "@nestjs/common";
import { SSE_METADATA } from "@nestjs/common/constants";
import { lastValueFrom, of } from "rxjs";

/** An execution context for a plain route handler, or for one decorated with `@Sse`. */
const contextFor = (sse = false) => {
	const handler = () => undefined;
	if (sse) Reflect.defineMetadata(SSE_METADATA, true, handler);
	return { getHandler: () => handler } as unknown as ExecutionContext;
};

const run = (payload: unknown, sse = false) => {
	const interceptor = new ResponseFormatInterceptor();
	const handler: CallHandler = { handle: () => of(payload) };
	return lastValueFrom(interceptor.intercept(contextFor(sse), handler));
};

describe("ResponseFormatInterceptor", () => {
	it("envelopes a plain payload", async () => {
		await expect(run({ id: "abc" })).resolves.toEqual({
			status: "success",
			statusCode: 200,
			message: null,
			data: { id: "abc" },
		});
	});

	it("does not let a payload's own `status` overwrite the envelope's", async () => {
		// An order carries status PAID/REFUNDED/CANCELLED. Key-sniffing would surface that as the
		// envelope status and break every client that checks `status === "success"`.
		const result = await run({ id: "abc", status: "OPEN" });

		expect(result.status).toBe("success");
		expect(result.data).toEqual({ id: "abc", status: "OPEN" });
	});

	it("does not let a payload's own `message` or `meta` leak into the envelope", async () => {
		const result = await run({ message: "job description", meta: { total: 99 } });

		expect(result.message).toBeNull();
		expect(result.meta).toBeUndefined();
		expect(result.data).toEqual({ message: "job description", meta: { total: 99 } });
	});

	it("passes pagination through for a PaginatedResponse", async () => {
		const result = await run(new PaginatedResponse([{ id: 1 }], 21, 2, 10));

		expect(result).toEqual({
			status: "success",
			message: null,
			data: [{ id: 1 }],
			meta: { total: 21, page: 2, last_page: 3, limit: 10 },
		});
	});

	it("lets a handler set the message explicitly", async () => {
		const result = await run(new MessagedResponse({ id: "abc" }, "Job saved"));

		expect(result).toMatchObject({
			status: "success",
			message: "Job saved",
			data: { id: "abc" },
		});
	});

	it("passes null and empty arrays through untouched", async () => {
		await expect(run(null)).resolves.toMatchObject({ data: null });
		await expect(run([])).resolves.toMatchObject({ data: [] });
	});

	it("leaves a Server-Sent Events stream unwrapped", async () => {
		const event = { type: "kitchen", data: { topic: "kitchen" } };
		await expect(run(event, true)).resolves.toEqual(event);
	});
});
