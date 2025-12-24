import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Chat } from "@/components/chat";
import { DataStreamProvider } from "@/components/data-stream-provider";
import type { ChatMessage } from "@/lib/types";

const sendMessage = vi.fn();

vi.mock("@ai-sdk/react", () => ({
	useChat: () => ({
		messages: [],
		setMessages: vi.fn(),
		sendMessage,
		status: "ready",
		stop: vi.fn(),
		regenerate: vi.fn(),
		resumeStream: vi.fn(),
	}),
}));

vi.mock("@/hooks/use-auto-resume", () => ({
	useAutoResume: () => {},
}));

vi.mock("next/navigation", () => ({
	useRouter: () => ({ refresh: vi.fn() }),
	useSearchParams: () => ({
		get: (key: string) => (key === "query" ? "Why is the sky blue?" : null),
	}),
}));

vi.mock("swr", () => ({
	default: () => ({ data: [] }),
	useSWRConfig: () => ({ mutate: vi.fn() }),
}));

describe("Chat", () => {
	it("sends a query param message and replaces history", async () => {
		const replaceSpy = vi.spyOn(window.history, "replaceState");

		render(
			<DataStreamProvider>
				<Chat
					autoResume={false}
					id="chat-123"
					initialChatModel="chat-model"
					initialMessages={[] as ChatMessage[]}
					isReadonly={true}
				/>
			</DataStreamProvider>,
		);

		await waitFor(() => {
			expect(sendMessage).toHaveBeenCalledWith({
				role: "user",
				parts: [{ type: "text", text: "Why is the sky blue?" }],
			});
		});

		expect(replaceSpy).toHaveBeenCalledWith({}, "", "/chat/chat-123");
	});
});
