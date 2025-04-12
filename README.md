# Neo4j 3D Graph Visualizer

A 3D visualization tool for Neo4j graph databases using Three.js. This application provides an interactive 3D representation of nodes and relationships from a Neo4j database.

## Features

- 3D visualization of Neo4j graph data
- Interactive controls for exploring the graph
- Automatic node and relationship coloring based on types
- Data caching for improved performance
- API endpoint for Neo4j database queries
- Brain visualization with neuron connections
- Real-time chat interface
- Timeline visualization

## Prerequisites

- Node.js (v14 or higher)
- Neo4j Database (running locally or remotely)
- Python 3.x (for brain control functionality)

## Installation

1. Clone this repository:

   ```
   git clone https://github.com/RobertAnthonyQ/Brainlive
   cd neo4j-3d-graph-visualizer
   ```

2. Install dependencies:

   ```
   npm install
   pip install -r requirements.txt
   ```

3. Configure Neo4j connection:
   Edit `src/api/server.js` to set your Neo4j connection details or set the following environment variables:
   ```
   NEO4J_URI=neo4j://localhost:7687
   NEO4J_USER=neo4j
   NEO4J_PASSWORD=your-password
   ```

## Usage

### Development Mode

Start the application in development mode with hot-reloading:

```
npm run dev
```

Start the brain control server:

```
python neo4j_brain_control.py
```

### Production Mode

Start the application in production mode:

```
npm start
```

Open your browser and navigate to `http://localhost:3000` to view the application.

## API Endpoints

### Neo4j API (`/api/neo4j`)

- **GET** `/api/neo4j/nodes` - Get all nodes
- **GET** `/api/neo4j/relationships` - Get all relationships
- **GET** `/api/neo4j/query` - Execute custom Cypher query
- **POST** `/api/neo4j/query` - Execute custom Cypher query with parameters

### Brain API (`/api/brain`)

- **GET** `/api/brain/status` - Get brain status
- **POST** `/api/brain/command` - Send command to brain
- **GET** `/api/brain/neurons` - Get all neurons
- **GET** `/api/brain/connections` - Get all neuron connections

### Example API Calls

```javascript
// Get all nodes
fetch("/api/neo4j/nodes")
  .then((response) => response.json())
  .then((data) => console.log(data));

// Execute custom query
fetch("/api/neo4j/query", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    query: "MATCH (n) RETURN n LIMIT 10",
  }),
})
  .then((response) => response.json())
  .then((data) => console.log(data));

// Send brain command
fetch("/api/brain/command", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    command: "activate",
    parameters: {
      neuronId: "123",
    },
  }),
})
  .then((response) => response.json())
  .then((data) => console.log(data));
```

## Project Structure

```
├── index.html           # Main HTML file
├── package.json         # Project dependencies and scripts
├── requirements.txt     # Python dependencies
├── neo4j_brain_control.py # Python brain control server
├── src/
│   ├── api/
│   │   ├── neo4jApi.js  # API functions for Neo4j data
│   │   ├── brain.js     # Brain API implementation
│   │   ├── brain_client.js # Brain client implementation
│   │   └── server.js    # Express server implementation
│   ├── components/
│   │   ├── ChatInterface.js # Chat interface component
│   │   └── TimelineInterface.js # Timeline visualization
│   ├── models/
│   │   ├── Brain.js            # 3D brain visualization
│   │   ├── BrainApiClient.js   # Brain API client
│   │   ├── GraphDataService.js # Neo4j data service
│   │   ├── GraphVisualizer.js  # Neo4j visualization
│   │   ├── Neuron.js           # Node representation
│   │   ├── NeuronConnection.js # Relationship representation
│   │   └── model3d/
│   │       └── cerebro.fbx     # 3D brain model
│   └── main.js          # Application entry point
```

## Configuration Options

You can customize the visualization in `src/main.js`:

```javascript
const graphVisualizer = new GraphVisualizer(container, {
  useMockData: false, // Set to true for development without Neo4j
  nodeLimit: 50, // Limit number of nodes for performance
  relationshipLimit: 500, // Limit number of relationships
  nodeColorMap: {
    // Custom colors for different node types
    Person: 0x42adf5, // Blue
    Movie: 0xf542a7, // Pink
  },
  relationshipColorMap: {
    // Custom colors for different relationship types
    ACTED_IN: 0x42f5a7, // Green
    DIRECTED: 0xf5e642, // Yellow
  },
});
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

# Brain Visualization Control System

This system allows you to control the 3D brain visualization by activating specific neurons and their connections via a simple Python script.

## Brain Control Examples

### Activating Nodes

You can activate specific neurons in the brain visualization using the `neo4j_brain_control.py` script. Here are some examples:

1. **Activate a single neuron**:

```bash
python neo4j_brain_control.py activar -n "144:Visual Cortex"
```

2. **Activate multiple neurons**:

```bash
python neo4j_brain_control.py activar -n "144:Visual Cortex" "145:Motor Cortex" "146:Prefrontal Cortex"
```

3. **Activate neurons and append to existing active nodes**:

```bash
python neo4j_brain_control.py activar -n "144:Visual Cortex" "145:Motor Cortex" --append
```

4. **Check current active nodes**:

```bash
python neo4j_brain_control.py estado
```

5. **Reset visualization**:

```bash
python neo4j_brain_control.py reiniciar
```

### Using a Custom Server URL

If your server is running on a different URL, you can specify it with the `--server` flag:

```bash
python neo4j_brain_control.py --server "http://localhost:3000/api/brain" activar -n "144:Visual Cortex"
```

### Example Output

When you activate nodes, you'll see output like this:

```
Enviando petición a http://localhost:3000/api/brain/activate
Datos: {
  "nodes": [
    {"id": "144", "name": "Visual Cortex"},
    {"id": "145", "name": "Motor Cortex"}
  ],
  "append": false
}

✅ Nodos activados
Estado: {"activeNodes": ["144", "145"]}

Nodos activos:
 ➤ 144 - Visual Cortex
 ➤ 145 - Motor Cortex
```

### Common Node IDs and Names

Here are some common neuron IDs and their corresponding names:

- `144:Visual Cortex`
- `145:Motor Cortex`
- `146:Prefrontal Cortex`
- `147:Auditory Cortex`
- `148:Somatosensory Cortex`
- `149:Hippocampus`
- `150:Amygdala`
