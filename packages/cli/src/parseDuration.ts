const UNITS: Record<string, number> = { m: 60_000, h: 3_600_000, d: 86_400_000 };

/** `30m`, `48h`, or `7d` in milliseconds. Throws on anything else. */
export function parseDuration(value: string): number {
	const match = value.trim().match(/^(\d+)([mhd])$/);
	const unit = match?.[2] ? UNITS[match[2]] : undefined;
	if (!match || unit === undefined || Number(match[1]) <= 0) {
		throw new Error(`Use a window like 30m, 48h, or 7d, not "${value}".`);
	}

	return Number(match[1]) * unit;
}
