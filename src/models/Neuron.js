import * as THREE from "three";

// Shaders para el efecto de resplandor
const glowVertexShader = `
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vViewPosition;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vec4 mvPosition = viewMatrix * worldPosition;
    vViewPosition = -mvPosition.xyz;
    
    // Efecto de pulsación sutil en el tamaño
    float pulse = sin(uTime * 2.0) * 0.05 + 1.0;
    vec3 newPosition = position * pulse;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
  }
`;

const glowFragmentShader = `
  uniform vec3 color;
  uniform float brightness;
  uniform float opacity;
  uniform float uTime;
  uniform float glowStrength;
  uniform float glowFactor;
  
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  
  void main() {
    // Vector de visión normalizado
    vec3 viewVector = normalize(vViewPosition);
    
    // Calcular brillo de Fresnel (más brillante en los bordes)
    float fresnel = pow(1.0 - abs(dot(vNormal, viewVector)), glowFactor);
    
    // Añadir variación de tiempo para efecto pulsante
    float pulse = 0.5 + 0.5 * sin(uTime * 3.0);
    fresnel *= mix(0.8, 1.2, pulse);
    
    // Color final con brillo y resplandor
    vec3 finalColor = color * brightness * (1.0 + fresnel * glowStrength);
    
    // Opacidad final con componente de resplandor
    float finalOpacity = opacity * (0.6 + 0.4 * fresnel);
    
    gl_FragColor = vec4(finalColor, finalOpacity);
  }
`;

class Neuron {
  static defaultConfig = {
    color: 0x00ff00,
    size: 2,
    opacity: 0.2,
    brightness: 0.3,
    depthEffect: {
      near: 1.0,
      far: 100.0,
      strength: 0.8,
    },
    rimEffect: {
      strength: 0.3,
      power: 1.0,
    },
    glowEffect: {
      enabled: false,
      strength: 1.5,
      factor: 3.5,
    },
    // Datos de Neo4j
    nodeData: null,
  };

  constructor(position, config = {}) {
    // Combinar configuración por defecto con la proporcionada
    this.config = { ...Neuron.defaultConfig, ...config };

    // Guardar los datos de Neo4j si existen
    this.nodeData = this.config.nodeData;

    // Ajustar tamaño según propiedades de Neo4j (si existen)
    let size = this.config.size;
    if (this.nodeData && this.nodeData.properties) {
      // Se podría ajustar el tamaño según alguna propiedad del nodo
      // Por ejemplo: si hay una propiedad "importance" o "weight"
      if (this.nodeData.properties.size) {
        size = this.config.size * this.nodeData.properties.size;
      }
    }

    // Crear geometría de esfera optimizada (menos segmentos)
    const geometry = new THREE.SphereGeometry(
      size,
      24, // Aumentado de 16 a 24 para mejor calidad
      24 // Aumentado de 16 a 24 para mejor calidad
    );

    // Crear material con efectos de brillo y resplandor
    const material = new THREE.ShaderMaterial({
      uniforms: {
        color: { value: new THREE.Color(this.config.color) },
        viewPosition: { value: new THREE.Vector3() },
        brightness: { value: this.config.brightness },
        opacity: { value: this.config.opacity },
        depthNear: { value: this.config.depthEffect.near },
        depthFar: { value: this.config.depthEffect.far },
        depthStrength: { value: this.config.depthEffect.strength },
        rimStrength: { value: this.config.rimEffect.strength },
        rimPower: { value: this.config.rimEffect.power },
        uTime: { value: 0.0 },
        glowStrength: {
          value: this.config.glowEffect.enabled
            ? this.config.glowEffect.strength
            : 0.0,
        },
        glowFactor: { value: this.config.glowEffect.factor },
      },
      vertexShader: glowVertexShader,
      fragmentShader: glowFragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: THREE.FrontSide,
      blending: THREE.AdditiveBlending,
    });

    // Crear la malla
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.renderOrder = 999;

    // Almacenar la posición como un Vector3 separado para evitar referencias compartidas
    this.position = new THREE.Vector3();
    if (position) {
      this.position.copy(position);
      this.mesh.position.copy(position);
    }

    // Guardar referencia al material
    this.material = material;

    // Creamos una segunda esfera más grande para el efecto de halo
    this.haloMesh = null;
    this.pointLight = null;

    // Tiempo para animación
    this.time = 0;
    this.isActive = false;

    // Añadir marca de tiempo para optimización
    this.lastUpdateTime = 0;
  }

