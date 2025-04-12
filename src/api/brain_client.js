// Client-side code to integrate with the Brain visualization

// Function to fetch the current state from the server
async function fetchBrainState() {
  try {
    const response = await fetch("http://localhost:5000/api/brain/status");
    const data = await response.json();
    return data.activeNodes || [];
  } catch (error) {
    console.error("Error fetching brain state:", error);
    return [];
  }
}

// Function to update the Brain visualization with active nodes and connections
function updateBrainVisualization(activeNodes) {
  // Resetear todos los nodos a estado inactivo
  neurons.forEach((neuron) => {
    neuron.material.color.set(0x00ff00);
    neuron.scale.set(1, 1, 1);
    // Actualizar el texto si existe
    if (neuron.textSprite) {
      neuron.textSprite.visible = false;
    }
  });

  // Actualizar nodos activos
  activeNodes.forEach((nodeData) => {
    // Asegurar que nodeData.id sea una cadena
    const nodeId = String(nodeData.id);
    const neuron = neurons.find((n) => String(n.userData.id) === nodeId);
    if (neuron) {
      neuron.material.color.set(0xff0000);
      neuron.scale.set(1.5, 1.5, 1.5);

      // Actualizar o crear texto
      if (!neuron.textSprite) {
        const text = nodeData.name || nodeData.id;
        neuron.textSprite = createTextSprite(text);
        neuron.add(neuron.textSprite);
      }
      neuron.textSprite.visible = true;
    }
  });

  // Actualizar conexiones
  connections.forEach((connection) => {
    // Convertir IDs a cadenas para comparación
    const sourceId = String(connection.userData.source);
    const targetId = String(connection.userData.target);

    const sourceActive = activeNodes.some((n) => String(n.id) === sourceId);
    const targetActive = activeNodes.some((n) => String(n.id) === targetId);

    if (sourceActive && targetActive) {
      connection.material.color.set(0xff0000);
      connection.material.opacity = 1;
    } else {
      connection.material.color.set(0x00ff00);
      connection.material.opacity = 0.3;
    }
  });
}

function createTextSprite(text) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  context.font = "Bold 60px Arial";
  context.fillStyle = "white";
  context.fillText(text, 0, 60);

  const texture = new THREE.CanvasTexture(canvas);
  const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.scale.set(2, 1, 1);
  sprite.position.set(0, 2, 0);

  return sprite;
}

// Initialize and start the polling
function initBrainClient(brain, pollingInterval = 1000) {
  // Add necessary methods to Neuron and NeuronConnection classes if they don't exist

  // Add setActive method to Neuron prototype if it doesn't exist
  if (!brain.neurons[0].setActive) {
    // Implementar desde cero si no existe
    Object.defineProperty(brain.neurons[0].constructor.prototype, "setActive", {
      value: function (active, scene = null) {
        this.isActive = active;
        // Modify appearance based on active state
        if (active) {
          // Increase brightness and opacity when active - valores amplificados
          this.updateBrightness(10.0);
          this.updateOpacity(5.0);

          // Si tenemos acceso a la escena, crear efectos visuales avanzados
          if (scene) {
            // Implementar efectos visuales si la escena está disponible
            this.updateGlowEffect(true, 8.0, 3.0);
          }
        } else {
          // Default state when inactive - muy transparente
          this.updateBrightness(0.2);
          this.updateOpacity(0.1);

          // Desactivar efectos visuales si están activos
          this.updateGlowEffect(false, 0.0, 0.0);

          // Limpiar efectos visuales si existe la escena
          if (scene && this.haloMesh) {
            scene.remove(this.haloMesh);
            scene.remove(this.pointLight);
            this.haloMesh = null;
            this.pointLight = null;
          }
        }
      },
      writable: true,
      configurable: true,
    });
  } else {
    // Si ya existe un método setActive nativo, extenderlo para asegurar valores correctos
    const originalSetActive = brain.neurons[0].setActive;

    brain.neurons[0].constructor.prototype.setActive = function (
      active,
      scene = null
    ) {
      // Primero llamar al método original para mantener su funcionamiento
      originalSetActive.call(this, active, scene || brain.scene);

      // Asegurar valores de brillo y opacidad correctos
      if (active) {
        this.updateBrightness(10.0);
        this.updateOpacity(5.0);
      } else {
        this.updateBrightness(0.2);
        this.updateOpacity(0.1);
      }
    };
  }

  // Add setActive method to NeuronConnection prototype if it doesn't exist
  if (brain.connections.length > 0 && !brain.connections[0].setActive) {
    Object.defineProperty(
      brain.connections[0].constructor.prototype,
      "setActive",
      {
        value: function (active) {
          this.isActive = active;
          // Modify appearance based on active state
          if (active) {
            // Increase opacity and pulse when active
            this.updateOpacity(3.0);
            this.updatePulseEffect(10.0, 8.0);
          } else {
            // Default state when inactive (nearly invisible)
            this.updateOpacity(0.05);
            this.updatePulseEffect(0.1, 0.1);
          }
        },
        writable: true,
        configurable: true,
      }
    );
  }

  // Assign IDs to neurons if they don't have them
  brain.neurons.forEach((neuron, index) => {
    if (!neuron.id) {
      neuron.id = `neuron-${index}`;
    }
    // Initialize all neurons as inactive - asegurar que se pasa scene si es posible
    neuron.setActive(false, brain.scene);
  });

  // Start polling for updates
  setInterval(async () => {
    const state = await fetchBrainState();
    updateBrainVisualization(state);
  }, pollingInterval);

  console.log("Brain client initialized and polling for updates");
}

// Export the initialization function
export { initBrainClient };
