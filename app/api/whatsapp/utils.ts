import { svrnHostSystemPrompt } from "@/lib/ai/prompts";
import type { Attachment } from "@/lib/types";
import type { IncomingMessage } from "./types";

const WHATSAPP_PREFIX = "whatsapp:";
const E164_REGEX = /^\+[1-9]\d{1,14}$/;

function hasWhatsAppPrefix(value: string) {
	return value.toLowerCase().startsWith(WHATSAPP_PREFIX);
}

export interface ErrorWithAttempts {
	attempts?: number;
}

function isErrorWithAttempts(error: unknown): error is ErrorWithAttempts {
	return !!error && typeof error === "object" && "attempts" in error;
}

export function getAttemptsFromError(error: unknown): number | undefined {
	if (!isErrorWithAttempts(error)) {
		return undefined;
	}

	const { attempts } = error;

	return typeof attempts === "number" && Number.isFinite(attempts)
		? attempts
		: undefined;
}

export function normalizeWhatsAppNumber(value: string) {
	const trimmedValue = value.trim();

	if (trimmedValue.length === 0) {
		throw new TypeError(
			`Invalid WhatsApp number: "${value}" is empty or whitespace.`,
		);
	}

	const normalizedValue = hasWhatsAppPrefix(trimmedValue)
		? trimmedValue.slice(WHATSAPP_PREFIX.length)
		: trimmedValue;

	if (!E164_REGEX.test(normalizedValue)) {
		throw new Error(
			`Invalid WhatsApp number: "${normalizedValue}" is not in E.164 format.`,
		);
	}

	return normalizedValue;
}

export function formatWhatsAppNumber(value: string) {
	const trimmedValue = value.trim();

	if (trimmedValue.length === 0) {
		throw new TypeError(
			`Invalid WhatsApp number: "${value}" is empty or whitespace.`,
		);
	}

	const numberPart = hasWhatsAppPrefix(trimmedValue)
		? trimmedValue.slice(WHATSAPP_PREFIX.length)
		: trimmedValue;

	if (!E164_REGEX.test(numberPart)) {
		throw new Error(
			`Invalid WhatsApp number: "${numberPart}" is not in E.164 format.`,
		);
	}

	return `${WHATSAPP_PREFIX}${numberPart}`;
}

export function extractAttachments(payload: IncomingMessage): Attachment[] {
	const attachmentCount = payload.NumMedia ?? 0;
	const attachments: Attachment[] = [];

	for (let index = 0; index < attachmentCount; index += 1) {
		const mediaUrl = payload[
			`MediaUrl${index}` as keyof typeof payload
		] as unknown as string | undefined;
		const contentType = payload[
			`MediaContentType${index}` as keyof typeof payload
		] as unknown as string | undefined;

		if (mediaUrl) {
			attachments.push({
				name: `media-${index + 1}`,
				url: mediaUrl,
				contentType: contentType ?? "application/octet-stream",
			});
		}
	}

	return attachments;
}

export function buildSystemPrompt(payload: IncomingMessage) {
	return `${svrnHostSystemPrompt}

You are chatting with a WhatsApp user. Keep replies concise, single-message friendly, and formatted for WhatsApp. Always return a JSON object that matches the provided schema with a "message" string and optional buttons (short quick replies), optional mediaUrl, and optional location data. Do not include Markdown fences or additional prose.

Buttons must include both "id" and "label" fields. Include a "url" field only when linking externally, otherwise omit it. Generate stable, deterministic IDs that are unique within a response (e.g., "option-1", "option-2").

Profile Name: ${payload.ProfileName ?? "unknown"}`;
}
