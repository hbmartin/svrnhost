"use server";

import { z } from "zod";

import { auth } from "@/app/(auth)/auth";
import {
	cancelScheduledMessage as dbCancelScheduledMessage,
	createScheduledMessage,
	getAllTemplates,
	getScheduledMessages,
	getTemplateByContentSid,
} from "@/lib/db/queries";
import type { MessageTemplate, ScheduledMessage } from "@/lib/db/schema";
import { ADMIN_EMAIL } from "@/lib/constants";
import { createTwilioClient } from "@/app/api/whatsapp/twilio";
import {
	createContent,
	deleteContent,
	submitForWhatsAppApproval,
} from "@/lib/twilio/content-api";
import { syncTemplatesFromTwilio } from "@/lib/templates/sync-service";
import { sendTemplateBulk } from "@/lib/templates/send-service";

// ============================================================================
// Types
// ============================================================================

export type TemplateActionState = {
	status: "idle" | "success" | "failed" | "forbidden" | "invalid_data";
	data?: unknown;
	error?: string;
};

export type TemplateListResult = {
	status: "success" | "failed" | "forbidden";
	templates?: MessageTemplate[];
	error?: string;
};

export type ScheduledListResult = {
	status: "success" | "failed" | "forbidden";
	messages?: ScheduledMessage[];
	error?: string;
};

export type SyncResult = {
	status: "success" | "failed" | "forbidden";
	created?: number;
	updated?: number;
	deleted?: number;
	errors?: Array<{ contentSid: string; error: string }>;
	error?: string;
};

// ============================================================================
// Validation Schemas
// ============================================================================

const createTemplateSchema = z.object({
	friendlyName: z.string().min(1).max(256),
	language: z.string().min(2).max(10),
	// Types is a JSON string that will be parsed
	types: z.string().transform((val, ctx) => {
		try {
			return JSON.parse(val) as Record<string, unknown>;
		} catch {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Invalid JSON for types",
			});
			return z.NEVER;
		}
	}),
	variables: z
		.string()
		.optional()
		.transform((val, ctx) => {
			if (!val) return undefined;
			try {
				return JSON.parse(val) as Record<string, string>;
			} catch {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: "Invalid JSON for variables",
				});
				return z.NEVER;
			}
		}),
});

const submitApprovalSchema = z.object({
	contentSid: z.string().regex(/^HX[0-9a-fA-F]{32}$/),
	name: z.string().regex(/^[a-z0-9_]+$/).min(1).max(256),
	category: z.enum(["UTILITY", "MARKETING", "AUTHENTICATION"]),
});

const sendTemplateSchema = z.object({
	contentSid: z.string().regex(/^HX[0-9a-fA-F]{32}$/),
	// Comma-separated phone numbers
	recipients: z.string().transform((val) =>
		val
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean),
	),
	contentVariables: z
		.string()
		.optional()
		.transform((val, ctx) => {
			if (!val) return undefined;
			try {
				return JSON.parse(val) as Record<string, string>;
			} catch {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: "Invalid JSON for variables",
				});
				return z.NEVER;
			}
		}),
});

const scheduleMessageSchema = z.object({
	contentSid: z.string().regex(/^HX[0-9a-fA-F]{32}$/),
	recipients: z.string().transform((val) =>
		val
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean),
	),
	contentVariables: z
		.string()
		.optional()
		.transform((val, ctx) => {
			if (!val) return undefined;
			try {
				return JSON.parse(val) as Record<string, string>;
			} catch {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: "Invalid JSON for variables",
				});
				return z.NEVER;
			}
		}),
	scheduledAt: z.string().datetime(),
});

// ============================================================================
// Auth Helper
// ============================================================================

async function requireAdmin(): Promise<{ authorized: true } | { authorized: false; error: TemplateActionState }> {
	const session = await auth();
	if (!session || session.user?.email !== ADMIN_EMAIL) {
		return { authorized: false, error: { status: "forbidden" } };
	}
	return { authorized: true };
}

// ============================================================================
// Actions
// ============================================================================

/**
 * List all templates from the database.
 */
