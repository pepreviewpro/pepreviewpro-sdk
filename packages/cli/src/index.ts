#!/usr/bin/env node
import { text } from "node:stream/consumers";
import { main } from "./main";
import { terminalPrompt } from "./terminalPrompt";

const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);
process.exitCode = await main(process.argv.slice(2), {
	cwd: process.cwd(),
	env: process.env,
	out: (line) => console.log(line),
	err: (line) => console.error(line),
	interactive,
	prompt: terminalPrompt(),
	readStdin: () => (process.stdin.isTTY ? Promise.resolve("") : text(process.stdin)),
	now: Date.now
});
