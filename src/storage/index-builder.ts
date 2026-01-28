/**
 * Global index builder for smart-codebase plugin
 * Constructs search indexes and knowledge graphs from distributed fact files
 */

import { join, relative, dirname } from 'path';
import { mkdir } from 'fs/promises';
import type { SearchIndex, KnowledgeGraph, Fact } from '../types';
import { loadKnowledge } from './knowledge-loader';
import { fileExists, readTextFile, writeTextFile, findFiles } from '../utils/fs-compat';

const CODEBASE_MEMORY_DIR = '.codebase-memory';
const SEARCH_INDEX_FILE = 'search-index.json';
const GRAPH_FILE = 'graph.json';

/**
 * Finds all .knowledge/facts.jsonl files in the project
 * 
 * @param projectRoot - Root directory of the project
 * @returns Array of absolute paths to facts.jsonl files
 */
async function findAllKnowledgeFiles(projectRoot: string): Promise<string[]> {
  const knowledgeFiles: string[] = [];
  
  async function scanDirectory(dir: string): Promise<void> {
    try {
      const entries = await findFiles('**/.knowledge/facts.jsonl', {
        cwd: dir,
        absolute: true,
      });
      
      knowledgeFiles.push(...entries);
    } catch (error) {
      console.error(`Error scanning directory ${dir}:`, error);
    }
  }
  
  await scanDirectory(projectRoot);
  return knowledgeFiles;
}

/**
 * Builds a search index mapping keywords to fact locations
 * 
 * Scans all .knowledge/facts.jsonl files in the project and creates
 * a keyword → fact locations mapping for fast retrieval.
 * 
 * Implements incremental updates: loads existing index and merges new facts.
 * 
 * @param projectRoot - Root directory of the project
 * @returns SearchIndex with keyword mappings
 * 
 * @example
 * const index = await buildSearchIndex('/path/to/project');
 * // index.keywords = { "order": ["src/order/.knowledge/facts.jsonl:fact-id-1"] }
 */
export async function buildSearchIndex(projectRoot: string): Promise<SearchIndex> {
  const indexPath = join(projectRoot, CODEBASE_MEMORY_DIR, SEARCH_INDEX_FILE);
  
   // Load existing index for incremental update
   let existingIndex: SearchIndex = { keywords: {} };
   try {
     if (await fileExists(indexPath)) {
       const content = await readTextFile(indexPath);
       existingIndex = JSON.parse(content);
     }
   } catch (error) {
     console.warn('Failed to load existing search index, starting fresh:', error);
   }
  
  // Find all knowledge files
  const knowledgeFiles = await findAllKnowledgeFiles(projectRoot);
  
  // Build index from all facts
  const index: SearchIndex = { keywords: { ...existingIndex.keywords } };
  
  for (const file of knowledgeFiles) {
    const directory = dirname(file);
    const facts = await loadKnowledge(directory);
    
    // Get relative path for location reference
    const relativePath = relative(projectRoot, file);
    
    for (const fact of facts) {
      const location = `${relativePath}:${fact.id}`;
      
      // Index all keywords from the fact
      for (const keyword of fact.keywords) {
        if (!index.keywords[keyword]) {
          index.keywords[keyword] = [];
        }
        
        // Add location if not already present (deduplication)
        if (!index.keywords[keyword].includes(location)) {
          index.keywords[keyword].push(location);
        }
      }
    }
  }
  
  // Ensure .codebase-memory directory exists
  const memoryDir = join(projectRoot, CODEBASE_MEMORY_DIR);
  try {
    await mkdir(memoryDir, { recursive: true });
  } catch (error) {
    console.error('Failed to create .codebase-memory directory:', error);
    throw error;
  }
  
   // Write updated index
   await writeTextFile(indexPath, JSON.stringify(index, null, 2));
  
  return index;
}

/**
 * Builds a knowledge graph with nodes and edges
 * 
 * Scans all .knowledge/facts.jsonl files and constructs a graph where:
 * - Nodes are fact IDs
 * - Edges represent relationships between facts
 * 
 * MVP: Only populates nodes array. Edges will be added by Task 10 (knowledge linking).
 * 
 * @param projectRoot - Root directory of the project
 * @returns KnowledgeGraph with nodes and edges
 * 
 * @example
 * const graph = await buildGraph('/path/to/project');
 * // graph.nodes = ["fact-id-1", "fact-id-2"]
 * // graph.edges = [] (MVP - edges added later)
 */
export async function buildGraph(projectRoot: string): Promise<KnowledgeGraph> {
  const graphPath = join(projectRoot, CODEBASE_MEMORY_DIR, GRAPH_FILE);
  
   // Load existing graph for incremental update
   let existingGraph: KnowledgeGraph = { nodes: [], edges: [] };
   try {
     if (await fileExists(graphPath)) {
       const content = await readTextFile(graphPath);
       existingGraph = JSON.parse(content);
     }
   } catch (error) {
     console.warn('Failed to load existing graph, starting fresh:', error);
   }
  
  // Find all knowledge files
  const knowledgeFiles = await findAllKnowledgeFiles(projectRoot);
  
  // Build graph from all facts
  const nodeSet = new Set<string>(existingGraph.nodes);
  const graph: KnowledgeGraph = {
    nodes: [],
    edges: [...existingGraph.edges], // Preserve existing edges
  };
  
  for (const file of knowledgeFiles) {
    const directory = dirname(file);
    const facts = await loadKnowledge(directory);
    
    for (const fact of facts) {
      // Add fact ID as node
      nodeSet.add(fact.id);
      
      // MVP: No edge creation yet
      // Task 10 will add logic to detect relationships and create edges
      // Future: Detect keyword overlap, citation overlap, etc.
    }
  }
  
  graph.nodes = Array.from(nodeSet);
  
  // Ensure .codebase-memory directory exists
  const memoryDir = join(projectRoot, CODEBASE_MEMORY_DIR);
  try {
    await mkdir(memoryDir, { recursive: true });
  } catch (error) {
    console.error('Failed to create .codebase-memory directory:', error);
    throw error;
  }
  
   // Write updated graph
   await writeTextFile(graphPath, JSON.stringify(graph, null, 2));
  
  return graph;
}

/**
 * Rebuilds all indexes from scratch
 * 
 * Convenience function that rebuilds both search index and knowledge graph.
 * Use this when you want to ensure indexes are fully synchronized with facts.
 * 
 * @param projectRoot - Root directory of the project
 * 
 * @example
 * await rebuildAllIndexes('/path/to/project');
 * // Both search-index.json and graph.json are rebuilt
 */
export async function rebuildAllIndexes(projectRoot: string): Promise<void> {
  console.log('Rebuilding search index...');
  await buildSearchIndex(projectRoot);
  
  console.log('Rebuilding knowledge graph...');
  await buildGraph(projectRoot);
  
  console.log('All indexes rebuilt successfully');
}
