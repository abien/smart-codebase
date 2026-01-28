import { tool } from "@opencode-ai/plugin";
import { loadKnowledge } from "../storage/knowledge-loader";
import { linkFact } from "../linking/knowledge-linker";

export const rebuildIndexCommand = tool({
  description: "Rebuild global knowledge base index",
  args: {},
  async execute(_input, ctx) {
    try {
      const allFacts = await loadKnowledge(ctx.directory);
      
      for (const fact of allFacts) {
        await linkFact(fact, ctx.directory);
      }
      
      return `🔄 知识索引重建完成

处理知识点: ${allFacts.length}
重建链接: 完成`;
      
    } catch (error) {
      console.error('[smart-codebase] Rebuild index command failed:', error);
      return `❌ 重建索引失败: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
});
