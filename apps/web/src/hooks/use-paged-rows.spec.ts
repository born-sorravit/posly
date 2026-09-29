import { pageSlice } from "@/hooks/use-paged-rows";
import { describe, expect, it } from "vitest";

describe("pageSlice", () => {
	it("splits 57 rows into pages of 20", () => {
		expect(pageSlice(57, 1, 20)).toEqual({ page: 1, lastPage: 3, start: 0, end: 20 });
		expect(pageSlice(57, 3, 20)).toEqual({ page: 3, lastPage: 3, start: 40, end: 57 });
	});

	it("clamps to the last page when the list shrinks under it", () => {
		expect(pageSlice(21, 3, 20)).toEqual({ page: 2, lastPage: 2, start: 20, end: 21 });
	});

	it("keeps one empty page for an empty list", () => {
		expect(pageSlice(0, 4, 20)).toEqual({ page: 1, lastPage: 1, start: 0, end: 0 });
	});
});
