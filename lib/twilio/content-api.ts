import "server-only";

import type { TwilioClient } from "@/app/api/whatsapp/twilio";
import { withRetry } from "@/lib/retry";

// ============================================================================
// Types for Twilio Content API
// ============================================================================

export interface TwilioContentTemplate {
	sid: string;
	account_sid: string;
	friendly_name: string;
	language: string;
	variables?: Record<string, string>;
	types: Record<string, unknown>;
	date_created: string;
	date_updated: string;
	url: string;
	links: {
		approval_create: string;
		approval_fetch: string;
	};
}

export interface TwilioContentApproval {
	whatsapp?: {
		status: string;
		name?: string;
		category?: string;
		rejection_reason?: string;
	};
}

export interface TwilioContentAndApproval extends TwilioContentTemplate {
	approval_requests?: TwilioContentApproval;
}

interface ContentListResponse {
	contents: TwilioContentAndApproval[];
	meta: {
		page: number;
		page_size: number;
		first_page_url: string;
		next_page_url: string | null;
		previous_page_url: string | null;
		key: string;
	};
}

export interface CreateTemplateParams {
	friendlyName: string;
	language: string;
	variables?: Record<string, string>;
	types: Record<string, unknown>;
}

export interface SubmitApprovalParams {
	contentSid: string;
	name: string;
	category: "UTILITY" | "MARKETING" | "AUTHENTICATION";
}

// ============================================================================
// Content API Functions
// ============================================================================

const CONTENT_API_BASE = "https://content.twilio.com";

/**
 * List all content templates with their approval status.
 * Handles pagination automatically.
 */
export async function listContentAndApprovals(
	client: TwilioClient,
	pageSize = 100,
): Promise<TwilioContentAndApproval[]> {
	const allContents: TwilioContentAndApproval[] = [];
	let nextPageUrl: string | null = `${CONTENT_API_BASE}/v1/ContentAndApprovals?PageSize=${pageSize}`;

	while (nextPageUrl) {
		const response = await withRetry(
			() =>
				client.request({
					method: "get",
					uri: nextPageUrl as string,
				}),
			{
				maxAttempts: 3,
				baseDelayMs: 1000,
				maxDelayMs: 10000,
				context: "twilio-content-list",
			},
		);

		const data = response.result.body as ContentListResponse;
		allContents.push(...data.contents);
		nextPageUrl = data.meta.next_page_url;
	}

	return allContents;
}

/**
 * Fetch a single content template by SID.
 */
export async function fetchContent(
	client: TwilioClient,
	contentSid: string,
): Promise<TwilioContentTemplate> {
	const response = await withRetry(
		() =>
			client.request({
				method: "get",
				uri: `${CONTENT_API_BASE}/v1/Content/${contentSid}`,
			}),
		{
			maxAttempts: 3,
			baseDelayMs: 1000,
			maxDelayMs: 10000,
			context: "twilio-content-fetch",
		},
	);

	return response.result.body as TwilioContentTemplate;
}

/**
 * Fetch the approval status for a content template.
 */
export async function fetchApprovalStatus(
	client: TwilioClient,
	contentSid: string,
): Promise<TwilioContentApproval> {
	const response = await withRetry(
		() =>
			client.request({
				method: "get",
				uri: `${CONTENT_API_BASE}/v1/Content/${contentSid}/ApprovalRequests`,
			}),
		{
			maxAttempts: 3,
			baseDelayMs: 1000,
			maxDelayMs: 10000,
			context: "twilio-content-approval-fetch",
		},
	);

	return response.result.body as TwilioContentApproval;
}

/**
 * Create a new content template.
 */
export async function createContent(
	client: TwilioClient,
	params: CreateTemplateParams,
): Promise<TwilioContentTemplate> {
	const response = await withRetry(
		() =>
			client.request({
				method: "post",
				uri: `${CONTENT_API_BASE}/v1/Content`,
				data: {
					friendly_name: params.friendlyName,
					language: params.language,
					variables: params.variables,
					types: params.types,
				},
			}),
		{
			maxAttempts: 3,
			baseDelayMs: 1000,
			maxDelayMs: 10000,
			context: "twilio-content-create",
		},
	);

	return response.result.body as TwilioContentTemplate;
}

/**
 * Submit a content template for WhatsApp approval.
 */
export async function submitForWhatsAppApproval(
	client: TwilioClient,
	params: SubmitApprovalParams,
): Promise<{ status: string; name: string }> {
	const response = await withRetry(
		() =>
			client.request({
				method: "post",
				uri: `${CONTENT_API_BASE}/v1/Content/${params.contentSid}/ApprovalRequests/WhatsApp`,
				data: {
					name: params.name,
					category: params.category,
				},
			}),
		{
			maxAttempts: 3,
			baseDelayMs: 1000,
			maxDelayMs: 10000,
			context: "twilio-content-submit-approval",
		},
	);

	const body = response.result.body as { status?: string; name?: string };
	return {
		status: body.status ?? "pending",
		name: body.name ?? params.name,
	};
}

/**
 * Delete a content template.
 *
 * @param deleteInWaba - If true, also deletes the template in WABA (WhatsApp Business Account)
 */
export async function deleteContent(
	client: TwilioClient,
	contentSid: string,
	deleteInWaba = false,
): Promise<void> {
	await withRetry(
		() =>
			client.request({
				method: "delete",
				uri: `${CONTENT_API_BASE}/v1/Content/${contentSid}?deleteInWaba=${deleteInWaba}`,
			}),
		{
			maxAttempts: 3,
			baseDelayMs: 1000,
			maxDelayMs: 10000,
			context: "twilio-content-delete",
		},
	);
}
