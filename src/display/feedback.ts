import type { ExtractionResult } from '../hooks/knowledge-extractor';

export function displayExtractionResult(result: ExtractionResult): string {
  if (result.modulesUpdated === 0) {
    return "本次会话未发现新知识点";
  }

  const modulesText = result.modulesUpdated === 1 
    ? `1 个模块` 
    : `${result.modulesUpdated} 个模块`;
  
  const sectionsText = result.sectionsAdded > 0 
    ? `，新增 ${result.sectionsAdded} 个知识条目` 
    : '';
  
  const indexText = result.indexUpdated ? '，已更新索引' : '';
  
  return `✨ 更新了 ${modulesText}${sectionsText}${indexText}`;
}
