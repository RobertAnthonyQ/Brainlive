export default class TimelineInterface {
  constructor(container) {
    this.container = container;
    this.requests = [];
    this.activeNodes = new Set();
    this.initializeUI();
  }

  initializeUI() {
    const timelineContainer = document.createElement("div");
    timelineContainer.className = "timeline-interface";

    const styles = document.createElement("style");
    styles.textContent = `
      .timeline-interface {
        position: absolute;
        top: 40px;
        right: 40px;
        width: 280px;
        display: flex;
        flex-direction: column;
        gap: 5px;
        z-index: 1000;
      }

      .timeline-content {
        display: flex;
        flex-direction: column;
        gap: 24px;
        max-height: calc(100vh - 100px);
        overflow-y: auto;
        padding-right: 10px;
        position: relative;
      }

      .timeline-content::before {
        content: '';
        position: absolute;
        left: 6px;
        top: 0;
        bottom: 0;
        width: 1px;
        background: linear-gradient(
          to bottom,
          rgba(255, 255, 255, 0) 0%,
          rgba(255, 255, 255, 0.2) 10%,
          rgba(255, 255, 255, 0.2) 90%,
          rgba(255, 255, 255, 0) 100%
        );
      }

      .timeline-group {
        position: relative;
        padding-left: 24px;
        animation: groupAppear 0.3s ease-out;
      }

      @keyframes groupAppear {
        from {
          opacity: 0;
          transform: translateX(10px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }

      .timeline-dot {
        position: absolute;
        left: 0;
        top: 8px;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: currentColor;
        box-shadow: 0 0 10px currentColor;
      }

      .timeline-dot::after {
        content: '';
        position: absolute;
        inset: -2px;
        border-radius: 50%;
        border: 1px solid currentColor;
        opacity: 0.3;
        animation: pulseRing 2s infinite;
      }

      @keyframes pulseRing {
        0% { transform: scale(1); opacity: 0.3; }
        50% { transform: scale(1.5); opacity: 0; }
        100% { transform: scale(1); opacity: 0.3; }
      }

      .timeline-group-header {
        color: rgba(255, 255, 255, 0.7);
        font-size: 11px;
        margin-bottom: 8px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .timeline-group-time {
        font-size: 10px;
        opacity: 0.5;
        font-family: monospace;
      }

      .timeline-nodes {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .timeline-node {
        color: rgba(255, 255, 255, 0.8);
        font-size: 12px;
        padding: 4px 8px;
        border-radius: 4px;
        background: transparent;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .timeline-node:hover {
        background: rgba(255, 255, 255, 0.05);
      }

      .timeline-node.active {
        color: white;
        background: rgba(255, 255, 255, 0.1);
      }

      .timeline-node.active::before {
        background: currentColor;
      }

      .timeline-node::before {
        content: '';
        display: block;
        width: 4px;
        height: 4px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.3);
        flex-shrink: 0;
      }

      .timeline-node-name {
        flex: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .timeline-node-id {
        font-size: 10px;
        opacity: 0.5;
        font-family: monospace;
      }

      .timeline-content::-webkit-scrollbar {
        width: 4px;
      }

      .timeline-content::-webkit-scrollbar-track {
        background: transparent;
      }

      .timeline-content::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 10px;
      }

      .timeline-content::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.2);
      }
    `;

    document.head.appendChild(styles);

    const timelineContent = document.createElement("div");
    timelineContent.className = "timeline-content";
    timelineContainer.appendChild(timelineContent);

    this.container.appendChild(timelineContainer);
    this.timelineContent = timelineContent;
  }

  formatTime() {
    const now = new Date();
    return now.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  getNodeName(node) {
    if (typeof node === "object") {
      if (node.name) return node.name;
      if (node.id) return `Neuron ${node.id}`;
    }
    return `Neuron ${node}`;
  }

  addRequestGroup(requestId, nodes, color = "#42adf5") {
    // Verificar si los nodos ya existen
    if (!nodes || nodes.length === 0) return;

    const group = document.createElement("div");
    group.className = "timeline-group";
    group.style.color = color;

    const dot = document.createElement("div");
    dot.className = "timeline-dot";

    const header = document.createElement("div");
    header.className = "timeline-group-header";

    const title = document.createElement("span");
    title.textContent = requestId.startsWith("API-")
      ? `PROCESSING`
      : `Activation Group ${requestId}`;

    const time = document.createElement("span");
    time.className = "timeline-group-time";
    time.textContent = this.formatTime();

    header.appendChild(title);
    header.appendChild(time);

    const nodesContainer = document.createElement("div");
    nodesContainer.className = "timeline-nodes";

    nodes.forEach((node) => {
      const nodeElement = document.createElement("div");
      nodeElement.className = "timeline-node";

      const nodeId = typeof node === "object" ? node.id : node;
      if (this.activeNodes.has(String(nodeId))) {
        nodeElement.classList.add("active");
      }

      const nodeName = document.createElement("span");
      nodeName.className = "timeline-node-name";
      nodeName.textContent = this.getNodeName(node);

      const nodeIdSpan = document.createElement("span");
      nodeIdSpan.className = "timeline-node-id";
      nodeIdSpan.textContent = `#${nodeId}`;

      nodeElement.appendChild(nodeName);
      nodeElement.appendChild(nodeIdSpan);

      nodesContainer.appendChild(nodeElement);
    });

    group.appendChild(dot);
    group.appendChild(header);
    group.appendChild(nodesContainer);

    requestAnimationFrame(() => {
      this.timelineContent.appendChild(group);
      this.timelineContent.scrollTop = this.timelineContent.scrollHeight;
    });

    this.requests.push({ requestId, nodes, color, timestamp: new Date() });
  }

  toggleNodeActive(node, element) {
    // Esta función ya no es necesaria, pero la mantenemos vacía por si hay referencias
    return;
  }

  updateActiveNodes(activeNodeIds) {
    if (!Array.isArray(activeNodeIds) || activeNodeIds.length === 0) return;

    // Convertir todos los IDs a strings para consistencia
    const normalizedIds = activeNodeIds.map((node) => {
      if (typeof node === "object") {
        return { id: String(node.id), name: node.name };
      }
      return { id: String(node), name: `Neuron ${node}` };
    });

    // Si estos son nuevos nodos activos, crear un nuevo grupo
    const newNodes = normalizedIds.filter(
      (node) => !this.activeNodes.has(node.id)
    );
    if (newNodes.length > 0) {
      this.addRequestGroup(
        "API-" + Date.now(),
        newNodes,
        TimelineInterface.generateColor()
      );
    }

    this.activeNodes = new Set(normalizedIds.map((node) => node.id));

    // Actualizar la UI para reflejar los nodos activos
    const nodeElements =
      this.timelineContent.querySelectorAll(".timeline-node");
    nodeElements.forEach((element) => {
      const nodeId = element
        .querySelector(".timeline-node-id")
        .textContent.slice(1);
      if (this.activeNodes.has(nodeId)) {
        element.classList.add("active");
      } else {
        element.classList.remove("active");
      }
    });
  }

  static generateColor() {
    const colors = [
      "#42adf5", // azul
      "#f542a7", // rosa
      "#42f59e", // verde
      "#f5d242", // amarillo
      "#f54242", // rojo
      "#9942f5", // morado
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }
}
