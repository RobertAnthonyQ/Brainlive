# Neo4j 3D Graph Visualizer

A 3D visualization tool for Neo4j graph databases using Three.js. This application provides an interactive 3D representation of nodes and relationships from a Neo4j database.

## Features

- 3D visualization of Neo4j graph data
- Interactive controls for exploring the graph
- Automatic node and relationship coloring based on types
- Data caching for improved performance
- API endpoint for Neo4j database queries

## Prerequisites

- Node.js (v14 or higher)
- Neo4j Database (running locally or remotely)

## Installation

1. Clone this repository:

   ```
   git clone <repository-url>
   cd neo4j-3d-graph-visualizer
   ```

2. Install dependencies:

   ```
   npm install
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

### Production Mode

Start the application in production mode:

```
npm start
```

Open your browser and navigate to `http://localhost:3000` to view the application.

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

## Project Structure

```
├── index.html           # Main HTML file
├── package.json         # Project dependencies and scripts
├── src/
│   ├── api/
│   │   ├── neo4jApi.js  # API functions for Neo4j data
│   │   └── server.js    # Express server implementation
│   ├── models/
│   │   ├── Brain.js            # 3D brain visualization
│   │   ├── GraphDataService.js # Neo4j data service
│   │   ├── GraphVisualizer.js  # Neo4j visualization
│   │   ├── Neuron.js           # Node representation
│   │   └── NeuronConnection.js # Relationship representation
│   └── main.js          # Application entry point
```

## Development Notes

- For development without a Neo4j database, set `useMockData: true` in the GraphVisualizer options.
- The visualization is optimized for graphs with up to a few hundred nodes and relationships. For larger graphs, consider using additional filtering.

## License

[MIT License](LICENSE)

# Brain Visualization Control System

This system allows you to control the 3D brain visualization by activating specific neurons and their connections via a simple Python script.

## System Components

1. **Flask Server (server.py)** - Handles requests to activate/deactivate neurons
2. **Python Client (brain_control.py)** - Command-line tool to send activation requests
3. **JavaScript Integration (Brain.js)** - Modified to respond to server state

## Setup & Installation

### Requirements

- Python 3.6+
- Flask
- Requests library

Install the required Python packages:

```bash
pip install flask flask-cors requests
```

## Usage

### 1. Start the Flask Server

First, start the Flask server that will handle the requests:

```bash
python server.py
```

The server will run on http://localhost:5000 by default.

### 2. Initialize the Brain Visualization

Make sure the 3D brain visualization is initialized in your JavaScript code:

```javascript
// After initializing the Brain instance
brain.initializeApiIntegration("http://localhost:5000");
```

### 3. Use the Python Client to Control Neurons

Use the brain_control.py script to activate specific neurons:

```bash
# Activate specific neurons by ID (this will also activate connections between them)
python brain_control.py activate --nodes neuron-1 neuron-5 neuron-8

# Reset the visualization (deactivate all neurons and connections)
python brain_control.py reset

# Check the current status of active neurons and connections
python brain_control.py status
```

## How It Works

1. The Python client sends POST requests to the Flask server
2. The server keeps track of which neurons should be active
3. The brain visualization polls the server regularly to update its state
4. Active neurons appear brighter and more visible
5. Connections between active neurons are animated with a pulsing effect

## Example Workflow

1. Start with all neurons inactive (dim and semi-transparent)
2. Activate specific neurons using the Python client
3. The activated neurons become brighter and fully opaque
4. If two activated neurons have a connection, that connection becomes visible and animated
5. Reset the visualization to return to the initial state

## Customization

You can modify the appearance of active/inactive neurons by changing the values in these methods:

- `activateNeuron()` - Controls how active neurons appear
- `activateConnection()` - Controls how active connections appear
- `resetNeuronState()` - Controls how inactive neurons/connections appear

## Troubleshooting

- If connections aren't appearing, check that the maximum connection distance in `connectionConfig` is set appropriately
- Make sure the server is running and accessible from your web application
- Check browser console for any connection errors
