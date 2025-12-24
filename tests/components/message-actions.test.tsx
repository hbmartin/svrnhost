import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { describe, expect, it, vi } from "vitest";
import { PureMessageActions } from "@/components/message-actions";
import type { ChatMessage } from "@/lib/types";

vi.mock("sonner", () => ({
	toast: {
		promise: vi.fn((promise: Promise<unknown>, handlers: any) =>
			promise.then(() => handlers.success()),
		),
	},
}));

vi.mock("usehooks-ts", () => ({
	useCopyToClipboard: () => [null, vi.fn()],
}));

const message: ChatMessage = {
	id: "message-1",
	role: "assistant",
	parts: [{ type: "text", text: "Hello" }],
};

describe("MessageActions", () => {
	it("upvotes a message and updates cache", async () => {
		const mutate = vi.fn();
		const fetchSpy = vi.fn().mockResolvedValue(new Response("ok"));
		vi.stubGlobal("fetch", fetchSpy);

		render(
			<SWRConfig value={{ mutate }}>
				<PureMessageActions
					chatId="chat-1"
					isLoading={false}
					message={message}
					vote={undefined}
				/>
			</SWRConfig>,
		);

		const upvoteButton = screen.getByTestId("message-upvote");
		fireEvent.click(upvoteButton);

		await waitFor(() => {
			expect(fetchSpy).toHaveBeenCalledWith("/api/vote", {
				method: "PATCH",
				body: JSON.stringify({
					chatId: "chat-1",
					messageId: "message-1",
					type: "up",
				}),
			});
		});

		await waitFor(() => {
			expect(mutate).toHaveBeenCalledWith(
				"/api/vote?chatId=chat-1",
				expect.any(Function),
				{ revalidate: false },
			);
		});
	});
});
