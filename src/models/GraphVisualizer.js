import * as THREE from "three";
import Brain from "./Brain.js";
import Neuron from "./Neuron.js";
import NeuronConnection from "./NeuronConnection.js";
import GraphDataService from "./GraphDataService.js";

// Shaders para el efecto de resplandor/fosforescente
const glowVertexShader = `
uniform vec3 viewVector;
uniform float c;
uniform float p;
uniform float uTime;
varying float intensity;
varying vec2 vUv;

void main() {
    vUv = uv;
    
    // Esto crea el efecto basado en ángulo de visión
    vec3 vNormal = normalize(normalMatrix * normal);
    vec3 vNormel = normalize(normalMatrix * viewVector);
    intensity = pow(c - abs(dot(vNormal, vec3(0, 0, 1))), p);
    
    // Animación pulsante basada en tiempo
    intensity *= (0.7 + 0.3 * sin(uTime * 2.0));
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// Fragment Shader - controla el color y la opacidad del efecto
const glowFragmentShader = `
uniform vec3 glowColor;
varying float intensity;
varying vec2 vUv;
uniform float uTime;

void main() {
    // Efecto de resplandor que se desvanece en los bordes
    vec3 glow = glowColor * intensity;
    
    // Añade pulsación al alpha para crear el efecto fosforescente
    float alpha = clamp(cos(uTime * 3.0), 0.5, 1.0);
    
    gl_FragColor = vec4(glow, alpha);
}
`;

/**
 * Class to visualize Neo4j graph data using the Brain model
 */
class GraphVisualizer {
  /**
   * Creates a new GraphVisualizer instance
   * @param {HTMLElement} container - DOM element to render the visualization
   * @param {Object} options - Configuration options
   */
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      useMockData: false,
      nodeLimit: 1000,
      relationshipLimit: 1000,
      nodeColorMap: {}, // Map node labels to colors
      relationshipColorMap: {}, // Map relationship types to colors
      apiUrl: "http://localhost:3000/api/brain", // Default API URL
      enableApiPolling: true, // Default to enable API polling
      pollingInterval: 2000, // Default polling interval in ms
      maxFPS: 60, // Maximum frames per second
      ...options,
    };

    // Initialize the Brain visualization
    this.brain = new Brain(container);

    // FPS limiting
    this.lastFrameTime = performance.now();
    this.frameInterval = 1000 / this.options.maxFPS; // milliseconds per frame

    // Initialize the data service
    this.dataService = new GraphDataService(this.options.useMockData);

    // Geometry and material caching for reuse
    this.sharedGeometries = {};
    this.sharedMaterials = {};

    // Maps to track nodes and connections
    this.nodeMap = new Map(); // Maps Neo4j node IDs to Neuron instances
    this.connectionMap = new Map(); // Maps Neo4j relationship IDs to NeuronConnection instances

    // Track active nodes
    this.activeNodes = [];

    // Rastrear esferas resplandecientes
    this.glowingSpheres = new Map(); // Maps Neo4j node IDs to glowing effects
    this.clock = new THREE.Clock(); // Para animar los efectos

    // NodeType color mapping (default)
    this.nodeColorMap = {
      Person: 0x4287f5, // Blue
      Movie: 0xf542a7, // Pink
      default: 0xffffff, // White default
      ...this.options.nodeColorMap,
    };

    // Relationship color mapping (default)
    this.relationshipColorMap = {
      ACTED_IN: 0x42f5a7, // Green
      DIRECTED: 0xf5d442, // Yellow
      FOLLOWS: 0x42f5a7, // Green for FOLLOWS
      default: 0xaaaaaa, // Gray default
      ...this.options.relationshipColorMap,
    };

    // Inicializar cliente API si está habilitado
    if (this.options.enableApiPolling) {
      this.initializeApiClient(this.options.apiUrl);
      console.log(`API client initialized with URL: ${this.options.apiUrl}`);
    }

    // Iniciar la animación del efecto resplandeciente
    this.startGlowAnimation();
  }

  /**
   * Initializes the visualization with Neo4j data
   * @param {boolean} generateVisuals - Si se deben generar las neuronas y conexiones automáticamente
   */
  async initialize(generateVisuals = false) {
    try {
      console.log("Initializing graph visualization...");

      // Load data from Neo4j (or cache)
      await this.loadData();

      // Generar mapas de colores dinámicos basados en los tipos de nodos y relaciones
      this.generateDynamicColorMaps();

      // Solo generar visuales si se solicita explícitamente
      if (generateVisuals) {
        // Crear neuronas y conexiones
        this.generateNeuronsFromNeo4j();
        this.generateConnectionsFromNeo4j();

        console.log(
          `Visualization created with ${this.nodeMap.size} neurons and ${this.connectionMap.size} connections`
        );
      } else {
        console.log("Data loaded, waiting for manual generation of visuals");
      }
    } catch (error) {
      console.error("Error initializing graph visualization:", error);
    }
  }

  /**
   * Loads data from Neo4j using the GraphDataService
   */
  async loadData() {
    try {
      // Get data from the GraphDataService
      const { nodes, relationships } = await this.dataService.loadData();

      // Apply limits if specified
      this.nodes = this.options.nodeLimit
        ? nodes.slice(0, this.options.nodeLimit)
        : nodes;
      this.relationships = this.options.relationshipLimit
        ? relationships.slice(0, this.options.relationshipLimit)
        : relationships;

      console.log(
        `Loaded ${this.nodes.length} nodes and ${this.relationships.length} relationships`
      );
    } catch (error) {
      console.error("Error loading data:", error);
      throw error;
    }
  }

  /**
   * Genera mapas de colores dinámicos basados en los tipos de nodos y relaciones encontrados
   */
  generateDynamicColorMaps() {
    // Recolectar todos los tipos de nodos
    const nodeTypes = new Set();
    this.nodes.forEach((node) => {
      if (node.labels && Array.isArray(node.labels)) {
        node.labels.forEach((label) => nodeTypes.add(label));
      }
    });

    // Recolectar todos los tipos de relaciones
    const relationshipTypes = new Set();
    this.relationships.forEach((rel) => {
      if (rel.type) {
        relationshipTypes.add(rel.type);
      }
    });

    console.log("Tipos de nodos detectados:", Array.from(nodeTypes));
    console.log(
      "Tipos de relaciones detectadas:",
      Array.from(relationshipTypes)
    );

    // Generar colores para tipos de nodos
    this.nodeColorMap = this.generateColorMap(
      Array.from(nodeTypes),
      this.options.nodeColorMap || {}
    );

    // Generar colores para tipos de relaciones
    this.relationshipColorMap = this.generateColorMap(
      Array.from(relationshipTypes),
      this.options.relationshipColorMap || {}
    );

    console.log("Mapa de colores para nodos:", this.nodeColorMap);
    console.log("Mapa de colores para relaciones:", this.relationshipColorMap);
  }

  /**
   * Genera un mapa de colores para una lista de tipos
   * @param {Array} types - Lista de tipos
   * @param {Object} existingMap - Mapa de colores existente
   * @returns {Object} Mapa de colores
   */
  generateColorMap(types, existingMap = {}) {
    const colorMap = { ...existingMap };

    // Colores predefinidos si no hay suficientes en el mapa existente
    const predefinedColors = [
      0x4287f5, // Azul
      0xf542a7, // Rosa
      0x42f59e, // Verde claro
      0xf5d242, // Amarillo
      0xf54242, // Rojo
      0x9942f5, // Morado
      0x42b5f5, // Cyan
      0xf59e42, // Naranja
      0x42f54e, // Verde brillante
      0xf542d4, // Magenta
    ];

    let colorIndex = 0;

    // Asignar colores a los tipos que no tienen uno asignado
    types.forEach((type) => {
      if (!colorMap[type]) {
        // Si hay colores predefinidos disponibles, usar uno
        if (colorIndex < predefinedColors.length) {
          colorMap[type] = predefinedColors[colorIndex++];
        } else {
          // Generar un color aleatorio
          colorMap[type] = Math.random() * 0xffffff;
        }
      }
    });

    // Añadir color por defecto
    if (!colorMap.default) {
      colorMap.default = 0xffffff; // Blanco
    }

    return colorMap;
  }

  /**
   * Genera neuronas basadas en los datos de Neo4j, utilizando la lógica
   * original de Brain para posicionar dentro del elipsoide, pero manteniendo
   * nodos conectados más cercanos entre sí
   */
  generateNeuronsFromNeo4j() {
    console.log(
      "Generating neurons from Neo4j data with proximity clustering..."
    );
    this.brain.neurons = [];
    this.nodeMap.clear();

    // Contar nodos por tipo
    const nodesByType = {};

    // Use nodes array directly, these are already unique
    const uniqueNodesArray = this.nodes;

    console.log("Nodos únicos:", uniqueNodesArray.length);

    // Count nodes by type
    uniqueNodesArray.forEach((node) => {
      if (node.labels && node.labels.length > 0) {
        const label = node.labels[0] || "unknown";
        nodesByType[label] = (nodesByType[label] || 0) + 1;
      }
    });

    console.log("Distribución de nodos por tipo:", nodesByType);

    // Obtener configuración del elipsoide
    const { ellipsoidConfig } = this.brain;
    const { radius, scaleX, scaleY, scaleZ, position } = ellipsoidConfig;

    // Ajustar el centro del elipsoide para alinearlo mejor con el modelo del cerebro
    const centerOffset = new THREE.Vector3(0, 0, 0);

    // Valores de escala ajustados para una mejor distribución dentro del cerebro
    const adjustedScaleX = scaleX * 0.85;
    const adjustedScaleY = scaleY * 0.85;
    const adjustedScaleZ = scaleZ * 0.85;

    // Crear un mapa de conexiones para saber qué nodos están conectados entre sí
    const connectionMap = new Map(); // Map<nodeId, Set<connectedNodeId>>

    // Llenar el mapa de conexiones con datos de relaciones
    this.relationships.forEach((rel) => {
      // Añadir sourceId -> targetId
      if (!connectionMap.has(rel.sourceId)) {
        connectionMap.set(rel.sourceId, new Set());
      }
      connectionMap.get(rel.sourceId).add(rel.targetId);

      // Añadir targetId -> sourceId (conexión bidireccional para posicionamiento)
      if (!connectionMap.has(rel.targetId)) {
        connectionMap.set(rel.targetId, new Set());
      }
      connectionMap.get(rel.targetId).add(rel.sourceId);
    });

    // Determinar el orden de posicionamiento de nodos
    // Comenzamos con nodos que tienen más conexiones (hubs)
    const nodeProcessingOrder = [...uniqueNodesArray].sort((a, b) => {
      const aConnections = connectionMap.has(a.id)
        ? connectionMap.get(a.id).size
        : 0;
      const bConnections = connectionMap.has(b.id)
        ? connectionMap.get(b.id).size
        : 0;
      return bConnections - aConnections; // Ordenar de más conexiones a menos
    });

    // Mapa para rastrear las posiciones ya asignadas
    const positionedNodes = new Map(); // Map<nodeId, THREE.Vector3>

    // Función para generar una posición aleatoria dentro del elipsoide
    const generateRandomPosition = () => {
      let pos;
      let isInsideBrain = false;
      let attempts = 0;
      const maxAttempts = 10;

      while (!isInsideBrain && attempts < maxAttempts) {
        // Generar punto aleatorio en coordenadas esféricas
        const theta = Math.random() * Math.PI * 2; // Ángulo horizontal (0 a 2π)
        const phi = Math.acos(2 * Math.random() - 1); // Ángulo vertical (0 a π)

        // Para distribución uniforme en el volumen
        const r = Math.pow(Math.random(), 1 / 3);

        // Convertir a coordenadas cartesianas
        const x = r * Math.sin(phi) * Math.cos(theta);
        const y = r * Math.sin(phi) * Math.sin(theta);
        const z = r * Math.cos(phi);

        // Escalar según dimensiones del elipsoide
        const posX = x * radius * adjustedScaleX + position.x + centerOffset.x;
        const posY = y * radius * adjustedScaleY + position.y + centerOffset.y;
        const posZ = z * radius * adjustedScaleZ + position.z + centerOffset.z;

        pos = new THREE.Vector3(posX, posY, posZ);

        // Verificar si está dentro del cerebro
        if (this.brain.isPointInsideBrain) {
          isInsideBrain = this.brain.isPointInsideBrain(pos);
        } else {
          isInsideBrain = true;
        }

        attempts++;
      }

      return pos;
    };

    // Función para generar posición cercana a un conjunto de nodos conectados
    const generateProximityPosition = (connectedNodeIds) => {
      // Calcular posición promedio de los nodos conectados ya posicionados
      let connectedPositions = [];

      for (const connectedId of connectedNodeIds) {
        if (positionedNodes.has(connectedId)) {
          connectedPositions.push(positionedNodes.get(connectedId));
        }
      }

      // Si no hay nodos conectados ya posicionados, generar posición aleatoria
      if (connectedPositions.length === 0) {
        return generateRandomPosition();
      }

      // Calcular centro de gravedad de los nodos conectados
      const centerOfGravity = new THREE.Vector3();
      connectedPositions.forEach((pos) => centerOfGravity.add(pos));
      centerOfGravity.divideScalar(connectedPositions.length);

      // Generar posición cercana al centro de gravedad con cierta variación aleatoria
      // El factor de proximidad determina qué tan cerca estarán los nodos (0-1)
      const proximityFactor = 0.3; // 70% cercano, 30% aleatorio

      // Generar vector aleatorio para añadir variación
      const randomOffset = new THREE.Vector3(
        (Math.random() - 0.5) * radius * adjustedScaleX * 0.5,
        (Math.random() - 0.5) * radius * adjustedScaleY * 0.5,
        (Math.random() - 0.5) * radius * adjustedScaleZ * 0.5
      );

      // Combinar centro de gravedad con offset aleatorio
      const targetPos = new THREE.Vector3().copy(centerOfGravity);
      targetPos.lerp(
        new THREE.Vector3(
          centerOfGravity.x + randomOffset.x,
          centerOfGravity.y + randomOffset.y,
          centerOfGravity.z + randomOffset.z
        ),
        1 - proximityFactor
      );

      // Asegurarse de que esté dentro del cerebro
      let isInsideBrain = false;
      if (this.brain.isPointInsideBrain) {
        isInsideBrain = this.brain.isPointInsideBrain(targetPos);
      } else {
        isInsideBrain = true;
      }

      // Si la posición no está dentro del cerebro, volver a una posición aleatoria
      if (!isInsideBrain) {
        return generateRandomPosition();
      }

      return targetPos;
    };

    // Crear neuronas para cada nodo en orden de procesamiento
    nodeProcessingOrder.forEach((node) => {
      // Determinar color basado en la etiqueta del nodo
      const nodeLabel =
        node.labels && node.labels.length > 0 ? node.labels[0] : "default";
      const color = this.nodeColorMap[nodeLabel] || this.nodeColorMap.default;

      let pos;

      // Verificar si este nodo tiene conexiones
      if (connectionMap.has(node.id) && connectionMap.get(node.id).size > 0) {
        // Generar posición basada en las conexiones
        pos = generateProximityPosition(connectionMap.get(node.id));
      } else {
        // Para nodos sin conexiones, generar posición aleatoria
        pos = generateRandomPosition();
      }

      // Guardar la posición para uso futuro
      positionedNodes.set(node.id, pos);

      // Configuración de la neurona
      const neuronConfig = {
        ...this.brain.neuronConfig,
        color,
        size: this.getNodeSize(node),
        nodeData: node,
      };

      // Crear neurona
      const neuron = new Neuron(pos, neuronConfig);

      // Añadir a la escena y al mapa
      this.brain.scene.add(neuron.getMesh());
      this.brain.neurons.push(neuron);
      this.nodeMap.set(node.id, {
        neuron,
        data: node,
      });
    });

    console.log(
      `Created ${this.nodeMap.size} neurons inside ellipsoid with proximity clustering`
    );
  }

  /**
   * Determina el tamaño del nodo según sus propiedades y tipo
   * @param {Object} node - Nodo de Neo4j
   * @returns {number} - Tamaño calculado
   */
  getNodeSize(node) {
    // Tamaño base
    let size = 2;

    // Ajustar según el tipo de nodo
    const nodeLabel =
      node.labels && node.labels.length > 0 ? node.labels[0] : "default";

    switch (nodeLabel) {
      case "Movie":
        size = 3; // Movies más grandes
        break;
      case "Person":
        size = 2.5; // Persons medianos
        break;
      case "Product":
        size = 2.2; // Products un poco más pequeños
        break;
      case "User":
        size = 2.3; // Users
        break;
      case "Category":
        size = 2.8; // Categories más grandes
        break;
      default:
        size = 2;
    }

    // Añadir variación aleatoria
    size += Math.random() * 0.5;

    // Ajustar según propiedades del nodo si existen
    if (node.properties) {
      if (node.properties.size) {
        size *= node.properties.size;
      }

      // Si es un producto, ajustar según el precio
      if (nodeLabel === "Product" && node.properties.price) {
        // Incrementar tamaño según precio (normalizado)
        const priceBonus = Math.min(node.properties.price / 100, 1.5);
        size *= 1 + priceBonus * 0.5;
      }
    }

    return size;
  }

  /**
   * Genera conexiones basadas en las relaciones de Neo4j
   * Respeta exactamente las conexiones definidas en Neo4j
   */
  generateConnectionsFromNeo4j() {
    console.log("Generating connections from Neo4j relationships...");
    console.log(`Total relationships to process: ${this.relationships.length}`);

    this.brain.connections = [];
    this.connectionMap.clear();

    // Debug counter for missing nodes
    let missingSourceCount = 0;
    let missingTargetCount = 0;
    let successCount = 0;

    // Contar relaciones por tipo
    const relByType = {};

    // Crear conexiones para cada relación exacta de Neo4j
    this.relationships.forEach((relationship, index) => {
      // Contar por tipo
      relByType[relationship.type] = (relByType[relationship.type] || 0) + 1;

      // Debug the first few relationships
      if (index < 5) {
        console.log(`Relationship ${index}:`, {
          id: relationship.id,
          type: relationship.type,
          sourceId: relationship.sourceId,
          targetId: relationship.targetId,
        });
      }

      const sourceNode = this.nodeMap.get(relationship.sourceId);
      const targetNode = this.nodeMap.get(relationship.targetId);

      // Debug missing nodes
      if (!sourceNode) {
        missingSourceCount++;
        if (missingSourceCount <= 3) {
          console.warn(
            `Source node missing for relationship ${index}, sourceId: ${relationship.sourceId}`
          );
        }
      }

      if (!targetNode) {
        missingTargetCount++;
        if (missingTargetCount <= 3) {
          console.warn(
            `Target node missing for relationship ${index}, targetId: ${relationship.targetId}`
          );
        }
      }

      // Solo crear conexión si ambos nodos existen
      if (sourceNode && targetNode) {
        successCount++;

        // Determinar color basado en el tipo de relación
        const color =
          this.relationshipColorMap[relationship.type] ||
          this.relationshipColorMap.default;

        // Configuración de la conexión
        const connectionConfig = {
          ...this.brain.connectionConfig,
          color,
          thickness: 0.5 + Math.random() * 0.5, // Menos variación para uniformidad
          relationshipData: relationship, // Pasamos los datos Neo4j a la conexión
          opacity: 0.2, // Opacidad baja por defecto
          pulseSpeed: 0.5, // Velocidad de pulso baja por defecto
          pulseIntensity: 0.5, // Intensidad de pulso baja por defecto
        };

        // Crear conexión
        const connection = new NeuronConnection(
          sourceNode.neuron,
          targetNode.neuron,
          connectionConfig
        );

        // Desactivar animación al inicio
        if (connection.isAnimated !== undefined) {
          connection.isAnimated = false;
        }
        if (connection.isActive !== undefined) {
          connection.isActive = false;
        }

        // Asegurar que la emissiveIntensity es baja
        if (connection.material) {
          connection.material.emissiveIntensity = 0.2;
        }

        // Añadir a la escena y al mapa
        this.brain.scene.add(connection.getMesh());
        this.brain.connections.push(connection);
        this.connectionMap.set(relationship.id, {
          connection,
          data: relationship,
        });
      }
    });

    console.log(`Created ${this.connectionMap.size} connections`);
    console.log(
      `Missing source nodes: ${missingSourceCount}, Missing target nodes: ${missingTargetCount}, Success: ${successCount}`
    );
    console.log("Distribución de relaciones por tipo:", relByType);

    // Display some node IDs for debugging
    console.log(
      "Available nodes in nodeMap:",
      Array.from(this.nodeMap.keys()).slice(0, 5)
    );
  }

  /**
   * Finds a neuron by Neo4j node ID
   * @param {string} nodeId - Neo4j node ID
   * @returns {Object|null} Object containing the neuron and data or null
   */
  findNeuronByNodeId(nodeId) {
    return this.nodeMap.get(nodeId) || null;
  }

  /**
   * Finds a connection by Neo4j relationship ID
   * @param {string} relationshipId - Neo4j relationship ID
   * @returns {Object|null} Object containing the connection and data or null
   */
  findConnectionByRelationshipId(relationshipId) {
    return this.connectionMap.get(relationshipId) || null;
  }

  /**
   * Highlights a neuron and its connections
   * @param {string} nodeId - Neo4j node ID
   */
  highlightNode(nodeId) {
    // Reset all elements
    this.resetHighlights();

    // Get the neuron
    const neuronObj = this.findNeuronByNodeId(nodeId);
    if (!neuronObj) return;

    // Highlight the neuron
    neuronObj.neuron.updateBrightness(3.0);

    // Find all connections related to this node
    this.relationships.forEach((relationship) => {
      if (
        relationship.sourceId === nodeId ||
        relationship.targetId === nodeId
      ) {
        const connectionObj = this.findConnectionByRelationshipId(
          relationship.id
        );
        if (connectionObj) {
          // Highlight the connection
          connectionObj.connection.updateOpacity(1.0);
          connectionObj.connection.updatePulseEffect(8.0, 2.0);

          // Activar la animación
          if (typeof connectionObj.connection.isAnimated !== "undefined") {
            connectionObj.connection.isAnimated = true;
          }
          if (typeof connectionObj.connection.isActive !== "undefined") {
            connectionObj.connection.isActive = true;
          }

          // Highlight the other node
          const otherNodeId =
            relationship.sourceId === nodeId
              ? relationship.targetId
              : relationship.sourceId;

          const otherNeuronObj = this.findNeuronByNodeId(otherNodeId);
          if (otherNeuronObj) {
            otherNeuronObj.neuron.updateBrightness(2.0);
          }
        }
      }
    });
  }

  /**
   * Resets all highlights
   */
  resetHighlights() {
    // Reset all neurons
    this.nodeMap.forEach((nodeObj) => {
      // Desactivar el efecto resplandeciente pasando la referencia a la escena
      if (typeof nodeObj.neuron.setActive === "function") {
        console.log("Desactivando efectos visuales de neurona");
        nodeObj.neuron.setActive(false, this.brain.scene);
      } else {
        // Fallback si no tiene el método setActive
        nodeObj.neuron.updateBrightness(0.15);
        nodeObj.neuron.updateOpacity(0.08);
      }

      // Restaurar escala original si se había modificado
      if (nodeObj.neuron.mesh && nodeObj.neuron.originalScale) {
        nodeObj.neuron.mesh.scale.copy(nodeObj.neuron.originalScale);
        nodeObj.neuron.originalScale = null;
      }

      // Desactivar pulso
      if (nodeObj.neuron.pulse) {
        nodeObj.neuron.pulse = false;
      }
    });

    // Reset all connections
    this.connectionMap.forEach((connectionObj) => {
      connectionObj.connection.updateOpacity(0.05);

      // Desactivar la animación
      if (typeof connectionObj.connection.isAnimated !== "undefined") {
        connectionObj.connection.isAnimated = false;
      }
      if (typeof connectionObj.connection.isActive !== "undefined") {
        connectionObj.connection.isActive = false;
      }

      // Establecer una intensidad de emisión muy baja
      if (connectionObj.connection.material) {
        connectionObj.connection.material.emissiveIntensity = 0.1;
      }
    });

    // Eliminar efectos resplandecientes
    this.glowingSpheres.forEach((glowEffect) => {
      if (glowEffect && glowEffect.dispose) {
        glowEffect.dispose();
      }
    });
    this.glowingSpheres.clear();

    console.log("Todos los efectos visuales han sido reseteados");
  }

  /**
   * Updates the visualization with new data
   */
  async refresh() {
    try {
      console.log("Refreshing visualization with new data...");

      // Reset data service to force data reload
      this.dataService.reset();

      // Reload and visualize data
      await this.loadData();

      console.log(
        `Relationships available for visualization: ${this.relationships.length}`
      );
      if (this.relationships.length > 0) {
        console.log("First relationship sample:", this.relationships[0]);
      } else {
        console.warn(
          "No relationships found after refresh. This might indicate your query returned no results."
        );
      }

      // Print query results for debugging
      console.log("QUERY RESULTS:");
      console.log(`Nodes: ${this.nodes.length}`);
      console.log(`Relationships: ${this.relationships.length}`);

      // Show node types
      const nodeTypes = new Map();
      this.nodes.forEach((node) => {
        if (node.labels && node.labels.length > 0) {
          const label = node.labels[0];
          nodeTypes.set(label, (nodeTypes.get(label) || 0) + 1);
        }
      });
      console.log("Node types:", Object.fromEntries(nodeTypes));

      // Show relationship types
      const relTypes = new Map();
      this.relationships.forEach((rel) => {
        relTypes.set(rel.type, (relTypes.get(rel.type) || 0) + 1);
      });
      console.log("Relationship types:", Object.fromEntries(relTypes));

      // Limpiar visuales existentes y generar nuevos
      this.cleanupVisuals();
      this.generateNeuronsFromNeo4j();
      this.generateConnectionsFromNeo4j();

      // Actualizar el wireframe si existe
      if (this.ellipsoidMesh) {
        this.brain.scene.remove(this.ellipsoidMesh);
        this.toggleEllipsoidWireframe(
          true,
          this.ellipsoidMesh.material.color.getHex()
        );
      }
    } catch (error) {
      console.error("Error refreshing visualization:", error);
    }
  }

  /**
   * Muestra u oculta una malla wireframe del elipsoide para visualizar la zona donde se generan las neuronas
   * @param {boolean} visible - Si debe mostrarse o no
   * @param {number} color - Color del wireframe (hexadecimal)
   */
  toggleEllipsoidWireframe(visible = true, color = 0xffffff) {
    // Eliminar malla existente si hay alguna
    if (this.ellipsoidMesh) {
      this.brain.scene.remove(this.ellipsoidMesh);
      this.ellipsoidMesh = null;
    }

    if (visible) {
      // Obtener la configuración del elipsoide
      const { ellipsoidConfig } = this.brain;
      const { radius, scaleX, scaleY, scaleZ, position } = ellipsoidConfig;

      // Crear una geometría de esfera
      const geometry = new THREE.SphereGeometry(radius, 32, 24);

      // Escalar para crear un elipsoide
      geometry.scale(scaleX, scaleY, scaleZ);

      // Crear material wireframe
      const material = new THREE.MeshBasicMaterial({
        color: color,
        wireframe: true,
        transparent: true,
        opacity: 0.3,
      });

      // Crear malla
      this.ellipsoidMesh = new THREE.Mesh(geometry, material);
      this.ellipsoidMesh.position.copy(position);

      // Añadir a la escena
      this.brain.scene.add(this.ellipsoidMesh);

      console.log("Mostrando wireframe del elipsoide");
    } else {
      console.log("Ocultando wireframe del elipsoide");
    }
  }

  /**
   * Genera los elementos visuales (neuronas y conexiones)
   */
  generateVisuals() {
    // Limpiar elementos previos si existen
    this.cleanupVisuals();

    // Generar neuronas y conexiones
    this.generateNeuronsFromNeo4j();
    this.generateConnectionsFromNeo4j();

    console.log(
      `Visualization created with ${this.nodeMap.size} neurons and ${this.connectionMap.size} connections`
    );
  }

  /**
   * Limpia todas las neuronas y conexiones existentes
   */
  cleanupVisuals() {
    // Eliminar neuronas existentes
    if (this.brain.neurons.length > 0) {
      console.log("Cleaning up existing neurons...");
      this.brain.neurons.forEach((neuron) => {
        this.brain.scene.remove(neuron.getMesh());
      });
      this.brain.neurons = [];
    }

    // Eliminar conexiones existentes
    if (this.brain.connections.length > 0) {
      console.log("Cleaning up existing connections...");
      this.brain.connections.forEach((connection) => {
        this.brain.scene.remove(connection.getMesh());
      });
      this.brain.connections = [];
    }

    // Limpiar mapas
    this.nodeMap.clear();
    this.connectionMap.clear();
  }

  /**
   * Crea un efecto resplandeciente alrededor de una neurona
   * @param {Neuron} neuron - La neurona a la que añadir el resplandor
   * @param {number} color - Color del resplandor
   * @returns {Object} Objeto que contiene el efecto y función de actualización
   */
  createGlowingEffect(neuron, color = 0x84ccff) {
    if (!neuron || !neuron.mesh || !this.brain.scene || !this.brain.camera) {
      console.warn(
        "No se puede crear efecto resplandeciente - neurona o escena no disponible"
      );
      return null;
    }

    // Obtener la posición y tamaño de la neurona
    const position = neuron.mesh.position.clone();
    const size = neuron.size * 5.0; // Hacer el resplandor MUCHO más grande (era 1.8)

    // Crea la geometría de la esfera
    const geometry = new THREE.SphereGeometry(size, 32, 32);

    // Convertir color hexadecimal a THREE.Color y hacerlo más brillante
    const glowColor = new THREE.Color(color);
    // Aumentar la saturación del color para hacerlo más intenso
    const hsl = {};
    glowColor.getHSL(hsl);
    glowColor.setHSL(
      hsl.h,
      Math.min(hsl.s + 0.3, 1.0),
      Math.min(hsl.l + 0.3, 1.0)
    );

    // Material con efecto de resplandor INTENSIFICADO
    const material = new THREE.ShaderMaterial({
      uniforms: {
        c: { type: "f", value: 0.2 }, // Reducido para expandir el resplandor (era 0.9)
        p: { type: "f", value: 1.5 }, // Reducido para expandir el resplandor (era 3.5)
        glowColor: { type: "c", value: glowColor },
        viewVector: { type: "v3", value: this.brain.camera.position.clone() },
        uTime: { type: "f", value: 0.0 }, // Para animación
      },
      vertexShader: glowVertexShader,
      fragmentShader: glowFragmentShader,
      side: THREE.FrontSide,
      blending: THREE.AdditiveBlending, // Crucial para el efecto de brillo
      transparent: true, // Necesario para blending
      depthWrite: false, // Previene problemas con transparencia
    });

    // Crea la esfera resplandeciente
    const glowMesh = new THREE.Mesh(geometry, material);
    glowMesh.position.copy(position);
    glowMesh.scale.multiplyScalar(1.2); // Escalar adicionalmente para hacerla más grande
    this.brain.scene.add(glowMesh);

    // Añadir una luz puntual MUCHO más intensa para potenciar el efecto
    const light = new THREE.PointLight(color, 3.0, size * 6); // Intensidad 3.0 (era 1.0), rango ampliado
    light.position.copy(position);
    this.brain.scene.add(light);

    // Añadir una segunda capa de resplandor más amplia y difusa
    const outerGlowGeometry = new THREE.SphereGeometry(size * 1.8, 32, 32);

    // Color para la capa externa (más claro y translúcido)
    const outerGlowColor = new THREE.Color(color);
    outerGlowColor.setHSL(
      hsl.h,
      Math.min(hsl.s * 0.8, 1.0),
      Math.min(hsl.l * 1.5, 1.0)
    );

    // Material para la capa externa
    const outerGlowMaterial = new THREE.ShaderMaterial({
      uniforms: {
        c: { type: "f", value: 0.1 }, // Muy bajo para expandir mucho
        p: { type: "f", value: 1.0 }, // Muy bajo para expansión máxima
        glowColor: { type: "c", value: outerGlowColor },
        viewVector: { type: "v3", value: this.brain.camera.position.clone() },
        uTime: { type: "f", value: 0.0 }, // Para animación
      },
      vertexShader: glowVertexShader,
      fragmentShader: glowFragmentShader,
      side: THREE.BackSide, // BackSide para efecto exterior
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });

    const outerGlowMesh = new THREE.Mesh(outerGlowGeometry, outerGlowMaterial);
    outerGlowMesh.position.copy(position);
    this.brain.scene.add(outerGlowMesh);

    // Añadir un efecto de lente óptica para realzar la sensación de brillo
    const lensFlareSize = size * 5;
    const lensFlareTexture = new THREE.TextureLoader().load(
      "https://threejs.org/examples/textures/lensflare/lensflare0.png",
      (texture) => {
        texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
      }
    );

    // Crea un material para el lens flare
    const lensFlareGeometry = new THREE.PlaneGeometry(
      lensFlareSize,
      lensFlareSize
    );
    const lensFlareMaterial = new THREE.MeshBasicMaterial({
      map: lensFlareTexture,
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
      color: glowColor,
    });

    const lensFlare = new THREE.Mesh(lensFlareGeometry, lensFlareMaterial);
    lensFlare.position.copy(position);
    this.brain.scene.add(lensFlare);

    // Función para hacer que el lens flare siempre mire a la cámara
    const updateLensFlare = () => {
      if (lensFlare && this.brain.camera) {
        lensFlare.lookAt(this.brain.camera.position);
      }
    };

    // Llamar la primera vez
    updateLensFlare();

    return {
      mesh: glowMesh,
      outerMesh: outerGlowMesh,
      lensFlare: lensFlare,
      light: light,
      neuron: neuron,
      update: (time) => {
        // Actualiza el tiempo para animaciones
        material.uniforms.uTime.value = time;
        outerGlowMaterial.uniforms.uTime.value = time * 0.7; // Velocidad diferente para variación

        // Actualiza viewVector para responder a la posición de la cámara
        if (this.brain.camera) {
          material.uniforms.viewVector.value =
            this.brain.camera.position.clone();
          outerGlowMaterial.uniforms.viewVector.value =
            this.brain.camera.position.clone();

          // Actualizar lens flare para que siempre mire a la cámara
          updateLensFlare();
        }

        // Si la neurona se ha movido, actualizar posición
        if (neuron.mesh) {
          const newPosition = neuron.mesh.position.clone();
          glowMesh.position.copy(newPosition);
          outerGlowMesh.position.copy(newPosition);
          lensFlare.position.copy(newPosition);
          light.position.copy(newPosition);

          // Pulsar la intensidad de la luz
          light.intensity = 3.0 + Math.sin(time * 3) * 1.5;
        }
      },
      dispose: () => {
        // Limpiar recursos
        this.brain.scene.remove(glowMesh);
        this.brain.scene.remove(outerGlowMesh);
        this.brain.scene.remove(lensFlare);
        this.brain.scene.remove(light);

        geometry.dispose();
        material.dispose();
        outerGlowGeometry.dispose();
        outerGlowMaterial.dispose();
        lensFlareGeometry.dispose();
        lensFlareMaterial.dispose();
      },
    };
  }

  /**
   * Inicia la animación de los efectos resplandecientes
   */
  startGlowAnimation() {
    const animate = () => {
      // Request next animation frame
      this.animationFrameId = requestAnimationFrame(animate);

      // FPS limiting
      const now = performance.now();
      const elapsed = now - this.lastFrameTime;

      // Skip frame if less than frameInterval ms has passed
      if (elapsed < this.frameInterval) {
        return;
      }

      // Update lastFrameTime
      this.lastFrameTime = now - (elapsed % this.frameInterval);

      // Actualizar todos los efectos resplandecientes activos
      const time = this.clock.getElapsedTime();
      this.glowingSpheres.forEach((glowEffect) => {
        if (glowEffect && glowEffect.update) {
          glowEffect.update(time);
        }
      });
    };

    animate();
  }

  /**
   * Procesa peticiones de activación desde el API
   * @param {Array} nodeData - Array de objetos con id y name de los nodos a activar
   */
  processApiActivation(nodeData) {
    // Convertir nodeData a formato consistente
    const nodeIds = nodeData.map((node) =>
      typeof node === "object" ? node.id : node
    );

    // Actualizar lista de nodos activos con nombres
    this.activeNodes = nodeData.map((node) => {
      return typeof node === "object"
        ? node
        : { id: node, name: `Neuron ${node}` };
    });

    // Resetear estado previo
    this.resetHighlights();

    // Limpiar efectos resplandecientes anteriores
    this.glowingSpheres.forEach((glowEffect) => {
      if (glowEffect && glowEffect.dispose) {
        glowEffect.dispose();
      }
    });
    this.glowingSpheres.clear();

    if (!nodeIds || nodeIds.length === 0) {
      console.log("No hay nodos activos para destacar");
      return;
    }

    console.log(`Activando ${nodeIds.length} nodos desde API:`, nodeData);

    // 1. Primero activar TODOS los nodos solicitados con alta intensidad
    nodeIds.forEach((nodeId) => {
      const neuronObj = this.findNeuronByNodeId(nodeId);
      if (neuronObj) {
        // Activar el nodo independientemente de sus conexiones
        if (typeof neuronObj.neuron.setActive === "function") {
          console.log(`Activando nodo ${nodeId} con efectos visuales`);
          neuronObj.neuron.setActive(true, this.brain.scene);
        }

        // Asegurar alta visibilidad
        neuronObj.neuron.updateBrightness(10.0);
        neuronObj.neuron.updateOpacity(5.0);

        // Hacer el nodo más grande
        if (neuronObj.neuron.mesh) {
          if (!neuronObj.neuron.originalScale) {
            neuronObj.neuron.originalScale =
              neuronObj.neuron.mesh.scale.clone();
          }
          neuronObj.neuron.mesh.scale.multiplyScalar(1.2);
        }

        // Crear efecto resplandeciente para TODOS los nodos activos
        const glowEffect = this.createGlowingEffect(
          neuronObj.neuron,
          this.getNodeColor(neuronObj.data)
        );
        if (glowEffect) {
          this.glowingSpheres.set(nodeId, glowEffect);
        }
      } else {
        console.warn(`Nodo con ID ${nodeId} no encontrado en la visualización`);
      }
    });

    // 2. Luego, procesar las conexiones si existen
    if (nodeIds.length > 1) {
      this.relationships.forEach((relationship) => {
        const sourceId = relationship.sourceId;
        const targetId = relationship.targetId;

        // Activar conexión si conecta dos nodos activos
        if (nodeIds.includes(sourceId) && nodeIds.includes(targetId)) {
          const connectionObj = this.findConnectionByRelationshipId(
            relationship.id
          );
          if (connectionObj) {
            connectionObj.connection.updateOpacity(1.0);
            connectionObj.connection.updatePulseEffect(12.0, 5.0);

            if (connectionObj.connection.material) {
              connectionObj.connection.material.emissiveIntensity = 2.5;
            }

            // Activar animación
            if (typeof connectionObj.connection.isAnimated !== "undefined") {
              connectionObj.connection.isAnimated = true;
            }
            if (typeof connectionObj.connection.isActive !== "undefined") {
              connectionObj.connection.isActive = true;
            }
          }
        }
      });
    }
  }

  /**
   * Actualiza la animación para todos los elementos
   * @param {number} deltaTime - Tiempo transcurrido desde el último frame
   */
  updateAnimations(deltaTime) {
    // Skip updating distant objects or use LOD (Level of Detail)
    const camera = this.brain.camera;
    if (!camera) return;

    // Actualizar neuronas
    this.nodeMap.forEach((nodeObj) => {
      if (typeof nodeObj.neuron.animate === "function") {
        nodeObj.neuron.animate(deltaTime);
      }
    });

    // Actualizar los efectos resplandecientes
    const time = this.clock ? this.clock.getElapsedTime() : 0;
    this.glowingSpheres.forEach((glowEffect) => {
      if (glowEffect && glowEffect.update) {
        glowEffect.update(time);
      }
    });

    // Actualizar las conexiones
    this.connectionMap.forEach((connectionObj) => {
      if (typeof connectionObj.connection.update === "function") {
        connectionObj.connection.update(deltaTime);
      }
    });

    // Apply LOD based on distance
    Array.from(this.nodeMap.values()).forEach((nodeData) => {
      const neuron = nodeData.neuron;
      if (neuron && neuron.mesh) {
        const distance = camera.position.distanceTo(neuron.mesh.position);

        // Skip animation updates for distant neurons
        if (distance > 300) return;

        // ... existing animation code for this neuron ...
      }
    });
  }

  /**
   * Inicializa el cliente API que se conecta al servidor y maneja activaciones
   * @param {string} serverUrl - URL del servidor API
   */
  initializeApiClient(serverUrl = "http://localhost:3000/api/brain") {
    console.log(`Iniciando cliente API con URL: ${serverUrl}`);

    // Crear una función para verificar el estado
    const checkStatus = async () => {
      try {
        console.log("Consultando estado de API...");
        const response = await fetch(`${serverUrl}/status`);

        if (response.ok) {
          const data = await response.json();
          console.log("Estado API recibido:", data);

          // Solo procesar si hay cambios en los nodos activos
          const newActiveNodes = data.activeNodes || [];
          const currentActiveStr = JSON.stringify(this.activeNodes.sort());
          const newActiveStr = JSON.stringify(newActiveNodes.sort());

          if (currentActiveStr !== newActiveStr) {
            console.log("Cambio detectado en nodos activos");
            this.processApiActivation(newActiveNodes);
          }
        } else {
          console.error("Error consultando API:", response.statusText);
        }
      } catch (error) {
        console.error("Error consultando API:", error);
      }
    };

    // Verificar estado inmediatamente
    checkStatus();

    // Configurar intervalo para polling
    this.apiPollingInterval = setInterval(
      checkStatus,
      this.options.pollingInterval
    );

    console.log(
      `API polling configurado cada ${this.options.pollingInterval}ms`
    );

    // Configurar el loop de animación para actualizar efectos visuales
    if (!this.animationLoopStarted) {
      this.animationLoopStarted = true;

      // Crear un reloj para animaciones
      if (!this.clock) {
        this.clock = new THREE.Clock();
      }

      const animate = () => {
        requestAnimationFrame(animate);
        const deltaTime = this.clock.getDelta();
        this.updateAnimations(deltaTime);
      };

      animate();
      console.log("Loop de animación iniciado para efectos visuales");
    }
  }

  /**
   * Método utilitario para activar nodos manualmente
   * @param {Array} nodeIds - IDs de los nodos a activar
   */
  activateNodes(nodeIds) {
    if (!Array.isArray(nodeIds) || nodeIds.length === 0) {
      console.warn("No se proporcionaron IDs de nodos válidos para activar");
      return;
    }

    console.log(`Activando manualmente ${nodeIds.length} nodos:`, nodeIds);

    // Enviar petición al API si está habilitado
    if (this.options.enableApiPolling) {
      this.sendActivationRequest(nodeIds);
    } else {
      // Activar localmente sin API
      this.processApiActivation(nodeIds);
    }
  }

  /**
   * Envía una petición al API para activar nodos
   * @param {Array} nodeIds - IDs de los nodos a activar
   * @param {boolean} append - Si se debe añadir a los nodos ya activos
   */
  async sendActivationRequest(nodeIds, append = false) {
    if (!this.options.apiUrl) {
      console.error("No se ha configurado URL de API");
      return;
    }

    try {
      console.log(`Enviando petición para activar nodos:`, nodeIds);
      console.log(`Modo: ${append ? "append" : "replace"}`);

      const response = await fetch(`${this.options.apiUrl}/activate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nodeIds: nodeIds,
          append: append,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log("Respuesta de activación:", data);

        // Actualizar localmente para estar sincronizados con el servidor
        if (data.activeNodes) {
          this.activeNodes = data.activeNodes;
        }
      } else {
        console.error("Error activando nodos:", response.statusText);
      }
    } catch (error) {
      console.error("Error enviando petición de activación:", error);
    }
  }

  /**
   * Resetea la visualización enviando una petición al API
   */
  async resetVisualization() {
    console.log("Reseteando visualización");

    // Enviar petición al API si está habilitado
    if (this.options.enableApiPolling) {
      try {
        const response = await fetch(`${this.options.apiUrl}/reset`, {
          method: "POST",
        });

        if (response.ok) {
          console.log("Visualización reseteada exitosamente");
        } else {
          console.error("Error reseteando visualización:", response.statusText);
        }
      } catch (error) {
        console.error("Error enviando petición de reset:", error);
      }
    } else {
      // Resetear localmente sin API
      this.resetHighlights();
      this.activeNodes = [];
    }
  }

  /**
   * Creates and returns a shared geometry to be reused
   * @param {string} key - Unique identifier for the geometry
   * @param {Function} createFn - Function that creates the geometry if it doesn't exist
   * @returns {THREE.BufferGeometry} The requested geometry
   */
  getSharedGeometry(key, createFn) {
    if (!this.sharedGeometries[key]) {
      this.sharedGeometries[key] = createFn();
    }
    return this.sharedGeometries[key];
  }

  /**
   * Creates and returns a shared material to be reused
   * @param {string} key - Unique identifier for the material
   * @param {Function} createFn - Function that creates the material if it doesn't exist
   * @returns {THREE.Material} The requested material
   */
  getSharedMaterial(key, createFn) {
    if (!this.sharedMaterials[key]) {
      this.sharedMaterials[key] = createFn();
    }
    return this.sharedMaterials[key];
  }

  /**
   * Clean up resources to prevent memory leaks
   */
  dispose() {
    console.log("Disposing GraphVisualizer resources...");

    // Cancel animation frame
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Clean up brain instance
    if (this.brain && typeof this.brain.dispose === "function") {
      this.brain.dispose();
    }

    // Clear node and connection maps to remove references
    this.nodeMap.clear();
    this.connectionMap.clear();

    // Dispose shared geometries
    Object.values(this.sharedGeometries).forEach((geometry) => {
      if (geometry && typeof geometry.dispose === "function") {
        geometry.dispose();
      }
    });
    this.sharedGeometries = {};

    // Dispose shared materials
    Object.values(this.sharedMaterials).forEach((material) => {
      if (material && typeof material.dispose === "function") {
        material.dispose();
      }
    });
    this.sharedMaterials = {};

    // Clear other object references
    this.glowingSpheres.clear();

    // Remove event listeners if any
    // ... code to remove event listeners ...

    console.log("GraphVisualizer disposed successfully");
  }

  /**
   * Creates a neuron for a single node
   * @param {Object} node - Neo4j node data
   * @returns {Object|null} The created neuron object or null if failed
   */
  createNeuronForNode(node) {
    try {
      if (!node || !node.id) return null;

      // Skip if this node already has a neuron
      if (this.nodeMap.has(node.id)) {
        return this.nodeMap.get(node.id);
      }

      // Get node color based on its labels
      const nodeColor = this.getNodeColor(node);

      // Generate position for the neuron
      const position = this.generateNodePosition(node);

      // Use simpler materials for distant neurons
      const distance = this.brain.camera
        ? this.brain.camera.position.distanceTo(position)
        : 0;

      // Create neuron
      const neuron = this.brain.createNeuron(position, {
        color: nodeColor,
        size: this.getNodeSize(node),
        opacity: distance > 300 ? 0.05 : 0.08, // Lower opacity for distant nodes
        brightness: distance > 300 ? 0.1 : 0.15, // Lower brightness for distant
        useLOD: true, // Enable Level of Detail
      });

      // Store the neuron in the map with its Neo4j node data
      this.nodeMap.set(node.id, {
        neuron,
        data: node,
        position,
        isActive: false,
        glowEffect: null,
      });

      return this.nodeMap.get(node.id);
    } catch (error) {
      console.error(`Error creating neuron for node ${node.id}:`, error);
      return null;
    }
  }

  /**
   * Generates a position for a node
   * @param {Object} node - Neo4j node data
   * @returns {THREE.Vector3} The position vector
   */
  generateNodePosition(node) {
    // Reuse existing functionality to place nodes properly
    // This can use any positioning algorithm from your existing code

    // Generate a random position inside the ellipsoid as fallback
    const ellipsoidPosition = new THREE.Vector3();
    if (this.brain && this.brain.neuronEllipsoid) {
      this.brain.neuronEllipsoid.getWorldPosition(ellipsoidPosition);
    }

    // Random position inside ellipsoid with some randomization
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const radius =
      Math.cbrt(Math.random()) *
      (this.brain.ellipsoidConfig?.radius || 50) *
      0.9;

    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.sin(phi) * Math.sin(theta);
    const z = radius * Math.cos(phi);

    // Apply ellipsoid scaling
    const scaleX = this.brain.ellipsoidConfig?.scaleX || 3.5;
    const scaleY = this.brain.ellipsoidConfig?.scaleY || 2.7;
    const scaleZ = this.brain.ellipsoidConfig?.scaleZ || 4.5;

    return new THREE.Vector3(
      ellipsoidPosition.x + x * scaleX,
      ellipsoidPosition.y + y * scaleY,
      ellipsoidPosition.z + z * scaleZ
    );
  }

  /**
   * Gets the color for a node based on its labels
   * @param {Object} node - Neo4j node data
   * @returns {number} Hex color value
   */
  getNodeColor(node) {
    if (!node.labels || node.labels.length === 0) {
      return this.nodeColorMap.default || 0xffffff;
    }

    // Try to find a color for any of the node's labels
    for (const label of node.labels) {
      if (this.nodeColorMap[label]) {
        return this.nodeColorMap[label];
      }
    }

    return this.nodeColorMap.default || 0xffffff;
  }
}

export default GraphVisualizer;
