/**
 * Liveness probe endpoint.
 * Returns 200 OK if the service is running.
 */
export function GET() {
	return Response.json({
		status: "ok",
		timestamp: new Date().toISOString(),
		service: "ai-chatbot",
	});
}
