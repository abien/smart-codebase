/**
 * Knowledge loading and retrieval module
 * Handles on-demand loading of facts from JSONL storage with keyword matching
 */

import { join, dirname } from 'path';
import type { Fact } from '../types';
import { fileExists, readTextFile } from '../utils/fs-compat';

/**
 * Loads all knowledge facts from a directory's .knowledge/facts.jsonl file
 * 
 * @param directory - Directory containing .knowledge folder
 * @returns Array of Fact objects, empty array if file doesn't exist
 * 
 * @example
 * const facts = await loadKnowledge('src/order');
 * // Returns all facts from src/order/.knowledge/facts.jsonl
 */
export async function loadKnowledge(directory: string): Promise<Fact[]> {
  const factsFile = join(directory, '.knowledge', 'facts.jsonl');
  
   try {
     const exists = await fileExists(factsFile);
     
     if (!exists) {
       return [];
     }
     
     const content = await readTextFile(factsFile);
    
    // Empty file
    if (!content.trim()) {
      return [];
    }
    
    const facts: Fact[] = [];
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines
      if (!line) {
        continue;
      }
      
      try {
        const fact = JSON.parse(line) as Fact;
        facts.push(fact);
      } catch (parseError) {
        // Log warning but continue processing other lines
        console.warn(`Failed to parse fact at ${factsFile}:${i + 1}:`, parseError);
      }
    }
    
    return facts;
  } catch (error) {
    // File read errors (permissions, etc.) - return empty array
    console.error(`Error loading knowledge from ${factsFile}:`, error);
    return [];
  }
}

/**
 * Loads knowledge facts relevant to a file path and keywords
 * 
 * Performs case-insensitive keyword matching against:
 * - Fact subject
 * - Fact content
 * - Fact keywords array
 * 
 * @param filePath - Path to the file (used to determine directory)
 * @param keywords - Keywords to match against facts
 * @returns Array of matching Fact objects
 * 
 * @example
 * const facts = await loadRelevantKnowledge(
 *   'src/order/service.ts',
 *   ['order', 'status', 'update']
 * );
 * // Returns facts from src/order/.knowledge/facts.jsonl that match keywords
 */
export async function loadRelevantKnowledge(
  filePath: string,
  keywords: string[]
): Promise<Fact[]> {
  // Determine directory from file path
  const directory = dirname(filePath);
  
  // Load all facts from the directory
  const allFacts = await loadKnowledge(directory);
  
  // No keywords means no filtering
  if (keywords.length === 0) {
    return allFacts;
  }
  
  // Normalize keywords for case-insensitive matching
  const normalizedKeywords = keywords.map(k => k.toLowerCase());
  
  // Filter facts by keyword matching
  const relevantFacts = allFacts.filter(fact => {
    return matchesKeywords(fact, normalizedKeywords);
  });
  
  return relevantFacts;
}

/**
 * Checks if a fact matches any of the provided keywords
 * 
 * Performs case-insensitive substring matching against:
 * - fact.subject
 * - fact.fact (content)
 * - fact.keywords array
 * 
 * @param fact - Fact to check
 * @param normalizedKeywords - Lowercase keywords to match
 * @returns true if any keyword matches
 */
function matchesKeywords(fact: Fact, normalizedKeywords: string[]): boolean {
  // Prepare searchable text (lowercase for case-insensitive matching)
  const subject = fact.subject.toLowerCase();
  const content = fact.fact.toLowerCase();
  const factKeywords = fact.keywords.map(k => k.toLowerCase());
  
  // Check if any keyword matches
  for (const keyword of normalizedKeywords) {
    // Check subject
    if (subject.includes(keyword)) {
      return true;
    }
    
    // Check fact content
    if (content.includes(keyword)) {
      return true;
    }
    
    // Check fact keywords array
    for (const factKeyword of factKeywords) {
      if (factKeyword.includes(keyword)) {
        return true;
      }
    }
  }
  
  return false;
}
