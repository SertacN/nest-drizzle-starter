const UNIT_MS: Record<string, number> = {
	s: 1000,
	m: 60 * 1000,
	h: 60 * 60 * 1000,
	d: 24 * 60 * 60 * 1000,
};

/**
 * Turns a jsonwebtoken-style duration ('15m', '30d', '3600') into milliseconds.
 *
 * Used so the cookie's Max-Age and the JWT's own expiry come from a SINGLE env value — set
 * them separately and you eventually get a cookie that outlives its token, or the reverse.
 */
export function durationToMs(value: string): number {
	const match = /^(\d+)\s*(s|m|h|d)?$/i.exec(value.trim());
	if (!match) throw new Error(`invalid duration: ${value}`);
	const unit = match[2]?.toLowerCase() ?? 's';
	return Number(match[1]) * UNIT_MS[unit];
}
