import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatHeader } from "@/components/chat-header";

const setTheme = vi.fn();

vi.mock("next-themes", () => ({
	useTheme: () => ({
		resolvedTheme: "dark",
		setTheme,
	}),
}));

describe("ChatHeader", () => {
	it("toggles theme when mounted", async () => {
		render(<ChatHeader chatId="chat-1" isReadonly={false} />);

		await waitFor(() => {
			expect(
				screen.getByRole("button", { name: "Switch to light theme" }),
			).toBeTruthy();
		});

		fireEvent.click(
			screen.getByRole("button", { name: "Switch to light theme" }),
		);

		expect(setTheme).toHaveBeenCalledWith("light");
	});
});
