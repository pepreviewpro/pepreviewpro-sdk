import type { ImportCheckpoint } from "@pepreviewpro/server";
import { readFile, rm, stat, writeFile } from "node:fs/promises";

interface SavedCheckpoint extends ImportCheckpoint {
	store: string;
	size: number;
	mtimeMs: number;
}

/** Where `import-orders` keeps its place: beside the source file, so a second run of the same command resumes. */
export function checkpointPath(file: string): string {
	return `${file}.pepreviewpro-checkpoint.json`;
}

/** The saved place for this file and store, or null when there is none or the file has changed since. */
export async function readCheckpoint(file: string, store: string): Promise<ImportCheckpoint | null> {
	try {
		const saved = JSON.parse(await readFile(checkpointPath(file), "utf8")) as SavedCheckpoint;
		const { size, mtimeMs } = await stat(file);
		return saved.store === store && saved.size === size && saved.mtimeMs === mtimeMs ? { processed: saved.processed } : null;
	} catch {
		return null;
	}
}

export async function writeCheckpoint(file: string, store: string, checkpoint: ImportCheckpoint): Promise<void> {
	const { size, mtimeMs } = await stat(file);
	const saved: SavedCheckpoint = { store, size, mtimeMs, processed: checkpoint.processed };
	await writeFile(checkpointPath(file), `${JSON.stringify(saved)}\n`);
}

export async function removeCheckpoint(file: string): Promise<void> {
	await rm(checkpointPath(file), { force: true });
}
