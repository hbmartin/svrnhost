/**
 * Re-engagement window configuration for WhatsApp messages.
 *
 * WhatsApp has a 24-hour window for free-form messaging after user interaction.
 * This module calculates the optimal send time for re-engagement messages
 * (typically 18-23 hours after the last user message).
 */
export const REENGAGEMENT_CONFIG = {
	minHours: 18,
	maxHours: 23,
	defaultHours: 20,
} as const;

/**
 * Calculate the re-engagement send time based on the user's last message.
 * Returns a Date that is `preferredHours` after the last user message,
 * clamped between minHours and maxHours.
 *
 * @param lastUserMessageAt - The timestamp of the user's last message
 * @param preferredHours - Desired hours after last message (default: 20)
 * @returns The calculated scheduled send time
 */
export function calculateReengagementTime(
	lastUserMessageAt: Date,
	preferredHours: number = REENGAGEMENT_CONFIG.defaultHours,
): Date {
	const hours = Math.max(
		REENGAGEMENT_CONFIG.minHours,
		Math.min(REENGAGEMENT_CONFIG.maxHours, preferredHours),
	);

	return new Date(lastUserMessageAt.getTime() + hours * 60 * 60 * 1000);
}

/**
 * Check if a scheduled time is within the valid re-engagement window
 * (between 18-23 hours after the last user message).
 *
 * @param lastUserMessageAt - The timestamp of the user's last message
 * @param scheduledFor - The proposed send time
 * @returns True if the scheduled time is within the valid window
 */
export function isValidReengagementTime(
	lastUserMessageAt: Date,
	scheduledFor: Date,
): boolean {
	const minTime = new Date(
		lastUserMessageAt.getTime() +
			REENGAGEMENT_CONFIG.minHours * 60 * 60 * 1000,
	);
	const maxTime = new Date(
		lastUserMessageAt.getTime() +
			REENGAGEMENT_CONFIG.maxHours * 60 * 60 * 1000,
	);

	return scheduledFor >= minTime && scheduledFor <= maxTime;
}

/**
 * Get the remaining time until the 24-hour window closes.
 *
 * @param lastUserMessageAt - The timestamp of the user's last message
 * @returns Milliseconds until window closes, or 0 if already closed
 */
export function getTimeUntilWindowCloses(lastUserMessageAt: Date): number {
	const windowEnd = new Date(
		lastUserMessageAt.getTime() + 24 * 60 * 60 * 1000,
	);
	const remaining = windowEnd.getTime() - Date.now();
	return Math.max(0, remaining);
}

/**
 * Check if the 24-hour messaging window is still open.
 *
 * @param lastUserMessageAt - The timestamp of the user's last message
 * @returns True if within the 24-hour window
 */
export function isWithin24HourWindow(lastUserMessageAt: Date): boolean {
	return getTimeUntilWindowCloses(lastUserMessageAt) > 0;
}
