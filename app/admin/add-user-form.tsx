"use client";

import Form from "next/form";
import { useActionState, useEffect, useState } from "react";

import { SubmitButton } from "@/components/submit-button";
import { toast } from "@/components/toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { type AddUserActionState, addUser } from "./actions";

const initialState: AddUserActionState = {
	status: "idle",
};

export function AddUserForm() {
	const [email, setEmail] = useState("");
	const [phone, setPhone] = useState("");
	const [state, formAction] = useActionState<AddUserActionState, FormData>(
		addUser,
		initialState,
	);

	useEffect(() => {
		if (state.status === "success") {
			toast({
				type: "success",
				description: "User was created successfully.",
			});
		} else if (state.status === "user_exists") {
			toast({
				type: "error",
				description: "That email is already registered.",
			});
		} else if (state.status === "phone_exists") {
			toast({
				type: "error",
				description: "That phone number is already registered.",
			});
		} else if (state.status === "invalid_data") {
			toast({
				type: "error",
				description:
					"Provide a valid email, password (6+ chars), and phone in E.164 format (e.g., +14155551234).",
			});
		} else if (state.status === "failed") {
			toast({
				type: "error",
				description: "We couldn't create the user. Try again.",
			});
		} else if (state.status === "forbidden") {
			toast({
				type: "error",
				description: "You are not allowed to perform this action.",
			});
		}
	}, [state.status]);

	const handleSubmit = (formData: FormData) => {
		setEmail(formData.get("email") as string);
		setPhone(formData.get("phone") as string);
		formAction(formData);
	};

	return (
		<Form action={handleSubmit} className="flex flex-col gap-4 px-4 sm:px-16">
			<div className="flex flex-col gap-2">
				<Label
					className="font-normal text-zinc-600 dark:text-zinc-400"
					htmlFor="email"
				>
					Email Address
				</Label>
				<Input
					autoComplete="email"
					autoFocus
					className="bg-muted text-md md:text-sm"
					defaultValue={email}
					id="email"
					name="email"
					placeholder="user@acme.com"
					required
					type="email"
				/>
			</div>

			<div className="flex flex-col gap-2">
				<Label
					className="font-normal text-zinc-600 dark:text-zinc-400"
					htmlFor="phone"
				>
					Phone Number (E.164 format)
				</Label>
				<Input
					autoComplete="tel"
					className="bg-muted text-md md:text-sm"
					defaultValue={phone}
					id="phone"
					name="phone"
					placeholder="+14155551234"
					required
					type="tel"
				/>
			</div>

			<div className="flex flex-col gap-2">
				<Label
					className="font-normal text-zinc-600 dark:text-zinc-400"
					htmlFor="password"
				>
					Password
				</Label>
				<Input
					className="bg-muted text-md md:text-sm"
					id="password"
					name="password"
					required
					type="password"
				/>
			</div>

			<SubmitButton
				disableOnSuccess={false}
				isSuccessful={state.status === "success"}
			>
				Add user
			</SubmitButton>
		</Form>
	);
}
