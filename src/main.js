import GraphVisualizer from "./models/GraphVisualizer.js";
import ChatInterface from "./components/ChatInterface.js";
import TimelineInterface from "./components/TimelineInterface.js";

document.addEventListener("DOMContentLoaded", async () => {
  // Create chat interface container
  const chatContainer = document.createElement("div");
  document.body.appendChild(chatContainer);

  // Create timeline interface container
  const timelineContainer = document.createElement("div");
  document.body.appendChild(timelineContainer);

  // Initialize interfaces
  const chatInterface = new ChatInterface(chatContainer);
  const timelineInterface = new TimelineInterface(timelineContainer);

  // Make timeline available globally for the GraphVisualizer to use
  window.timelineInterface = timelineInterface;

  // Mostrar pantalla de carga
  const loadingScreen = document.createElement("div");
  loadingScreen.style.position = "absolute";
  loadingScreen.style.width = "100%";
  loadingScreen.style.height = "100%";
  loadingScreen.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
  loadingScreen.style.display = "flex";
  loadingScreen.style.justifyContent = "center";
  loadingScreen.style.alignItems = "center";
  loadingScreen.style.zIndex = "1000";
  loadingScreen.style.color = "white";
  loadingScreen.style.fontFamily = "Arial, sans-serif";

  const loadingText = document.createElement("div");
  loadingText.textContent = "Inicializando visualización cerebral...";
  loadingText.style.fontSize = "24px";
  loadingScreen.appendChild(loadingText);

  document.body.appendChild(loadingScreen);

  // Create container for the 3D scene
  const container = document.createElement("div");
  container.style.width = "100%";
  container.style.height = "100%";
  container.style.position = "absolute";
  container.style.top = "0";
  container.style.left = "0";
  document.body.appendChild(container);

  // Retrasar la inicialización para permitir que la interfaz se renderice
  setTimeout(async () => {
    try {
      await initializeVisualization(container, loadingScreen, loadingText);
    } catch (error) {
      console.error("Error en la inicialización:", error);
      loadingText.textContent =
        "Error al cargar la visualización: " + error.message;
    }
  }, 100);
});

/**
 * Inicializa la visualización con carga progresiva
 */
async function initializeVisualization(container, loadingScreen, loadingText) {
  // Initialize the GraphVisualizer with lower initial limits
  const graphVisualizer = new GraphVisualizer(container, {
    useMockData: false,
    nodeLimit: 400,
    relationshipLimit: 600,
    nodeColorMap: {
      Person: 0x42adf5,
      Movie: 0xf542a7,
      Product: 0x42f59e,
      Category: 0xf5d242,
      User: 0xf54242,
    },
    relationshipColorMap: {
      ACTED_IN: 0x42f5a7,
      DIRECTED: 0xf5e642,
      PURCHASED: 0x42adf5,
      RATED: 0xf542a7,
      BELONGS_TO: 0xf5a642,
    },
    apiUrl: "http://localhost:3000/api/brain",
    enableApiPolling: true, // Cambiar a true para permitir activación inmediata
    pollingInterval: 2000, // Reducir el intervalo para respuesta más rápida
    showDebugInfo: true,
    maxFPS: 60, // Aumentar FPS para mejor respuesta visual
    preloadAssets: true, // Precargar assets para mejor respuesta
    onNodesAdded: (nodes, requestId) => {
      // Add nodes to timeline when they are created
      timelineInterface.addRequestGroup(
        requestId || Date.now(),
        nodes,
        TimelineInterface.generateColor()
      );
    },
    onActiveNodesChanged: (activeNodes) => {
      // Update timeline when active nodes change
      timelineInterface.updateActiveNodes(activeNodes);

      // Asegurar que todos los nodos se activen visualmente
      if (graphVisualizer.processApiActivation) {
        graphVisualizer.processApiActivation(activeNodes);
      }
    },
  });

  // Ajustar configuración del elipsoide para alinear mejor con el cerebro
  if (graphVisualizer.brain && graphVisualizer.brain.ellipsoidConfig) {
    // Configuraciones básicas iniciales
    graphVisualizer.brain.ellipsoidConfig.position.set(200, 40, 5);
    graphVisualizer.brain.ellipsoidConfig.scaleX = 4.1;
    graphVisualizer.brain.ellipsoidConfig.scaleY = 3.6;
    graphVisualizer.brain.ellipsoidConfig.scaleZ = 5.3;

    // Hacer que las conexiones sean invisibles inicialmente
    graphVisualizer.brain.connectionConfig.opacity = 0;

    // Ocultar wireframe del elipsoide desde el inicio
    graphVisualizer.toggleEllipsoidWireframe(false);
  }

  // Cargar datos básicos
  loadingText.textContent = "Cargando datos iniciales...";
  await new Promise((resolve) => setTimeout(resolve, 10)); // Permitir actualización de UI

  // Inicializar visualización básica sin generar visuales
  await graphVisualizer.initialize(false);

  // Crear neuronas en lotes pequeños
  loadingText.textContent = "Generando neuronas (primera fase)...";
  await new Promise((resolve) => setTimeout(resolve, 10));

  // Primera fase: Generar un 20% de neuronas
  const neuronsToCreate = Math.min(
    20,
    Math.floor(graphVisualizer.nodes.length * 0.2)
  );
  await generateBatchedNeurons(
    graphVisualizer,
    0,
    neuronsToCreate,
    loadingText
  );

  // Mostrar escena inicial y continuar cargando en segundo plano
  loadingScreen.style.opacity = "0";
  loadingScreen.style.transition = "opacity 0.5s ease";
  setTimeout(() => {
    loadingScreen.style.display = "none";
  }, 500);

  // Añadir contador minimalista
  addControls(graphVisualizer);

  // Continuar cargando el resto en segundo plano
  setTimeout(async () => {
    // Segunda fase: Aumentar límites gradualmente
    graphVisualizer.options.nodeLimit = 200;
    graphVisualizer.options.relationshipLimit = 250;

    await graphVisualizer.refresh();

    // Generar más neuronas
    await generateBatchedNeurons(
      graphVisualizer,
      neuronsToCreate,
      graphVisualizer.nodes.length
    );

    // Tercera fase: Cargar todos los datos restantes
    graphVisualizer.options.nodeLimit = 500;
    graphVisualizer.options.relationshipLimit = 500;
    graphVisualizer.options.maxFPS = 60; // Restaurar FPS completo

    // Habilitar animaciones y polling
    graphVisualizer.options.enableApiPolling = true;
    if (graphVisualizer.initializeApiClient) {
      graphVisualizer.initializeApiClient(graphVisualizer.options.apiUrl);
    }

    // Mostrar conexiones gradualmente
    fadeInConnections(graphVisualizer);

    // Hacer disponible globalmente para debugging
    window.graphVisualizer = graphVisualizer;

    console.log("GraphVisualizer completamente inicializado");
  }, 1000);

  // Configurar polling para actualizar nodos activos
  const pollActiveNodes = async () => {
    try {
      const response = await fetch("http://localhost:3000/api/brain/status");
      const data = await response.json();
      if (data.activeNodes) {
        timelineInterface.updateActiveNodes(data.activeNodes);
      }
    } catch (error) {
      console.error("Error polling active nodes:", error);
    }
  };

  // Iniciar polling de nodos activos
  setInterval(pollActiveNodes, 2000);
}

