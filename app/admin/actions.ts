"use server";

import { z } from "zod";

import { ADMIN_EMAIL } from "@/lib/constants";
import { createUser, getUser } from "@/lib/db/queries";

import { auth } from "../(auth)/auth";

export type AddUserActionState = {
	status:
		| "idle"
		| "success"
		| "failed"
		| "invalid_data"
		| "user_exists"
		| "forbidden";
};

const adminCreateUserSchema = z.object({
	email: z.string().email(),
	password: z.string().min(6),
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
		const { email, password } = adminCreateUserSchema.parse({
			email: formData.get("email"),
			password: formData.get("password"),
		});

		const [existingUser] = await getUser(email);

		if (existingUser) {
			return { status: "user_exists" };
		}

		await createUser(email, password);

		return { status: "success" };
	} catch (error) {
		if (error instanceof z.ZodError) {
			return { status: "invalid_data" };
		}

		return { status: "failed" };
	}
}

