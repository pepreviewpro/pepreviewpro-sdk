import ts from "typescript";

/** Which hand-written response type in `packages/core/src/types.ts` describes each endpoint the SDK calls. */
export const RESPONSE_TYPES: Record<string, string> = {
	"/api/v1/orders": "OrdersResponse",
	"/api/v1/catalog": "CatalogResponse",
	"/api/v1/heartbeat": "HeartbeatResponse",
	"/api/v1/widget-data": "WidgetDataResponse",
	"/api/v1/store-profile": "StoreProfileResponse",
	"/api/v1/submit-review": "SubmitReviewResponse",
	"/api/v1/my-stores": "MyStoresResponse",
	"/api/v1/my-reviews": "MyReviewsResponse",
	"/api/v1/stores": "StoresResponse",
	"/api/v1/products": "ProductsResponse",
	"/api/v1/reviews": "DirectoryReviewsResponse",
	"/api/v1/vendor-miss": "VendorMissResponse",
	"/api/v1/partner-events": "PartnerEventsResponse",
	"/api/v1/me": "MeResponse"
};

/** Which query type lists the params the SDK sends to each GET endpoint. */
const QUERY_TYPES: Record<string, string> = {
	"/api/v1/widget-data": "WidgetDataQuery",
	"/api/v1/my-stores": "MyStoresQuery",
	"/api/v1/my-reviews": "MyReviewsQuery",
	"/api/v1/stores": "StoresQuery",
	"/api/v1/products": "ProductsQuery",
	"/api/v1/reviews": "DirectoryReviewsQuery"
};

export interface ExportedEndpoint {
	path: string;
	params?: { name: string }[];
	response: unknown;
}

export interface CheckReport {
	/** A required field the SDK declares that the documented example does not have. CI fails on these. */
	errors: string[];
	/** Optional fields missing from an example, fields under a null or empty example value, and undocumented params. */
	warnings: string[];
}

type Declared = Map<string, { optional: boolean }>;

/** Every field path a type declares, like `results[].numeric_id`, and whether it or a parent is optional. */
function declaredPaths(checker: ts.TypeChecker, type: ts.Type, prefix: string, optional: boolean, out: Declared, depth = 0): void {
	const nonNull = checker.getNonNullableType(type);
	if (depth > 6) {
		return;
	}

	if (checker.isArrayType(nonNull)) {
		const [element] = checker.getTypeArguments(nonNull as ts.TypeReference);
		if (element) {
			declaredPaths(checker, element, `${prefix}[]`, optional, out, depth + 1);
		}

		return;
	}

	if (!(nonNull.flags & ts.TypeFlags.Object) || nonNull.isUnion()) {
		return;
	}

	for (const property of checker.getPropertiesOfType(nonNull)) {
		const path = prefix ? `${prefix}.${property.name}` : property.name;
		const isOptional = optional || (property.flags & ts.SymbolFlags.Optional) !== 0;
		out.set(path, { optional: isOptional });
		const declaration = property.valueDeclaration ?? property.declarations?.[0];
		if (declaration) {
			declaredPaths(checker, checker.getTypeOfSymbolAtLocation(property, declaration), path, isOptional, out, depth + 1);
		}
	}
}

/** Every field path in an example value. Paths whose value is null or an empty list are also kept apart: what is under them can't be checked. */
function examplePaths(value: unknown, prefix: string, present: Set<string>, opaque: Set<string>): void {
	if (Array.isArray(value)) {
		if (value.length === 0) {
			opaque.add(prefix);
		}

		for (const item of value) {
			examplePaths(item, `${prefix}[]`, present, opaque);
		}

		return;
	}

	if (value === null) {
		opaque.add(prefix);
		return;
	}

	if (typeof value !== "object") {
		return;
	}

	for (const [key, child] of Object.entries(value)) {
		const path = prefix ? `${prefix}.${key}` : key;
		present.add(path);
		examplePaths(child, path, present, opaque);
	}
}

const ancestors = (path: string) => path.split(".").map((_, index, parts) => parts.slice(0, index).join("."));

function loadTypes(typesFile: string) {
	const program = ts.createProgram([typesFile], { strict: true, noEmit: true, skipLibCheck: true });
	const source = program.getSourceFile(typesFile);
	if (!source) {
		throw new Error(`Cannot read ${typesFile}`);
	}

	const checker = program.getTypeChecker();
	const exports = checker.getExportsOfModule(checker.getSymbolAtLocation(source) as ts.Symbol);
	return (name: string): Declared => {
		const symbol = exports.find((item) => item.name === name);
		if (!symbol) {
			throw new Error(`${typesFile} exports no ${name}`);
		}

		const declared: Declared = new Map();
		declaredPaths(checker, checker.getDeclaredTypeOfSymbol(symbol), "", false, declared);
		return declared;
	};
}

/**
 * Checks the SDK's hand-written types against the app's `apiEndpoints`, exported as JSON. Fails on any required
 * field the SDK reads that the documented response example lacks: either the docs are behind or the API dropped it.
 */
export function checkApiTypes(endpoints: ExportedEndpoint[], typesFile: string): CheckReport {
	const report: CheckReport = { errors: [], warnings: [] };
	const declaredFor = loadTypes(typesFile);
	for (const [path, typeName] of Object.entries(RESPONSE_TYPES)) {
		const endpoint = endpoints.find((item) => item.path === path);
		if (!endpoint) {
			report.errors.push(`${path}: not in apiEndpoints, but the SDK calls it.`);
			continue;
		}

		const present = new Set<string>();
		const opaque = new Set<string>();
		examplePaths(endpoint.response, "", present, opaque);
		const missingOptional = new Set<string>();
		for (const [field, { optional }] of declaredFor(typeName)) {
			if (present.has(field) || ancestors(field).some((ancestor) => missingOptional.has(ancestor))) {
				continue;
			}

			const hidden = ancestors(field).find((ancestor) => opaque.has(ancestor) || opaque.has(`${ancestor}[]`));
			if (hidden !== undefined) {
				report.warnings.push(`${path}: ${field} can't be checked, the example's ${hidden || "body"} is null or empty.`);
			} else if (optional) {
				missingOptional.add(field);
				report.warnings.push(`${path}: optional ${field} is not in the example.`);
			} else {
				report.errors.push(`${path}: ${typeName}.${field} is not in the documented response.`);
			}
		}

		const queryType = QUERY_TYPES[path];
		if (queryType) {
			const documented = new Set((endpoint.params ?? []).map((param) => param.name));
			for (const [param] of declaredFor(queryType)) {
				if (!documented.has(param)) {
					report.warnings.push(`${path}: the SDK sends ${param}, which the docs do not list.`);
				}
			}
		}
	}

	return report;
}
