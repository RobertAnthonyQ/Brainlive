import * as THREE from "three";
import { fetchGraphData, generateMockData } from "../api/neo4jApi.js";

/**
 * Service to fetch and cache graph data from Neo4j
 */
class GraphDataService {
  constructor(useMockData = false) {
    this.nodes = [];
    this.relationships = [];
    this.isLoaded = false;
    this.isLoading = false;
    this.useMockData = useMockData;
  }

  /**
   * Load data from Neo4j or mock data
   * @returns {Promise<Object>} Promise that resolves with nodes and relationships
   */
  async loadData() {
    if (this.isLoading) {
      console.log("Data is already loading");
      return { nodes: this.nodes, relationships: this.relationships };
    }

    console.log("Loading fresh data...");
    this.isLoading = true;
    this.isLoaded = false; // Reset loaded state to always load fresh data

    try {
      // Fetch data from API or generate mock data
      let data;
      if (this.useMockData) {
        data = generateMockData();
      } else {
        data = await fetchGraphData();
      }

      console.log("Raw data from API/mock:", data);

      // If data only contains relationships (from server.js), extract nodes from them
      if (!data.nodes && data.relationships) {
        console.log("Extracting nodes from relationships...");
        const extractedNodes = this.extractNodesFromRelationships(
          data.relationships
        );
        data.nodes = extractedNodes;
        console.log(`Extracted ${extractedNodes.length} unique nodes`);
      }

      // Process and store the data
      this.nodes = this.processNodes(data.nodes || []);
      this.relationships = this.processRelationships(data.relationships || []);

      this.isLoaded = true;
      this.isLoading = false;
      console.log(
        `Loaded ${this.nodes.length} nodes and ${this.relationships.length} relationships`
      );

      // Debug relationship structure
      if (this.relationships.length > 0) {
        console.log("Sample relationship structure:", this.relationships[0]);
      }

      return { nodes: this.nodes, relationships: this.relationships };
    } catch (error) {
      console.error("Error loading graph data:", error);
      this.isLoading = false;
      throw error;
    }
  }

  /**
   * Extract unique nodes from relationship data
   * @param {Array} relationships - Array of relationship objects with source and target node data
   * @returns {Array} Array of unique nodes
   */
  extractNodesFromRelationships(relationships) {
    const nodeMap = new Map();

    relationships.forEach((rel) => {
      // Extract source node
      if (rel.sourceId && !nodeMap.has(rel.sourceId)) {
        nodeMap.set(rel.sourceId, {
          id: rel.sourceId,
          labels: rel.sourceLabels || [],
          properties: rel.sourceProperties || {},
        });
      }

      // Extract target node
      if (rel.targetId && !nodeMap.has(rel.targetId)) {
        nodeMap.set(rel.targetId, {
          id: rel.targetId,
          labels: rel.targetLabels || [],
          properties: rel.targetProperties || {},
        });
      }
    });

    return Array.from(nodeMap.values());
  }

  /**
   * Process the node data from Neo4j into a standardized format
   * @param {Array} nodes - Raw node data from Neo4j
   * @returns {Array} Processed node data
   */
  processNodes(nodes) {
    return nodes.map((node) => {
      // Ensure IDs are consistently strings
      const nodeId = typeof node.id === "string" ? node.id : node.id.toString();

      return {
        id: nodeId,
        labels: node.labels || [],
        properties: node.properties || {},
      };
    });
  }

  /**
   * Process the relationship data from Neo4j into a standardized format
   * @param {Array} relationships - Raw relationship data from Neo4j
   * @returns {Array} Processed relationship data
   */
  processRelationships(relationships) {
    return relationships.map((rel) => {
      // Debug problematic relationships
      if (!rel.sourceId && !rel.targetId) {
        console.warn("Found relationship without source or target:", rel);
      }

      return {
        id:
          rel.id ||
          (rel.relationshipId && rel.relationshipId.toString()) ||
          `rel_${Math.random().toString(36).substr(2, 9)}`,
        type: rel.type || rel.relationshipType,
        sourceId: rel.startNodeId || rel.sourceId,
        targetId: rel.endNodeId || rel.targetId,
        sourceLabels: rel.sourceLabels || [],
        targetLabels: rel.targetLabels || [],
        sourceProperties: rel.sourceProperties || {},
        targetProperties: rel.targetProperties || {},
        properties: rel.properties || rel.relationshipProperties || {},
      };
    });
  }

  /**
   * Reset the data service state
   */
  reset() {
    this.nodes = [];
    this.relationships = [];
    this.isLoaded = false;
    this.isLoading = false;
    console.log("Graph data service reset");
  }

  /**
   * Get all nodes
   * @returns {Array} All nodes
   */
  getNodes() {
    return [...this.nodes];
  }

  /**
   * Get all relationships
   * @returns {Array} All relationships
   */
  getRelationships() {
    return [...this.relationships];
  }

  /**
   * Get node by ID
   * @param {string} id - Node ID
   * @returns {Object|null} Node or null if not found
   */
  getNodeById(id) {
    return this.nodes.find((node) => node.id === id) || null;
  }

  /**
   * Get nodes by label
   * @param {string} label - Node label
   * @returns {Array} Nodes with the specified label
   */
  getNodesByLabel(label) {
    return this.nodes.filter((node) => node.labels.includes(label));
  }

  /**
   * Get relationships by type
   * @param {string} type - Relationship type
   * @returns {Array} Relationships of the specified type
   */
  getRelationshipsByType(type) {
    return this.relationships.filter((rel) => rel.type === type);
  }

  /**
   * Get relationships for a specific node (incoming and outgoing)
   * @param {string} nodeId - Node ID
   * @returns {Array} Relationships connected to the node
   */
  getRelationshipsForNode(nodeId) {
    return this.relationships.filter(
      (rel) => rel.sourceId === nodeId || rel.targetId === nodeId
    );
  }

  /**
   * Get outgoing relationships from a node
   * @param {string} nodeId - Node ID
   * @returns {Array} Outgoing relationships from the node
   */
  getOutgoingRelationships(nodeId) {
    return this.relationships.filter((rel) => rel.sourceId === nodeId);
  }

  /**
   * Get incoming relationships to a node
   * @param {string} nodeId - Node ID
   * @returns {Array} Incoming relationships to the node
   */
  getIncomingRelationships(nodeId) {
    return this.relationships.filter((rel) => rel.targetId === nodeId);
  }

  /**
   * Get unique node labels from all nodes
   * @returns {Array} Unique node labels
   */
  getUniqueNodeLabels() {
    const labels = new Set();
    this.nodes.forEach((node) => {
      node.labels.forEach((label) => labels.add(label));
    });
    return Array.from(labels);
  }

  /**
   * Get unique relationship types from all relationships
   * @returns {Array} Unique relationship types
   */
  getUniqueRelationshipTypes() {
    const types = new Set();
    this.relationships.forEach((rel) => {
      types.add(rel.type);
    });
    return Array.from(types);
  }
}

export default GraphDataService;
