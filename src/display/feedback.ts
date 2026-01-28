/**
 * User feedback display module
 * Formats and displays knowledge extraction results to the user
 */

import type { Fact, GraphEdge } from '../types.js';

/**
 * Displays the result of knowledge extraction to the user
 * 
 * @param facts - Array of newly extracted facts
 * @param links - Array of newly created knowledge graph edges
 * @param totalFacts - Total number of facts in the knowledge base
 * @param totalLinks - Total number of links in the knowledge graph
 * @returns Formatted Markdown string for display
 */
export function displayExtractionResult(
  facts: Fact[],
  links: GraphEdge[],
  totalFacts: number,
  totalLinks: number
): string {
  // Handle case where no facts were learned
  if (facts.length === 0) {
    return "📚 smart-codebase: 本次会话未发现新知识点";
  }

  const lines: string[] = [];
  
  // Header
  lines.push("📚 smart-codebase 学习完成！");
  lines.push("");
  
  // Facts section
  lines.push(`✨ 学到了 ${facts.length} 个新知识点：`);
  lines.push("");
  
  facts.forEach((fact, index) => {
    // Format: 1. **Subject** (importance)
    lines.push(`${index + 1}. **${fact.subject}** (${fact.importance} importance)`);
    
    // Format fact content (keep it concise, max 2 lines)
    const factContent = fact.fact.length > 100 
      ? fact.fact.substring(0, 100) + "..." 
      : fact.fact;
    lines.push(`   > ${factContent}`);
    
    // Show first citation only
    if (fact.citations.length > 0) {
      lines.push(`   📍 ${fact.citations[0]}`);
    }
    
    lines.push("");
  });
  
  // Links section (only if links exist)
  if (links.length > 0) {
    lines.push(`🔗 建立了 ${links.length} 个关联：`);
    
    // Find fact subjects for the links
    const factMap = new Map(facts.map(f => [f.id, f.subject]));
    
    links.forEach(link => {
      const fromSubject = factMap.get(link.from) || link.from;
      const toSubject = factMap.get(link.to) || link.to;
      const relationLabel = getRelationLabel(link.relation);
      
      lines.push(`- "${fromSubject}" ↔ "${toSubject}"（${relationLabel}）`);
    });
    
    lines.push("");
  }
  
  // Statistics section
  lines.push(`📊 知识库状态：共 ${totalFacts} 个知识点，${totalLinks} 个关联`);
  
  return lines.join("\n");
}

/**
 * Converts relation type to Chinese label
 */
function getRelationLabel(relation: string): string {
  const labels: Record<string, string> = {
    'keyword_overlap': '关键词重叠',
    'same_file': '相同文件引用',
    'related': '相关',
    'depends_on': '依赖关系',
    'similar': '相似主题'
  };
  
  return labels[relation] || relation;
}
