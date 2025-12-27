import { redirect } from "next/navigation";
import { Suspense } from "react";

import { ADMIN_EMAIL } from "@/lib/constants";

import { auth } from "../(auth)/auth";
import { AddUserForm } from "./add-user-form";
import { QueueMessageForm } from "./queue-message-form";

export default function AdminPage() {
	return (
		<Suspense fallback={<div className="flex h-dvh" />}>
			<AdminPageContent />
		</Suspense>
	);
}

async function AdminPageContent() {
	const session = await auth();

	if (!session || session.user?.email !== ADMIN_EMAIL) {
		redirect("/");
	}

	return (
		<div className="flex min-h-dvh w-full flex-col items-center gap-8 bg-background px-4 py-12">
			<section className="flex w-full max-w-xl flex-col gap-6 rounded-2xl border border-border/40 bg-card px-6 py-10 shadow-lg">
				<div className="flex flex-col gap-2 text-center">
					<p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
						Admin only
					</p>
					<h1 className="font-semibold text-2xl">Add a new user</h1>
					<p className="text-muted-foreground text-sm">
						Enter the email address and password for the person you want to
						onboard. Accounts created here can sign in immediately.
					</p>
				</div>
				<AddUserForm />
			</section>

			<section className="flex w-full max-w-xl flex-col gap-6 rounded-2xl border border-border/40 bg-card px-6 py-10 shadow-lg">
				<div className="flex flex-col gap-2 text-center">
					<p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
						Re-engagement
					</p>
					<h1 className="font-semibold text-2xl">Queue a message</h1>
					<p className="text-muted-foreground text-sm">
						Schedule a WhatsApp message to be sent 18-23 hours after the
						user&apos;s last message.
					</p>
				</div>
				<QueueMessageForm />
			</section>
		</div>
	);
}
