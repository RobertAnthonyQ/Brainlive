// Server file for Node.js backend (requires Express and Neo4j driver)
const express = require("express");
const neo4j = require("neo4j-driver");
const path = require("path");
const { setupBrainRoutes } = require("./brain"); // Importar las rutas del cerebro

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para procesar JSON en el cuerpo de solicitudes
app.use(express.json());

// Middleware para CORS (si es necesario)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Serve static files from the 'src' directory
app.use(express.static(path.join(__dirname, "../../")));

// Neo4j connection settings
const NEO4J_URI = process.env.NEO4J_URI || "neo4j://localhost:7687";
const NEO4J_USER = process.env.NEO4J_USER || "neo4j";
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || "12345678";

console.log("Neo4j settings:", {
  uri: NEO4J_URI,
  user: NEO4J_USER,
  passwordLength: NEO4J_PASSWORD.length,
});

// Create Neo4j driver instance
const driver = neo4j.driver(
  NEO4J_URI,
  neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD)
);

// Verify database connection
async function verifyConnection() {
  const session = driver.session();
  try {
    await session.run("RETURN 1 as n");
    console.log("Connected to Neo4j database");
  } catch (error) {
    console.error("Failed to connect to Neo4j:", error);
  } finally {
    await session.close();
  }
}

// Endpoint para obtener datos de Neo4j
app.get("/api/neo4j", async (req, res) => {
  try {
    console.log("Executing Neo4j query...");
    console.log("Request received with cache-buster:", req.query.t);

    // Aumentamos el límite a 1000 relaciones
    const nodeLimit = 500;
    const relationshipLimit = 1000;

    // Consulta unificada que devuelve tanto nodos como relaciones en una sola consulta
    const query = `
      MATCH (n)-[r]->(m)
      RETURN n, r, m
    `;

    console.log("Running Neo4j query:", query);

    // Ejecutar consulta
    const session = driver.session();
    try {
      const result = await session.run(query);

      console.log(`Raw query returned ${result.records.length} records`);

      // Transformar resultados - need to extract data from the full objects
      const relationships = result.records.map((record, index) => {
        const sourceNode = record.get("n");
        const relationship = record.get("r");
        const targetNode = record.get("m");

        // Log details of first few records for debugging
        if (index < 3) {
          console.log(`Record ${index} details:`, {
            sourceNode: {
              identity: sourceNode.identity.toString(),
              labels: sourceNode.labels,
            },
            relationship: {
              identity: relationship.identity.toString(),
              type: relationship.type,
            },
            targetNode: {
              identity: targetNode.identity.toString(),
              labels: targetNode.labels,
            },
          });
        }

        return {
          id: relationship.identity.toString(),
          type: relationship.type,
          properties: relationship.properties,
          sourceId: sourceNode.identity.toString(),
          sourceLabels: sourceNode.labels,
          sourceProperties: sourceNode.properties,
          targetId: targetNode.identity.toString(),
          targetLabels: targetNode.labels,
          targetProperties: targetNode.properties,
        };
      });

      // Contar tipos de nodos y relaciones para depuración
      const nodeTypes = new Set();
      const relationshipTypes = new Set();
      relationships.forEach((rel) => {
        rel.sourceLabels.forEach((label) => nodeTypes.add(label));
        rel.targetLabels.forEach((label) => nodeTypes.add(label));
        relationshipTypes.add(rel.type);
      });

      console.log(`Query returned ${relationships.length} relationships`);
      console.log(`Node types found: ${Array.from(nodeTypes).join(", ")}`);
      console.log(
        `Relationship types found: ${Array.from(relationshipTypes).join(", ")}`
      );

      await session.close();

      res.json({
        relationships,
        queryInfo: {
          query: query,
          recordCount: result.records.length,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("Error executing Neo4j query:", error);
      await session.close();
      throw error; // Re-throw for the outer catch block
    }
  } catch (error) {
    console.error("Error querying Neo4j:", error);
    res
      .status(500)
      .json({ error: "Error querying Neo4j", message: error.message });
  }
});

// Setup Brain API routes
setupBrainRoutes(app);

// Add index.html route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../../index.html"));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`API del cerebro disponible en:`);
  console.log(`  GET  http://localhost:${PORT}/api/brain/status`);
  console.log(`  POST http://localhost:${PORT}/api/brain/activate`);
  console.log(`  POST http://localhost:${PORT}/api/brain/reset`);
  verifyConnection();
});

// Close Neo4j connection when server shuts down
process.on("SIGINT", async () => {
  await driver.close();
  console.log("Neo4j connection closed");
  process.exit(0);
});
