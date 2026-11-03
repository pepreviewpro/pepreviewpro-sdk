/**
 * Every item of a cursor-paged list, one page at a time: fetches the next page only when the loop reaches it, and
 * stops when `nextCursor` is null. Breaking out of the loop stops the fetching.
 */
export async function* paginate<Item>(
	fetchPage: (cursor: string | null) => Promise<{ items: Item[]; nextCursor: string | null }>,
	cursor: string | null = null
): AsyncGenerator<Item, void, undefined> {
	let next: string | null = cursor;
	do {
		const page = await fetchPage(next);
		yield* page.items;
		next = page.nextCursor;
	} while (next);
}
