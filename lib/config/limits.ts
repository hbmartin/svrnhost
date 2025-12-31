export const WHATSAPP_LIMITS = {
	/**
	 * Maximum message length Twilio can accept for WhatsApp.
	 * Messages longer than this must be chunked into multiple sends.
	 */
	maxMessageLength: 1600,
	/**
	 * Delay in milliseconds between sending chunked messages.
	 */
	chunkDelayMs: 500,
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
		maxDelayMs: 30_000,
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
