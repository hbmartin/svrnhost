export const WHATSAPP_LIMITS = {
	/**
	 * Twilio WhatsApp sender throughput target (messages per second).
	 * The WhatsApp Business API enforces sender-level throughput limits.
	 */
	senderRateLimitPerSecond: 80,
	/** Burst capacity for the sender token bucket. */
	senderRateLimitBurst: 80,
	/** Max time to wait for a sender token before failing. */
	senderRateLimitMaxWaitMs: 5000,
	/**
	 * Retry limits for outbound sends.
	 */
	retry: {
		maxAttempts: 3,
		baseDelayMs: 1000,
		maxDelayMs: 30000,
	},
	/** Twilio client automatic retry count for 429 responses. */
	twilioAutoRetryMaxRetries: 3,
} as const;

export const LLM_LIMITS = {
	/** Timeout in milliseconds for LLM calls. */
	timeoutMs: 30_000,
	/** Maximum retries for transient model failures. */
	maxRetries: 2,
	/** Minimum response length to accept. */
	minResponseLength: 1,
} as const;

export const TEMPLATE_LIMITS = {
	/** Maximum recipients per immediate bulk send. */
	maxBulkRecipients: 100,
	/** Maximum recipients per scheduled send. */
	maxScheduledRecipients: 1000,
	/** Minimum seconds between template syncs. */
	syncCooldownSeconds: 60,
} as const;
