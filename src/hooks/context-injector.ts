/**
 * Context injection hook for smart-codebase plugin
 * Intercepts Read tool operations and injects relevant knowledge from .knowledge/facts.jsonl
 */

import type { PluginInput, Hooks } from "@opencode-ai/plugin";
import type { Event } from "@opencode-ai/sdk";
import { loadRelevantKnowledge } from "../storage/knowledge-loader";
import type { Fact, PluginConfig } from "../types";
import { basename, dirname, extname } from "path";

type ToolExecuteAfterInput = Parameters<NonNullable<Hooks["tool.execute.after"]>>[0];
type ToolExecuteAfterOutput = Parameters<NonNullable<Hooks["tool.execute.after"]>>[1];
type EventInput = Parameters<NonNullable<Hooks["event"]>>[0];

/**
 * Creates the context injector hook
 * 
 * Implements tool.execute.after hook to inject knowledge into Read tool outputs
 * Maintains per-session cache to avoid duplicate injections
 * 
 * @param ctx - Plugin input context
 * @param config - Plugin configuration
 * @returns Hook handlers object
 */
export function createContextInjectorHook(ctx: PluginInput, config?: PluginConfig) {
  // Session-based cache: Map<sessionID, Set<filePath>>
  // Tracks which files have already had knowledge injected in each session
  const sessionCaches = new Map<string, Set<string>>();

  /**
   * Gets or creates the injection cache for a session
   */
  function getSessionCache(sessionID: string): Set<string> {
    if (!sessionCaches.has(sessionID)) {
      sessionCaches.set(sessionID, new Set<string>());
    }
    return sessionCaches.get(sessionID)!;
  }

  /**
   * Extracts keywords from a file path for relevance matching
   * 
   * @param filePath - Path to the file
   * @returns Array of keywords extracted from path
   * 
   * @example
   * extractKeywords("src/order/service.ts") // ["order", "service"]
   * extractKeywords("src/utils/money.ts") // ["utils", "money"]
   */
  function extractKeywords(filePath: string): string[] {
    const keywords: string[] = [];

    // Extract file name without extension
    const fileName = basename(filePath, extname(filePath));
    if (fileName) {
      keywords.push(fileName);
    }

    // Extract directory names from path
    const dir = dirname(filePath);
    const pathParts = dir.split(/[/\\]/).filter(part => part && part !== '.');

    keywords.push(...pathParts);

    return keywords;
  }

  /**
   * Formats facts as Markdown for injection into tool output
   * 
   * @param facts - Array of facts to format
   * @returns Formatted Markdown string
   */
  function formatFactsAsMarkdown(facts: Fact[]): string {
    if (facts.length === 0) {
      return "";
    }

    const lines: string[] = [
      "",
      "---",
      "📚 **Codebase Knowledge** (from smart-codebase)",
      "",
    ];

    for (const fact of facts) {
      // Format: **Subject** (importance)
      lines.push(`**${fact.subject}** (${fact.importance} importance)`);

      // Format: > Fact content
      lines.push(`> ${fact.fact}`);

      // Format: > 来源: learned_from
      lines.push(`> 来源: ${fact.learned_from}`);

      // Format: > 引用: citations
      if (fact.citations.length > 0) {
        lines.push(`> 引用: ${fact.citations.join(", ")}`);
      }

      lines.push(""); // Empty line between facts
    }

    lines.push("---");
    lines.push("");

    return lines.join("\n");
  }

  /**
   * Sorts facts by importance (high > medium > low)
   * 
   * @param facts - Array of facts to sort
   * @returns Sorted array (mutates original)
   */
  function sortFactsByImportance(facts: Fact[]): Fact[] {
    const importanceOrder = { high: 0, medium: 1, low: 2 };

    return facts.sort((a, b) => {
      return importanceOrder[a.importance] - importanceOrder[b.importance];
    });
  }

  /**
   * Tool execution after hook
   * Intercepts Read tool calls and injects relevant knowledge
   */
  const toolExecuteAfter = async (
    input: ToolExecuteAfterInput,
    output: ToolExecuteAfterOutput,
  ) => {
    const toolName = input.tool.toLowerCase();

    // Only inject for Read tool
    if (toolName !== "read") {
      return;
    }

    // Get file path from output.title (Read tool sets this to the file path)
    const filePath = output.title;
    if (!filePath) {
      return;
    }

    // Check cache - avoid duplicate injection in same session
    const cache = getSessionCache(input.sessionID);
    if (cache.has(filePath)) {
      return;
    }

    try {
      // Extract keywords from file path
      const keywords = extractKeywords(filePath);

      // Load relevant knowledge
      const facts = await loadRelevantKnowledge(filePath, keywords);

      // No facts found - nothing to inject
      if (facts.length === 0) {
        cache.add(filePath);
        return;
      }

      // Sort by importance
      sortFactsByImportance(facts);

      // Limit to maxRelevantFacts (default: 5)
      const maxFacts = config?.maxRelevantFacts ?? 5;
      const topFacts = facts.slice(0, maxFacts);

      // Format as Markdown
      const knowledgeSection = formatFactsAsMarkdown(topFacts);

      // Inject into output
      output.output += knowledgeSection;

      // Mark as injected
      cache.add(filePath);
    } catch (error) {
      // Don't break file reading if knowledge loading fails
      console.error(`[smart-codebase] Failed to inject knowledge for ${filePath}:`, error);
    }
  };

  /**
   * Event handler
   * Cleans up session cache when session is deleted
   */
  const eventHandler = async ({ event }: EventInput) => {
    const props = event.properties as Record<string, unknown> | undefined;

    if (event.type === "session.deleted") {
      const sessionInfo = props?.info as { id?: string } | undefined;
      if (sessionInfo?.id) {
        sessionCaches.delete(sessionInfo.id);
      }
    }
  };

  return {
    "tool.execute.after": toolExecuteAfter,
    event: eventHandler,
  };
}
