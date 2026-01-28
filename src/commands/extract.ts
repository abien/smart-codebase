import { tool } from "@opencode-ai/plugin";
import { extractKnowledge } from "../hooks/knowledge-extractor";
import { displayExtractionResult } from "../display/feedback";
import { getPluginInput } from "../plugin-context";

export const extractCommand = tool({
  description: "Manually trigger knowledge extraction from codebase",
  args: {},
  async execute(_input, ctx) {
    try {
      const pluginInput = getPluginInput();
      const result = await extractKnowledge(pluginInput, ctx.sessionID);
      
      return displayExtractionResult(result);
    } catch (error) {
      console.error('[smart-codebase] Extract command failed:', error);
      return `❌ 提取失败: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
});
