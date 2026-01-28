/**
 * Knowledge extraction hook for smart-codebase plugin
 * Monitors session idle events and extracts knowledge from completed tasks
 */

import type { PluginInput, Hooks } from "@opencode-ai/plugin";
import type { PluginConfig } from "../types";
import { appendFact } from "../storage/knowledge-writer";
import { getKnowledgeDirectory } from "../storage/knowledge-writer";

type ToolExecuteAfterInput = Parameters<NonNullable<Hooks["tool.execute.after"]>>[0];
type ToolExecuteAfterOutput = Parameters<NonNullable<Hooks["tool.execute.after"]>>[1];
type EventInput = Parameters<NonNullable<Hooks["event"]>>[0];

/**
 * Creates the knowledge extraction hook
 * 
 * Implements:
 * - event hook for session.idle (with 30s debounce)
 * - event hook for session.deleted (cleanup)
 * - tool.execute.after hook for tracking file modifications
 * 
 * @param ctx - Plugin input context
 * @param config - Plugin configuration
 * @returns Hook handlers object
 */
export function createKnowledgeExtractorHook(ctx: PluginInput, config?: PluginConfig) {
  // Session state: Map<sessionID, debounceTimeout>
  const sessionDebounceTimers = new Map<string, NodeJS.Timeout>();
  
  // Session state: Map<sessionID, Set<filePath>>
  // Tracks which files were modified in each session
  const sessionModifiedFiles = new Map<string, Set<string>>();

  /**
   * Gets or creates the modified files set for a session
   */
  function getModifiedFiles(sessionID: string): Set<string> {
    if (!sessionModifiedFiles.has(sessionID)) {
      sessionModifiedFiles.set(sessionID, new Set<string>());
    }
    return sessionModifiedFiles.get(sessionID)!;
  }

  /**
   * Extracts knowledge from a session
   * 
   * For MVP: Placeholder implementation that logs the extraction trigger
   * Future: Will call AI to analyze session changes and extract facts
   * 
   * @param sessionID - Session identifier
   */
  async function extractKnowledge(sessionID: string): Promise<void> {
    try {
      const modifiedFiles = sessionModifiedFiles.get(sessionID);
      
      // No files modified - nothing to extract
      if (!modifiedFiles || modifiedFiles.size === 0) {
        console.log(`[smart-codebase] No files modified in session ${sessionID}, skipping extraction`);
        return;
      }

      console.log(`[smart-codebase] Knowledge extraction triggered for session ${sessionID}`);
      console.log(`[smart-codebase] Modified files:`, Array.from(modifiedFiles));

      // MVP: Placeholder implementation
      // TODO: Implement actual AI-based knowledge extraction
      // 1. Call AI with prompt to analyze session changes
      // 2. Parse AI response as JSON array of facts
      // 3. Store each fact using appendFact()
      
      // Example of how extraction will work in future:
      /*
      const extractionPrompt = `
        Based on the changes made in this session, extract key learnings:
        1. What patterns or conventions were discovered?
        2. What gotchas or important notes should be remembered?
        3. What relationships between files/modules were identified?
        
        Modified files: ${Array.from(modifiedFiles).join(", ")}
        
        Format as JSON array of facts with subject, fact, citations, importance, keywords.
      `;
      
      const response = await ctx.ask(extractionPrompt);
      const facts = JSON.parse(response);
      
      for (const factData of facts) {
        const fact: Fact = {
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          subject: factData.subject,
          fact: factData.fact,
          citations: factData.citations,
          importance: factData.importance,
          learned_from: `Session ${sessionID}`,
          keywords: factData.keywords,
        };
        
        // Determine storage directory from first modified file
        const firstFile = Array.from(modifiedFiles)[0];
        const directory = getKnowledgeDirectory(firstFile);
        
        await appendFact(directory, fact);
      }
      */

      // Clear modified files after extraction
      sessionModifiedFiles.delete(sessionID);
    } catch (error) {
      console.error(`[smart-codebase] Failed to extract knowledge for session ${sessionID}:`, error);
    }
  }

  /**
   * Tool execution after hook
   * Tracks file modifications from Write and Edit tools
   */
  const toolExecuteAfter = async (
    input: ToolExecuteAfterInput,
    output: ToolExecuteAfterOutput,
  ) => {
    const toolName = input.tool.toLowerCase();

    // Track Write and Edit tool executions
    if (toolName === "write" || toolName === "edit") {
      try {
        // Extract file path from output.title
        // Both Write and Edit tools set title to the file path
        const filePath = output.title;

        if (filePath) {
          const modifiedFiles = getModifiedFiles(input.sessionID);
          modifiedFiles.add(filePath);
          console.log(`[smart-codebase] Tracked file modification: ${filePath} in session ${input.sessionID}`);
        }
      } catch (error) {
        console.error(`[smart-codebase] Failed to track file modification:`, error);
      }
    }
  };

  /**
   * Event handler
   * Handles session.idle and session.deleted events
   */
  const eventHandler = async ({ event }: EventInput) => {
    const props = event.properties as Record<string, unknown> | undefined;

    // Handle session.idle event with debounce
    if (event.type === "session.idle") {
      const sessionID = props?.sessionID as string | undefined;
      if (!sessionID) return;

      // Check if auto-extraction is enabled
      if (config?.autoExtract === false) {
        return;
      }

      // Clear previous debounce timer
      const existingTimer = sessionDebounceTimers.get(sessionID);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // Set new debounce timer (default: 30 seconds)
      const debounceMs = config?.debounceMs ?? 30000;
      const timer = setTimeout(async () => {
        await extractKnowledge(sessionID);
        sessionDebounceTimers.delete(sessionID);
      }, debounceMs);

      sessionDebounceTimers.set(sessionID, timer);
      console.log(`[smart-codebase] Session ${sessionID} idle, extraction scheduled in ${debounceMs}ms`);
    }

    // Handle session.deleted event - cleanup
    if (event.type === "session.deleted") {
      const sessionInfo = props?.info as { id?: string } | undefined;
      if (sessionInfo?.id) {
        const timer = sessionDebounceTimers.get(sessionInfo.id);
        if (timer) {
          clearTimeout(timer);
        }
        sessionDebounceTimers.delete(sessionInfo.id);
        sessionModifiedFiles.delete(sessionInfo.id);
        console.log(`[smart-codebase] Cleaned up session ${sessionInfo.id}`);
      }
    }
  };

  return {
    "tool.execute.after": toolExecuteAfter,
    event: eventHandler,
  };
}
