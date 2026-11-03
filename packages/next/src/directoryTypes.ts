import type { DirectoryProductsOptions, DirectoryReviewsOptions, DirectoryStoresOptions } from "@pepreviewpro/server";

/** Plain values only, since the cached readers key their entries on them. */
export type DirectoryStoresQuery = Omit<DirectoryStoresOptions, "signal">;
export type DirectoryProductsQuery = Omit<DirectoryProductsOptions, "signal">;
export type DirectoryReviewsQuery = Omit<DirectoryReviewsOptions, "signal">;
