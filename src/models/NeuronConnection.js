import * as THREE from "three";

class NeuronConnection {
  static defaultConfig = {
    color: 0x000000,
    thickness: 0.8,
    pulseSpeed: 8.0,
    pulseIntensity: 1.0,
    maxDistance: 50, // Distancia máxima para crear conexiones
    opacity: 0.8,
    segments: 20,
    tubeSegments: 8,
    // Datos de Neo4j
    relationshipData: null,
  };

  constructor(neuronA, neuronB, config = {}) {
    this.config = { ...NeuronConnection.defaultConfig, ...config };
    this.neuronA = neuronA;
    this.neuronB = neuronB;

    // Guardar los datos de Neo4j si existen
    this.relationshipData = this.config.relationshipData;

    // Ajustar el grosor según propiedades de Neo4j (si existen)
    let thickness = this.config.thickness;
    if (this.relationshipData && this.relationshipData.properties) {
      // Podemos ajustar el grosor según alguna propiedad de la relación
      // Por ejemplo: si hay una propiedad "weight" o "strength"
      if (this.relationshipData.properties.weight) {
        thickness =
          this.config.thickness * this.relationshipData.properties.weight;
      }
    }
    this.config.thickness = thickness;

    // Convertir el color hexadecimal a THREE.Color
    const initialColor = new THREE.Color(this.config.color);

    // Crear material con shader personalizado para el efecto de pulso
    const material = new THREE.ShaderMaterial({
      uniforms: {
        baseColor: { value: initialColor },
        time: { value: 0 },
        opacity: { value: this.config.opacity },
        pulseSpeed: { value: this.config.pulseSpeed },
        pulseIntensity: { value: this.config.pulseIntensity },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vPosition;
        
        void main() {
          vUv = uv;
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 baseColor;
        uniform float time;
        uniform float opacity;
        uniform float pulseSpeed;
        uniform float pulseIntensity;
        
        varying vec2 vUv;
        varying vec3 vPosition;
        
        void main() {
          // Efecto de pulso que se mueve a lo largo del tubo
          float pulse = sin(vUv.x * 3.14159 + time * pulseSpeed) * 0.5 + 0.5;
          
          // Intensidad base más el pulso
          float intensity = mix(0.3, 1.0, pulse * pulseIntensity);
          
          // Suavizar los bordes del tubo
          float edgeSmooth = smoothstep(0.0, 0.3, 1.0 - abs(vUv.y - 0.5) * 2.0);
          
          // Color final con pulso y transparencia
          vec3 finalColor = baseColor * intensity;
          float finalOpacity = opacity * edgeSmooth;
          
          gl_FragColor = vec4(finalColor, finalOpacity);
        }
      `,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });

    // Crear la geometría del tubo
    this.createTube();

    // Crear la malla
    this.mesh = new THREE.Mesh(this.tubeGeometry, material);
    this.mesh.renderOrder = 998; // Asegurar que se renderice después de las neuronas

    // Guardar una referencia al material
    this.material = material;

    // Guardar las posiciones actuales de las neuronas para comparación
    this.lastPositionA = this.neuronA.getPosition().clone();
    this.lastPositionB = this.neuronB.getPosition().clone();
  }

  createTube() {
    // Obtener las posiciones actualizadas de las neuronas
    const posA = this.neuronA.getPosition();
    const posB = this.neuronB.getPosition();

    // Crear puntos para la curva
    const midPoint = new THREE.Vector3()
      .addVectors(posA, posB)
      .multiplyScalar(0.5);

    // Calcular offset basado en la distancia
    const distance = posA.distanceTo(posB);
    const offset = distance * 0.15;
    midPoint.y += offset;

    // Crear curva suave
    const curve = new THREE.QuadraticBezierCurve3(
      posA.clone(), // Importante clonar para evitar referencias mutables
      midPoint,
      posB.clone()
    );

    // Crear geometría de tubo
    this.tubeGeometry = new THREE.TubeGeometry(
      curve,
      this.config.segments,
      this.config.thickness,
      this.config.tubeSegments,
      false
    );
  }

  update(time) {
    // Actualizar el tiempo para la animación del shader
    this.material.uniforms.time.value = time;

    // Obtener las posiciones actuales de las neuronas
    const currentPosA = this.neuronA.getPosition();
    const currentPosB = this.neuronB.getPosition();

    // Verificar si las neuronas se han movido lo suficiente para actualizar el tubo
    // Esto evita recrear la geometría en cada frame si no hay cambios significativos
    if (
      !this.lastPositionA.equals(currentPosA) ||
      !this.lastPositionB.equals(currentPosB)
    ) {
      // Actualizar la geometría del tubo
      const oldGeometry = this.tubeGeometry;
      this.createTube();
      this.mesh.geometry = this.tubeGeometry;
      oldGeometry.dispose(); // Limpiar la geometría anterior

      // Actualizar las posiciones guardadas
      this.lastPositionA.copy(currentPosA);
      this.lastPositionB.copy(currentPosB);
    }
  }

  getMesh() {
    return this.mesh;
  }

  updateColor(color) {
    // Asegurarse de que el color sea un número hexadecimal
    if (typeof color === "string") {
      color = parseInt(color.replace("#", "0x"));
    }

    // Actualizar el color en la configuración
    this.config.color = color;

    // Convertir a THREE.Color y actualizar el shader
    const threeColor = new THREE.Color(color);
    this.material.uniforms.baseColor.value = threeColor;
  }

  updateOpacity(opacity) {
    this.config.opacity = opacity;
    this.material.uniforms.opacity.value = opacity;
  }

  updatePulseEffect(speed, intensity) {
    // Actualizar valores en la configuración
    this.config.pulseSpeed = speed;
    this.config.pulseIntensity = intensity;

    // Actualizar uniforms del shader
    this.material.uniforms.pulseSpeed.value = speed;
    this.material.uniforms.pulseIntensity.value = intensity;
  }

  updateThickness(thickness) {
    this.config.thickness = thickness;
    const oldGeometry = this.tubeGeometry;
    this.createTube();
    this.mesh.geometry = this.tubeGeometry;
    oldGeometry.dispose();
  }

  // Método para obtener los datos de la relación Neo4j
  getRelationshipData() {
    return this.relationshipData;
  }

  // Método para obtener el ID de la relación Neo4j
  getRelationshipId() {
    return this.relationshipData ? this.relationshipData.id : null;
  }

  // Método para obtener el tipo de relación Neo4j
  getRelationshipType() {
    return this.relationshipData ? this.relationshipData.type : null;
  }

  // Método para obtener las neuronas conectadas
  getNeurons() {
    return {
      source: this.neuronA,
      target: this.neuronB,
    };
  }

  // Método para forzar la actualización de la geometría
  forceUpdate() {
    const oldGeometry = this.tubeGeometry;
    this.createTube();
    this.mesh.geometry = this.tubeGeometry;
    oldGeometry.dispose();

    // Actualizar las posiciones guardadas
    this.lastPositionA.copy(this.neuronA.getPosition());
    this.lastPositionB.copy(this.neuronB.getPosition());
  }
}

export default NeuronConnection;
