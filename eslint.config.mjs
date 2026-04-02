import llmCore from "eslint-plugin-llm-core";
import tseslint from "typescript-eslint";

export default [
  ...tseslint.configs.recommended,
  ...llmCore.configs.recommended,
];
