import { describe, expect, it } from "vitest";
import type { IncomingMessage } from "@/app/api/whatsapp/types";
import {
	buildSystemPrompt,
	extractAttachments,
	formatWhatsAppNumber,
	getAttemptsFromError,
	normalizeWhatsAppNumber,
} from "@/app/api/whatsapp/utils";

describe("getAttemptsFromError", () => {
	it("returns undefined for null", () => {
		expect(getAttemptsFromError(null)).toBeUndefined();
	});

	it("returns undefined for undefined", () => {
		expect(getAttemptsFromError(undefined)).toBeUndefined();
	});

	it("returns undefined for primitive values", () => {
		expect(getAttemptsFromError("error")).toBeUndefined();
		expect(getAttemptsFromError(123)).toBeUndefined();
		expect(getAttemptsFromError(true)).toBeUndefined();
	});

	it("returns undefined for object without attempts", () => {
		expect(getAttemptsFromError({ message: "error" })).toBeUndefined();
	});

	it("returns undefined for non-numeric attempts", () => {
		expect(getAttemptsFromError({ attempts: "3" })).toBeUndefined();
		expect(getAttemptsFromError({ attempts: null })).toBeUndefined();
		expect(getAttemptsFromError({ attempts: undefined })).toBeUndefined();
	});

	it("returns undefined for non-finite attempts", () => {
		expect(
			getAttemptsFromError({ attempts: Number.POSITIVE_INFINITY }),
		).toBeUndefined();
		expect(
			getAttemptsFromError({ attempts: Number.NEGATIVE_INFINITY }),
		).toBeUndefined();
		expect(getAttemptsFromError({ attempts: Number.NaN })).toBeUndefined();
	});

	it("returns attempts for valid numeric value", () => {
		expect(getAttemptsFromError({ attempts: 3 })).toBe(3);
		expect(getAttemptsFromError({ attempts: 0 })).toBe(0);
		expect(getAttemptsFromError({ attempts: 1 })).toBe(1);
	});

	it("returns attempts from Error-like objects", () => {
		const error = new Error("test");
		(error as unknown as { attempts: number }).attempts = 5;
		expect(getAttemptsFromError(error)).toBe(5);
	});
});

describe("normalizeWhatsAppNumber", () => {
	describe("valid numbers", () => {
		it("returns number without whatsapp: prefix", () => {
			expect(normalizeWhatsAppNumber("+14155551234")).toBe("+14155551234");
		});

		it("strips whatsapp: prefix (lowercase)", () => {
			expect(normalizeWhatsAppNumber("whatsapp:+14155551234")).toBe(
				"+14155551234",
			);
		});

		it("strips whatsapp: prefix (uppercase)", () => {
			expect(normalizeWhatsAppNumber("WHATSAPP:+14155551234")).toBe(
				"+14155551234",
			);
		});

		it("strips whatsapp: prefix (mixed case)", () => {
			expect(normalizeWhatsAppNumber("WhatsApp:+14155551234")).toBe(
				"+14155551234",
			);
		});

		it("handles leading/trailing whitespace", () => {
			expect(normalizeWhatsAppNumber("  +14155551234  ")).toBe("+14155551234");
			expect(normalizeWhatsAppNumber("  whatsapp:+14155551234  ")).toBe(
				"+14155551234",
			);
		});

		it("accepts various E.164 formats", () => {
			expect(normalizeWhatsAppNumber("+1234567890")).toBe("+1234567890");
			expect(normalizeWhatsAppNumber("+447911123456")).toBe("+447911123456");
			expect(normalizeWhatsAppNumber("+861381234567")).toBe("+861381234567");
		});
	});

	describe("invalid numbers", () => {
		it("throws TypeError for empty string", () => {
			expect(() => normalizeWhatsAppNumber("")).toThrow(TypeError);
			expect(() => normalizeWhatsAppNumber("")).toThrow("empty or whitespace");
		});

		it("throws TypeError for whitespace only", () => {
			expect(() => normalizeWhatsAppNumber("   ")).toThrow(TypeError);
			expect(() => normalizeWhatsAppNumber("\t\n")).toThrow(TypeError);
		});

		it("throws Error for missing plus sign", () => {
			expect(() => normalizeWhatsAppNumber("14155551234")).toThrow(
				"not in E.164 format",
			);
		});

		it("throws Error for number starting with +0", () => {
			expect(() => normalizeWhatsAppNumber("+04155551234")).toThrow(
				"not in E.164 format",
			);
		});

		it("throws Error for too short number", () => {
			expect(() => normalizeWhatsAppNumber("+1")).toThrow(
				"not in E.164 format",
			);
		});

		it("throws Error for too long number", () => {
			expect(() => normalizeWhatsAppNumber("+1234567890123456")).toThrow(
				"not in E.164 format",
			);
		});

		it("throws Error for non-numeric characters", () => {
			expect(() => normalizeWhatsAppNumber("+1415-555-1234")).toThrow(
				"not in E.164 format",
			);
			expect(() => normalizeWhatsAppNumber("+1 415 555 1234")).toThrow(
				"not in E.164 format",
			);
			expect(() => normalizeWhatsAppNumber("+1(415)5551234")).toThrow(
				"not in E.164 format",
			);
		});

		it("throws Error for invalid format with prefix", () => {
			expect(() => normalizeWhatsAppNumber("whatsapp:invalid")).toThrow(
				"not in E.164 format",
			);
		});
	});
});

