import type { PluginInput } from "@opencode-ai/plugin";

let pluginInput: PluginInput | null = null;

export function setPluginInput(input: PluginInput): void {
  pluginInput = input;
}

export function getPluginInput(): PluginInput {
  if (!pluginInput) {
    throw new Error('[smart-codebase] Plugin not initialized');
  }
  return pluginInput;
}
