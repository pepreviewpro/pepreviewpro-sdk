import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import type { Prompt } from "./io";

/** Prompts on the terminal. `askSecret` writes the question but none of the typed characters. */
export function terminalPrompt(): Prompt {
	const ask = async (question: string, muted = false) => {
		let mute = false;
		const output = new Writable({
			write(chunk, encoding, callback) {
				if (!mute) {
					process.stdout.write(chunk, encoding);
				}

				callback();
			}
		});
		const readline = createInterface({ input: process.stdin, output, terminal: true });
		try {
			const answer = readline.question(question);
			mute = muted;
			const value = await answer;
			if (muted) {
				process.stdout.write("\n");
			}

			return value.trim();
		} finally {
			readline.close();
		}
	};

	return {
		ask: (question) => ask(question),
		askSecret: (question) => ask(question, true),
		confirm: async (question) => /^y(es)?$/i.test(await ask(question))
	};
}
