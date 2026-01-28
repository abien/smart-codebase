/**
 * Knowledge linking module for smart-codebase plugin
 * Detects and creates relationships between facts based on keyword and citation overlap
 */

import { join, dirname } from 'path';
import { mkdir } from 'fs/promises';
import type { Fact, KnowledgeGraph, GraphEdge } from '../types';
import { loadKnowledge } from '../storage/knowledge-loader';
import { fileExists, readTextFile, writeTextFile, findFiles } from '../utils/fs-compat';

const CODEBASE_MEMORY_DIR = '.codebase-memory';
const GRAPH_FILE = 'graph.json';
const MAX_RELATED_FACTS = 5;

/**
 * Links a new fact to existing facts based on relationship detection rules
 * 
 * Relationship detection rules:
 * 1. Keyword overlap: ≥2 common keywords
 * 2. Citation overlap: Same file in citations
 * 
 * Updates:
 * - graph.json: Adds bidirectional edges
 * - fact's related_facts field in JSONL file
 * - related facts' related_facts fields (bidirectional)
 * 
 * Limits each fact to max 5 related facts.
 * 
 * @param newFact - The fact to link to existing facts
 * @param projectRoot - Root directory of the project
 * 
 * @example
 * await linkFact(myFact, '/path/to/project');
 * // Creates edges in graph.json and updates related_facts fields
 */
export async function linkFact(newFact: Fact, projectRoot: string): Promise<void> {
  // Load existing knowledge graph
  const graphPath = join(projectRoot, CODEBASE_MEMORY_DIR, GRAPH_FILE);
  let graph: KnowledgeGraph = { nodes: [], edges: [] };
  
   try {
     if (await fileExists(graphPath)) {
       const content = await readTextFile(graphPath);
       graph = JSON.parse(content);
     }
   } catch (error) {
     console.warn('Failed to load existing graph, starting fresh:', error);
   }
  
  // Add new fact as node if not exists
  if (!graph.nodes.includes(newFact.id)) {
    graph.nodes.push(newFact.id);
  }
  
  // Find all knowledge files to load all facts
  const knowledgeFiles = await findAllKnowledgeFiles(projectRoot);
  
  // Load all existing facts
  const allFacts: Fact[] = [];
  const factsByFile = new Map<string, Fact[]>(); // Track which file each fact belongs to
  
  for (const file of knowledgeFiles) {
    const directory = dirname(file);
    const facts = await loadKnowledge(directory);
    allFacts.push(...facts);
    
    // Track facts by their file location
    for (const fact of facts) {
      factsByFile.set(fact.id, facts);
    }
  }
  
  // Track relationships to create
  const relatedFactIds: string[] = [];
  const newEdges: GraphEdge[] = [];
  
  // Detect relationships with existing facts
  for (const existingFact of allFacts) {
    // Skip self-linking
    if (existingFact.id === newFact.id) {
      continue;
    }
    
    // Skip if either fact already has max relationships
    const newFactRelatedCount = (newFact.related_facts || []).length;
    const existingFactRelatedCount = (existingFact.related_facts || []).length;
    
    if (newFactRelatedCount >= MAX_RELATED_FACTS || existingFactRelatedCount >= MAX_RELATED_FACTS) {
      continue;
    }
    
    // Rule 1: Keyword overlap (≥2 common keywords)
    const commonKeywords = newFact.keywords.filter(k => 
      existingFact.keywords.includes(k)
    );
    
    // Rule 2: Citation file overlap
    const newFiles = newFact.citations.map(c => c.split(':')[0]);
    const existingFiles = existingFact.citations.map(c => c.split(':')[0]);
    const commonFiles = newFiles.filter(f => existingFiles.includes(f));
    
    // Create relationship if either rule matches
    if (commonKeywords.length >= 2 || commonFiles.length > 0) {
      relatedFactIds.push(existingFact.id);
      
      // Create bidirectional edges
      newEdges.push({
        from: newFact.id,
        to: existingFact.id,
        relation: 'related'
      });
      
      newEdges.push({
        from: existingFact.id,
        to: newFact.id,
        relation: 'related'
      });
      
      // Stop if we've reached max relationships for new fact
      if (relatedFactIds.length >= MAX_RELATED_FACTS) {
        break;
      }
    }
  }
  
  // Update newFact's related_facts field
  newFact.related_facts = [
    ...(newFact.related_facts || []),
    ...relatedFactIds
  ].slice(0, MAX_RELATED_FACTS);
  
  // Add new edges to graph (deduplicate)
  for (const edge of newEdges) {
    const edgeExists = graph.edges.some(e => 
      e.from === edge.from && e.to === edge.to && e.relation === edge.relation
    );
    
    if (!edgeExists) {
      graph.edges.push(edge);
    }
  }
  
  // Write updated graph
  const memoryDir = join(projectRoot, CODEBASE_MEMORY_DIR);
  try {
    await mkdir(memoryDir, { recursive: true });
  } catch (error) {
    // Directory might already exist, ignore
  }
  
   await writeTextFile(graphPath, JSON.stringify(graph, null, 2));
  
  // Update related facts' related_facts fields (bidirectional linking)
  await updateRelatedFactsFields(newFact, relatedFactIds, knowledgeFiles, projectRoot);
}

