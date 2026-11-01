import js from "@eslint/js";
import tseslint from "typescript-eslint";
import hooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  { ignores: ["dist/**", "src-tauri/**", "node_modules/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": hooks },
    rules: hooks.configs.recommended.rules,
  },
  {
    files: ["scripts/*.mjs"],
    languageOptions: {
      globals: {
        process: "readonly",
        fetch: "readonly",
        console: "readonly",
        AbortSignal: "readonly",
        setTimeout: "readonly",
        URL: "readonly",
      },
    },
  },
);
