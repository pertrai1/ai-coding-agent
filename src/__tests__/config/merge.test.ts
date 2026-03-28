import { describe, expect, it } from "vitest";

import { mergeConfigs } from "../../config/merge.js";
import type { Config } from "../../config/types.js";

describe("mergeConfigs", () => {
  // Spec: config-hierarchy > Three-tier config file discovery > "No config files exist"
  it("returns an empty config when given an empty array", () => {
    const result = mergeConfigs([]);

    expect(result).toEqual({});
  });

  // Spec: config-hierarchy > Three-tier config file discovery > "Only project config exists"
  it("returns the single config when given one non-null entry", () => {
    const config: Config = { model: "claude-haiku-4-5-20250514" };

    const result = mergeConfigs([null, config, null]);

    expect(result).toEqual({ model: "claude-haiku-4-5-20250514" });
  });

  it("skips null entries in the array", () => {
    const result = mergeConfigs([null, null, null]);

    expect(result).toEqual({});
  });

  // Spec: config-hierarchy > Config merge order > "Local overrides global model"
  it("later scope overrides earlier scope for scalar values", () => {
    const global: Config = { model: "claude-sonnet-4-20250514" };
    const local: Config = { model: "claude-haiku-4-5-20250514" };

    const result = mergeConfigs([global, null, local]);

    expect(result.model).toBe("claude-haiku-4-5-20250514");
  });

  // Spec: config-hierarchy > Config merge order > "Permissions merge across scopes"
  it("shallow-merges permissions across scopes", () => {
    const global: Config = {
      permissions: { bash: "deny", write_file: "prompt" },
    };
    const project: Config = {
      permissions: { bash: "prompt" },
    };

    const result = mergeConfigs([global, project]);

    expect(result.permissions).toEqual({
      bash: "prompt",
      write_file: "prompt",
    });
  });

  // Spec: config-hierarchy > Config merge order > "Unset keys preserve earlier values"
  it("preserves earlier values for keys not set in later scopes", () => {
    const global: Config = {
      model: "claude-sonnet-4-20250514",
      systemPromptExtra: "Be helpful.",
    };
    const project: Config = {
      model: "claude-haiku-4-5-20250514",
    };

    const result = mergeConfigs([global, project]);

    expect(result.model).toBe("claude-haiku-4-5-20250514");
    expect(result.systemPromptExtra).toBe("Be helpful.");
  });

  // Three-tier full merge
  it("merges all three tiers with correct precedence", () => {
    const global: Config = {
      model: "claude-sonnet-4-20250514",
      systemPromptExtra: "global extra",
      permissions: { bash: "deny", glob: "allow" },
    };
    const project: Config = {
      permissions: { bash: "prompt", write_file: "prompt" },
    };
    const local: Config = {
      model: "claude-haiku-4-5-20250514",
    };

    const result = mergeConfigs([global, project, local]);

    expect(result.model).toBe("claude-haiku-4-5-20250514");
    expect(result.systemPromptExtra).toBe("global extra");
    expect(result.permissions).toEqual({
      bash: "prompt",
      glob: "allow",
      write_file: "prompt",
    });
  });
});
