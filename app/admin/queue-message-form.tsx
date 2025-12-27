"use client";

import Form from "next/form";
import { useActionState, useEffect, useState } from "react";

import { SubmitButton } from "@/components/submit-button";
import { toast } from "@/components/toast";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import {
	type QueueMessageActionState,
	getUsers,
	queueMessage,
} from "./actions";

const initialState: QueueMessageActionState = {
	status: "idle",
};

export function QueueMessageForm() {
	const [users, setUsers] = useState<
		Array<{ id: string; email: string; phone: string }>
	>([]);
	const [selectedUserId, setSelectedUserId] = useState<string>("");
	const [state, formAction] = useActionState<
		QueueMessageActionState,
		FormData
	>(queueMessage, initialState);

	useEffect(() => {
		getUsers()
			.then(setUsers)
			.catch((err) => console.error("Failed to load users:", err));
	}, []);

	useEffect(() => {
		if (state.status === "success") {
			toast({
				type: "success",
				description: "Message queued successfully.",
			});
			setSelectedUserId("");
		} else if (state.status === "user_not_found") {
			toast({
				type: "error",
				description: "Selected user not found.",
			});
		} else if (state.status === "no_engagement") {
			toast({
				type: "error",
				description:
					"User has no message history. Cannot schedule re-engagement.",
			});
		} else if (state.status === "invalid_data") {
			toast({
				type: "error",
				description: "Please select a user and enter a message.",
			});
		} else if (state.status === "failed") {
			toast({
				type: "error",
				description: "Failed to queue message. Try again.",
			});
		} else if (state.status === "forbidden") {
			toast({
				type: "error",
				description: "You are not allowed to perform this action.",
			});
		}
	}, [state.status]);

	const handleSubmit = (formData: FormData) => {
		formData.set("userId", selectedUserId);
		formAction(formData);
	};

	return (
		<Form action={handleSubmit} className="flex flex-col gap-4 px-4 sm:px-16">
			<div className="flex flex-col gap-2">
				<Label
					className="font-normal text-zinc-600 dark:text-zinc-400"
					htmlFor="userId"
				>
					Select User
				</Label>
				<Select value={selectedUserId} onValueChange={setSelectedUserId}>
					<SelectTrigger className="bg-muted">
						<SelectValue placeholder="Choose a user..." />
					</SelectTrigger>
					<SelectContent>
						{users.map((user) => (
							<SelectItem key={user.id} value={user.id}>
								{user.email} ({user.phone})
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			<div className="flex flex-col gap-2">
				<Label
					className="font-normal text-zinc-600 dark:text-zinc-400"
					htmlFor="content"
				>
					Message Content
				</Label>
				<Textarea
					className="bg-muted text-md min-h-[120px] md:text-sm"
					id="content"
					name="content"
					placeholder="Enter your re-engagement message..."
					required
				/>
			</div>

			<SubmitButton
				disableOnSuccess={false}
				isSuccessful={state.status === "success"}
			>
				Queue message
			</SubmitButton>
		</Form>
	);
}
