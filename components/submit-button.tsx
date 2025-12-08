"use client";

import { useFormStatus } from "react-dom";

import { LoaderIcon } from "@/components/icons";

import { Button } from "./ui/button";

export function SubmitButton({
	children,
	isSuccessful,
	disableOnSuccess = true,
}: {
	children: React.ReactNode;
	isSuccessful: boolean;
	disableOnSuccess?: boolean;
}) {
	const { pending } = useFormStatus();
	const shouldDisable = pending || (disableOnSuccess && isSuccessful);

	return (
		<Button
			aria-disabled={shouldDisable}
			className="relative"
			disabled={shouldDisable}
			type={pending ? "button" : "submit"}
		>
			{children}

			{shouldDisable && (
				<span className="absolute right-4 animate-spin">
					<LoaderIcon />
				</span>
			)}

			<output aria-live="polite" className="sr-only">
				{shouldDisable ? "Loading" : "Submit form"}
			</output>
		</Button>
	);
}
