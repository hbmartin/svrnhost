"use client";
import type { UseChatHelpers } from "@ai-sdk/react";
import equal from "fast-deep-equal";
import { type Dispatch, memo, type SetStateAction, useState } from "react";
import type { Vote } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import { cn, sanitizeText } from "@/lib/utils";
import { useDataStream } from "./data-stream-provider";
import { MessageContent } from "./elements/message";
import { Response } from "./elements/response";
import {
	Tool,
	ToolContent,
	ToolHeader,
	ToolInput,
	ToolOutput,
} from "./elements/tool";
import { SparklesIcon } from "./icons";
import { MessageActions } from "./message-actions";
import { MessageEditor } from "./message-editor";
import { MessageReasoning } from "./message-reasoning";
import { PreviewAttachment } from "./preview-attachment";
import { Weather } from "./weather";

function renderReasoningPart(
	part: Extract<ChatMessage["parts"][number], { type: "reasoning" }>,
	partKey: string,
	isLoading: boolean,
): React.ReactNode {
	if (!part.text?.trim().length) {
		return null;
	}
	return (
		<MessageReasoning
			isLoading={isLoading}
			key={partKey}
			reasoning={part.text}
		/>
	);
}

function renderTextPartView(
	part: Extract<ChatMessage["parts"][number], { type: "text" }>,
	partKey: string,
	role: ChatMessage["role"],
): React.ReactNode {
	return (
		<div key={partKey}>
			<MessageContent
				className={cn({
					"w-fit break-words rounded-2xl px-3 py-2 text-right text-white":
						role === "user",
					"bg-transparent px-0 py-0 text-left": role === "assistant",
				})}
				data-testid="message-content"
				style={role === "user" ? { backgroundColor: "#006cff" } : undefined}
			>
				<Response>{sanitizeText(part.text)}</Response>
			</MessageContent>
		</div>
	);
}

function renderTextPartEdit(
	partKey: string,
	message: ChatMessage,
	setMessages: UseChatHelpers<ChatMessage>["setMessages"],
	regenerate: UseChatHelpers<ChatMessage>["regenerate"],
	setMode: Dispatch<SetStateAction<"view" | "edit">>,
): React.ReactNode {
	return (
		<div className="flex w-full flex-row items-start gap-3" key={partKey}>
			<div className="size-8" />
			<div className="min-w-0 flex-1">
				<MessageEditor
					key={message.id}
					message={message}
					regenerate={regenerate}
					setMessages={setMessages}
					setMode={setMode}
				/>
			</div>
		</div>
	);
}

function renderWeatherToolPart(
	part: Extract<ChatMessage["parts"][number], { type: "tool-getWeather" }>,
): React.ReactNode {
	const { toolCallId, state } = part;
	return (
		<Tool defaultOpen={true} key={toolCallId}>
			<ToolHeader state={state} type="tool-getWeather" />
			<ToolContent>
				{state === "input-available" && <ToolInput input={part.input} />}
				{state === "output-available" && (
					<ToolOutput
						errorText={undefined}
						output={<Weather weatherAtLocation={part.output} />}
					/>
				)}
			</ToolContent>
		</Tool>
	);
}

const PurePreviewMessage = ({
	chatId,
	message,
	vote,
	isLoading,
	setMessages,
	regenerate,
	isReadonly,
	requiresScrollPadding: _requiresScrollPadding,
}: {
	chatId: string;
	message: ChatMessage;
	vote: Vote | undefined;
	isLoading: boolean;
	setMessages: UseChatHelpers<ChatMessage>["setMessages"];
	regenerate: UseChatHelpers<ChatMessage>["regenerate"];
	isReadonly: boolean;
	requiresScrollPadding: boolean;
}) => {
	const [mode, setMode] = useState<"view" | "edit">("view");

	const attachmentsFromMessage = message.parts.filter(
		(part) => part.type === "file",
	);

	useDataStream();

	return (
		<div
			className="group/message fade-in w-full animate-in duration-200"
			data-role={message.role}
			data-testid={`message-${message.role}`}
		>
			<div
				className={cn("flex w-full items-start gap-2 md:gap-3", {
					"justify-end": message.role === "user" && mode !== "edit",
					"justify-start": message.role === "assistant",
				})}
			>
				{message.role === "assistant" && (
					<div className="-mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-background ring-1 ring-border">
						<SparklesIcon size={14} />
					</div>
				)}

				<div
					className={cn("flex flex-col", {
						"gap-2 md:gap-4": message.parts?.some(
							(p) => p.type === "text" && p.text?.trim(),
						),
						"w-full":
							(message.role === "assistant" &&
								message.parts?.some(
									(p) => p.type === "text" && p.text?.trim(),
								)) ||
							mode === "edit",
						"max-w-[calc(100%-2.5rem)] sm:max-w-[min(fit-content,80%)]":
							message.role === "user" && mode !== "edit",
					})}
				>
					{attachmentsFromMessage.length > 0 && (
						<div
							className="flex flex-row justify-end gap-2"
							data-testid={"message-attachments"}
						>
							{attachmentsFromMessage.map((attachment) => (
								<PreviewAttachment
									attachment={{
										name: attachment.filename ?? "file",
										contentType: attachment.mediaType,
										url: attachment.url,
									}}
									key={attachment.url}
								/>
							))}
						</div>
					)}

					{message.parts?.map((part, index) => {
						const { type } = part;
						const key = `message-${message.id}-part-${index}`;

						if (type === "reasoning") {
							return renderReasoningPart(part, key, isLoading);
						}

						if (type === "text") {
							if (mode === "view") {
								return renderTextPartView(part, key, message.role);
							}
							if (mode === "edit") {
								return renderTextPartEdit(
									key,
									message,
									setMessages,
									regenerate,
									setMode,
								);
							}
						}

						if (type === "tool-getWeather") {
							return renderWeatherToolPart(part);
						}

						return null;
					})}

					{!isReadonly && (
						<MessageActions
							chatId={chatId}
							isLoading={isLoading}
							key={`action-${message.id}`}
							message={message}
							setMode={setMode}
							vote={vote}
						/>
					)}
				</div>
			</div>
		</div>
	);
};

export const PreviewMessage = memo(
	PurePreviewMessage,
	(prevProps, nextProps) => {
		if (prevProps.isLoading !== nextProps.isLoading) {
			return false;
		}
		if (prevProps.message.id !== nextProps.message.id) {
			return false;
		}
		if (prevProps.requiresScrollPadding !== nextProps.requiresScrollPadding) {
			return false;
		}
		if (!equal(prevProps.message.parts, nextProps.message.parts)) {
			return false;
		}
		if (!equal(prevProps.vote, nextProps.vote)) {
			return false;
		}

		return false;
	},
);

export const ThinkingMessage = () => {
	return (
		<div
			className="group/message fade-in w-full animate-in duration-300"
			data-role="assistant"
			data-testid="message-assistant-loading"
		>
			<div className="flex items-start justify-start gap-3">
				<div className="-mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-background ring-1 ring-border">
					<div className="animate-pulse">
						<SparklesIcon size={14} />
					</div>
				</div>

				<div className="flex w-full flex-col gap-2 md:gap-4">
					<div className="flex items-center gap-1 p-0 text-muted-foreground text-sm">
						<span className="animate-pulse">Thinking</span>
						<span className="inline-flex">
							<span className="animate-bounce [animation-delay:0ms]">.</span>
							<span className="animate-bounce [animation-delay:150ms]">.</span>
							<span className="animate-bounce [animation-delay:300ms]">.</span>
						</span>
					</div>
				</div>
			</div>
		</div>
	);
};
