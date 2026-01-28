import { tool } from "@opencode-ai/plugin";
import { join } from "path";
import type { KnowledgeStats } from "../types";
import { fileExists, findFiles } from "../utils/fs-compat";

export const statusCommand = tool({
  description: "Display smart-codebase knowledge base status",
  args: {},
  async execute(_input, ctx) {
    try {
      const stats = await getKnowledgeStats(ctx.directory);
      
      const indexStatus = stats.hasGlobalIndex ? '✅ 存在' : '❌ 未创建';
      const moduleList = stats.modules.length > 0 
        ? stats.modules.map(m => `  - ${m}`).join('\n')
        : '  (暂无)';
      
      return `📚 smart-codebase 知识库状态

全局索引 (KNOWLEDGE.md): ${indexStatus}
模块知识数量: ${stats.moduleCount}

已有知识的模块:
${moduleList}`;
      
    } catch (error) {
      console.error('[smart-codebase] Status command failed:', error);
      return `❌ 获取状态失败: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
});

async function getKnowledgeStats(projectRoot: string): Promise<KnowledgeStats> {
  const indexPath = join(projectRoot, 'KNOWLEDGE.md');
  const hasGlobalIndex = await fileExists(indexPath);
  
  const skillFiles = await findFiles('**/.knowledge/SKILL.md', {
    cwd: projectRoot,
    absolute: false,
  });
  
  const modules = skillFiles.map(f => f.replace('/.knowledge/SKILL.md', ''));
  
  return {
    hasGlobalIndex,
    moduleCount: modules.length,
    modules,
  };
}
