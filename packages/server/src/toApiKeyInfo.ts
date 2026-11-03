import type { MeResponse } from "@pepreviewpro/core";
import type { ApiKeyInfo } from "./directoryTypes";

export function toApiKeyInfo({ key, limits }: MeResponse): ApiKeyInfo {
	return {
		key: { id: key.id, prefix: key.key_prefix, type: key.key_type, scopes: key.scopes },
		limits: {
			ratePerSecond: limits.rate_per_second,
			monthlyQuota: limits.monthly_quota,
			usedThisMonth: limits.used_this_month,
			remainingThisMonth: limits.remaining_this_month
		}
	};
}
