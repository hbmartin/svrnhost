import { redirect } from "next/navigation";
import { Suspense } from "react";

import { ADMIN_EMAIL } from "@/lib/constants";
import { auth } from "@/app/(auth)/auth";
import { TemplatesManager } from "./templates-manager";

export default function TemplatesPage() {
	return (
		<Suspense
			fallback={
				<div className="flex min-h-dvh items-center justify-center">
					Loading...
				</div>
			}
		>
			<TemplatesPageContent />
		</Suspense>
	);
}

async function TemplatesPageContent() {
	const session = await auth();

	if (!session || session.user?.email !== ADMIN_EMAIL) {
		redirect("/");
	}

	return (
		<div className="min-h-dvh w-full bg-background px-4 py-8">
			<div className="mx-auto max-w-6xl">
				<header className="mb-8">
					<p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
						Admin
					</p>
					<h1 className="font-semibold text-2xl">WhatsApp Message Templates</h1>
					<p className="mt-2 text-muted-foreground text-sm">
						Manage your Twilio Content API templates. Sync from Twilio, send
						templates to recipients, or schedule for later.
					</p>
				</header>
				<TemplatesManager />
			</div>
		</div>
	);
}
