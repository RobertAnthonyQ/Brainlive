import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
/**
 * Shader personalizado para efecto de rayos X con resplandor
 */
class XRayMaterial extends THREE.ShaderMaterial {
  constructor(options = {}) {
    super({
      uniforms: {
        color: { value: new THREE.Color(options.color || 0x84ccff) },
        c: { value: options.c !== undefined ? options.c : 0.9 },
        p: { value: options.p !== undefined ? options.p : 6.7 },
        offsetY: {
          value: options.offsetY !== undefined ? options.offsetY : 0.3,
        },
        time: { value: 0 },
      },
      vertexShader: `
        uniform float time;
        uniform float offsetY;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vec4 mvPosition = viewMatrix * worldPosition;
          vViewPosition = -mvPosition.xyz;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 color;
        uniform float c;
        uniform float p;
        uniform float time;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        
        void main() {
          vec3 normal = normalize(vNormal);
          vec3 viewPosition = normalize(vViewPosition);
          float rim = pow(abs(dot(normal, viewPosition)), p);
          
          // Añadir efecto de pulso al brillo
          float pulse = 0.9 + 0.1 * sin(time * 2.0);
          
          vec3 glowColor = color * c * (1.0 - rim) * pulse;
          gl_FragColor = vec4(glowColor, 1.0 - rim * 0.5);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.type = "XRayMaterial";
  }

  update(time) {
    this.uniforms.time.value = time;
  }
}

/**
 * Material personalizado para animación de puntos
 */
class PointsAnimationMaterial extends THREE.ShaderMaterial {
  constructor(options) {
    super({
      uniforms: {
        color: { value: new THREE.Color(0xffffff) },
        size: { value: 3.0 },
        time: { value: 0 },
      },
      vertexShader: `
        uniform float time;
        uniform float size;
        
        void main() {
          vec3 pos = position;
          gl_PointSize = size;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 color;
        
        void main() {
          float dist = length(gl_PointCoord - vec2(0.5, 0.5));
          if (dist > 0.5) discard;
          gl_FragColor = vec4(color, 1.0);
        }
      `,
      transparent: true,
      depthTest: true,
    });

    this.uniforms.color.value = new THREE.Color(options.color || 0xffffff);
    this.uniforms.size.value = options.size || 3.0;
  }

  update(time) {
    this.uniforms.time.value = time;
  }
}

/**
 * Clase Neuron - Representa una neurona en el cerebro
 */
class Neuron {
  constructor(position, config) {
    this.id = null; // Will be assigned later
    this.position = position.clone();
    this.config = { ...config };

    // Use shared geometry from pool instead of creating new one
    this.material = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(this.config.color),
      emissive: new THREE.Color(this.config.color),
      emissiveIntensity: this.config.brightness || 1.0,
      transparent: true,
      opacity: this.config.opacity || 0.5,
    });

    // Crear malla
    this.mesh = new THREE.Mesh(Neuron.getSharedGeometry(), this.material);
    this.mesh.position.copy(this.position);

    // Estado inicial inactivo
    this.isActive = false;
  }

  // Static method to create and reuse shared geometry
  static getSharedGeometry() {
    if (!Neuron.sharedGeometry) {
      // Reduced segments from the typical default of 32 to 12
      Neuron.sharedGeometry = new THREE.SphereGeometry(1, 12, 12);
    }
    return Neuron.sharedGeometry;
  }

  getMesh() {
    return this.mesh;
  }

  getPosition() {
    return this.position;
  }

  setPosition(position) {
    this.position.copy(position);
    this.mesh.position.copy(position);
  }

  updateViewPosition(camera) {
    // Could be used for view-dependent effects
  }

  updateColor(color) {
    this.config.color = color;
    this.material.color.set(color);
    this.material.emissive.set(color);
  }

  updateBrightness(brightness) {
    this.config.brightness = brightness;
    this.material.emissiveIntensity = brightness;
  }

  updateOpacity(opacity) {
    this.config.opacity = opacity;
    this.material.opacity = opacity;
  }

  updateDepthEffect(near, far, strength) {
    // Implementation for depth effect if needed
  }

  updateRimEffect(strength, power) {
    // Implementation for rim effect if needed
  }

  animate(deltaTime) {
    // Implementation of animate method
  }
}

/**
 * Clase NeuronConnection - Representa una conexión entre neuronas
 */
class NeuronConnection {
  constructor(sourceNeuron, targetNeuron, config) {
    this.sourceNeuron = sourceNeuron;
    this.targetNeuron = targetNeuron;
    this.config = { ...config };

    // Crear curva entre neuronas
    this.curve = this.createCurve();

    // Reduced segments for tube geometry
    const geometry = new THREE.TubeGeometry(
      this.curve,
      this.config.segments || 12, // reduced from 20 to 12
      this.config.thickness || 0.5,
      this.config.tubeSegments || 6, // reduced from 8 to 6
      false
    );

    this.material = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(this.config.color || 0xffffff),
      transparent: true,
      opacity: this.config.opacity || 0.2, // Más transparente por defecto
      emissive: new THREE.Color(this.config.color || 0xffffff),
      emissiveIntensity: 0.2, // Baja intensidad por defecto
    });

    // Crear malla
    this.mesh = new THREE.Mesh(geometry, this.material);

    // Estado inicial inactivo pero visible
    this.isActive = false;
    this.isAnimated = false; // Nueva propiedad para controlar la animación
  }

  createCurve() {
    const start = this.sourceNeuron.getPosition();
    const end = this.targetNeuron.getPosition();

    // Calcular punto de control
    const mid = new THREE.Vector3().addVectors(start, end).divideScalar(2);
    const direction = new THREE.Vector3().subVectors(end, start).normalize();
    const normal = new THREE.Vector3(
      -direction.y,
      direction.x,
      direction.z
    ).normalize();

    // Desplazar punto de control para crear una curva
    const distance = start.distanceTo(end);
    const offset = Math.min(distance * 0.3, 15);
    mid.add(normal.multiplyScalar(offset));

    // Crear curva cuadrática
    return new THREE.QuadraticBezierCurve3(start, mid, end);
  }

  getMesh() {
    return this.mesh;
  }

  update(time) {
    // Recrear la curva para mantenerla actualizada con las posiciones de las neuronas
    this.curve = this.createCurve();

    // Only update geometry if positions have changed significantly
    const sourcePos = this.sourceNeuron.getPosition();
    const targetPos = this.targetNeuron.getPosition();

    if (
      !this.lastSourcePos ||
      !this.lastTargetPos ||
      sourcePos.distanceTo(this.lastSourcePos) > 0.1 ||
      targetPos.distanceTo(this.lastTargetPos) > 0.1
    ) {
      // Actualizar la geometría
      this.mesh.geometry.dispose();
      this.mesh.geometry = new THREE.TubeGeometry(
        this.curve,
        this.config.segments || 12, // Reduced from 20
        this.config.thickness || 0.5,
        this.config.tubeSegments || 6, // Reduced from 8
        false
      );

      // Save positions for next comparison
      this.lastSourcePos = sourcePos.clone();
      this.lastTargetPos = targetPos.clone();
    }

    // Aplicar efecto de pulso SOLO si está activo Y animado
    if (this.isActive && this.isAnimated) {
      const pulseSpeed = this.config.pulseSpeed || 4.0;
      const pulseIntensity = this.config.pulseIntensity || 1.0;
      const pulse = 0.7 + 0.3 * Math.sin(time * pulseSpeed);
      this.material.emissiveIntensity = pulse * pulseIntensity;
    }
  }

  updateColor(color) {
    this.config.color = color;
    this.material.color.set(color);
    this.material.emissive.set(color);
  }

  updateOpacity(opacity) {
    this.config.opacity = opacity;
    this.material.opacity = opacity;
  }

  updatePulseEffect(speed, intensity) {
    this.config.pulseSpeed = speed;
    this.config.pulseIntensity = intensity;
  }

  updateThickness(thickness) {
    this.config.thickness = thickness;
    // La geometría se actualizará en el próximo frame
  }
}

/**
 * Clase Brain - Gestiona la visualización 3D del modelo de cerebro
 */
class Brain {
  /**
   * Constructor de la clase Brain
   * @param {HTMLElement} container - Elemento DOM donde se renderizará la escena
   */
  constructor(container) {
    this.container = container;
    // Crear una nueva escena 3D
    this.scene = new THREE.Scene();
    // Establecer el color de fondo a un tono azul-gris claro
    this.scene.background = new THREE.Color(0x000000);

    // Variables para la animación
    this.clock = new THREE.Clock();
    this.particleGlow = 0.5; // Control de brillo inicial
    this.lastFrameTime = performance.now(); // For FPS limiting

    // Shared geometry and materials for reuse
    this.sharedGeometries = {};
    this.sharedMaterials = {};

    // Configuración del elipsoide para las neuronas
    this.ellipsoidConfig = {
      radius: 50, // Radio base
      scaleX: 3.5, // Escala en X
      scaleY: 2.7, // Escala en Y
      scaleZ: 4.5, // Escala en Z
      color: 0x3498db,
      opacity: 0,
      wireframe: false,
      position: new THREE.Vector3(-80, 200, 80), // Posición relativa al cerebro
      //(ancho, alto, largo)
    };

    // Configuración por defecto para las neuronas
    this.neuronConfig = {
      color: 0xffffff,
      size: 1.5,
      opacity: 0.5,
      brightness: 1.2,
      depthEffect: {
        near: 1.0,
        far: 100.0,
        strength: 0.8,
      },
      rimEffect: {
        strength: 0.5,
        power: 1.0,
      },
    };

    this.neurons = [];

    // Añadir array para conexiones
    this.connections = [];

    // Configuración para conexiones
    this.connectionConfig = {
      color: 0xffffff, // Color de las conexiones en formato hexadecimal
      thickness: 0.5, // Grosor de las líneas de conexión
      pulseSpeed: 4.0, // Velocidad del efecto de pulso en las conexiones
      pulseIntensity: 5.0, // Intensidad del efecto de pulso
      maxDistance: 35, // Distancia máxima para crear conexiones entre neuronas
      opacity: 0.5, // Transparencia de las conexiones
      segments: 20, // Número de segmentos en la curva de la conexión
      tubeSegments: 8, // Número de segmentos en la geometría del tubo
    };

    // Configurar componentes principales de la visualización 3D
    this.setupCamera(); // Configurar la cámara
    this.setupLights(); // Configurar las luces
    this.setupRenderer(); // Configurar el renderizador
    this.setupControls(); // Configurar los controles de navegación
    this.loadModel(); // Cargar el modelo 3D

    // Manejar eventos de cambio de tamaño de ventana
    window.addEventListener("resize", this.onWindowResize.bind(this));
    // Iniciar el ciclo de animación
    this.animate();
  }

  /**
   * Configura la cámara perspectiva para visualizar la escena
   */
  setupCamera() {
    // Crear una cámara perspectiva con FOV de 75 grados
    this.camera = new THREE.PerspectiveCamera(
      75, // Campo de visión (FOV) en grados
      window.innerWidth / window.innerHeight, // Relación de aspecto
      0.1, // Plano cercano
      1000 // Plano lejano
    );
    // Posicionar la cámara a 200 unidades en el eje Z y 200 unidades a la izquierda
    this.camera.position.set(-200, 0, 200);
  }

  /**
   * Configura las luces para iluminar el modelo 3D
   */
  setupLights() {
    // Luz ambiental para iluminación general suave
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(this.ambientLight);

    // Luz principal (spotlight) encima del cerebro
    this.spotlight = new THREE.SpotLight(0xffffff, 1.0);
    this.spotlight.position.set(0, 500, -10);
    this.spotlight.distance = 175;
    this.spotlight.angle = Math.PI / 2;
    this.spotlight.castShadow = false; // Desactivar sombras
    this.scene.add(this.spotlight);

    // Añadir luces adicionales para iluminación más uniforme
    const frontLight = new THREE.DirectionalLight(0xffffff, 0.5);
    frontLight.position.set(0, 0, 200);
    frontLight.castShadow = false;
    this.scene.add(frontLight);

    const sideLight = new THREE.DirectionalLight(0xffffff, 0.3);
    sideLight.position.set(200, 0, 0);
    sideLight.castShadow = false;
    this.scene.add(sideLight);
  }

  /**
   * Configura el renderizador WebGL para dibujar la escena
   */
  setupRenderer() {
    // Crear renderizador WebGL con anti-aliasing
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true, // Permitir transparencia en el renderizador
    });
    // Configurar tamaño del renderizador al tamaño de la ventana
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    // Configurar ratio de píxeles para pantallas de alta densidad
    this.renderer.setPixelRatio(window.devicePixelRatio);
    // Desactivar sombras
    this.renderer.shadowMap.enabled = false;
    // Añadir el canvas del renderizador al contenedor DOM
    this.container.appendChild(this.renderer.domElement);
  }

  /**
   * Configura los controles de órbita para navegar alrededor del modelo
   */
  setupControls() {
    // Crear controles de órbita vinculados a la cámara y el elemento DOM
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    // Habilitar el amortiguamiento (movimiento suave)
    this.controls.enableDamping = true;
    // Factor de amortiguamiento (velocidad de desaceleración)
    this.controls.dampingFactor = 0.05;
    // Establecer el punto de rotación en la nueva posición del cerebro
    this.controls.target.set(200, 0, 0);
  }

  /**
   * Carga el modelo 3D del cerebro y aplica material vidrio/rayos X
   */
  loadModel() {
    const loader = new FBXLoader();

    // Crear material base transparente (vidrio)
    this.glassMaterial = new THREE.MeshPhysicalMaterial({
      // Color base del material (negro)
      color: 0x000000,
      // Habilita la transparencia del material
      transparent: true,
      // Nivel de opacidad (30% opaco)
      opacity: 0.3,
      // Rugosidad de la superficie (muy suave)
      roughness: 0.1,
      // Aspecto metálico (90% metálico)
      metalness: 0.1,
      // Nivel de transmisión de luz (90% transmisión)
      transmission: 0.9,
      // Intensidad de reflexiones (20% reflectante)
      reflectivity: 0.2,
      // Capa de barniz (desactivada)
      clearcoat: 0.0,
      // Rugosidad del barniz (desactivada)
      clearcoatRoughness: 0.0,
      // Renderiza ambos lados de las caras
      side: THREE.DoubleSide,
      // Desactiva escritura en buffer de profundidad
      depthWrite: false,
      // Activa test de profundidad
      depthTest: true,
    });

    // Crear material de efecto rayos X
    this.xrayMaterial = new XRayMaterial({
      color: 0xa00fa5,
      c: 0.2,
      p: 2.0,
      offsetY: 0.3,
    });

    // Mostrar plano simple mientras carga el modelo
    this.showLoadingPlaceholder();

    // Cargar modelo en modo asíncrono con Promise
    return new Promise((resolve) => {
      loader.load(
        "src/models/model3d/cerebro.fbx",
        (object) => {
          this.brainModel = object;

          // Crear un grupo para el punto de rotación
          this.rotationGroup = new THREE.Group();
          this.rotationGroup.position.set(200, 0, 0);

          // Crear un grupo para el cerebro
          this.brainGroup = new THREE.Group();

          // Optimización: Clonar objetos, hacer el segundo invisible inicialmente
          const objBase = object.clone();
          const objGlow = object.clone();
          objGlow.visible = false; // Inicialmente invisible

          // Aplicar material simplificado para carga inicial
          const tempMaterial = new THREE.MeshBasicMaterial({
            color: 0xa00fa5,
            transparent: true,
            opacity: 0.3,
            wireframe: false,
          });

          // Aplicar material temporal al modelo base
          objBase.traverse((child) => {
            if (child.isMesh) {
              child.material = tempMaterial;
              child.renderOrder = 1;
            }
          });

          // Añadir modelos a la escena
          const box = new THREE.Box3().setFromObject(objBase);
          const center = box.getCenter(new THREE.Vector3());

          this.brainGroup.add(objBase);
          this.brainGroup.add(objGlow);
          this.brainGroup.position.sub(center);

          // Crear la esfera para las neuronas
          this.createNeuronSphere();

          // Añadir el grupo del cerebro al grupo de rotación
          this.rotationGroup.add(this.brainGroup);
          this.scene.add(this.rotationGroup);

          // Reemplazar materiales temporales con los finales después de un corto retraso
          // Esto mejora la experiencia inicial al mostrar rápidamente algo en pantalla
          setTimeout(() => {
            // Aplicar material de vidrio al modelo base
            objBase.traverse((child) => {
              if (child.isMesh) {
                child.material = this.glassMaterial;
              }
            });

            // Aplicar material de rayos X y hacer visible el segundo modelo
            objGlow.traverse((child) => {
              if (child.isMesh) {
                child.material = this.xrayMaterial;
                child.renderOrder = 2;
                child.scale.multiplyScalar(1.01);
              }
            });
            objGlow.visible = true;

            // Eliminar material temporal
            if (tempMaterial) tempMaterial.dispose();

            // Ocultar placeholder de carga
            this.removeLoadingPlaceholder();
          }, 500);

          // Resolver promesa
          resolve();
        },
        (xhr) => {
          console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
        },
        (error) => {
          console.error("Error loading model", error);
          this.removeLoadingPlaceholder();
          resolve(); // Resolver de todos modos para no bloquear
        }
      );
    });
  }

  /**
   * Muestra un placeholder mientras carga el modelo
   */
  showLoadingPlaceholder() {
    // Crear un plano simple como placeholder
    const geometry = new THREE.PlaneGeometry(100, 100);
    const material = new THREE.MeshBasicMaterial({
      color: 0x333333,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    });

    this.placeholder = new THREE.Mesh(geometry, material);
    this.placeholder.position.set(200, 0, 0);
    this.placeholder.rotation.y = Math.PI / 2;
    this.scene.add(this.placeholder);
  }

  /**
   * Elimina el placeholder de carga
   */
  removeLoadingPlaceholder() {
    if (this.placeholder) {
      this.scene.remove(this.placeholder);
      if (this.placeholder.geometry) this.placeholder.geometry.dispose();
      if (this.placeholder.material) this.placeholder.material.dispose();
      this.placeholder = null;
    }
  }

  /**
   * Crea un elipsoide para contener las neuronas
   */
  createNeuronSphere() {
    // Crear geometría de esfera básica con menos segmentos (32->16)
    const sphereGeometry = new THREE.SphereGeometry(
      this.ellipsoidConfig.radius,
      16,
      16
    );

    // Crear material semi-transparente para el elipsoide
    const ellipsoidMaterial = new THREE.MeshPhysicalMaterial({
      color: this.ellipsoidConfig.color,
      transparent: true,
      opacity: this.ellipsoidConfig.opacity,
      wireframe: this.ellipsoidConfig.wireframe,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    // Crear la malla del elipsoide
    this.neuronEllipsoid = new THREE.Mesh(sphereGeometry, ellipsoidMaterial);
    this.neuronEllipsoid.position.copy(this.ellipsoidConfig.position);

    // Aplicar escalado para convertir la esfera en elipsoide
    this.neuronEllipsoid.scale.set(
      this.ellipsoidConfig.scaleX,
      this.ellipsoidConfig.scaleY,
      this.ellipsoidConfig.scaleZ
    );

    // Añadir el elipsoide al grupo del cerebro
    this.brainGroup.add(this.neuronEllipsoid);
  }

  /**
   * Actualiza la iluminación y los materiales durante la animación
   */
  updateLighting(time) {
    // Actualizar material de rayos X si existe
    if (this.xrayMaterial) {
      this.xrayMaterial.update(time);
    }
  }

  /**
   * Maneja el redimensionamiento de la ventana
   */
  onWindowResize() {
    // Actualizar relación de aspecto de la cámara
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    // Actualizar tamaño del renderizador
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  /**
   * Método principal de animación que se ejecuta en cada frame
   */
  animate() {
    // Solicitar siguiente animación
    this.animationId = requestAnimationFrame(this.animate.bind(this));

    // FPS limiting
    const now = performance.now();
    const elapsed = now - this.lastFrameTime;

    // Skip frame if less than 16.67ms has passed (60 FPS cap)
    if (elapsed < 16.67) {
      return;
    }

    // Update lastFrameTime
    this.lastFrameTime = now - (elapsed % 16.67); // Maintain consistent timing

    // Actualizar time para efectos
    const time = this.clock.getElapsedTime();
    const deltaTime = this.clock.getDelta();

    // Actualizar efectos de iluminación
    this.updateLighting(time);

    // Actualizar material de rayos X si está activo
    if (this.xrayMaterial && this.xrayMaterial.update) {
      this.xrayMaterial.update(time);
    }

    // Actualizar material de animación de partículas si está activo
    if (this.pointsMaterial && this.pointsMaterial.update) {
      this.pointsMaterial.update(time);
    }

    // Actualizar neuronas con el tiempo
    this.updateNeurons(deltaTime);

    // Actualizar conexiones con el tiempo
    this.connections.forEach((connection) => {
      if (connection.update) {
        connection.update(time);
      }
    });

    // Actualizar controles de cámara
    if (this.controls) {
      this.controls.update();
    }

    // Renderizar la escena
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Ajusta el brillo del efecto
   * @param {number} value - Valor entre 0 y 1
   */
  setParticleGlow(value) {
    this.particleGlow = value;
    if (this.xrayMaterial) {
      this.xrayMaterial.uniforms.c.value = value * 1.0;
    }
  }

  /**
   * Métodos para actualizar la configuración de todas las neuronas
   */
  updateNeuronColor(color) {
    this.neuronConfig.color = color;
    this.neurons.forEach((neuron) => neuron.updateColor(color));
  }

  updateNeuronBrightness(brightness) {
    this.neuronConfig.brightness = brightness;
    this.neurons.forEach((neuron) => neuron.updateBrightness(brightness));
  }

  updateNeuronOpacity(opacity) {
    this.neuronConfig.opacity = opacity;
    this.neurons.forEach((neuron) => neuron.updateOpacity(opacity));
  }

  updateNeuronDepthEffect(near, far, strength) {
    this.neuronConfig.depthEffect = { near, far, strength };
    this.neurons.forEach((neuron) =>
      neuron.updateDepthEffect(near, far, strength)
    );
  }

  updateNeuronRimEffect(strength, power) {
    this.neuronConfig.rimEffect = { strength, power };
    this.neurons.forEach((neuron) => neuron.updateRimEffect(strength, power));
  }

  /**
   * Genera neuronas dentro del elipsoide
   * @param {number} count - Número de neuronas a generar
   */
  generateNeurons(count = 30) {
    if (!this.neuronEllipsoid) return;

    // Limpiar neuronas existentes
    this.neurons.forEach((neuron) => {
      this.scene.remove(neuron.getMesh());
      // Dispose materials to prevent memory leaks
      if (neuron.material) neuron.material.dispose();
    });
    this.neurons = [];

    // Generar neuronas dentro del elipsoide
    let attempts = 0;
    const maxAttempts = count * 10;
    const ellipsoidPosition = new THREE.Vector3();
    this.neuronEllipsoid.getWorldPosition(ellipsoidPosition);
    const baseRadius = this.ellipsoidConfig.radius * 0.9; // 90% del radio para mantenerlas dentro

    // Create a material for Level of Detail (LOD)
    const simpleMaterial = new THREE.MeshBasicMaterial({
      color: this.neuronConfig.color,
      transparent: true,
      opacity: this.neuronConfig.opacity * 0.5,
    });

    while (this.neurons.length < count && attempts < maxAttempts) {
      attempts++;

      // Generar posición aleatoria dentro del elipsoide
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = Math.cbrt(Math.random()) * baseRadius; // Distribución uniforme en volumen

      // Calcular posición en coordenadas esféricas
      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);

      // Aplicar escalado del elipsoide
      const scaledX = x * this.ellipsoidConfig.scaleX;
      const scaledY = y * this.ellipsoidConfig.scaleY;
      const scaledZ = z * this.ellipsoidConfig.scaleZ;

      const position = new THREE.Vector3(
        ellipsoidPosition.x + scaledX,
        ellipsoidPosition.y + scaledY,
        ellipsoidPosition.z + scaledZ
      );

      // Create neuron with shared geometry
      const neuron = new Neuron(position, this.neuronConfig);

      // Add distance-based LOD
      neuron.distanceToCamera = 0;
      neuron.updateLOD = (camera) => {
        const dist = position.distanceTo(camera.position);
        neuron.distanceToCamera = dist;

        // Switch to simple material for distant neurons
        if (dist > 300 && neuron.material !== simpleMaterial) {
          neuron.mesh.material = simpleMaterial;
        } else if (dist <= 300 && neuron.mesh.material === simpleMaterial) {
          neuron.mesh.material = neuron.material;
        }
      };

      this.neurons.push(neuron);
      this.scene.add(neuron.getMesh());
    }

    // Generar conexiones después de crear las neuronas
    this.generateConnections();
  }

  /**
   * Verifica si un punto está dentro del elipsoide
   * @param {THREE.Vector3} point - Punto a verificar
   * @returns {boolean} - True si el punto está dentro del elipsoide
   */
  isPointInsideBrain(point) {
    if (!this.neuronEllipsoid) return false;

    const ellipsoidPosition = new THREE.Vector3();
    this.neuronEllipsoid.getWorldPosition(ellipsoidPosition);

    // Calcular coordenadas relativas al centro del elipsoide
    const relativeX = point.x - ellipsoidPosition.x;
    const relativeY = point.y - ellipsoidPosition.y;
    const relativeZ = point.z - ellipsoidPosition.z;

    // Normalizar según los ejes del elipsoide
    const normalizedX = relativeX / this.ellipsoidConfig.scaleX;
    const normalizedY = relativeY / this.ellipsoidConfig.scaleY;
    const normalizedZ = relativeZ / this.ellipsoidConfig.scaleZ;

    // Calcular distancia a origen en espacio normalizado
    const normalizedDistanceSquared =
      normalizedX * normalizedX +
      normalizedY * normalizedY +
      normalizedZ * normalizedZ;

    // El punto está dentro si la distancia normalizada es menor que el radio al cuadrado
    return (
      normalizedDistanceSquared <
      this.ellipsoidConfig.radius * this.ellipsoidConfig.radius
    );
  }

  /**
   * Actualiza todas las neuronas
   * @param {number} deltaTime - Tiempo transcurrido desde el último frame
   */
  updateNeurons(deltaTime) {
    // Actualizar la posición de la cámara para efectos de profundidad
    this.neurons.forEach((neuron) => {
      // Apply LOD based on distance from camera
      if (neuron.updateLOD) {
        neuron.updateLOD(this.camera);
      }

      // Actualizar la posición de la cámara en el shader de la neurona
      if (neuron.updateViewPosition) {
        neuron.updateViewPosition(this.camera);
      }

      // Animar la neurona si tiene una función de animación
      if (typeof neuron.animate === "function") {
        neuron.animate(deltaTime);
      }
    });
  }

  /**
   * Genera conexiones entre neuronas cercanas
   */
  generateConnections() {
    // Limpiar conexiones existentes
    this.connections.forEach((conn) => {
      this.scene.remove(conn.getMesh());
    });
    this.connections = [];

    // Crear conexiones entre neuronas cercanas
    for (let i = 0; i < this.neurons.length; i++) {
      for (let j = i + 1; j < this.neurons.length; j++) {
        const neuronA = this.neurons[i];
        const neuronB = this.neurons[j];

        // Calcular distancia entre neuronas
        const distance = neuronA
          .getPosition()
          .distanceTo(neuronB.getPosition());

        // Crear conexión si están lo suficientemente cerca
        if (distance < this.connectionConfig.maxDistance) {
          const connection = new NeuronConnection(
            neuronA,
            neuronB,
            this.connectionConfig
          );
          this.connections.push(connection);
          this.scene.add(connection.getMesh());
        }
      }
    }
  }

  // Métodos para actualizar la configuración de las conexiones
  updateConnectionColor(color) {
    // Asegurarse de que el color sea un número hexadecimal
    if (typeof color === "string") {
      color = parseInt(color.replace("#", "0x"));
    }
    this.connectionConfig.color = color;
    this.connections.forEach((conn) => conn.updateColor(color));
  }

  updateConnectionOpacity(opacity) {
    this.connectionConfig.opacity = opacity;
    this.connections.forEach((conn) => conn.updateOpacity(opacity));
  }

  updateConnectionPulse(speed, intensity) {
    this.connectionConfig.pulseSpeed = speed;
    this.connectionConfig.pulseIntensity = intensity;
    this.connections.forEach((conn) =>
      conn.updatePulseEffect(speed, intensity)
    );
  }

  updateConnectionThickness(thickness) {
    this.connectionConfig.thickness = thickness;
    this.connections.forEach((conn) => conn.updateThickness(thickness));
  }

  updateMaxConnectionDistance(distance) {
    this.connectionConfig.maxDistance = distance;
    this.generateConnections(); // Regenerar conexiones con nueva distancia
  }

  /**
   * Inicializa la integración con el servidor de control
   * @param {string} serverUrl - URL del servidor de control
   */
  initializeApiIntegration(serverUrl = "http://localhost:5000") {
    // Asignar IDs a las neuronas para poder referenciarlas
    this.neurons.forEach((neuron, index) => {
      neuron.id = `neuron-${index}`;
    });

    // Inicializar estado de neuronas (todas inactivas por defecto)
    this.resetNeuronState();

    // Iniciar polling
    this.startStatePolling(serverUrl);
  }

  /**
   * Inicia el polling para obtener el estado del servidor
   */
  startStatePolling(serverUrl) {
    // Polling cada segundo
    this.pollingInterval = setInterval(async () => {
      try {
        const response = await fetch(`${serverUrl}/api/status`);
        if (response.ok) {
          const data = await response.json();
          this.updateVisualizationState(
            data.active_nodes,
            data.active_connections
          );
        }
      } catch (error) {
        console.error("Error fetching brain state:", error);
      }
    }, 1000);
  }

  /**
   * Detiene el polling
   */
  stopStatePolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
  }

  /**
   * Actualiza el estado visual basado en los datos del servidor
   */
  updateVisualizationState(activeNodeIds, activeConnectionIds) {
    // Resetear estado
    this.resetNeuronState();

    // Activar neuronas específicas
    activeNodeIds.forEach((nodeId) => {
      // Handle both formats: "neuron-X" and "node-X"
      let neuron = null;

      if (nodeId.startsWith("neuron-")) {
        // Original format
        neuron = this.neurons.find((n) => n.id === nodeId);
      } else if (nodeId.startsWith("node-")) {
        // New format - extract the numeric ID after "node-"
        const nodeNumericId = nodeId.replace("node-", "");
        // Try to find a neuron with this ID
        neuron = this.neurons.find((n) => n.numericId === nodeNumericId);

        // If not found, assign a numeric ID to neurons if they don't have one
        if (!neuron) {
          // The first time we encounter this, assign numeric IDs to neurons
          if (!this.hasAssignedNumericIds) {
            this.neurons.forEach((n, index) => {
              n.numericId = String(index);
            });
            this.hasAssignedNumericIds = true;

            // Try again after assigning IDs
            neuron = this.neurons.find((n) => n.numericId === nodeNumericId);
          }
        }
      }

      if (neuron) {
        this.activateNeuron(neuron);
      }
    });

    // Activar conexiones específicas
    activeConnectionIds.forEach((connectionId) => {
      const [sourceId, targetId] = connectionId.split("-");

      // Try to find connection with the appropriate IDs
      let connection = this.findConnection(sourceId, targetId);

      if (connection) {
        this.activateConnection(connection);
      }
    });
  }

  /**
   * Find a connection between two nodes, handling different ID formats
   */
  findConnection(sourceId, targetId) {
    // For each connection, check if its endpoints match the source and target
    return this.connections.find((conn) => {
      // Get source and target IDs
      const sourceNodeId = conn.sourceNeuron.id;
      const targetNodeId = conn.targetNeuron.id;
      const sourceNumericId = conn.sourceNeuron.numericId;
      const targetNumericId = conn.targetNeuron.numericId;

      // Check if IDs match in either original format or new format
      const originalFormatMatch =
        (sourceNodeId === sourceId && targetNodeId === targetId) ||
        (sourceNodeId === targetId && targetNodeId === sourceId);

      const newFormatMatch =
        sourceNumericId &&
        targetNumericId &&
        ((sourceId.includes(sourceNumericId) &&
          targetId.includes(targetNumericId)) ||
          (sourceId.includes(targetNumericId) &&
            targetId.includes(sourceNumericId)));

      return originalFormatMatch || newFormatMatch;
    });
  }

  /**
   * Activa una neurona específica (aumenta su brillo y opacidad)
   */
  activateNeuron(neuron) {
    neuron.updateBrightness(8.0); // Aumentado de 2.0 a 8.0 - brillo muy intenso
    neuron.updateOpacity(3.0); // Aumentado de 1.0 a 3.0 - mayor opacidad para resaltar

    // Si la neurona tiene el método setActive, usarlo para aplicar efectos adicionales
    if (typeof neuron.setActive === "function") {
      // Buscar la escena para pasar como parámetro
      neuron.setActive(true, this.scene);
    }

    // Destacar el nodo aumentando ligeramente su tamaño
    if (neuron.mesh && !neuron.originalScale) {
      neuron.originalScale = neuron.mesh.scale.clone();
      neuron.mesh.scale.multiplyScalar(1.3); // Aumentar 30% su tamaño
    }
  }

  /**
   * Activa una conexión específica (aumenta su opacidad y activa el pulso)
   */
  activateConnection(connection) {
    connection.updateOpacity(2.0); // Aumentado de 0.8 a 2.0
    connection.isActive = true;
    connection.isAnimated = true; // Activar la animación
    connection.updatePulseEffect(8.0, 6.0); // Valores amplificados

    // Si la conexión tiene un material, aumentar su brillo
    if (connection.material) {
      connection.material.emissiveIntensity = 3.0; // Aumentado para mayor brillo
    }
  }

  /**
   * Restablece el estado de todas las neuronas y conexiones
   */
  resetNeuronState() {
    // Establecer neuronas a estado inactivo
    this.neurons.forEach((neuron) => {
      neuron.updateBrightness(0.15); // Reducido de 0.3 a 0.15 para mayor transparencia
      neuron.updateOpacity(0.08); // Reducido de 0.15 a 0.08 para casi invisibilidad

      // Si la neurona tiene el método setActive, asegurar que esté desactivado
      if (typeof neuron.setActive === "function") {
        neuron.setActive(false, this.scene);
      }

      // Restaurar tamaño original si fue modificado
      if (neuron.mesh && neuron.originalScale) {
        neuron.mesh.scale.copy(neuron.originalScale);
        neuron.originalScale = null;
      }
    });

    // Establecer conexiones a estado inactivo pero visible
    this.connections.forEach((connection) => {
      connection.updateOpacity(0.05); // Reducido de 0.2 a 0.05 para mayor contraste
      connection.isActive = false;
      connection.isAnimated = false; // Desactivar la animación

      // Reducir la intensidad al mínimo
      if (connection.material) {
        connection.material.emissiveIntensity = 0.1; // Reducido para mayor contraste
      }
    });
  }

  /**
   * Limpia los recursos y evita pérdidas de memoria
   */
  dispose() {
    // Stop animation
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    // Dispose connection materials and geometries
    this.connections.forEach((conn) => {
      if (conn.mesh) {
        if (conn.mesh.geometry) conn.mesh.geometry.dispose();
        if (conn.mesh.material) conn.mesh.material.dispose();
        this.scene.remove(conn.mesh);
      }
    });

    // Dispose neuron materials and remove references
    this.neurons.forEach((neuron) => {
      if (neuron.mesh) {
        if (neuron.material) neuron.material.dispose();
        this.scene.remove(neuron.mesh);
      }
    });

    // Dispose static shared geometry
    if (Neuron.sharedGeometry) {
      Neuron.sharedGeometry.dispose();
      Neuron.sharedGeometry = null;
    }

    // Remove brain model
    if (this.brainModel) {
      this.brainModel.traverse((child) => {
        if (child.isMesh) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((mat) => mat.dispose());
            } else {
              child.material.dispose();
            }
          }
        }
      });
      this.scene.remove(this.brainModel);
    }

    // Clean up references
    this.neurons = [];
    this.connections = [];

    // Dispose renderer
    if (this.renderer) {
      this.renderer.dispose();
    }

    // Remove DOM element
    if (this.container && this.renderer && this.renderer.domElement) {
      this.container.removeChild(this.renderer.domElement);
    }

    // Remove event listeners
    window.removeEventListener("resize", this.onWindowResize);

    // Stop polling interval
    this.stopStatePolling();
  }

  /**
   * Crea una neurona individual en la posición especificada
   * @param {THREE.Vector3} position - Posición para la neurona
   * @param {Object} config - Configuración personalizada para esta neurona
   * @returns {Neuron} - La neurona creada
   */
  createNeuron(position, config = {}) {
    // Combinar configuración por defecto con la personalizada
    const neuronConfig = {
      ...this.neuronConfig,
      ...config,
    };

    // Crear la neurona
    const neuron = new Neuron(position, neuronConfig);

    // Añadir a la escena y al array de neuronas
    this.scene.add(neuron.getMesh());
    this.neurons.push(neuron);

    return neuron;
  }
}

export default Brain;
export { Neuron, NeuronConnection };