describe("formatWhatsAppNumber", () => {
	describe("valid numbers", () => {
		it("adds whatsapp: prefix to E.164 number", () => {
			expect(formatWhatsAppNumber("+14155551234")).toBe(
				"whatsapp:+14155551234",
			);
		});

		it("preserves existing whatsapp: prefix (lowercase)", () => {
			expect(formatWhatsAppNumber("whatsapp:+14155551234")).toBe(
				"whatsapp:+14155551234",
			);
		});

		it("normalizes existing whatsapp: prefix (uppercase to lowercase)", () => {
			expect(formatWhatsAppNumber("WHATSAPP:+14155551234")).toBe(
				"whatsapp:+14155551234",
			);
		});

		it("normalizes existing whatsapp: prefix (mixed case)", () => {
			expect(formatWhatsAppNumber("WhatsApp:+14155551234")).toBe(
				"whatsapp:+14155551234",
			);
		});

		it("handles leading/trailing whitespace", () => {
			expect(formatWhatsAppNumber("  +14155551234  ")).toBe(
				"whatsapp:+14155551234",
			);
			expect(formatWhatsAppNumber("  whatsapp:+14155551234  ")).toBe(
				"whatsapp:+14155551234",
			);
		});

		it("formats various E.164 numbers", () => {
			expect(formatWhatsAppNumber("+1234567890")).toBe("whatsapp:+1234567890");
			expect(formatWhatsAppNumber("+447911123456")).toBe(
				"whatsapp:+447911123456",
			);
			expect(formatWhatsAppNumber("+861381234567")).toBe(
				"whatsapp:+861381234567",
			);
		});
	});

	describe("invalid numbers", () => {
		it("throws TypeError for empty string", () => {
			expect(() => formatWhatsAppNumber("")).toThrow(TypeError);
			expect(() => formatWhatsAppNumber("")).toThrow("empty or whitespace");
		});

		it("throws TypeError for whitespace only", () => {
			expect(() => formatWhatsAppNumber("   ")).toThrow(TypeError);
		});

		it("throws Error for missing plus sign", () => {
			expect(() => formatWhatsAppNumber("14155551234")).toThrow(
				"not in E.164 format",
			);
		});

		it("throws Error for invalid E.164", () => {
			expect(() => formatWhatsAppNumber("+0123456789")).toThrow(
				"not in E.164 format",
			);
			expect(() => formatWhatsAppNumber("+1")).toThrow("not in E.164 format");
		});

		it("throws Error for invalid format with prefix", () => {
			expect(() => formatWhatsAppNumber("whatsapp:invalid")).toThrow(
				"not in E.164 format",
			);
		});
	});
});

