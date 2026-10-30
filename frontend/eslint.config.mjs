import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * FSD dependency rule: a slice may only import from layers strictly below it,
 * and only through another slice's public API (`@/<layer>/<slice>`).
 * See .claude/skills/frontend-architecture/SKILL.md.
 *
 * ESLint replaces rule options rather than merging them, so every layer config
 * repeats the cross-slice bans.
 */
const layers = ["shared", "entities", "features", "widgets", "views", "app"];
const sliced = ["entities", "features", "widgets", "views"];

function boundaryConfig(layer) {
  const forbidden = layers.slice(layers.indexOf(layer) + 1);

  return {
    name: `nextnode/${layer}-layer-boundaries`,
    files: [`src/${layer}/**/*.{ts,tsx}`],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            ...forbidden.map((upper) => ({
              group: [`@/${upper}`, `@/${upper}/*`],
              message: `FSD: the ${layer} layer must not import from ${upper} (upper layer).`,
            })),
            ...sliced.map((lower) => ({
              group: [`@/${lower}/*/*`],
              message: `FSD: import ${lower} slices through their public API (@/${lower}/<slice>), not their internals.`,
            })),
            {
              group: ["../../*"],
              message:
                "FSD: reach other slices through their public API (@/<layer>/<slice>), not deep relative paths.",
            },
          ],
        },
      ],
    },
  };
}

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    name: "nextnode/size-limit",
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      // No frontend file may exceed 500 lines. Decompose instead of raising it.
      "max-lines": ["error", { max: 500, skipBlankLines: false, skipComments: false }],
    },
  },
  {
    name: "nextnode/env-access",
    files: ["src/**/*.{ts,tsx}"],
    // instrumentation.ts reads only Next's own NEXT_RUNTIME/NEXT_PHASE flags.
    ignores: ["src/shared/config/**", "src/instrumentation.ts"],
    rules: {
      "no-restricted-properties": [
        "error",
        {
          object: "process",
          property: "env",
          message: "Read environment variables only in src/shared/config.",
        },
      ],
    },
  },
  ...layers.map(boundaryConfig),
  globalIgnores([".next/**", ".next-e2e/**", "out/**", "build/**", "next-env.d.ts", "playwright-report/**", "test-results/**"]),
]);

export default eslintConfig;
