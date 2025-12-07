import tseslint from "typescript-eslint";
import globals from "globals";

/** @type {import("eslint").FlatConfig[]} */
export default [
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  // Enable ESLint for TypeScript and JavaScript files
  {
    files: ["**/*.{js,mjs,cjs,ts}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
      globals: globals.node,
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      // Custom rules
      "no-unused-vars": "off",
      "no-console": "warn",
      semi: ["error", "always"],
      strict: ["error", "global"],
      "no-undef": "off",
      "no-mixed-spaces-and-tabs": "error",
      "prefer-const": "warn",
      "no-trailing-spaces": "warn",
      "no-use-before-define": "error",
      "no-unused-expressions": "error",
      eqeqeq: "error",
      "no-else-return": "error",
      "no-empty-function": "error",
      "block-scoped-var": "error",
      "@typescript-eslint/no-empty-interface": "off",
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/explicit-function-return-type": "off",
    },
  },
];
