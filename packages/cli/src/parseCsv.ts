/**
 * RFC 4180 CSV as rows of strings: quoted fields may hold commas, newlines, and doubled quotes. Accepts CRLF or LF
 * and a leading byte order mark. Small enough to keep the CLI free of dependencies.
 */
export function parseCsv(text: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = "";
	let quoted = false;
	const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
	for (let index = 0; index < input.length; index++) {
		const char = input[index];
		if (quoted) {
			if (char === '"' && input[index + 1] === '"') {
				field += '"';
				index++;
			} else if (char === '"') {
				quoted = false;
			} else {
				field += char;
			}

			continue;
		}

		if (char === '"') {
			quoted = true;
		} else if (char === ",") {
			row.push(field);
			field = "";
		} else if (char === "\n" || char === "\r") {
			if (char === "\r" && input[index + 1] === "\n") {
				index++;
			}

			row.push(field);
			rows.push(row);
			row = [];
			field = "";
		} else {
			field += char;
		}
	}

	if (field !== "" || row.length > 0) {
		row.push(field);
		rows.push(row);
	}

	return rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
}