/**
 * Updates the related_facts fields of facts that are now linked to newFact
 * 
 * @param newFact - The new fact that was linked
 * @param relatedFactIds - IDs of facts that are related to newFact
 * @param knowledgeFiles - All knowledge files in the project
 * @param projectRoot - Root directory of the project
 */
async function updateRelatedFactsFields(
  newFact: Fact,
  relatedFactIds: string[],
  knowledgeFiles: string[],
  projectRoot: string
): Promise<void> {
  // Group related fact IDs by their file location
  const factIdsByFile = new Map<string, Set<string>>();
  
  for (const file of knowledgeFiles) {
    const directory = dirname(file);
    const facts = await loadKnowledge(directory);
    
    for (const fact of facts) {
      if (relatedFactIds.includes(fact.id)) {
        if (!factIdsByFile.has(file)) {
          factIdsByFile.set(file, new Set());
        }
        factIdsByFile.get(file)!.add(fact.id);
      }
    }
  }
  
  // Update each file that contains related facts
  for (const [file, factIds] of factIdsByFile.entries()) {
    const directory = dirname(file);
    const facts = await loadKnowledge(directory);
    
    let modified = false;
    
    for (const fact of facts) {
      if (factIds.has(fact.id)) {
        // Add newFact.id to this fact's related_facts
        if (!fact.related_facts) {
          fact.related_facts = [];
        }
        
        if (!fact.related_facts.includes(newFact.id)) {
          fact.related_facts.push(newFact.id);
          
          // Limit to max 5
          if (fact.related_facts.length > MAX_RELATED_FACTS) {
            fact.related_facts = fact.related_facts.slice(0, MAX_RELATED_FACTS);
          }
          
          modified = true;
        }
      }
    }
    
     // Rewrite JSONL file if modified
     if (modified) {
       const lines = facts.map(f => JSON.stringify(f)).join('\n') + '\n';
       await writeTextFile(file, lines);
     }
  }
}

/**
 * Finds all .knowledge/facts.jsonl files in the project
 * 
 * @param projectRoot - Root directory of the project
 * @returns Array of absolute paths to facts.jsonl files
 */
async function findAllKnowledgeFiles(projectRoot: string): Promise<string[]> {
  const knowledgeFiles: string[] = [];
  
   try {
     const entries = await findFiles('**/.knowledge/facts.jsonl', {
       cwd: projectRoot,
       absolute: true,
     });
     
     knowledgeFiles.push(...entries);
   } catch (error) {
     console.error(`Error scanning directory ${projectRoot}:`, error);
   }
  
  return knowledgeFiles;
}
