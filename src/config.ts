import { join } from "path";
import { parse as parseJsonc } from "jsonc-parser";
import type { PluginConfig } from "./types";
import { fileExists, readTextFile } from "./utils/fs-compat";

const CONFIG_FILE_NAME = "smart-codebase.json";

const DEFAULT_CONFIG: PluginConfig = {
  enabled: true,
  debounceMs: 15000,
  autoExtract: true,
  autoInject: true,
  disabledCommands: [],
};

export async function loadConfig(projectRoot: string): Promise<PluginConfig> {
  const configPath = join(projectRoot, CONFIG_FILE_NAME);
  
  if (!await fileExists(configPath)) {
    return DEFAULT_CONFIG;
  }
  
  try {
    const content = await readTextFile(configPath);
    const userConfig = parseJsonc(content) as Partial<PluginConfig>;
    return { ...DEFAULT_CONFIG, ...userConfig };
  } catch (error) {
    console.error(`[smart-codebase] Failed to parse ${CONFIG_FILE_NAME}:`, error);
    return DEFAULT_CONFIG;
  }
}
