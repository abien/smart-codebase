/**
 * Core type definitions for smart-codebase plugin
 * Defines knowledge representation, storage, and indexing structures
 */

/**
 * Represents a single knowledge fact extracted from a task
 * 
 * A fact is the atomic unit of knowledge in the system.
 * It captures what was learned, where it came from, and how to find it again.
 */
export interface Fact {
  /** Unique identifier (UUID) for this fact */
  id: string;

  /** ISO 8601 timestamp when this fact was created */
  timestamp: string;

  /** Topic/subject of the knowledge (e.g., "Order Status Flow", "Money Formatting") */
  subject: string;

  /** The actual knowledge content - what was learned */
  fact: string;

  /** Code references in format "file:line-line" (e.g., "src/store/order.ts:45-52") */
  citations: string[];

  /** Importance level for prioritization during injection */
  importance: 'high' | 'medium' | 'low';

  /** Source of learning - typically the task description or session context */
  learned_from: string;

  /** IDs of related facts (optional, populated during knowledge linking) */
  related_facts?: string[];

  /** Keywords for retrieval and matching (e.g., ["order", "status", "update"]) */
  keywords: string[];
}

/**
 * Represents an edge in the knowledge graph
 * Connects two facts with a semantic relationship
 */
export interface GraphEdge {
  /** ID of the source fact */
  from: string;

  /** ID of the target fact */
  to: string;

  /** Type of relationship (e.g., "related", "depends_on", "similar") */
  relation: string;
}

/**
 * Global knowledge graph structure
 * Maintains the network of all facts and their relationships
 */
export interface KnowledgeGraph {
  /** Array of all fact IDs in the graph */
  nodes: string[];

  /** Array of edges connecting facts */
  edges: GraphEdge[];
}

/**
 * Search index for fast keyword-based fact retrieval
 * Maps keywords to fact locations for efficient lookup
 */
export interface SearchIndex {
  /**
   * Keyword to fact locations mapping
   * Key: keyword (e.g., "order", "status")
   * Value: array of fact locations (e.g., ["src/order/.knowledge/facts.jsonl:fact-id-1"])
   */
  keywords: Record<string, string[]>;
}

/**
 * Plugin configuration options
 * Controls behavior of the smart-codebase plugin
 */
export interface PluginConfig {
  /** Whether the plugin is enabled */
  enabled: boolean;

  /** Maximum number of relevant facts to inject during context injection (default: 5) */
  maxRelevantFacts?: number;

  /** Debounce time in milliseconds for session.idle event (default: 30000) */
  debounceMs?: number;

  /** Whether to automatically extract knowledge on session idle (default: true) */
  autoExtract?: boolean;

  /** Whether to automatically inject knowledge when reading files (default: true) */
  autoInject?: boolean;
}
