"use client";
import type { TrackingOptions } from "@pepreviewpro/browser";
import { createContext } from "react";
import type { Theme } from "./types";

export interface PepReviewProSettings {
	store: string | undefined;
	theme: Theme | undefined;
	baseUrl: string;
	tracking: TrackingOptions;
}

export const PepReviewProContext = createContext<PepReviewProSettings | null>(null);
