/**
 * A 0 to 5 rating to one decimal, rounding halves up, as the widgets print it. `toFixed(1)` alone rounds 4.85 down
 * to 4.8 because the float is really 4.8499…
 */
export function roundRating(rating: number): number {
	return Math.round(rating * 10) / 10;
}
