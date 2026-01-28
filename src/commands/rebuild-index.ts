import { tool } from "@opencode-ai/plugin";
import { join, dirname } from "path";
import { findFiles, readTextFile, fileExists, writeTextFile } from "../utils/fs-compat";

export const rebuildIndexCommand = tool({
  description: "Rebuild global knowledge base index from all SKILL.md files",
  args: {},
  async execute(_input, ctx) {
    try {
      const skillFiles = await findFiles('**/.knowledge/SKILL.md', {
        cwd: ctx.directory,
        absolute: true,
      });
      
      if (skillFiles.length === 0) {
        return `📭 未找到任何模块知识文件 (.knowledge/SKILL.md)`;
      }
      
      const entries: string[] = [];
      
      for (const skillPath of skillFiles) {
        try {
          const content = await readTextFile(skillPath);
          const modulePath = dirname(dirname(skillPath)).replace(ctx.directory + '/', '');
          
          const titleMatch = content.match(/^# (.+)$/m);
          const title = titleMatch ? titleMatch[1] : modulePath;
          
          const descMatch = content.match(/^> (.+)$/m);
          const description = descMatch ? descMatch[1] : `${title} 相关知识`;
          
          const keywordsMatch = content.match(/Keywords?:\s*(.+)/i);
          const keywords = keywordsMatch 
            ? keywordsMatch[1].split(/[,，]/).map(k => k.trim()).filter(Boolean)
            : [];
          
          entries.push(`## ${title}
> ${description}
- **Location**: \`${modulePath}/.knowledge/SKILL.md\`
- **Keywords**: ${keywords.length > 0 ? keywords.join(', ') : title}
`);
        } catch (error) {
          console.warn(`[smart-codebase] Failed to parse ${skillPath}:`, error);
        }
      }
      
      const indexContent = `# Project Knowledge Index

> 项目知识索引 - AI 会在 session 开始时读取此文件，了解项目知识结构

${entries.join('\n')}`;
      
      const indexPath = join(ctx.directory, 'KNOWLEDGE.md');
      await writeTextFile(indexPath, indexContent);
      
      return `🔄 知识索引重建完成

扫描模块: ${skillFiles.length}
成功解析: ${entries.length}
索引位置: KNOWLEDGE.md`;
      
    } catch (error) {
      console.error('[smart-codebase] Rebuild index command failed:', error);
      return `❌ 重建索引失败: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
});
