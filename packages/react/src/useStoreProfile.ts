"use client";
import { PepReviewProClient, type StoreProfileResponse } from "@pepreviewpro/core";
import { useEffect, useState } from "react";
import { usePepReviewPro } from "./usePepReviewPro";

export interface StoreProfileState {
	profile: Pick<StoreProfileResponse, "store" | "widget_settings"> | null;
	loading: boolean;
	/** A store whose public page is off answers `Store profile is not public`. */
	error: Error | null;
}

/** The store's public branding: name, logos, banner, accent color, and description. */
export function useStoreProfile({ store }: { store?: string | undefined } = {}): StoreProfileState {
	const settings = usePepReviewPro();
	const slug = store ?? settings.store;
	const [state, setState] = useState<StoreProfileState>({ profile: null, loading: Boolean(slug), error: null });
	useEffect(() => {
		if (!slug) {
			setState({ profile: null, loading: false, error: new Error("Pass store, or render inside <PepReviewProProvider store>.") });
			return;
		}

		let current = true;
		new PepReviewProClient({ baseUrl: settings.baseUrl }).storeProfile({ site_id: slug }).then(
			({ store: profile, widget_settings }) => current && setState({ profile: { store: profile, widget_settings }, loading: false, error: null }),
			(error: unknown) => current && setState({ profile: null, loading: false, error: error instanceof Error ? error : new Error(String(error)) })
		);
		return () => {
			current = false;
		};
	}, [slug, settings.baseUrl]);
	return state;
}
