import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { type ReactNode, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { deleteTrailingMessages } from "@/app/(chat)/actions";
import { DataStreamProvider } from "@/components/data-stream-provider";
import { PreviewMessage } from "@/components/message";
import type { ChatMessage } from "@/lib/types";

vi.mock("sonner", () => ({
	toast: {
		promise: vi.fn(),
		error: vi.fn(),
		success: vi.fn(),
	},
}));

vi.mock("usehooks-ts", () => ({
	useCopyToClipboard: () => [null, vi.fn()],
}));

vi.mock("@/app/(chat)/actions", () => ({
	deleteTrailingMessages: vi.fn().mockResolvedValue(undefined),
}));

function Wrapper({ children }: { children: ReactNode }) {
	return <DataStreamProvider>{children}</DataStreamProvider>;
}

const assistantMessage: ChatMessage = {
	id: "assistant-1",
	role: "assistant",
	parts: [
		{ type: "reasoning", text: "Because scattering!" },
		{ type: "text", text: "It looks blue." },
	],
};

const userMessage: ChatMessage = {
	id: "user-1",
	role: "user",
	parts: [{ type: "text", text: "Why is the sky blue?" }],
};

describe("PreviewMessage", () => {
	it("renders reasoning and toggles open state", () => {
		render(
			<PreviewMessage
				chatId="chat-1"
				isLoading={false}
				isReadonly={false}
				message={assistantMessage}
				regenerate={vi.fn()}
				requiresScrollPadding={false}
				setMessages={vi.fn()}
				vote={undefined}
			/>,
			{ wrapper: Wrapper },
		);

		const reasoningRoot = screen.getByTestId("message-reasoning");
		expect(reasoningRoot.getAttribute("data-state")).toBe("closed");

		const trigger = screen.getByText("Thinking...").closest("button");
		if (!trigger) {
			throw new Error("Reasoning trigger not found");
		}

		fireEvent.click(trigger);
		expect(reasoningRoot.getAttribute("data-state")).toBe("open");
	});

	it("renders attachments for user message", () => {
		const messageWithAttachment: ChatMessage = {
			id: "user-2",
			role: "user",
			parts: [
				{
					type: "file",
					mediaType: "image/png",
					url: "https://example.com/image.png",
					filename: "image.png",
				},
				{ type: "text", text: "Here is an image" },
			],
		};

		render(
			<PreviewMessage
				chatId="chat-1"
				isLoading={false}
				isReadonly={false}
				message={messageWithAttachment}
				regenerate={vi.fn()}
				requiresScrollPadding={false}
				setMessages={vi.fn()}
				vote={undefined}
			/>,
			{ wrapper: Wrapper },
		);

		expect(screen.getByTestId("message-attachments")).toBeTruthy();
		expect(screen.getByTestId("input-attachment-preview")).toBeTruthy();
	});

	it("allows editing a user message and regenerates", async () => {
		const regenerate = vi.fn();

		function Harness() {
			const [messages, setMessages] = useState<ChatMessage[]>([userMessage]);

			return (
				<PreviewMessage
					chatId="chat-1"
					isLoading={false}
					isReadonly={false}
					message={messages[0]}
					regenerate={regenerate}
					requiresScrollPadding={false}
					setMessages={setMessages}
					vote={undefined}
				/>
			);
		}

		render(<Harness />, { wrapper: Wrapper });

		const editButton = screen.getByTestId("message-edit-button");
		fireEvent.click(editButton);

		const editor = screen.getByTestId("message-editor") as HTMLTextAreaElement;
		fireEvent.change(editor, { target: { value: "Why is grass green?" } });

		const sendButton = screen.getByTestId("message-editor-send-button");
		fireEvent.click(sendButton);

		await waitFor(() => {
			expect(regenerate).toHaveBeenCalled();
		});

		expect(deleteTrailingMessages).toHaveBeenCalledWith({ id: "user-1" });
		expect(screen.queryByTestId("message-editor")).toBeNull();
	});
});
