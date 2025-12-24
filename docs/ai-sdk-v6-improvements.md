# AI SDK v6 Improvements

This document summarizes the AI SDK v6 features implemented in this codebase and how to use them effectively.

## Overview

AI SDK v6 introduces several improvements for building production AI applications:
- **DevTools** for debugging LLM calls
- **Tool enhancements** (strict mode, input examples, `toModelOutput`)
- **ToolLoopAgent** abstraction for reusable agents
- **Call options** for type-safe per-request configuration
- **Extended usage tracking** for cost optimization

## 1. DevTools Middleware

### Reason for Change
Debugging multi-step agent flows is difficult. A small change in context can cascade through steps, making it hard to trace issues. DevTools provides full visibility into LLM calls.

### Implementation
DevTools middleware is conditionally applied to all models in development mode.

**File:** `lib/ai/providers.ts`

```typescript
import { devToolsMiddleware } from "@ai-sdk/devtools";

// Applied to each model when isDevelopmentEnvironment is true
wrapLanguageModel({
  model: openai.languageModel("gpt-5-mini"),
  middleware: isDevelopmentEnvironment ? devToolsMiddleware() : [],
}),
```

### Usage
1. Start your dev server: `pnpm dev`
2. In a separate terminal, run: `npx @ai-sdk/devtools`
3. Open http://localhost:4983 to inspect:
   - Input parameters and prompts
   - Output content and tool calls
   - Token usage and timing
   - Raw provider data

## 2. Tool Strict Mode

### Reason for Change
When available, native strict mode from LLM providers guarantees tool call inputs match your schema exactly. This prevents subtle runtime errors from malformed inputs.

### Implementation
**Files:** `lib/ai/tools/get-weather.ts`, `lib/ai/tools/list-upcoming-events.ts`

```typescript
export const getWeather = tool({
  description: "Get the current weather...",
  inputSchema: z.object({ /* ... */ }),
  strict: true,  // Enables provider-level schema validation
  execute: async (input) => { /* ... */ },
});
```

### Benefits
- Guaranteed schema compliance from providers that support it
- Reduced error handling code in tool implementations
- Better error messages when inputs don't match

## 3. Input Examples

### Reason for Change
Complex tool schemas can be difficult for models to understand from descriptions alone. Input examples show the model concrete instances of correctly structured input.

### Implementation
```typescript
export const getWeather = tool({
  description: "Get the current weather...",
  inputSchema: z.object({ /* ... */ }),
  inputExamples: [
    { input: { city: "San Francisco" } },
    { input: { city: "New York" } },
    { input: { latitude: 51.5074, longitude: -0.1278 } },
  ],
  execute: async (input) => { /* ... */ },
});
```

### Benefits
- Better tool calling accuracy, especially with Claude models
- Clarifies ambiguous input patterns
- Reduces prompt engineering in tool descriptions

### Note
Input examples are natively supported by Anthropic. For other providers, use `addToolInputExamplesMiddleware` to append examples to the tool description.

## 4. toModelOutput for Token Optimization

### Reason for Change
By default, tool results are sent back to the model as stringified JSON. For tools returning large payloads (weather API responses, event lists), this wastes tokens on data the model doesn't need for its response.

### Implementation
**File:** `lib/ai/tools/get-weather.ts`

```typescript
export const getWeather = tool({
  execute: async (input) => weatherData,  // Full data for UI
  toModelOutput: async ({ input, output }) => {
    // Concise summary for the model (saves tokens)
    return {
      type: "text",
      value: `Weather in ${input.city}: ${output.current?.temperature_2m}°C`,
    };
  },
});
```

**File:** `lib/ai/tools/list-upcoming-events.ts`

```typescript
export const listUpcomingEvents = tool({
  execute: async () => events,  // Full event payload for UI cards
  toModelOutput: async ({ output }) => {
    // Summarized list for model context
    const summaries = output.events.map(e =>
      `- ${e.title} on ${e.date} in ${e.venue.city}`
    ).join("\n");
    return { type: "text", value: summaries };
  },
});
```

### Benefits
- **Reduced token usage**: Model receives only what it needs to formulate a response
- **Full data for UI**: The `execute` return value is still available for rendering rich UI components
- **Cost savings**: Particularly significant for tools returning large payloads

## 5. ToolLoopAgent Abstraction

### Reason for Change
When reusing the same agent configuration across different endpoints (chat UI, background jobs, API endpoints), passing the same configuration everywhere breaks down. The agent abstraction provides a clean, reusable definition.

### Implementation
**File:** `lib/ai/agents/chat-agent.ts`

