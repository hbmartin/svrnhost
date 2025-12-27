"use server";

import { z } from "zod";

import { ADMIN_EMAIL } from "@/lib/constants";
import {
	createQueuedMessage,
	createUser,
	getAllUsers,
	getUser,
	getUserByPhone,
	getUserEngagement,
} from "@/lib/db/queries";
import { calculateReengagementTime } from "@/lib/reengagement";

import { auth } from "../(auth)/auth";

export type AddUserActionState = {
	status:
		| "idle"
		| "success"
		| "failed"
		| "invalid_data"
		| "user_exists"
		| "phone_exists"
		| "forbidden";
};

/**
 * E.164 phone number validation regex.
 * Format: + followed by 1-15 digits (country code + subscriber number)
 * Examples: +14155551234, +447911123456
 */
const E164_PHONE_REGEX = /^\+[1-9]\d{1,14}$/;

const adminCreateUserSchema = z.object({
	email: z.string().email(),
	password: z.string().min(6),
	phone: z
		.string()
		.regex(
			E164_PHONE_REGEX,
			"Phone must be in E.164 format (e.g., +14155551234)",
		),
});

export async function addUser(
	_prevState: AddUserActionState,
	formData: FormData,
): Promise<AddUserActionState> {
	const session = await auth();

	if (!session || session.user?.email !== ADMIN_EMAIL) {
		return { status: "forbidden" };
	}

	try {
		const { email, password, phone } = adminCreateUserSchema.parse({
			email: formData.get("email"),
			password: formData.get("password"),
			phone: formData.get("phone"),
		});

		const [existingUser] = await getUser(email);

		if (existingUser) {
			return { status: "user_exists" };
		}

		const existingPhoneUser = await getUserByPhone(phone);

		if (existingPhoneUser) {
			return { status: "phone_exists" };
		}

		await createUser(email, password, phone);

		return { status: "success" };
	} catch (error) {
		if (error instanceof z.ZodError) {
			return { status: "invalid_data" };
		}

		return { status: "failed" };
	}
}

// ============================================================
// Queue Message Actions
// ============================================================

export type QueueMessageActionState = {
	status:
		| "idle"
		| "success"
		| "failed"
		| "invalid_data"
		| "user_not_found"
		| "no_engagement"
		| "forbidden";
};

const queueMessageSchema = z.object({
	userId: z.string().uuid(),
	content: z.string().min(1).max(4096),
});

export async function getUsers(): Promise<
	Array<{ id: string; email: string; phone: string }>
> {
	const session = await auth();

	if (!session || session.user?.email !== ADMIN_EMAIL) {
		return [];
	}

	const users = await getAllUsers();
	return users.map((u) => ({ id: u.id, email: u.email, phone: u.phone }));
}

export async function queueMessage(
	_prevState: QueueMessageActionState,
	formData: FormData,
): Promise<QueueMessageActionState> {
	const session = await auth();

	if (!session || session.user?.email !== ADMIN_EMAIL) {
		return { status: "forbidden" };
	}

	try {
		const { userId, content } = queueMessageSchema.parse({
			userId: formData.get("userId"),
			content: formData.get("content"),
		});

		// Verify admin user exists
		const adminUser = await getUser(session.user.email);
		if (!adminUser[0]) {
			return { status: "forbidden" };
		}

		// Get user's last engagement to calculate send time
		const engagement = await getUserEngagement(userId);

		if (!engagement) {
			// User has never sent a message - cannot calculate re-engagement window
			return { status: "no_engagement" };
		}

		const scheduledFor = calculateReengagementTime(
			engagement.lastInboundMessageAt,
		);

		await createQueuedMessage({
			userId,
			content,
			scheduledFor,
			createdBy: adminUser[0].id,
		});

		return { status: "success" };
	} catch (error) {
		if (error instanceof z.ZodError) {
			return { status: "invalid_data" };
		}
		console.error("Failed to queue message:", error);
		return { status: "failed" };
	}
}
