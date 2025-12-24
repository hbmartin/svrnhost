import { describe, expect, it, vi } from "vitest";
import {
	ChatSDKError,
	type ErrorCode,
	getMessageByErrorCode,
	type Surface,
	visibilityBySurface,
} from "@/lib/errors";

describe("lib/errors", () => {
	describe("visibilityBySurface", () => {
		it("has database surface set to log", () => {
			expect(visibilityBySurface.database).toBe("log");
		});

		it("has other surfaces set to response", () => {
			const responseSurfaces: Surface[] = [
				"chat",
				"auth",
				"stream",
				"api",
				"history",
				"vote",
				"document",
				"suggestions",
				"activate_gateway",
			];

			for (const surface of responseSurfaces) {
				expect(visibilityBySurface[surface]).toBe("response");
			}
		});
	});

	describe("ChatSDKError", () => {
		it("parses error code correctly", () => {
			const error = new ChatSDKError("bad_request:api");

			expect(error.type).toBe("bad_request");
			expect(error.surface).toBe("api");
			expect(error.statusCode).toBe(400);
		});

		it("sets cause when provided", () => {
			const error = new ChatSDKError("unauthorized:auth", "Missing token");

			expect(error.cause).toBe("Missing token");
		});

		it("sets appropriate message", () => {
			const error = new ChatSDKError("rate_limit:chat");

			expect(error.message).toContain("exceeded your maximum number");
		});

		describe("toResponse", () => {
			it("returns JSON response with code and message for response visibility", () => {
				const error = new ChatSDKError("bad_request:api", "Invalid input");
				const response = error.toResponse();

				expect(response).toBeInstanceOf(Response);
				expect(response.status).toBe(400);
			});

			it("logs error and returns generic message for log visibility", () => {
				const consoleSpy = vi
					.spyOn(console, "error")
					.mockImplementation(() => {});
				const error = new ChatSDKError("bad_request:database", "Query failed");
				const response = error.toResponse();

				expect(consoleSpy).toHaveBeenCalled();
				expect(response.status).toBe(400);

				consoleSpy.mockRestore();
			});
		});
	});

	describe("getMessageByErrorCode", () => {
		it("returns database error message for database codes", () => {
			const message = getMessageByErrorCode("bad_request:database");
			expect(message).toContain("database query");
		});

		it("returns specific message for bad_request:api", () => {
			const message = getMessageByErrorCode("bad_request:api");
			expect(message).toContain("couldn't be processed");
		});

		it("returns specific message for bad_request:activate_gateway", () => {
			const message = getMessageByErrorCode("bad_request:activate_gateway");
			expect(message).toContain("credit card");
		});

		it("returns specific message for unauthorized:auth", () => {
			const message = getMessageByErrorCode("unauthorized:auth");
			expect(message).toContain("sign in");
		});

		it("returns specific message for forbidden:auth", () => {
			const message = getMessageByErrorCode("forbidden:auth");
			expect(message).toContain("does not have access");
		});

		it("returns specific message for rate_limit:chat", () => {
			const message = getMessageByErrorCode("rate_limit:chat");
			expect(message).toContain("exceeded your maximum");
		});

		it("returns specific message for not_found:chat", () => {
			const message = getMessageByErrorCode("not_found:chat");
			expect(message).toContain("was not found");
		});

		it("returns specific message for forbidden:chat", () => {
			const message = getMessageByErrorCode("forbidden:chat");
			expect(message).toContain("belongs to another user");
		});

		it("returns specific message for unauthorized:chat", () => {
			const message = getMessageByErrorCode("unauthorized:chat");
			expect(message).toContain("sign in to view");
		});

		it("returns specific message for offline:chat", () => {
			const message = getMessageByErrorCode("offline:chat");
			expect(message).toContain("internet connection");
		});

		it("returns specific message for not_found:document", () => {
			const message = getMessageByErrorCode("not_found:document");
			expect(message).toContain("document was not found");
		});

		it("returns specific message for forbidden:document", () => {
			const message = getMessageByErrorCode("forbidden:document");
			expect(message).toContain("document belongs to another user");
		});

		it("returns specific message for unauthorized:document", () => {
			const message = getMessageByErrorCode("unauthorized:document");
			expect(message).toContain("sign in to view this document");
		});

		it("returns specific message for bad_request:document", () => {
			const message = getMessageByErrorCode("bad_request:document");
			expect(message).toContain("create or update the document");
		});

		it("returns default message for unknown error codes", () => {
			const message = getMessageByErrorCode("unknown:unknown" as ErrorCode);
			expect(message).toContain("Something went wrong");
		});
	});

	describe("status codes", () => {
		const statusCodeTests: Array<{ code: ErrorCode; expected: number }> = [
			{ code: "bad_request:api", expected: 400 },
			{ code: "unauthorized:auth", expected: 401 },
			{ code: "forbidden:chat", expected: 403 },
			{ code: "not_found:document", expected: 404 },
			{ code: "rate_limit:chat", expected: 429 },
			{ code: "offline:chat", expected: 503 },
		];

		for (const { code, expected } of statusCodeTests) {
			it(`returns ${expected} for ${code}`, () => {
				const error = new ChatSDKError(code);
				expect(error.statusCode).toBe(expected);
			});
		}
	});
});