```typescript
import { ToolLoopAgent, InferAgentUIMessage, stepCountIs } from "ai";

export const chatAgent = new ToolLoopAgent({
  model: myProvider.languageModel("chat-model"),
  instructions: "",
  tools: { getWeather, listUpcomingEvents },
  stopWhen: stepCountIs(5),
  callOptionsSchema: chatAgentCallOptionsSchema,
  prepareCall: ({ options, ...settings }) => ({
    ...settings,
    model: myProvider.languageModel(options.selectedChatModel),
    instructions: systemPrompt({
      selectedChatModel: options.selectedChatModel,
      requestHints: options.requestHints,
    }),
  }),
});

export type ChatAgentUIMessage = InferAgentUIMessage<typeof chatAgent>;
```

### Usage

**For simple endpoints:**
```typescript
import { createAgentUIStreamResponse } from "ai";
import { chatAgent } from "@/lib/ai/agents/chat-agent";

export async function POST(request: Request) {
  const { messages, selectedChatModel, requestHints } = await request.json();
  return createAgentUIStreamResponse({
    agent: chatAgent,
    uiMessages: messages,
    options: { selectedChatModel, requestHints },
  });
}
```

**For complex endpoints (current implementation):**
The chat route uses `streamText` directly for custom business logic (database persistence, token tracking, resumable streams) while importing tools from the same source the agent uses.

### Benefits
- **Reusability**: Define once, use across multiple endpoints
- **Type safety**: `InferAgentUIMessage` provides typed tool invocations for UI
- **Clean organization**: Tools, agents, and routes are cleanly separated

## 6. Type-Safe Call Options

### Reason for Change
Passing configuration through request bodies loses type safety. Call options provide a typed contract for per-request customization.

### Implementation
```typescript
export const chatAgentCallOptionsSchema = z.object({
  selectedChatModel: z.enum(["chat-model", "chat-model-reasoning"]),
  requestHints: z.object({
    latitude: z.union([z.string(), z.undefined()]),
    longitude: z.union([z.string(), z.undefined()]),
    city: z.union([z.string(), z.undefined()]),
    country: z.union([z.string(), z.undefined()]),
  }),
});

export const chatAgent = new ToolLoopAgent({
  callOptionsSchema: chatAgentCallOptionsSchema,
  prepareCall: ({ options, ...settings }) => ({
    ...settings,
    model: myProvider.languageModel(options.selectedChatModel),
    instructions: systemPrompt({
      selectedChatModel: options.selectedChatModel,
      requestHints: options.requestHints,
    }),
  }),
});
```

### Benefits
- **Type safety**: Options are validated at compile time
- **Dynamic configuration**: Model selection, system prompts, and tool behavior can vary per request
- **Clean API**: Callers pass structured options rather than ad-hoc parameters

## 7. Extended Usage Information

### Reason for Change
Understanding token usage helps optimize costs. AI SDK v6 provides detailed breakdowns including cache hits, reasoning tokens, and raw provider data.

### Implementation
**File:** `lib/usage.ts`

```typescript
export type ExtendedUsageDetails = {
  inputTokenDetails?: {
    noCacheTokens?: number;
    cacheReadTokens?: number;     // Anthropic prompt caching
    cacheWriteTokens?: number;
  };
  outputTokenDetails?: {
    textTokens?: number;
    reasoningTokens?: number;     // Claude thinking, o1 reasoning
  };
  rawFinishReason?: string;       // Provider-specific finish reason
};
```

**File:** `app/(chat)/api/chat/route.ts`

```typescript
onFinish: async ({ usage, rawFinishReason }) => {
  const extendedUsage = {
    ...usage,
    rawFinishReason,
    // inputTokenDetails and outputTokenDetails included automatically
  };
  // Merge with TokenLens cost data and send to client
},
```

### Benefits
- **Cost visibility**: See cache hits vs. misses for Anthropic prompt caching
- **Reasoning tracking**: Monitor reasoning token usage for Claude/o1 models
- **Debugging**: `rawFinishReason` shows provider-specific stop reasons

## File Changes Summary

| File | Changes |
|------|---------|
| `lib/ai/providers.ts` | Added DevTools middleware for development |
| `lib/ai/tools/get-weather.ts` | Added `strict`, `inputExamples`, `toModelOutput` |
| `lib/ai/tools/list-upcoming-events.ts` | Added `strict`, `inputExamples`, `toModelOutput` |
| `lib/ai/agents/chat-agent.ts` | New file: ToolLoopAgent with call options |
| `lib/usage.ts` | Extended type with v6 usage details |
| `app/(chat)/api/chat/route.ts` | Updated imports, added `rawFinishReason` tracking |

## Future Improvements

Consider these additional v6 features for future iterations:

1. **Tool Execution Approval**: Add `needsApproval: true` to tools that perform actions (RSVP, purchases)
2. **Anthropic Provider Tools**: Use `anthropic.tools.codeExecution_20250825()` for sandboxed code execution
3. **Reranking**: Add `rerank()` for RAG use cases to improve context relevance
4. **MCP Integration**: Connect to Model Context Protocol servers for expanded tool access
