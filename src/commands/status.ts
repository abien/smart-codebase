import { tool } from "@opencode-ai/plugin";
import { join } from "path";
import type { KnowledgeGraph } from "../types";
import { loadKnowledge } from "../storage/knowledge-loader";
import { fileExists, readTextFile } from "../utils/fs-compat";

export const statusCommand = tool({
  description: "Display smart-codebase knowledge base status",
  args: {},
  async execute(_input, ctx) {
    try {
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
      
      return `📚 smart-codebase 知识库状态

知识点总数: ${totalFacts}
知识链接数: ${totalLinks}
存储位置: .knowledge/facts.jsonl
图谱位置: .codebase-memory/graph.json`;
      
    } catch (error) {
      console.error('[smart-codebase] Status command failed:', error);
      return `❌ 获取状态失败: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
});
