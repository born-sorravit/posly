/**
 * Image upload, in two hops, neither of which passes the file through our servers:
 *
 *   1. ask the API (through the `/api/backend` proxy, which attaches the session) for a
 *      signed upload URL scoped to this business;
 *   2. PUT the file straight to the storage bucket with it.
 *
 * The returned `path` is what gets saved on the product or business; the API derives the
 * public URL from it.
 */
import { friendlyMessage } from "@/lib/api/backend";

const PROXY = "/api/backend";

export type UploadPurpose = "product-image" | "business-logo";

const ALLOWED = ["image/jpeg", "image/png", "image/webp"] as const;
type AllowedType = (typeof ALLOWED)[number];

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export const isAllowedImage = (file: File): file is File & { type: AllowedType } =>
	(ALLOWED as readonly string[]).includes(file.type);

export async function uploadImage(
	businessId: string,
	file: File,
	purpose: UploadPurpose
): Promise<{ path: string; publicUrl: string }> {
	if (!isAllowedImage(file)) throw new Error("รองรับเฉพาะ JPG, PNG หรือ WebP");
	if (file.size > MAX_UPLOAD_BYTES) throw new Error("ไฟล์ใหญ่เกิน 5 MB");

	const ticketResponse = await fetch(`${PROXY}/businesses/${businessId}/uploads`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ purpose, contentType: file.type, size: file.size }),
	});
	const ticket = (await ticketResponse.json().catch(() => null)) as {
		data?: { uploadUrl: string; path: string; publicUrl: string };
		message?: string;
	} | null;

	if (!ticketResponse.ok || !ticket?.data) {
		throw new Error(friendlyMessage(ticketResponse.status, ticket?.message));
	}

	const put = await fetch(ticket.data.uploadUrl, {
		method: "PUT",
		headers: { "Content-Type": file.type },
		body: file,
	});
	if (!put.ok) throw new Error("อัปโหลดไม่สำเร็จ");

	return { path: ticket.data.path, publicUrl: ticket.data.publicUrl };
}
