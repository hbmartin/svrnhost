import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DataStreamProvider } from "@/components/data-stream-provider";
import { Messages } from "@/components/messages";
import type { ChatMessage } from "@/lib/types";

let isAtBottom = true;
const scrollToBottom = vi.fn();

vi.mock("@/hooks/use-messages", () => ({
	useMessages: () => ({
		containerRef: { current: null },
		endRef: { current: null },
		isAtBottom,
		scrollToBottom,
		hasSentMessage: false,
		onViewportEnter: vi.fn(),
		onViewportLeave: vi.fn(),
	}),
}));

const message: ChatMessage = {
	id: "msg-1",
	role: "assistant",
	parts: [{ type: "text", text: "Hello" }],
};

describe("Messages", () => {
	it("hides the scroll button when at bottom", () => {
		isAtBottom = true;
		render(
			<DataStreamProvider>
				<Messages
					chatId="chat-1"
					isReadonly={true}
					messages={[message]}
					regenerate={vi.fn()}
					selectedModelId="chat-model"
					setMessages={vi.fn()}
					status="ready"
					votes={[]}
				/>
			</DataStreamProvider>,
		);

		const button = screen.getByRole("button", { name: "Scroll to bottom" });
		expect(button.className.includes("pointer-events-none")).toBe(true);
	});

	it("shows and triggers scroll button when not at bottom", () => {
		isAtBottom = false;
		render(
			<DataStreamProvider>
				<Messages
					chatId="chat-1"
					isReadonly={true}
					messages={[message]}
					regenerate={vi.fn()}
					selectedModelId="chat-model"
					setMessages={vi.fn()}
					status="ready"
					votes={[]}
				/>
			</DataStreamProvider>,
		);

		const button = screen.getByRole("button", { name: "Scroll to bottom" });
		expect(button.className.includes("pointer-events-auto")).toBe(true);

		fireEvent.click(button);
		expect(scrollToBottom).toHaveBeenCalledWith("smooth");
	});
});
