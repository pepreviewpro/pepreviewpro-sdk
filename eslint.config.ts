import importXPlugin from "eslint-plugin-import-x";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig([
	{
		files: ["**/*.{ts,tsx,mts,js,mjs}"],
		languageOptions: {
			parser: tseslint.parser
		},
		plugins: {
			"import-x": importXPlugin,
			"@typescript-eslint": tseslint.plugin
		},
		rules: {
			"curly": ["error", "all"],
			"import-x/first": "error",
			"@typescript-eslint/consistent-type-imports": "error",
			"@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
			"padding-line-between-statements": [
				"error",
				{ blankLine: "never", prev: "*", next: "block-like" },
				{ blankLine: "never", prev: "*", next: "return" },
				{ blankLine: "always", prev: "block-like", next: "*" },
				{ blankLine: "any", prev: "*", next: "function" },
				{ blankLine: "any", prev: "function", next: "*" },
				{ blankLine: "any", prev: "*", next: "export" },
				{ blankLine: "any", prev: "export", next: "*" },
				{ blankLine: "always", prev: "import", next: "*" },
				{ blankLine: "never", prev: "import", next: "import" },
				{ blankLine: "never", prev: "directive", next: "import" }
			]
		}
	},
	globalIgnores([
		"**/dist/**",
		"**/node_modules/**",
		"coverage/**",
		"**/.next/**",
		"**/.astro/**",
		"**/.react-router/**",
		"**/build/**",
		"docs/api/**",
		"test-results/**",
		"playwright-report/**",
		".snippets/**"
	])
]);
