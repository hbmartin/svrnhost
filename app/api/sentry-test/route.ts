import { trace } from "@opentelemetry/api";
import { auth } from "@/app/(auth)/auth";
import { runWithRequestContext } from "@/lib/observability";

const tracer = trace.getTracer("sentry-test");

export function GET(request: Request) {
	return runWithRequestContext(
		{ request, service: "sentry_test" },
		async () => {
			await auth();

			return tracer.startActiveSpan("sentry-test-span", async (span) => {
				span.setAttribute("test.attribute", "dummy-value");

				await tracer.startActiveSpan("nested-child-span", async (childSpan) => {
					childSpan.setAttribute("child.attribute", "nested-value");
					await new Promise((resolve) => setTimeout(resolve, 100));
					childSpan.end();
				});

				span.end();
				throw new Error("Sentry test error - this is intentional");
			});
		},
	);
}
