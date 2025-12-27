import { describe, expect, it } from "vitest";
import { chunkMessageByNewlines } from "@/app/api/whatsapp/twilio";

describe("chunkMessageByNewlines", () => {
	const MAX_LENGTH = 1600;

	describe("messages under limit", () => {
		it("returns no chunks for empty message", () => {
			const result = chunkMessageByNewlines("", MAX_LENGTH);
			expect(result).toEqual([]);
		});

		it("returns single chunk for message under limit", () => {
			const message = "Hello, this is a short message.";
			const result = chunkMessageByNewlines(message, MAX_LENGTH);
			expect(result).toEqual([message]);
		});

		it("returns single chunk for message exactly at limit", () => {
			const message = "a".repeat(MAX_LENGTH);
			const result = chunkMessageByNewlines(message, MAX_LENGTH);
			expect(result).toEqual([message]);
		});

		it("returns single chunk for multi-line message under limit", () => {
			const message = "Line 1\nLine 2\nLine 3";
			const result = chunkMessageByNewlines(message, MAX_LENGTH);
			expect(result).toEqual([message]);
		});
	});

	describe("message chunking", () => {
		it("splits message on newline boundaries", () => {
			const line1 = "a".repeat(1000);
			const line2 = "b".repeat(1000);
			const message = `${line1}\n${line2}`;

			const result = chunkMessageByNewlines(message, MAX_LENGTH);

			expect(result).toHaveLength(2);
			expect(result[0]).toBe(line1);
			expect(result[1]).toBe(line2);
		});

		it("combines lines that fit together (minimizes message count)", () => {
			// This tests the optimization case: [700, 800, 900] should produce 2 messages
			const line1 = "a".repeat(700);
			const line2 = "b".repeat(800);
			const line3 = "c".repeat(900);
			const message = `${line1}\n${line2}\n${line3}`;

			const result = chunkMessageByNewlines(message, MAX_LENGTH);

			// line1 (700) + \n + line2 (800) = 1501 chars - fits in first chunk
			// line3 (900) goes in second chunk
			expect(result).toHaveLength(2);
			expect(result[0]).toBe(`${line1}\n${line2}`);
			expect(result[0]?.length).toBe(1501);
			expect(result[1]).toBe(line3);
			expect(result[1]?.length).toBe(900);
		});

		it("greedily packs lines to minimize chunks", () => {
			// 5 lines of 400 chars each
			// Line 0: 400
			// Line 0+1: 400 + 1 + 400 = 801
			// Line 0+1+2: 801 + 1 + 400 = 1202
			// Line 0+1+2+3: 1202 + 1 + 400 = 1603 > 1600, doesn't fit
			// So first chunk has 3 lines (1202 chars)
			// Second chunk: line 3 (400) + 1 + line 4 (400) = 801 chars
			const lines = Array.from({ length: 5 }, (_, i) =>
				String.fromCharCode(97 + i).repeat(400),
			);
			const message = lines.join("\n");

			const result = chunkMessageByNewlines(message, MAX_LENGTH);

			expect(result).toHaveLength(2);
			expect(result[0]).toBe(`${lines[0]}\n${lines[1]}\n${lines[2]}`);
			expect(result[0]?.length).toBe(1202);
			expect(result[1]).toBe(`${lines[3]}\n${lines[4]}`);
			expect(result[1]?.length).toBe(801);
		});

		it("handles single line exceeding limit", () => {
			const longLine = "a".repeat(2000);
			const result = chunkMessageByNewlines(longLine, MAX_LENGTH);

			// Single line over limit is kept as one chunk (Twilio handles truncation)
			expect(result).toHaveLength(1);
			expect(result[0]).toBe(longLine);
		});

		it("handles mixed short and long lines", () => {
			const shortLine = "short";
			const longLine = "a".repeat(2000);
			const anotherShort = "also short";
			const message = `${shortLine}\n${longLine}\n${anotherShort}`;

			const result = chunkMessageByNewlines(message, MAX_LENGTH);

			expect(result).toHaveLength(3);
			expect(result[0]).toBe(shortLine);
			expect(result[1]).toBe(longLine);
			expect(result[2]).toBe(anotherShort);
		});

		it("handles message with no newlines exceeding limit", () => {
			const message = "a".repeat(2000);
			const result = chunkMessageByNewlines(message, MAX_LENGTH);

			// No newlines to split on, so it's one chunk
			expect(result).toHaveLength(1);
			expect(result[0]).toBe(message);
		});
	});

	describe("edge cases", () => {
		it("handles consecutive newlines", () => {
			const message = "line1\n\n\nline2";
			const result = chunkMessageByNewlines(message, MAX_LENGTH);

			expect(result).toEqual([message]);
		});

		it("handles message ending with newline", () => {
			const message = "line1\nline2\n";
			const result = chunkMessageByNewlines(message, MAX_LENGTH);

			expect(result).toEqual([message]);
		});

		it("handles message starting with newline", () => {
			const message = "\nline1\nline2";
			const result = chunkMessageByNewlines(message, MAX_LENGTH);

			expect(result).toEqual([message]);
		});

		it("preserves exact content across chunks", () => {
			const line1 = "First line with some content";
			const line2 = "a".repeat(1600);
			const line3 = "Third line here";
			const message = `${line1}\n${line2}\n${line3}`;

			const result = chunkMessageByNewlines(message, MAX_LENGTH);

			// Reconstruct and verify
			const reconstructed = result.join("\n");
			expect(reconstructed).toBe(message);
		});

		it("uses custom max length", () => {
			const message = "abc\ndef\nghi";
			const result = chunkMessageByNewlines(message, 7);

			// "abc\ndef" = 7 chars, "ghi" = 3 chars
			expect(result).toHaveLength(2);
			expect(result[0]).toBe("abc\ndef");
			expect(result[1]).toBe("ghi");
		});
	});
});
