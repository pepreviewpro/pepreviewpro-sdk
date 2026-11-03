import type { LanguageModel } from "ai";
import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";

type StreamPart = Awaited<ReturnType<MockLanguageModelV4["doStream"]>>["stream"] extends ReadableStream<infer Part> ? Part : never;

const usage = {
	inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
	outputTokens: { total: 0, text: 0, reasoning: 0 }
};

const callTool: StreamPart[] = [
	{ type: "stream-start", warnings: [] },
	{ type: "tool-call", toolCallId: "call-1", toolName: "find_vendors", input: JSON.stringify({ compound: "bpc-157", ships_to: "CA" }) },
	{ type: "finish", finishReason: { unified: "tool-calls", raw: "tool_calls" }, usage }
];

const answer: StreamPart[] = [
	{ type: "stream-start", warnings: [] },
	{ type: "text-start", id: "answer" },
	{ type: "text-delta", id: "answer", delta: "Here are the stores that ship BPC-157 to Canada." },
	{ type: "text-end", id: "answer" },
	{ type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage }
];

/** Asks `find_vendors` for BPC-157 shipped to Canada, then answers in one sentence: the example's tests, without a model key. */
function scriptedModel(): LanguageModel {
	return new MockLanguageModelV4({
		doStream: async ({ prompt }) => ({
			stream: simulateReadableStream({
				initialDelayInMs: null,
				chunkDelayInMs: null,
				chunks: prompt.some((message) => message.role === "tool") ? answer : callTool
			})
		})
	});
}

/** The chat route's model. Any AI SDK model works; `EXAMPLE_SCRIPTED_MODEL=1` swaps in the scripted one the tests use. */
export const model: LanguageModel = process.env.EXAMPLE_SCRIPTED_MODEL === "1" ? scriptedModel() : "openai/gpt-5-mini";
