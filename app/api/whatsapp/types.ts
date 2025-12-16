import { z } from "zod";

export const sourceLabel = "twilio:whatsapp";

/**
 * Twilio WhatsApp incoming message schema.
 *
 * Uses passthrough() to preserve dynamic media fields (MediaUrl0, MediaContentType0, etc.)
 * that Twilio appends based on NumMedia count. These are accessed in utils.ts extractAttachments().
 */
export const incomingMessageSchema = z
	.object({
		MessageSid: z.string(),
		From: z.string(),
		To: z.string(),
		Body: z.string().optional().default(""),
		ProfileName: z.string().optional(),
		WaId: z.string().optional(),
		NumMedia: z.coerce.number().optional().default(0),
		ConversationSid: z.string().optional(),
		// Media fields are dynamically named (MediaUrl0, MediaContentType0, etc.)
		// and preserved via passthrough() below
	})
	.passthrough();

export const whatsappResponseSchema = z.object({
	message: z.string(),
	buttons: z
		.array(
			z.object({
				id: z.string().optional(),
				label: z.string(),
				url: z.string().url().optional(),
			}),
		)
		.optional(),
	mediaUrl: z.string().url().optional(),
	location: z
		.object({
			name: z.string(),
			latitude: z.number(),
			longitude: z.number(),
			label: z.string().optional(),
		})
		.optional(),
});

export type IncomingMessage = z.infer<typeof incomingMessageSchema>;
export type WhatsAppAIResponse = z.infer<typeof whatsappResponseSchema>;