  // Métodos para actualizar configuración en tiempo real
  updateColor(color) {
    this.material.uniforms.color.value.set(color);
    if (this.haloMesh) {
      this.haloMesh.material.uniforms.glowColor.value.set(color);
    }
    if (this.pointLight) {
      this.pointLight.color.set(color);
    }
  }

  updateBrightness(brightness) {
    this.material.uniforms.brightness.value = brightness;

    // Si el brillo es alto, activar efecto de resplandor
    if (brightness > 2.0 && !this.isActive) {
      this.setActive(true);
    } else if (brightness <= 1.2 && this.isActive) {
      this.setActive(false);
    }
  }

  updateOpacity(opacity) {
    this.material.uniforms.opacity.value = opacity;
  }

  updateDepthEffect(near, far, strength) {
    this.material.uniforms.depthNear.value = near;
    this.material.uniforms.depthFar.value = far;
    this.material.uniforms.depthStrength.value = strength;
  }

  updateRimEffect(strength, power) {
    this.material.uniforms.rimStrength.value = strength;
    this.material.uniforms.rimPower.value = power;
  }

  updateGlowEffect(enabled, strength = 2.0, factor = 3.5) {
    this.material.uniforms.glowStrength.value = enabled ? strength : 0.0;
    this.material.uniforms.glowFactor.value = factor;

    // Actualizar config
    this.config.glowEffect.enabled = enabled;
    this.config.glowEffect.strength = strength;
    this.config.glowEffect.factor = factor;
  }

  updateViewPosition(camera) {
    this.material.uniforms.viewPosition.value.copy(camera.position);
  }

  /**
   * Activa o desactiva el estado activo (resplandeciente) de la neurona
   * @param {boolean} active - Si debe estar activa
   * @param {THREE.Scene} scene - Escena para añadir efectos visuales
   */
  setActive(active, scene = null) {
    this.isActive = active;

    // Actualizar el shader para efecto de resplandor
    this.updateGlowEffect(active, active ? 8.0 : 0.0, 3.0); // Aumentado de 4.0 a 8.0 para mayor intensidad

    // Si se activa y no tiene halo, crear uno
    if (active && scene && !this.haloMesh) {
      // Crear geometría para el halo (esfera más grande)
      const haloGeometry = new THREE.SphereGeometry(
        this.config.size * 5.0, // Aumentado de 3.5 a 5.0 para un halo mucho más grande
        16,
        16
      );

      // Shader personalizado para el halo
      const haloMaterial = new THREE.ShaderMaterial({
        uniforms: {
          glowColor: {
            value: new THREE.Color(this.material.uniforms.color.value),
          },
          viewVector: { value: new THREE.Vector3() },
          uTime: { value: 0.0 },
          c: { value: 0.5 }, // Aumentado de 0.25 a 0.5 para mayor intensidad
          p: { value: 1.2 }, // Reducido para un efecto más suave pero más extendido
        },
        vertexShader: `
          uniform vec3 viewVector;
          uniform float c;
          uniform float p;
          uniform float uTime;
          varying float intensity;
          
          void main() {
            vec3 vNormal = normalize(normalMatrix * normal);
            vec3 vNormel = normalize(normalMatrix * viewVector);
            intensity = pow(c - abs(dot(vNormal, vNormel)), p);
            
            // Animación pulsante más pronunciada
            intensity *= (0.6 + 0.4 * sin(uTime * 3.0));  // Más amplitud y velocidad
            
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 glowColor;
          uniform float uTime;
          varying float intensity;
          
          void main() {
            // Color del halo con efecto pulsante intensificado
            vec3 glow = glowColor * intensity * 1.5;  // Multiplicador adicional de 1.5
            
            // Transparencia pulsante con valor mínimo para siempre tener algo visible
            float alpha = max(0.3, min(intensity * 1.2, 0.95));  // Aumentado para mayor visibilidad
            
            gl_FragColor = vec4(glow, alpha);
          }
        `,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      });

      // Crear el mesh del halo
      this.haloMesh = new THREE.Mesh(haloGeometry, haloMaterial);
      this.haloMesh.position.copy(this.position);
      this.haloMesh.scale.multiplyScalar(1.8); // Aumentado de 1.5 a 1.8
      scene.add(this.haloMesh);

      // Añadir luz puntual más intensa
      this.pointLight = new THREE.PointLight(
        this.material.uniforms.color.value,
        3.0, // Aumentado de 1.5 a 3.0
        this.config.size * 20 // Aumentado el radio de 10 a 20
      );
      this.pointLight.position.copy(this.position);
      scene.add(this.pointLight);
    }
    // Si se desactiva y tiene halo, eliminarlo
    else if (!active && this.haloMesh) {
      if (scene) {
        scene.remove(this.haloMesh);
        scene.remove(this.pointLight);
      }
      this.haloMesh = null;
      this.pointLight = null;
    }
  }

