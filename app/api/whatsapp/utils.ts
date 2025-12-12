import { svrnHostSystemPrompt } from "@/lib/ai/prompts";
import type { Attachment } from "@/lib/types";
import type { IncomingMessage } from "./types";

export function normalizeWhatsAppNumber(value: string) {
	if (value.startsWith("whatsapp:")) {
		return value;
	}
	return `whatsapp:${value}`;
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

Caller:
- Profile: ${payload.ProfileName ?? "unknown"}
- Phone: ${payload.From}`;
}
