import { auth } from "@/app/(auth)/auth";

export async function GET() {
	await auth();
	throw new Error("Sentry test error - this is intentional");
}
