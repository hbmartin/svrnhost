import { NextRequest, NextResponse } from "next/server";

import { processPendingScheduledMessages } from "@/lib/templates/scheduled-processor";

/**
 * Cron endpoint to process scheduled messages.
 *
 * Should be called by Vercel Cron or external scheduler.
 * Recommended: Run every minute.
 *
 * Security: Validates CRON_SECRET header.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
	// Validate cron secret
	const cronSecret = process.env["CRON_SECRET"];
	const authHeader = request.headers.get("authorization");

	// If CRON_SECRET is set, require it
	if (cronSecret) {
		if (authHeader !== `Bearer ${cronSecret}`) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
	}

	try {
		const result = await processPendingScheduledMessages();

		return NextResponse.json({
			success: true,
			processed: result.processed,
			succeeded: result.succeeded,
			failed: result.failed,
			errors: result.errors,
		});
	} catch (error) {
		console.error("Cron job failed:", error);
		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}
