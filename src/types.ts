export interface KnowledgeGraph {
  nodes: string[];
  edges: GraphEdge[];
}

export interface GraphEdge {
  from: string;
  to: string;
  relation: string;
}

export interface PluginConfig {
  enabled: boolean;
  debounceMs?: number;
  autoExtract?: boolean;
  autoInject?: boolean;
}

export interface KnowledgeStats {
  hasGlobalIndex: boolean;
  moduleCount: number;
  modules: string[];
}
