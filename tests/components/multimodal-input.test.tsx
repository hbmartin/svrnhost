import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { MultimodalInput } from "@/components/multimodal-input";
import type { Attachment, ChatMessage } from "@/lib/types";

vi.mock("sonner", () => ({
	toast: {
		error: vi.fn(),
	},
}));

interface HarnessProps {
	status?: "ready" | "submitted" | "streaming" | "error";
	selectedModelId?: string;
	sendMessage?: ReturnType<typeof vi.fn>;
	stop?: ReturnType<typeof vi.fn>;
	setMessagesSpy?: ReturnType<typeof vi.fn>;
	initialMessages?: ChatMessage[];
}

function Harness({
	status = "ready",
	selectedModelId = "chat-model",
	sendMessage = vi.fn(),
	stop = vi.fn(),
	setMessagesSpy,
	initialMessages = [],
}: HarnessProps) {
	const [input, setInput] = useState("");
	const [attachments, setAttachments] = useState<Attachment[]>([]);
	const [messages, setMessagesState] = useState<ChatMessage[]>(initialMessages);

	const setMessages = (
		update: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[]),
	) => {
		setMessagesSpy?.(update);
		setMessagesState((prev) =>
			typeof update === "function" ? update(prev) : update,
		);
	};

	return (
		<MultimodalInput
			attachments={attachments}
			chatId="chat-123"
			input={input}
			messages={messages}
			onModelChange={vi.fn()}
			selectedModelId={selectedModelId}
			sendMessage={sendMessage}
			setAttachments={setAttachments}
			setInput={setInput}
			setMessages={setMessages}
			status={status}
			stop={stop}
		/>
	);
}

describe("MultimodalInput", () => {
	it("shows suggested actions when no messages or attachments", () => {
		render(<Harness />);
		expect(screen.getByTestId("suggested-actions")).toBeTruthy();
	});

	it("submits a text message and enables send button", () => {
		const sendMessage = vi.fn();
		const { container } = render(<Harness sendMessage={sendMessage} />);

		const input = screen.getByTestId("multimodal-input") as HTMLTextAreaElement;
		const sendButton = screen.getByTestId("send-button") as HTMLButtonElement;

		expect(sendButton.disabled).toBe(true);

		fireEvent.change(input, { target: { value: "Hello there" } });
		expect(sendButton.disabled).toBe(false);

		const form = container.querySelector("form");
		if (!form) {
			throw new Error("Form not found");
		}

		fireEvent.submit(form);

		expect(sendMessage).toHaveBeenCalledWith({
			role: "user",
			parts: [{ type: "text", text: "Hello there" }],
		});
	});

	it("shows a stop button during submission", () => {
		const stop = vi.fn();
		const setMessagesSpy = vi.fn();
		render(
			<Harness
				setMessagesSpy={setMessagesSpy}
				status="submitted"
				stop={stop}
			/>,
		);

		const stopButton = screen.getByTestId("stop-button");
		fireEvent.click(stopButton);

		expect(stop).toHaveBeenCalled();
		expect(setMessagesSpy).toHaveBeenCalled();
	});

	it("uploads a file and includes it in the next message", async () => {
		const sendMessage = vi.fn();
		const fetchSpy = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				url: "https://example.com/test.png",
				pathname: "test.png",
				contentType: "image/png",
			}),
		});
		vi.stubGlobal("fetch", fetchSpy);

		const { container } = render(<Harness sendMessage={sendMessage} />);
		const fileInput = container.querySelector(
			'input[type="file"]',
		) as HTMLInputElement;

		const file = new File(["content"], "test.png", { type: "image/png" });
		fireEvent.change(fileInput, { target: { files: [file] } });

		await waitFor(() => {
			expect(screen.getByTestId("attachments-preview")).toBeTruthy();
		});

		await waitFor(() => {
			expect(screen.queryByTestId("input-attachment-loader")).toBeNull();
		});

		const input = screen.getByTestId("multimodal-input");
		fireEvent.change(input, { target: { value: "Who painted this?" } });

		const form = container.querySelector("form");
		if (!form) {
			throw new Error("Form not found");
		}

		fireEvent.submit(form);

		expect(fetchSpy).toHaveBeenCalledWith("/api/files/upload", {
			method: "POST",
			body: expect.any(FormData),
		});

		expect(sendMessage).toHaveBeenCalledWith({
			role: "user",
			parts: [
				{
					type: "file",
					url: "https://example.com/test.png",
					name: "test.png",
					mediaType: "image/png",
				},
				{ type: "text", text: "Who painted this?" },
			],
		});
	});

	it("disables attachments for the reasoning model", () => {
		render(<Harness selectedModelId="chat-model-reasoning" />);
		const attachmentsButton = screen.getByTestId("attachments-button");
		expect(attachmentsButton).toBeTruthy();
		expect((attachmentsButton as HTMLButtonElement).disabled).toBe(true);
	});
});
