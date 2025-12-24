import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SuggestedActions } from "@/components/suggested-actions";

const suggestions = [
	"What events are coming up?",
	"Who are the kinds of people I can meet?",
	"What's the recent funding news relevant to me?",
	"How can ancient philosophy apply to investing?",
];

describe("SuggestedActions", () => {
	it("renders suggestions and sends message on click", async () => {
		const sendMessage = vi.fn();
		const pushStateSpy = vi.spyOn(window.history, "pushState");
		render(<SuggestedActions chatId="chat-123" sendMessage={sendMessage} />);

		suggestions.forEach((text) => {
			expect(screen.getByText(text)).toBeTruthy();
		});

		fireEvent.click(screen.getByText(suggestions[0]));

		expect(pushStateSpy).toHaveBeenCalledWith({}, "", "/chat/chat-123");
		expect(sendMessage).toHaveBeenCalledWith({
			role: "user",
			parts: [{ type: "text", text: suggestions[0] }],
		});
	});
});
