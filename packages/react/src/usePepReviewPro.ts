"use client";
import { DEFAULT_BASE_URL } from "@pepreviewpro/core";
import { useContext } from "react";
import { PepReviewProContext, type PepReviewProSettings } from "./PepReviewProContext";

const DEFAULTS: PepReviewProSettings = { store: undefined, theme: undefined, baseUrl: DEFAULT_BASE_URL, tracking: {} };

/** The provider's store, theme, base URL, and tracking consent, or the defaults outside one. */
export function usePepReviewPro(): PepReviewProSettings {
	return useContext(PepReviewProContext) ?? DEFAULTS;
}
