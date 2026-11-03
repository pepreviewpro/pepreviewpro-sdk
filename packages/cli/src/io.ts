export interface Prompt {
	ask(question: string): Promise<string>;
	/** Like `ask`, without echoing what is typed. */
	askSecret(question: string): Promise<string>;
	confirm(question: string): Promise<boolean>;
}

/** Everything a command touches outside itself, so tests can run commands without a terminal or network. */
export interface Io {
	cwd: string;
	env: Record<string, string | undefined>;
	out: (line: string) => void;
	err: (line: string) => void;
	interactive: boolean;
	prompt: Prompt;
	readStdin: () => Promise<string>;
	fetch?: typeof fetch | undefined;
	now: () => number;
}
