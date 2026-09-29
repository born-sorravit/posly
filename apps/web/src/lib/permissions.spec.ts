import { friendlyMessage } from "@/lib/api/backend";
import { permissionForPath, withNeeds, withoutDependents } from "@/lib/permissions";
import { describe, expect, it } from "vitest";

describe("permissionForPath", () => {
	it("checks the most specific route first", () => {
		expect(permissionForPath("/products/new")).toBe("products:write");
		expect(permissionForPath("/products")).toBe("products:read");
		expect(permissionForPath("/products/3f1c2a4e")).toBe("products:read");
	});

	it("covers nested settings pages and leaves open pages open", () => {
		expect(permissionForPath("/settings/payment")).toBe("settings:manage");
		expect(permissionForPath("/employees")).toBe("members:manage");
		expect(permissionForPath("/notifications")).toBeNull();
	});

	it("does not match a longer sibling path", () => {
		expect(permissionForPath("/posters")).toBeNull();
	});
});

describe("friendlyMessage", () => {
	it("translates known API messages and falls back by status", () => {
		expect(friendlyMessage(409, "Croissant is out of stock")).toMatch(/^Croissant สต็อกไม่พอแล้ว/);
		expect(friendlyMessage(403, "Insufficient permissions")).toBe("คุณไม่มีสิทธิ์ทำรายการนี้");
		expect(friendlyMessage(500, "Internal server error")).toBe("ระบบขัดข้องชั่วคราว ลองใหม่อีกครั้ง");
	});
});

describe("permission needs", () => {
	it("adds what a permission needs, transitively", () => {
		expect([...withNeeds(["orders:discount"])].sort()).toEqual(
			["orders:discount", "orders:read-own", "pos:use", "products:read"].sort()
		);
	});

	it("removes what depends on a removed permission", () => {
		const all = withNeeds(["orders:discount", "orders:refund", "reports:read"]);
		expect([...withoutDependents(all, "orders:read-own")].sort()).toEqual(["products:read", "reports:read"]);
	});
});