  /**
   * Establece la posición de la neurona y actualiza la malla 3D
   * @param {THREE.Vector3} position - Nueva posición
   */
  setPosition(position) {
    // Actualizar posición interna
    this.position.copy(position);

    // Actualizar posición de la malla
    this.mesh.position.copy(position);

    // Actualizar posiciones de efectos adicionales
    if (this.haloMesh) {
      this.haloMesh.position.copy(position);
    }

    if (this.pointLight) {
      this.pointLight.position.copy(position);
    }

    // Marca el tiempo de la última actualización
    this.lastUpdateTime = performance.now();
  }

  /**
   * Obtiene la posición actual de la neurona
   * @returns {THREE.Vector3} Posición actual
   */
  getPosition() {
    // Asegurarse de que la posición interna coincida con la malla
    // Esto evita cualquier desincronización si algo ha modificado la malla directamente
    if (!this.position.equals(this.mesh.position)) {
      this.position.copy(this.mesh.position);
    }
    return this.position;
  }

  /**
   * Obtiene la malla 3D de la neurona
   * @returns {THREE.Mesh} Malla 3D
   */
  getMesh() {
    return this.mesh;
  }

  /**
   * Actualiza la neurona con el tiempo de animación
   * @param {number} deltaTime - Tiempo transcurrido desde última actualización
   */
  animate(deltaTime) {
    // Actualizar tiempo para animaciones
    this.time += deltaTime;
    this.material.uniforms.uTime.value = this.time;

    // Actualizar halo si existe
    if (this.haloMesh) {
      this.haloMesh.material.uniforms.uTime.value = this.time;

      // Hacer que el halo rote lentamente
      this.haloMesh.rotation.y += deltaTime * 0.2;
      this.haloMesh.rotation.x += deltaTime * 0.1;

      // Pulsar la intensidad de la luz
      if (this.pointLight) {
        this.pointLight.intensity = 1.5 + Math.sin(this.time * 3) * 1.0;
      }
    }
  }

  // Método para obtener los datos del nodo Neo4j
  getNodeData() {
    return this.nodeData;
  }

  // Método para obtener el ID de Neo4j
  getNodeId() {
    return this.nodeData ? this.nodeData.id : null;
  }

  // Método para destruir y limpiar recursos
  dispose(scene) {
    if (this.haloMesh && scene) {
      scene.remove(this.haloMesh);
      this.haloMesh.geometry.dispose();
      this.haloMesh.material.dispose();
    }

    if (this.pointLight && scene) {
      scene.remove(this.pointLight);
    }

    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}

export default Neuron;
