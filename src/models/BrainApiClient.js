/**
 * Cliente API simple para controlar el cerebro desde el servidor Node.js
 */
class BrainApiClient {
  constructor(brain, options = {}) {
    this.brain = brain;
    this.options = {
      pollInterval: 2000, // Intervalo de polling en ms
      apiUrl: "http://localhost:3000/api/brain", // URL base del endpoint en el servidor Node
      ...options,
    };

    this.activeNodeIds = new Set();
    this.activeConnections = new Set();
    this.isPolling = false;
    this.pollingId = null;
  }

  /**
   * Inicia el polling para buscar actualizaciones
   */
  startPolling() {
    if (this.isPolling) return;

    this.isPolling = true;
    console.log(
      `Iniciando polling a ${this.options.apiUrl}/status cada ${this.options.pollInterval}ms`
    );

    // Realizar la primera consulta inmediatamente
    this.checkBrainStatus();

    // Luego configurar el polling periódico
    this.pollingId = setInterval(() => {
      this.checkBrainStatus();
    }, this.options.pollInterval);
  }

  /**
   * Detiene el polling
   */
  stopPolling() {
    if (this.pollingId) {
      clearInterval(this.pollingId);
      this.pollingId = null;
      this.isPolling = false;
      console.log("Polling detenido");
    }
  }

  /**
   * Consulta el estado actual del cerebro en el servidor
   */
  async checkBrainStatus() {
    try {
      const response = await fetch(`${this.options.apiUrl}/status`);
      if (!response.ok) {
        throw new Error(`Error de servidor: ${response.status}`);
      }

      const data = await response.json();
      this.updateBrainState(data);
    } catch (error) {
      console.warn("Error al consultar estado del cerebro:", error.message);
    }
  }

  /**
   * Actualiza el estado del cerebro según la respuesta del servidor
   */
  updateBrainState(data) {
    if (!data || !this.brain) return;

    console.log("Actualizando estado del cerebro desde API:", data);

    // Limpiar estado previo
    this.resetBrainState();

    // Registrar y activar TODOS los nodos activos primero
    const activeNodeIds = data.activeNodes || [];

    console.log("Nodos a activar:", activeNodeIds);

    // PRIMERO: Activar TODOS los nodos independientemente de sus conexiones
    activeNodeIds.forEach((nodeId) => {
      const neuron = this.findNeuronById(nodeId);
      if (neuron) {
        console.log(`BrainApiClient: Activando nodo ${nodeId}`);
        this.activeNodeIds.add(nodeId);

        // Activar el nodo con máxima intensidad
        if (typeof neuron.setActive === "function") {
          neuron.setActive(true, this.brain.scene);
        }
        neuron.updateBrightness(10.0);
        neuron.updateOpacity(5.0);

        // Escalar el nodo para hacerlo más visible
        if (neuron.mesh && !neuron.originalScale) {
          neuron.originalScale = neuron.mesh.scale.clone();
          neuron.mesh.scale.multiplyScalar(1.2);
        }
      } else {
        console.warn(`BrainApiClient: Nodo no encontrado: ${nodeId}`);
      }
    });

    // SEGUNDO: Procesar conexiones si existen (esto es secundario)
    if (activeNodeIds.length >= 2) {
      this.processActiveConnections(activeNodeIds);
    }
  }

  /**
   * Procesa las conexiones entre nodos activos
   */
  processActiveConnections(activeNodeIds) {
    // Verificar cada posible par de nodos activos
    for (let i = 0; i < activeNodeIds.length; i++) {
      for (let j = i + 1; j < activeNodeIds.length; j++) {
        const sourceId = activeNodeIds[i];
        const targetId = activeNodeIds[j];

        const sourceNeuron = this.findNeuronById(sourceId);
        const targetNeuron = this.findNeuronById(targetId);

        if (sourceNeuron && targetNeuron) {
          // Buscar conexión entre estos nodos
          const connection = this.findConnection(sourceNeuron, targetNeuron);
          if (connection) {
            console.log(
              `BrainApiClient: Activando conexión entre ${sourceId} y ${targetId}`
            );
            this.activeConnections.add(connection);
            this.brain.activateConnection(connection);
          }
        }
      }
    }
  }

  /**
   * Encuentra una neurona por su ID
   */
  findNeuronById(nodeId) {
    // Si es un ID numérico directo (formato node-XXX)
    if (nodeId.startsWith("node-")) {
      const numericId = nodeId.replace("node-", "");
      return this.brain.neurons.find((n) => n.numericId === numericId);
    }

    // Si es un ID en formato neuron-X
    if (nodeId.startsWith("neuron-")) {
      return this.brain.neurons.find((n) => n.id === nodeId);
    }

    // Si es solo un número
    return this.brain.neurons.find(
      (n) => n.numericId === nodeId || n.id === `neuron-${nodeId}`
    );
  }

  /**
   * Encuentra una conexión entre dos neuronas
   */
  findConnection(sourceNeuron, targetNeuron) {
    return this.brain.connections.find(
      (conn) =>
        (conn.sourceNeuron === sourceNeuron &&
          conn.targetNeuron === targetNeuron) ||
        (conn.sourceNeuron === targetNeuron &&
          conn.targetNeuron === sourceNeuron)
    );
  }

  /**
   * Restablece el estado de todas las neuronas y conexiones
   */
  resetBrainState() {
    this.activeNodeIds.clear();
    this.activeConnections.clear();

    // Restablecer neuronas con valores más suaves
    if (this.brain.resetNeuronState) {
      this.brain.resetNeuronState();
    } else {
      // Fallback si el método no existe
      this.brain.neurons.forEach((neuron) => {
        // Solo resetear si no está en la lista de nodos activos
        if (!this.activeNodeIds.has(neuron.id)) {
          neuron.updateBrightness(0.15);
          neuron.updateOpacity(0.08);

          if (typeof neuron.setActive === "function") {
            neuron.setActive(false, this.brain.scene);
          }

          // Solo restaurar escala si no está activo
          if (
            neuron.mesh &&
            neuron.originalScale &&
            !this.activeNodeIds.has(neuron.id)
          ) {
            neuron.mesh.scale.copy(neuron.originalScale);
            neuron.originalScale = null;
          }
        }
      });

      // Resetear conexiones con valores más suaves
      this.brain.connections.forEach((connection) => {
        const sourceId = connection.sourceNeuron.id;
        const targetId = connection.targetNeuron.id;

        // Solo resetear si ninguno de los extremos está activo
        if (
          !this.activeNodeIds.has(sourceId) &&
          !this.activeNodeIds.has(targetId)
        ) {
          connection.updateOpacity(0.05);
          if (typeof connection.isActive !== "undefined") {
            connection.isActive = false;
          }
          if (typeof connection.isAnimated !== "undefined") {
            connection.isAnimated = false;
          }
          if (connection.material) {
            connection.material.emissiveIntensity = 0.1;
          }
        }
      });
    }
  }
}

export default BrainApiClient;
