/**
 * API module for Neo4j database interactions
 */

/**
 * Fetches all nodes and relationships from Neo4j
 * @returns {Promise} Promise that resolves with Neo4j graph data
 */
export async function fetchGraphData() {
  try {
    console.log("Fetching fresh data from Neo4j API");

    // Make a single query that returns both nodes and relationships
    const response = await fetch("/api/neo4j", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    console.log(
      `API returned ${
        data.relationships ? data.relationships.length : 0
      } relationships`
    );

    // The server may only return relationships with embedded node data
    // Return as-is to let GraphDataService extract nodes if needed
    return data;
  } catch (error) {
    console.error("Error fetching graph data from Neo4j:", error);
    throw error;
  }
}

/**
 * Mock function to generate test data (can be used for development/testing)
 * @returns {Object} Object with nodes and relationships arrays
 */
export function generateMockData() {
  console.log("Generating example data for development");

  // Generate 131 Person nodes as seen in the image
  const nodes = [];
  const relationships = [];

  // Create Person nodes
  for (let i = 1; i <= 131; i++) {
    nodes.push({
      id: `person${i}`,
      labels: ["Person"],
      properties: {
        name: `Person ${i}`,
        age: 20 + Math.floor(Math.random() * 40),
      },
    });
  }

  // Create FOLLOWS relationships between people
  // Each person follows 1-5 random other people
  nodes.forEach((person, index) => {
    const numFollows = Math.floor(Math.random() * 5) + 1;
    const followList = new Set();

    // Avoid self-follows and duplicates
    for (let i = 0; i < numFollows; i++) {
      let targetIndex;
      do {
        targetIndex = Math.floor(Math.random() * nodes.length);
      } while (targetIndex === index || followList.has(targetIndex));

      followList.add(targetIndex);
      const targetPerson = nodes[targetIndex];

      // Create relationship with sourceNode and targetNode data embedded
      relationships.push({
        id: `rel_follows_${person.id}_${targetPerson.id}`,
        type: "FOLLOWS",
        sourceId: person.id,
        targetId: targetPerson.id,
        sourceLabels: person.labels,
        targetLabels: targetPerson.labels,
        sourceProperties: person.properties,
        targetProperties: targetPerson.properties,
        properties: {
          since: `202${Math.floor(Math.random() * 4)}-${
            Math.floor(Math.random() * 12) + 1
          }-${Math.floor(Math.random() * 28) + 1}`,
        },
      });
    }
  });

  console.log(
    `Example data generated: ${relationships.length} relationships between ${nodes.length} people`
  );

  return {
    nodes,
    relationships,
  };
}
