import type { ExtractionResult } from '../hooks/knowledge-extractor';

export function displayExtractionResult(result: ExtractionResult): string {
  if (result.modulesUpdated === 0) {
    return "No new knowledge extracted";
  }

  const modulesText = result.modulesUpdated === 1 
    ? `1 module` 
    : `${result.modulesUpdated} modules`;
  
  const sectionsText = result.sectionsAdded > 0 
    ? `, ${result.sectionsAdded} sections added` 
    : '';
  
  const indexText = result.indexUpdated ? ', index updated' : '';
  
  return `✨ Updated ${modulesText}${sectionsText}${indexText}`;
}
