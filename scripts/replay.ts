import { spawn } from "node:child_process";
import { parseArgs } from "node:util";
import { startReplayServer } from "../test/replayServer";

/**
 * Starts the replay server, then runs a command with `PEPREVIEWPRO_BASE_URL` pointing at it and exits with the
 * command's code: `pnpm replay -- pnpm --filter next-app-router build`. With no command it serves until stopped.
 */
const { values, positionals } = parseArgs({
	allowPositionals: true,
	options: { port: { type: "string", default: "4010" }, runtime: { type: "string" } }
});
const server = await startReplayServer({ port: Number(values.port), runtimeFile: values.runtime });
console.log(`Replaying recorded responses at ${server.url}`);
const [command, ...args] = positionals;
if (command) {
	const child = spawn(command, args, { stdio: "inherit", env: { ...process.env, PEPREVIEWPRO_BASE_URL: server.url } });
	child.on("exit", async (code) => {
		await server.close();
		process.exit(code ?? 1);
	});
}
