import { tool } from "@opencode-ai/plugin";
import { join } from "path";
import type { KnowledgeGraph } from "../types";
import { extractKnowledge } from "../hooks/knowledge-extractor";
import { loadKnowledge } from "../storage/knowledge-loader";
import { displayExtractionResult } from "../display/feedback";
import { fileExists, readTextFile } from "../utils/fs-compat";
import { getPluginInput } from "../plugin-context";

export const extractCommand = tool({
  description: "Manually trigger knowledge extraction from codebase",
  args: {},
  async execute(_input, ctx) {
    try {
      const pluginInput = getPluginInput();
      const results = await extractKnowledge(pluginInput, ctx.sessionID);
      
      const allFacts = await loadKnowledge(ctx.directory);
      const totalFacts = allFacts.length;
      
      const graphPath = join(ctx.directory, '.codebase-memory', 'graph.json');
      let totalLinks = 0;
      try {
        if (await fileExists(graphPath)) {
          const graphContent = await readTextFile(graphPath);
          const graph: KnowledgeGraph = JSON.parse(graphContent);
          totalLinks = graph.edges.length;
        }
      } catch (error) {
        console.error('[smart-codebase] Failed to load graph:', error);
      }
      
      return displayExtractionResult(
        results.facts,
        results.links,
        totalFacts,
        totalLinks
      );
      
    } catch (error) {
      console.error('[smart-codebase] Extract command failed:', error);
      return `❌ 提取失败: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
});
