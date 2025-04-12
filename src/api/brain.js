/**
 * API para controlar la visualización del cerebro
 */

// Estado del cerebro - guarda los nodos activos
const brainState = {
  activeNodes: [], // Lista de objetos {id, name}
};

// Configurar rutas para la API del cerebro
function setupBrainRoutes(app) {
  // GET /api/brain/status - Obtiene estado actual
  app.get("/api/brain/status", (req, res) => {
    console.log(
      "GET /api/brain/status - Nodos activos:",
      brainState.activeNodes
    );
    res.json({
      activeNodes: brainState.activeNodes,
    });
  });

  // POST /api/brain/activate - Activa nodos específicos
  app.post("/api/brain/activate", (req, res) => {
    console.log("POST /api/brain/activate - Cuerpo:", req.body);

    // Estado anterior para debugging
    const previousNodes = [...brainState.activeNodes];

    // Por defecto, reemplazar los nodos activos con los nuevos
    // a menos que se especifique append:true
    if (!req.body.append) {
      brainState.activeNodes = [];
      console.log("Modo reemplazo: limpiando nodos activos");
    } else {
      console.log("Modo append: manteniendo nodos activos anteriores");
    }

    // Lista temporal para los nuevos nodos
    const newNodes = [];

    // Procesar IDs en formato simple (convertir a objetos con id)
    if (req.body.nodeIds && Array.isArray(req.body.nodeIds)) {
      req.body.nodeIds.forEach((id) => {
        // Asegurar que el ID sea una cadena
        const stringId = String(id);
        const nodeObj = { id: stringId, name: stringId }; // Usar ID como nombre por defecto
        if (!brainState.activeNodes.some((n) => String(n.id) === stringId)) {
          brainState.activeNodes.push(nodeObj);
          newNodes.push(nodeObj);
        }
      });
    }

    // Procesar IDs con nombres
    if (req.body.nodes && Array.isArray(req.body.nodes)) {
      req.body.nodes.forEach((node) => {
        if (node.id) {
          // Asegurar que el ID sea una cadena
          const stringId = String(node.id);
          const nodeObj = {
            id: stringId,
            name: node.name || stringId, // Usar nombre si existe, sino usar ID
          };
          if (!brainState.activeNodes.some((n) => String(n.id) === stringId)) {
            brainState.activeNodes.push(nodeObj);
            newNodes.push(nodeObj);
          }
        }
      });
    }

    console.log(`Nodos anteriores:`, previousNodes);
    console.log(`Nuevos nodos:`, newNodes);
    console.log(`Nodos activos actualizados:`, brainState.activeNodes);

    res.json({
      status: "success",
      activeNodes: brainState.activeNodes,
    });
  });

  // POST /api/brain/reset - Reinicia la visualización
  app.post("/api/brain/reset", (req, res) => {
    console.log("POST /api/brain/reset - Reiniciando visualización");

    const previousNodes = [...brainState.activeNodes];
    brainState.activeNodes = [];

    console.log(`Nodos reseteados: ${previousNodes.join(", ") || "ninguno"}`);

    res.json({
      status: "success",
      message: "Visualización reiniciada",
    });
  });

  console.log("✅ Rutas de API del cerebro configuradas");
  return app;
}

module.exports = {
  setupBrainRoutes,
};
