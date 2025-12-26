"use client";

import { useActionState, useEffect, useState, useTransition } from "react";

import type { MessageTemplate } from "@/lib/db/schema";
import { toast } from "@/components/toast";

import {
	listTemplates,
	syncTemplates,
	sendTemplate,
	type TemplateActionState,
	type SyncResult,
} from "./actions";

const initialSendState: TemplateActionState = { status: "idle" };

export function TemplatesManager() {
	const [templates, setTemplates] = useState<MessageTemplate[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isSyncing, startSyncTransition] = useTransition();
	const [selectedTemplate, setSelectedTemplate] =
		useState<MessageTemplate | null>(null);

	// Load templates on mount
	useEffect(() => {
		loadTemplates();
	}, []);

	async function loadTemplates() {
		setIsLoading(true);
		const result = await listTemplates();
		if (result.status === "success" && result.templates) {
			setTemplates(result.templates);
		} else if (result.error) {
			toast({ type: "error", description: result.error });
		}
		setIsLoading(false);
	}

	function handleSync() {
		startSyncTransition(async () => {
			const result: SyncResult = await syncTemplates();
			if (result.status === "success") {
				toast({
					type: "success",
					description: `Synced: ${result.created} created, ${result.updated} updated, ${result.deleted} deleted`,
				});
				await loadTemplates();
			} else {
				toast({
					type: "error",
					description: result.error ?? "Sync failed",
				});
			}
		});
	}

	return (
		<div className="space-y-6">
			{/* Header with Sync Button */}
			<div className="flex items-center justify-between">
				<div>
					<span className="text-sm text-muted-foreground">
						{templates.length} template{templates.length !== 1 ? "s" : ""}
					</span>
				</div>
				<button
					type="button"
					onClick={handleSync}
					disabled={isSyncing}
					className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
				>
					{isSyncing ? "Syncing..." : "Sync from Twilio"}
				</button>
			</div>

			{/* Templates Table */}
			{isLoading ? (
				<div className="flex items-center justify-center py-12">
					<span className="text-muted-foreground">Loading templates...</span>
				</div>
			) : templates.length === 0 ? (
				<div className="rounded-lg border border-dashed border-border p-12 text-center">
					<p className="text-muted-foreground">No templates found.</p>
					<p className="mt-1 text-sm text-muted-foreground">
						Click &quot;Sync from Twilio&quot; to import your templates.
					</p>
				</div>
			) : (
				<div className="overflow-hidden rounded-lg border border-border">
					<table className="w-full">
						<thead className="bg-muted/50">
							<tr>
								<th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
									Name
								</th>
								<th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
									Language
								</th>
								<th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
									Status
								</th>
								<th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
									Category
								</th>
								<th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
									Last Synced
								</th>
								<th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
									Actions
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border">
							{templates.map((template) => (
								<TemplateRow
									key={template.id}
									template={template}
									onSend={() => setSelectedTemplate(template)}
								/>
							))}
						</tbody>
					</table>
				</div>
			)}

			{/* Send Dialog */}
			{selectedTemplate && (
				<SendTemplateDialog
					template={selectedTemplate}
					onClose={() => setSelectedTemplate(null)}
				/>
			)}
		</div>
	);
}

function TemplateRow({
	template,
	onSend,
}: {
	template: MessageTemplate;
	onSend: () => void;
}) {
	const statusColors: Record<string, string> = {
		approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
		pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
		rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
		unsubmitted: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
	};

	const status = template.whatsappApprovalStatus ?? "unsubmitted";
	const statusClass = statusColors[status] ?? statusColors["unsubmitted"];

	return (
		<tr className="hover:bg-muted/30">
			<td className="px-4 py-3">
				<div className="font-medium">{template.friendlyName}</div>
				<div className="text-xs text-muted-foreground">{template.contentSid}</div>
			</td>
			<td className="px-4 py-3 text-sm">{template.language}</td>
			<td className="px-4 py-3">
				<span
					className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusClass}`}
				>
					{status}
				</span>
			</td>
			<td className="px-4 py-3 text-sm">
				{template.whatsappCategory ?? "-"}
			</td>
			<td className="px-4 py-3 text-sm text-muted-foreground">
				{template.lastSyncedAt
					? new Date(template.lastSyncedAt).toLocaleDateString()
					: "-"}
			</td>
			<td className="px-4 py-3 text-right">
				<button
					type="button"
					onClick={onSend}
					disabled={status !== "approved"}
					className="rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 disabled:cursor-not-allowed disabled:opacity-50"
				>
					Send
				</button>
			</td>
		</tr>
	);
}

function SendTemplateDialog({
	template,
	onClose,
}: {
	template: MessageTemplate;
	onClose: () => void;
}) {
	const [state, formAction] = useActionState<TemplateActionState, FormData>(
		sendTemplate,
		initialSendState,
	);
	const [isPending, startTransition] = useTransition();

	useEffect(() => {
		if (state.status === "success") {
			const data = state.data as {
				sent: number;
				failed: number;
				details: { sent: unknown[]; failed: unknown[] };
			};
			toast({
				type: "success",
				description: `Sent to ${data.sent} recipient(s). ${data.failed} failed.`,
			});
			onClose();
		} else if (state.status === "failed" || state.status === "invalid_data") {
			toast({
				type: "error",
				description: state.error ?? "Failed to send template",
			});
		}
	}, [state, onClose]);

	function handleSubmit(formData: FormData) {
		formData.set("contentSid", template.contentSid);
		startTransition(() => {
			formAction(formData);
		});
	}

	// Extract variable names from template
	const variableNames = template.variables
		? Object.values(template.variables)
		: [];

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
			<div className="w-full max-w-md rounded-lg bg-card p-6 shadow-xl">
				<h2 className="mb-4 text-lg font-semibold">
					Send: {template.friendlyName}
				</h2>
				<form action={handleSubmit} className="space-y-4">
					<div>
						<label
							htmlFor="recipients"
							className="mb-1 block text-sm font-medium"
						>
							Recipients (comma-separated phone numbers)
						</label>
						<input
							type="text"
							id="recipients"
							name="recipients"
							placeholder="+1234567890, +0987654321"
							required
							className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
						/>
					</div>

					{variableNames.length > 0 && (
						<div>
							<label
								htmlFor="contentVariables"
								className="mb-1 block text-sm font-medium"
							>
								Variables (JSON)
							</label>
							<textarea
								id="contentVariables"
								name="contentVariables"
								placeholder={`{"1": "value1", "2": "value2"}`}
								rows={3}
								className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
							/>
							<p className="mt-1 text-xs text-muted-foreground">
								Template variables: {variableNames.join(", ")}
							</p>
						</div>
					)}

					<div className="flex justify-end gap-2">
						<button
							type="button"
							onClick={onClose}
							className="rounded-md px-4 py-2 text-sm font-medium hover:bg-muted"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={isPending}
							className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
						>
							{isPending ? "Sending..." : "Send Now"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