export async function listTemplates(): Promise<TemplateListResult> {
	const authResult = await requireAdmin();
	if (!authResult.authorized) {
		return { status: "forbidden" };
	}

	try {
		const templates = await getAllTemplates();
		return { status: "success", templates };
	} catch (error) {
		return {
			status: "failed",
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

/**
 * Sync templates from Twilio Content API to the database.
 */
export async function syncTemplates(): Promise<SyncResult> {
	const authResult = await requireAdmin();
	if (!authResult.authorized) {
		return { status: "forbidden" };
	}

	try {
		const result = await syncTemplatesFromTwilio();
		return {
			status: "success",
			created: result.created,
			updated: result.updated,
			deleted: result.deleted,
			errors: result.errors,
		};
	} catch (error) {
		return {
			status: "failed",
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

/**
 * Create a new template in Twilio Content API.
 */
export async function createTemplate(
	_prevState: TemplateActionState,
	formData: FormData,
): Promise<TemplateActionState> {
	const authResult = await requireAdmin();
	if (!authResult.authorized) {
		return authResult.error;
	}

	try {
		const parsed = createTemplateSchema.parse({
			friendlyName: formData.get("friendlyName"),
			language: formData.get("language"),
			types: formData.get("types"),
			variables: formData.get("variables"),
		});

		const client = createTwilioClient();
		const result = await createContent(client, {
			friendlyName: parsed.friendlyName,
			language: parsed.language,
			types: parsed.types,
			...(parsed.variables ? { variables: parsed.variables } : {}),
		});

		// Sync to get the new template in our database
		await syncTemplatesFromTwilio();

		return {
			status: "success",
			data: { contentSid: result.sid },
		};
	} catch (error) {
		if (error instanceof z.ZodError) {
			return { status: "invalid_data", error: error.message };
		}
		return {
			status: "failed",
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

/**
 * Submit a template for WhatsApp approval.
 */
export async function submitForApproval(
	_prevState: TemplateActionState,
	formData: FormData,
): Promise<TemplateActionState> {
	const authResult = await requireAdmin();
	if (!authResult.authorized) {
		return authResult.error;
	}

	try {
		const parsed = submitApprovalSchema.parse({
			contentSid: formData.get("contentSid"),
			name: formData.get("name"),
			category: formData.get("category"),
		});

		const client = createTwilioClient();
		const result = await submitForWhatsAppApproval(client, parsed);

		// Sync to update the approval status
		await syncTemplatesFromTwilio();

		return {
			status: "success",
			data: result,
		};
	} catch (error) {
		if (error instanceof z.ZodError) {
			return { status: "invalid_data", error: error.message };
		}
		return {
			status: "failed",
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

/**
 * Delete a template from Twilio.
 */
export async function deleteTemplate(
	contentSid: string,
): Promise<TemplateActionState> {
	const authResult = await requireAdmin();
	if (!authResult.authorized) {
		return authResult.error;
	}

	try {
		const client = createTwilioClient();
		await deleteContent(client, contentSid, false);

		// Sync to update the database
		await syncTemplatesFromTwilio();

		return { status: "success" };
	} catch (error) {
		return {
			status: "failed",
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

/**
 * Send a template immediately to one or more recipients.
 */
export async function sendTemplate(
	_prevState: TemplateActionState,
	formData: FormData,
): Promise<TemplateActionState> {
	const authResult = await requireAdmin();
	if (!authResult.authorized) {
		return authResult.error;
	}

	try {
		const parsed = sendTemplateSchema.parse({
			contentSid: formData.get("contentSid"),
			recipients: formData.get("recipients"),
			contentVariables: formData.get("contentVariables"),
		});

		if (parsed.recipients.length === 0) {
			return { status: "invalid_data", error: "No recipients provided" };
		}

		if (parsed.recipients.length > 100) {
			return {
				status: "invalid_data",
				error: "Maximum 100 recipients per immediate send",
			};
		}

		const result = await sendTemplateBulk(
			parsed.contentSid,
			parsed.recipients,
			parsed.contentVariables,
		);

		return {
			status: "success",
			data: {
				sent: result.sent.length,
				failed: result.failed.length,
				details: result,
			},
		};
	} catch (error) {
		if (error instanceof z.ZodError) {
			return { status: "invalid_data", error: error.message };
		}
		return {
			status: "failed",
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

/**
 * Schedule a template message for later.
 */
export async function scheduleMessage(
	_prevState: TemplateActionState,
	formData: FormData,
): Promise<TemplateActionState> {
	const authResult = await requireAdmin();
	if (!authResult.authorized) {
		return authResult.error;
	}

	try {
		const parsed = scheduleMessageSchema.parse({
			contentSid: formData.get("contentSid"),
			recipients: formData.get("recipients"),
			contentVariables: formData.get("contentVariables"),
			scheduledAt: formData.get("scheduledAt"),
		});

		if (parsed.recipients.length === 0) {
			return { status: "invalid_data", error: "No recipients provided" };
		}

		if (parsed.recipients.length > 1000) {
			return {
				status: "invalid_data",
				error: "Maximum 1000 recipients per scheduled send",
			};
		}

		// Get the template to link by ID
		const template = await getTemplateByContentSid(parsed.contentSid);

		const session = await auth();
		const scheduled = await createScheduledMessage({
			templateId: template?.id ?? null,
			contentSid: parsed.contentSid,
			contentVariables: parsed.contentVariables ?? null,
			recipients: parsed.recipients,
			scheduledAt: new Date(parsed.scheduledAt),
			createdBy: session?.user?.email ?? null,
		});

		return {
			status: "success",
			data: { id: scheduled.id, scheduledAt: scheduled.scheduledAt },
		};
	} catch (error) {
		if (error instanceof z.ZodError) {
			return { status: "invalid_data", error: error.message };
		}
		return {
			status: "failed",
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

/**
 * List scheduled messages.
 */
export async function listScheduledMessages(): Promise<ScheduledListResult> {
	const authResult = await requireAdmin();
	if (!authResult.authorized) {
		return { status: "forbidden" };
	}

	try {
		const messages = await getScheduledMessages({ limit: 100 });
		return { status: "success", messages };
	} catch (error) {
		return {
			status: "failed",
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

/**
 * Cancel a scheduled message.
 */
export async function cancelScheduledMessage(
	id: string,
): Promise<TemplateActionState> {
	const authResult = await requireAdmin();
	if (!authResult.authorized) {
		return authResult.error;
	}

	try {
		await dbCancelScheduledMessage(id);
		return { status: "success" };
	} catch (error) {
		return {
			status: "failed",
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}
