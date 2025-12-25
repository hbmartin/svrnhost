import "server-only";

import { createTwilioClient } from "@/app/api/whatsapp/twilio";
import {
	getAllTemplates,
	softDeleteTemplate,
	upsertTemplate,
} from "@/lib/db/queries";
import {
	fetchApprovalStatus,
	listContentAndApprovals,
	type TwilioContentAndApproval,
} from "@/lib/twilio/content-api";

export interface SyncResult {
	created: number;
	updated: number;
	deleted: number;
	errors: Array<{ contentSid: string; error: string }>;
}

/**
 * Convert Twilio Content API response to our database format.
 */
function mapTwilioTemplateToDb(template: TwilioContentAndApproval) {
	const whatsappApproval = template.approval_requests?.whatsapp;

	return {
		contentSid: template.sid,
		friendlyName: template.friendly_name,
		language: template.language,
		variables: template.variables ?? null,
		types: template.types,
		whatsappApprovalStatus: whatsappApproval?.status ?? "unsubmitted",
		whatsappTemplateName: whatsappApproval?.name ?? null,
		whatsappCategory: whatsappApproval?.category ?? null,
		rejectionReason: whatsappApproval?.rejection_reason ?? null,
		twilioCreatedAt: new Date(template.date_created),
		twilioUpdatedAt: new Date(template.date_updated),
	};
}

/**
 * Sync all templates from Twilio Content API to the local database.
 *
 * This function:
 * 1. Fetches all templates from Twilio with approval status
 * 2. Upserts each template to the local database
 * 3. Marks templates that no longer exist in Twilio as deleted
 */
export async function syncTemplatesFromTwilio(): Promise<SyncResult> {
	const client = createTwilioClient();
	const result: SyncResult = {
		created: 0,
		updated: 0,
		deleted: 0,
		errors: [],
	};

	// Fetch all templates from Twilio
	const twilioTemplates = await listContentAndApprovals(client);
	const twilioSids = new Set(twilioTemplates.map((t) => t.sid));

	// Get existing templates from database
	const existingTemplates = await getAllTemplates({ includeDeleted: false });
	const existingSids = new Set(existingTemplates.map((t) => t.contentSid));

	// Upsert each Twilio template
	for (const twilioTemplate of twilioTemplates) {
		try {
			const templateData = mapTwilioTemplateToDb(twilioTemplate);
			await upsertTemplate(templateData);

			if (existingSids.has(twilioTemplate.sid)) {
				result.updated++;
			} else {
				result.created++;
			}
		} catch (error) {
			result.errors.push({
				contentSid: twilioTemplate.sid,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	// Mark templates that no longer exist in Twilio as deleted
	for (const existing of existingTemplates) {
		if (!twilioSids.has(existing.contentSid)) {
			try {
				await softDeleteTemplate(existing.contentSid);
				result.deleted++;
			} catch (error) {
				result.errors.push({
					contentSid: existing.contentSid,
					error: `Failed to soft delete: ${error instanceof Error ? error.message : String(error)}`,
				});
			}
		}
	}

	return result;
}

/**
 * Sync a single template's approval status from Twilio.
 */
export async function syncTemplateApprovalStatus(
	contentSid: string,
): Promise<void> {
	const client = createTwilioClient();
	const approval = await fetchApprovalStatus(client, contentSid);

	const whatsappApproval = approval.whatsapp;
	if (!whatsappApproval) {
		return;
	}

	await upsertTemplate({
		contentSid,
		whatsappApprovalStatus: whatsappApproval.status,
		whatsappTemplateName: whatsappApproval.name ?? null,
		whatsappCategory: whatsappApproval.category ?? null,
		rejectionReason: whatsappApproval.rejection_reason ?? null,
	});
}
