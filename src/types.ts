export interface PluginConfig {
  enabled: boolean;
  debounceMs?: number;
  autoExtract?: boolean;
  autoInject?: boolean;
  disabledCommands?: string[];
}

export interface KnowledgeStats {
  hasGlobalIndex: boolean;
  moduleCount: number;
  modules: string[];
}