describe("extractAttachments", () => {
	const basePayload: IncomingMessage = {
		MessageSid: "SM123",
		From: "whatsapp:+14155551234",
		To: "whatsapp:+14155559999",
		Body: "Hello",
		NumMedia: 0,
	};

	it("returns empty array when NumMedia is 0", () => {
		const result = extractAttachments(basePayload);
		expect(result).toEqual([]);
	});

	it("returns empty array when NumMedia is undefined", () => {
		const payload = { ...basePayload, NumMedia: undefined };
		const result = extractAttachments(payload as IncomingMessage);
		expect(result).toEqual([]);
	});

	it("extracts single media attachment", () => {
		const payload = {
			...basePayload,
			NumMedia: 1,
			MediaUrl0: "https://api.twilio.com/media/123",
			MediaContentType0: "image/jpeg",
		};
		const result = extractAttachments(payload as IncomingMessage);
		expect(result).toEqual([
			{
				name: "media-1",
				url: "https://api.twilio.com/media/123",
				contentType: "image/jpeg",
			},
		]);
	});

	it("extracts multiple media attachments", () => {
		const payload = {
			...basePayload,
			NumMedia: 3,
			MediaUrl0: "https://api.twilio.com/media/1",
			MediaContentType0: "image/jpeg",
			MediaUrl1: "https://api.twilio.com/media/2",
			MediaContentType1: "image/png",
			MediaUrl2: "https://api.twilio.com/media/3",
			MediaContentType2: "video/mp4",
		};
		const result = extractAttachments(payload as IncomingMessage);
		expect(result).toHaveLength(3);
		expect(result[0]).toEqual({
			name: "media-1",
			url: "https://api.twilio.com/media/1",
			contentType: "image/jpeg",
		});
		expect(result[1]).toEqual({
			name: "media-2",
			url: "https://api.twilio.com/media/2",
			contentType: "image/png",
		});
		expect(result[2]).toEqual({
			name: "media-3",
			url: "https://api.twilio.com/media/3",
			contentType: "video/mp4",
		});
	});

	it("uses default content type when not provided", () => {
		const payload = {
			...basePayload,
			NumMedia: 1,
			MediaUrl0: "https://api.twilio.com/media/123",
		};
		const result = extractAttachments(payload as IncomingMessage);
		expect(result).toEqual([
			{
				name: "media-1",
				url: "https://api.twilio.com/media/123",
				contentType: "application/octet-stream",
			},
		]);
	});

	it("skips attachments with missing URL", () => {
		const payload = {
			...basePayload,
			NumMedia: 2,
			MediaContentType0: "image/jpeg",
			MediaUrl1: "https://api.twilio.com/media/2",
			MediaContentType1: "image/png",
		};
		const result = extractAttachments(payload as IncomingMessage);
		expect(result).toHaveLength(1);
		expect(result[0]).toEqual({
			name: "media-2",
			url: "https://api.twilio.com/media/2",
			contentType: "image/png",
		});
	});

	it("handles various media content types", () => {
		const payload = {
			...basePayload,
			NumMedia: 4,
			MediaUrl0: "https://api.twilio.com/media/1",
			MediaContentType0: "application/pdf",
			MediaUrl1: "https://api.twilio.com/media/2",
			MediaContentType1: "audio/ogg",
			MediaUrl2: "https://api.twilio.com/media/3",
			MediaContentType2: "text/vcard",
			MediaUrl3: "https://api.twilio.com/media/4",
			MediaContentType3: "application/octet-stream",
		};
		const result = extractAttachments(payload as IncomingMessage);
		expect(result).toHaveLength(4);
		expect(result.map((a) => a.contentType)).toEqual([
			"application/pdf",
			"audio/ogg",
			"text/vcard",
			"application/octet-stream",
		]);
	});
});

describe("buildSystemPrompt", () => {
	const basePayload: IncomingMessage = {
		MessageSid: "SM123",
		From: "whatsapp:+14155551234",
		To: "whatsapp:+14155559999",
		Body: "Hello",
		NumMedia: 0,
	};

	it("includes ProfileName when provided", () => {
		const payload = { ...basePayload, ProfileName: "John Doe" };
		const result = buildSystemPrompt(payload);
		expect(result).toContain("Profile Name: John Doe");
	});

	it("uses 'unknown' when ProfileName is not provided", () => {
		const result = buildSystemPrompt(basePayload);
		expect(result).toContain("Profile Name: unknown");
	});

	it("uses 'unknown' when ProfileName is undefined", () => {
		const payload = { ...basePayload, ProfileName: undefined };
		const result = buildSystemPrompt(payload);
		expect(result).toContain("Profile Name: unknown");
	});

	it("includes system prompt content", () => {
		const result = buildSystemPrompt(basePayload);
		// The result should start with the svrnHostSystemPrompt content
		expect(result.length).toBeGreaterThan(20);
	});
});