/**
 * Genera neuronas en lotes para evitar bloquear el hilo principal
 */
async function generateBatchedNeurons(
  graphVisualizer,
  startIdx,
  endIdx,
  loadingText = null
) {
  const batchSize = 10;
  const totalNeurons = endIdx - startIdx;

  for (let i = startIdx; i < endIdx; i += batchSize) {
    const currentBatch = Math.min(i + batchSize, endIdx);

    if (loadingText) {
      const progress = Math.floor(((i - startIdx) / totalNeurons) * 100);
      loadingText.textContent = `Generando neuronas... ${progress}%`;
    }

    // Generar un lote de neuronas
    const nodesToCreate = graphVisualizer.nodes.slice(i, currentBatch);
    if (nodesToCreate.length > 0) {
      // Crear neuronas para este lote
      for (const node of nodesToCreate) {
        graphVisualizer.createNeuronForNode(node);
      }
    }

    // Esperar un tiempo para permitir que la UI se actualice
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

/**
 * Muestra las conexiones gradualmente para evitar lag
 */
function fadeInConnections(graphVisualizer) {
  if (graphVisualizer.brain && graphVisualizer.brain.connectionConfig) {
    // Mostrar conexiones gradualmente a lo largo de 2 segundos
    let opacity = 0;
    const interval = setInterval(() => {
      opacity += 0.02;
      if (opacity >= 0.1) {
        opacity = 0.1;
        clearInterval(interval);
      }

      graphVisualizer.brain.updateConnectionOpacity(opacity);
    }, 50);
  }
}

/**
 * Añade controles de UI para interactuar con la visualización
 * @param {GraphVisualizer} visualizer - Instancia del visualizador de grafos
 */
function addControls(visualizer) {
  // Crear contenedor de UI minimalista
  const uiContainer = document.createElement("div");
  uiContainer.style.position = "absolute";
  uiContainer.style.bottom = "20px";
  uiContainer.style.right = "20px";
  uiContainer.style.zIndex = "1000";
  uiContainer.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
  uiContainer.style.padding = "10px";
  uiContainer.style.borderRadius = "5px";
  uiContainer.style.color = "white";
  uiContainer.style.fontFamily = "Arial, sans-serif";
  uiContainer.style.fontSize = "14px";
  document.body.appendChild(uiContainer);

  // Añadir solo las estadísticas
  const stats = document.createElement("div");
  stats.innerHTML = `
    Nodos: <span id="node-count">0</span> | 
    Relaciones: <span id="relationship-count">0</span>
  `;
  uiContainer.appendChild(stats);

  // Actualizar estadísticas
  const updateStats = () => {
    document.getElementById("node-count").textContent = visualizer.nodeMap.size;
    document.getElementById("relationship-count").textContent =
      visualizer.connectionMap.size;
  };

  // Actualizar estadísticas periódicamente
  setInterval(updateStats, 1000);
}

// Estilos básicos del documento
const style = document.createElement("style");
style.textContent = `
    body, html {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
    }
    
    /* Estilos para los controles deslizantes */
    input[type=range] {
        -webkit-appearance: none;
        background: rgba(255,255,255,0.2);
        height: 5px;
        border-radius: 5px;
    }
    
    input[type=range]::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 15px;
        height: 15px;
        border-radius: 50%;
        background: #4287f5;
        cursor: pointer;
    }
    
    input[type=range]:focus {
        outline: none;
    }
`;
document.head.appendChild(style);
