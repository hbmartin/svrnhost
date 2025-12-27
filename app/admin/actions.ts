"use server";

import { z } from "zod";

import { ADMIN_EMAIL } from "@/lib/constants";
import { createUser, getUser, getUserByPhone } from "@/lib/db/queries";

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
		.regex(E164_PHONE_REGEX, "Phone must be in E.164 format (e.g., +14155551234)"),
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
