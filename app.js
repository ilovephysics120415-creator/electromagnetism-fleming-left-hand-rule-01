// app.js

// Global variables for State Management
const state = {
    currentDir: 'outwards', // 'inwards', 'outwards', 'left', 'right', 'up', 'down'
    fieldDir: 'left',       // 'left', 'right', 'up', 'down', 'inwards', 'outwards'
    flowType: 'conventional',  // 'conventional' or 'electron'
    showField: true,
    showHand: true,
    score: 0,
    testMode: false
};

// Vector mappings
const directionVectors = {
    left: new THREE.Vector3(-1, 0, 0),
    right: new THREE.Vector3(1, 0, 0),
    up: new THREE.Vector3(0, 1, 0),
    down: new THREE.Vector3(0, -1, 0),
    inwards: new THREE.Vector3(0, 0, -1),
    outwards: new THREE.Vector3(0, 0, 1)
};

// UI elements
const elCurrentDir = document.getElementById('select-current-dir');
const elFieldDir = document.getElementById('select-field-dir');
const elFlowType = document.getElementById('toggle-flow-type');
const elShowField = document.getElementById('show-field-lines');
const elShowHand = document.getElementById('show-hand-model');
const elResetCam = document.getElementById('reset-cam');
const elToggleTestMode = document.getElementById('toggle-test-mode');
const elStatusField = document.getElementById('status-field');
const elStatusFlow = document.getElementById('status-flow');

// Challenge Elements
const elChallengePrompt = document.getElementById('challenge-prompt');
const elChallengeFeedback = document.getElementById('challenge-feedback');
const elNextChallenge = document.getElementById('next-challenge');
const elScoreBadge = document.getElementById('score-badge');
const elChoiceBtns = document.querySelectorAll('.btn-choice');

// Three.js Variables
let scene, camera, renderer, controls;
let magnetN, magnetS;
let wire;
let wireSymbolsGroup;
let fieldLines = [];
let chargeCarriers = [];
let fieldArrow, currentArrow;
let handGroup;
let wireDeflection = new THREE.Vector3();
let targetWireDeflection = new THREE.Vector3();

// Setup Scene
function initThree() {
    const container = document.getElementById('canvas-container');
    
    // Scene
    scene = new THREE.Scene();
    
    // Camera
    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
    resetCameraPosition();

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // Controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 4;
    controls.maxDistance = 20;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight1.position.set(5, 10, 7);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x00d2ff, 0.3); // Neon blue fill
    dirLight2.position.set(-10, -2, -5);
    scene.add(dirLight2);

    // Build components
    buildGridFloor();
    buildWire();
    buildHand();
    buildVectors();
    
    // Initial update of components structure
    updateSetup();

    // Event listeners
    window.addEventListener('resize', onWindowResize);
    
    // Start loop
    animate();
}

function resetCameraPosition() {
    // Standard flat 2D worksheet perspective looking down the Z axis
    camera.position.set(0, 0, 9);
    camera.lookAt(0, 0, 0);
    if (controls) {
        controls.target.set(0, 0, 0);
    }
}

function buildGridFloor() {
    const gridHelper = new THREE.GridHelper(20, 20, 0x00d2ff, 0x11111a);
    gridHelper.position.y = -3.5;
    scene.add(gridHelper);
}

// Create Red (North) and Blue (South) magnet poles
function buildMagnets() {
    const magnetGeo = new THREE.BoxGeometry(1.5, 2.5, 2.5);
    
    // North Pole (Red)
    const materialN = new THREE.MeshStandardMaterial({
        color: 0xef5350,
        roughness: 0.2,
        metalness: 0.8,
        emissive: 0xef5350,
        emissiveIntensity: 0.1
    });
    magnetN = new THREE.Mesh(magnetGeo, materialN);
    scene.add(magnetN);

    // South Pole (Blue)
    const materialS = new THREE.MeshStandardMaterial({
        color: 0x29b6f6,
        roughness: 0.2,
        metalness: 0.8,
        emissive: 0x29b6f6,
        emissiveIntensity: 0.1
    });
    magnetS = new THREE.Mesh(magnetGeo, materialS);
    scene.add(magnetS);
}

// Wire shell and charge carriers setup
function buildWire() {
    // Base wire shell cylinder
    const wireGeo = new THREE.CylinderGeometry(0.12, 0.12, 10, 16);
    
    const wireMat = new THREE.MeshStandardMaterial({
        color: 0x888899,
        transparent: true,
        opacity: 0.4,
        roughness: 0.1,
        metalness: 0.9,
    });
    wire = new THREE.Mesh(wireGeo, wireMat);
    scene.add(wire);

    // Group for end-on symbols (X or Dot)
    wireSymbolsGroup = new THREE.Group();
    scene.add(wireSymbolsGroup);

    // Create charge carrier particles (dots)
    const particleCount = 18;
    const particleGeo = new THREE.SphereGeometry(0.08, 8, 8);
    
    for (let i = 0; i < particleCount; i++) {
        const particleMat = new THREE.MeshBasicMaterial({ color: 0xff4d4d });
        const particle = new THREE.Mesh(particleGeo, particleMat);
        scene.add(particle);
        chargeCarriers.push(particle);
    }
}

// Helper to create 3D cross (X) symbol
function create3DInSymbol(scale = 0.25) {
    const group = new THREE.Group();
    const material = new THREE.MeshBasicMaterial({ color: 0xff4d4d });
    
    // Circle outline
    const ringGeo = new THREE.TorusGeometry(scale * 1.2, scale * 0.15, 8, 24);
    const ring = new THREE.Mesh(ringGeo, material);
    group.add(ring);

    // Cross bars
    const barGeo = new THREE.CylinderGeometry(scale * 0.12, scale * 0.12, scale * 1.8, 8);
    barGeo.rotateZ(Math.PI / 4);
    const bar1 = new THREE.Mesh(barGeo, material);
    group.add(bar1);

    const bar2 = bar1.clone();
    bar2.rotateZ(Math.PI / 2);
    group.add(bar2);

    return group;
}

// Helper to create 3D dot symbol
function create3DOutSymbol(scale = 0.25) {
    const group = new THREE.Group();
    const material = new THREE.MeshBasicMaterial({ color: 0xff4d4d });
    
    // Circle outline
    const ringGeo = new THREE.TorusGeometry(scale * 1.2, scale * 0.15, 8, 24);
    const ring = new THREE.Mesh(ringGeo, material);
    group.add(ring);

    // Center dot
    const dotGeo = new THREE.SphereGeometry(scale * 0.45, 8, 8);
    const dot = new THREE.Mesh(dotGeo, material);
    group.add(dot);

    return group;
}

// Dynamically generate field lines based on direction
function buildFieldLines() {
    // Clear existing
    fieldLines.forEach(line => scene.remove(line));
    fieldLines = [];

    if (!state.showField) return;

    const dirKey = state.fieldDir;
    const direction = directionVectors[dirKey].clone();

    if (dirKey === 'inwards' || dirKey === 'outwards') {
        // Grid of 9 crosses/dots on the plane Z = 0 (3x3 grid)
        const size = 3.0;
        const positions = [-1.5, 0, 1.5];
        
        positions.forEach(x => {
            positions.forEach(y => {
                // Skip center where the wire is if current is end-on
                if (Math.abs(x) < 0.1 && Math.abs(y) < 0.1 && (state.currentDir === 'inwards' || state.currentDir === 'outwards')) {
                    return;
                }

                let symbol;
                if (dirKey === 'inwards') {
                    // Create X symbol
                    symbol = new THREE.Group();
                    const mat = new THREE.LineBasicMaterial({ color: 0x00d2ff, linewidth: 2 });
                    
                    const points1 = [new THREE.Vector3(-0.15, -0.15, 0), new THREE.Vector3(0.15, 0.15, 0)];
                    const geo1 = new THREE.BufferGeometry().setFromPoints(points1);
                    symbol.add(new THREE.Line(geo1, mat));

                    const points2 = [new THREE.Vector3(-0.15, 0.15, 0), new THREE.Vector3(0.15, -0.15, 0)];
                    const geo2 = new THREE.BufferGeometry().setFromPoints(points2);
                    symbol.add(new THREE.Line(geo2, mat));
                } else {
                    // Create Thick dot
                    const geo = new THREE.SphereGeometry(0.08, 8, 8);
                    const mat = new THREE.MeshBasicMaterial({ color: 0x00d2ff });
                    symbol = new THREE.Mesh(geo, mat);
                }

                symbol.position.set(x, y, 0);
                scene.add(symbol);
                fieldLines.push(symbol);
            });
        });
    } else {
        // 5 lines/arrows pointing in the field direction
        // Distribute them around the wire center
        const offsetAxis = (dirKey === 'left' || dirKey === 'right') ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
        const startOffset = -1.6;
        const length = 5.0;

        for (let i = 0; i < 5; i++) {
            const currentOffset = startOffset + 0.8 * i;
            const origin = offsetAxis.clone().multiplyScalar(currentOffset);
            
            // Move back slightly in the direction opposite to field so arrow spans the gap
            origin.addScaledVector(direction, -length / 2);

            const arrow = new THREE.ArrowHelper(
                direction,
                origin,
                length,
                0x00d2ff,
                0.4,
                0.25
            );
            arrow.line.material.linewidth = 2;
            arrow.line.material.transparent = true;
            arrow.line.material.opacity = 0.7;

            scene.add(arrow);
            fieldLines.push(arrow);
        }
    }
}

// Build 3D vector indicator arrows projecting from wire center
function buildVectors() {
    // Field (B) Arrow - Greenish Blue
    const dirB = new THREE.Vector3(1, 0, 0);
    fieldArrow = new THREE.ArrowHelper(dirB, new THREE.Vector3(0, 0.5, 0), 1.8, 0x00d2ff, 0.4, 0.25);
    scene.add(fieldArrow);

    // Current (I) Arrow - Red
    const dirI = new THREE.Vector3(0, 0, -1);
    currentArrow = new THREE.ArrowHelper(dirI, new THREE.Vector3(0, 0.5, 0), 1.8, 0xff4d4d, 0.4, 0.25);
    scene.add(currentArrow);
}

function updateVectors() {
    const currentPos = wireDeflection.clone();
    
    // 1. Field Arrow
    const fieldVec = directionVectors[state.fieldDir].clone();
    fieldArrow.setDirection(fieldVec);
    fieldArrow.position.copy(currentPos);
    fieldArrow.visible = state.showField;

    // 2. Current Arrow
    const isConventional = state.flowType === 'conventional';
    const currentVec = directionVectors[state.currentDir].clone();
    currentArrow.setDirection(currentVec);
    currentArrow.position.copy(currentPos);
    
    // Color depends on flow type
    if (isConventional) {
        currentArrow.line.material.color.setHex(0xff4d4d);
        currentArrow.cone.material.color.setHex(0xff4d4d);
    } else {
        currentArrow.line.material.color.setHex(0xd500f9);
        currentArrow.cone.material.color.setHex(0xd500f9);
    }
}

// GCE O-Level Fleming's Left Hand Rule cross product Force calculation
function calculateForceDirectionVector() {
    const I = directionVectors[state.currentDir].clone();
    const B = directionVectors[state.fieldDir].clone();
    
    // F = I x B
    return new THREE.Vector3().crossVectors(I, B);
}

// Procedural 3D hand model (Palm & Wrist ONLY)
function buildHand() {
    handGroup = new THREE.Group();

    const handMat = new THREE.MeshStandardMaterial({
        color: 0x334466,
        roughness: 0.4,
        metalness: 0.7,
        transparent: true,
        opacity: 0.85
    });

    // Palm / Back of hand
    const palmGeo = new THREE.BoxGeometry(0.8, 0.8, 0.4);
    const palm = new THREE.Mesh(palmGeo, handMat);
    palm.position.set(0, 0, 0);
    handGroup.add(palm);

    // Wrist / Cuff
    const wristGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.6, 12);
    const wrist = new THREE.Mesh(wristGeo, handMat);
    wrist.position.set(0, -0.7, 0);
    handGroup.add(wrist);

    scene.add(handGroup);
    updateHandTransform();
}

// Rotates the hand palm to align with standard coordinates
function updateHandTransform() {
    handGroup.visible = state.showHand;
    if (!state.showHand) return;

    // Position hand slightly offset from wire
    const offset = directionVectors[state.currentDir].clone().cross(directionVectors[state.fieldDir]).normalize().multiplyScalar(-0.8);
    handGroup.position.copy(wireDeflection).add(offset);

    // Rotate palm to face the active directions
    // Force direction = UP/DOWN/etc.
    const F = calculateForceDirectionVector();
    const I = directionVectors[state.currentDir];
    const B = directionVectors[state.fieldDir];
    
    // Look rotation aligning Y with Force, Z with Current, X with Field
    const matrix = new THREE.Matrix4();
    matrix.makeBasis(B, F, I); // X, Y, Z orthogonal basis
    handGroup.rotation.setFromRotationMatrix(matrix);
}

// Re-orientates all physical structures (magnets, wire orientation, particles distribution)
function updateSetup() {
    const curDirKey = state.currentDir;
    const fldDirKey = state.fieldDir;

    // --- 2. Orient Wire ---
    const wireVector = directionVectors[curDirKey];
    // Reset wire rotation
    wire.rotation.set(0, 0, 0);
    
    if (curDirKey === 'left' || curDirKey === 'right') {
        wire.rotation.z = Math.PI / 2;
    } else if (curDirKey === 'inwards' || curDirKey === 'outwards') {
        wire.rotation.x = Math.PI / 2;
    }

    // Remove old symbols
    while (wireSymbolsGroup.children.length > 0) {
        wireSymbolsGroup.remove(wireSymbolsGroup.children[0]);
    }

    // Add 3D indicators if end-on view (along Z axis)
    if (curDirKey === 'inwards' || curDirKey === 'outwards') {
        const isElectron = state.flowType === 'electron';
        const isCurrentInward = curDirKey === 'inwards';
        // Direction of conventional current indicator:
        // Conventional current points inwards/outwards directly
        const symbolIn = create3DInSymbol(0.35);
        const symbolOut = create3DOutSymbol(0.35);

        // Position symbols at front and back ends of the wire
        const sym1 = (isCurrentInward) ? symbolIn : symbolOut;
        sym1.position.set(0, 0, 2.5);
        wireSymbolsGroup.add(sym1);

        const sym2 = sym1.clone();
        sym2.position.set(0, 0, -2.5);
        wireSymbolsGroup.add(sym2);
    }

    // --- 3. Re-distribute Charge Carriers ---
    const particleCount = chargeCarriers.length;
    for (let i = 0; i < particleCount; i++) {
        // Distribute from -4.5 to 4.5 along wire direction
        const posVal = -4.5 + (9 / (particleCount - 1)) * i;
        const particle = chargeCarriers[i];
        
        particle.position.copy(wireVector).multiplyScalar(posVal);
    }

    // --- 4. Rebuild static field lines ---
    buildFieldLines();
}

// Particle flow simulation
function animateParticles(delta) {
    const curDirKey = state.currentDir;
    const isConventional = state.flowType === 'conventional';
    
    // Speed of flowing charge carriers
    const speed = 4.0;
    
    // Flow direction along wire axis
    const wireVector = directionVectors[curDirKey];
    // If conventional: flows along current direction vector. If electron: flows opposite
    const flowMultiplier = isConventional ? 1 : -1;

    chargeCarriers.forEach(particle => {
        // Compute along wire axis
        const axisProj = particle.position.dot(wireVector);
        let newProj = axisProj + flowMultiplier * speed * delta;

        // Wrap around boundaries (-4.5 to 4.5)
        if (newProj > 4.5) {
            newProj = -4.5;
        } else if (newProj < -4.5) {
            newProj = 4.5;
        }

        // Apply back to particle vector, adding current deflection offset
        particle.position.copy(wireVector).multiplyScalar(newProj).add(wireDeflection);

        // Update colors based on conventional (Red) or electron (Purple)
        if (isConventional) {
            particle.material.color.setHex(0xff4d4d);
        } else {
            particle.material.color.setHex(0xd500f9);
        }
    });
}

// Animation loop
let lastTime = 0;
function animate(time) {
    requestAnimationFrame(animate);
    
    const delta = (time - lastTime) / 1000;
    lastTime = time;

    // Elastic wire deflection
    const forceDirection = calculateForceDirectionVector();
    targetWireDeflection.copy(forceDirection).multiplyScalar(0.4); // maximum 0.4 displacement deflection
    
    // Damp deflection
    wireDeflection.lerp(targetWireDeflection, 0.15);
    wire.position.copy(wireDeflection);
    wireSymbolsGroup.position.copy(wireDeflection);

    // Update particles
    animateParticles(delta);

    // Update helpers
    updateVectors();
    updateHandTransform();

    // Render scene
    controls.update();
    renderer.render(scene, camera);
}

function onWindowResize() {
    const container = document.getElementById('canvas-container');
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

// --- UI Interaction Event Listeners ---

elCurrentDir.addEventListener('change', (e) => {
    state.currentDir = e.target.value;
    updateSetup();
});

elFieldDir.addEventListener('change', (e) => {
    state.fieldDir = e.target.value;
    elStatusField.textContent = state.fieldDir.charAt(0).toUpperCase() + state.fieldDir.slice(1);
    updateSetup();
});

elFlowType.addEventListener('change', (e) => {
    state.flowType = e.target.checked ? 'electron' : 'conventional';
    elStatusFlow.textContent = state.flowType === 'conventional' ? 'Conventional' : 'Electron Flow';
    updateSetup();
});

elShowField.addEventListener('change', (e) => {
    state.showField = e.target.checked;
    buildFieldLines();
});

elShowHand.addEventListener('change', (e) => {
    state.showHand = e.target.checked;
});

elResetCam.addEventListener('click', () => {
    resetCameraPosition();
});

function setControlsDisabled(disabled) {
    elCurrentDir.disabled = disabled;
    elFieldDir.disabled = disabled;
    elFlowType.disabled = disabled;
    elShowField.disabled = disabled;
    elShowHand.disabled = disabled;
    elResetCam.disabled = disabled;
    
    const sidebar = document.getElementById('controls-sidebar');
    if (disabled) {
        sidebar.classList.add('controls-locked');
    } else {
        sidebar.classList.remove('controls-locked');
    }
}

elToggleTestMode.addEventListener('click', () => {
    state.testMode = !state.testMode;
    setControlsDisabled(state.testMode);
    if (state.testMode) {
        elToggleTestMode.innerHTML = '<i class="fa-solid fa-lock"></i> Test Mode: ON';
        elToggleTestMode.classList.add('btn-primary');
        elToggleTestMode.classList.remove('btn-secondary');
        
        resetCameraPosition();
        if (controls) {
            controls.enabled = false;
        }
    } else {
        elToggleTestMode.innerHTML = '<i class="fa-solid fa-lock-open"></i> Test Mode: OFF';
        elToggleTestMode.classList.remove('btn-primary');
        elToggleTestMode.classList.add('btn-secondary');
        
        if (controls) {
            controls.enabled = true;
        }
    }
});


// --- Gamified Challenge Mode (24 configurations) ---

const challenges = [
    // Current Outwards (towards camera)
    { current: 'outwards', field: 'left', flowType: 'conventional', answer: 'down', prompt: 'Current: Out of Screen ⊙<br>Field: Left ←<br>Predict the Force direction:' },
    { current: 'outwards', field: 'right', flowType: 'conventional', answer: 'up', prompt: 'Current: Out of Screen ⊙<br>Field: Right →<br>Predict the Force direction:' },
    { current: 'outwards', field: 'up', flowType: 'conventional', answer: 'left', prompt: 'Current: Out of Screen ⊙<br>Field: Up ↑<br>Predict the Force direction:' },
    { current: 'outwards', field: 'down', flowType: 'conventional', answer: 'right', prompt: 'Current: Out of Screen ⊙<br>Field: Down ↓<br>Predict the Force direction:' },

    // Current Inwards (into screen)
    { current: 'inwards', field: 'left', flowType: 'conventional', answer: 'up', prompt: 'Current: Into Screen ⊗<br>Field: Left ←<br>Predict the Force direction:' },
    { current: 'inwards', field: 'right', flowType: 'conventional', answer: 'down', prompt: 'Current: Into Screen ⊗<br>Field: Right →<br>Predict the Force direction:' },
    { current: 'inwards', field: 'up', flowType: 'conventional', answer: 'right', prompt: 'Current: Into Screen ⊗<br>Field: Up ↑<br>Predict the Force direction:' },
    { current: 'inwards', field: 'down', flowType: 'conventional', answer: 'left', prompt: 'Current: Into Screen ⊗<br>Field: Down ↓<br>Predict the Force direction:' },

    // Current Left
    { current: 'left', field: 'up', flowType: 'conventional', answer: 'inwards', prompt: 'Current: Left ←<br>Field: Up ↑<br>Predict the Force direction:' },
    { current: 'left', field: 'down', flowType: 'conventional', answer: 'outwards', prompt: 'Current: Left ←<br>Field: Down ↓<br>Predict the Force direction:' },
    { current: 'left', field: 'outwards', flowType: 'conventional', answer: 'up', prompt: 'Current: Left ←<br>Field: Out of Screen ⊙<br>Predict the Force direction:' },
    { current: 'left', field: 'inwards', flowType: 'conventional', answer: 'down', prompt: 'Current: Left ←<br>Field: Into Screen ⊗<br>Predict the Force direction:' },

    // Current Right
    { current: 'right', field: 'up', flowType: 'conventional', answer: 'outwards', prompt: 'Current: Right →<br>Field: Up ↑<br>Predict the Force direction:' },
    { current: 'right', field: 'down', flowType: 'conventional', answer: 'inwards', prompt: 'Current: Right →<br>Field: Down ↓<br>Predict the Force direction:' },
    { current: 'right', field: 'outwards', flowType: 'conventional', answer: 'down', prompt: 'Current: Right →<br>Field: Out of Screen ⊙<br>Predict the Force direction:' },
    { current: 'right', field: 'inwards', flowType: 'conventional', answer: 'up', prompt: 'Current: Right →<br>Field: Into Screen ⊗<br>Predict the Force direction:' },

    // Current Up
    { current: 'up', field: 'left', flowType: 'conventional', answer: 'outwards', prompt: 'Current: Up ↑<br>Field: Left ←<br>Predict the Force direction:' },
    { current: 'up', field: 'right', flowType: 'conventional', answer: 'inwards', prompt: 'Current: Up ↑<br>Field: Right →<br>Predict the Force direction:' },
    { current: 'up', field: 'outwards', flowType: 'conventional', answer: 'right', prompt: 'Current: Up ↑<br>Field: Out of Screen ⊙<br>Predict the Force direction:' },
    { current: 'up', field: 'inwards', flowType: 'conventional', answer: 'left', prompt: 'Current: Up ↑<br>Field: Into Screen ⊗<br>Predict the Force direction:' },

    // Current Down
    { current: 'down', field: 'left', flowType: 'conventional', answer: 'inwards', prompt: 'Current: Down ↓<br>Field: Left ←<br>Predict the Force direction:' },
    { current: 'down', field: 'right', flowType: 'conventional', answer: 'outwards', prompt: 'Current: Down ↓<br>Field: Right →<br>Predict the Force direction:' },
    { current: 'down', field: 'outwards', flowType: 'conventional', answer: 'left', prompt: 'Current: Down ↓<br>Field: Out of Screen ⊙<br>Predict the Force direction:' },
    { current: 'down', field: 'inwards', flowType: 'conventional', answer: 'right', prompt: 'Current: Down ↓<br>Field: Into Screen ⊗<br>Predict the Force direction:' }
];

let currentChallengeIndex = 0;

function loadChallenge() {
    elChoiceBtns.forEach(btn => {
        btn.className = 'btn btn-choice';
    });
    elChallengeFeedback.textContent = '';
    elNextChallenge.style.display = 'none';

    // Pick random challenge
    let newIndex = currentChallengeIndex;
    while (newIndex === currentChallengeIndex) {
        newIndex = Math.floor(Math.random() * challenges.length);
    }
    currentChallengeIndex = newIndex;

    const challenge = challenges[currentChallengeIndex];
    elChallengePrompt.innerHTML = challenge.prompt;

    // Apply to simulation state
    state.currentDir = challenge.current;
    state.fieldDir = challenge.field;
    state.flowType = challenge.flowType;

    // Sync select dropdowns and inputs
    elCurrentDir.value = challenge.current;
    elFieldDir.value = challenge.field;
    elFlowType.checked = (challenge.flowType === 'electron');
    
    elStatusField.textContent = state.fieldDir.charAt(0).toUpperCase() + state.fieldDir.slice(1);
    elStatusFlow.textContent = state.flowType === 'conventional' ? 'Conventional' : 'Electron Flow';
    
    if (scene) {
        updateSetup();
        resetCameraPosition(); // Snap to 2D view for the worksheet alignment
        setControlsDisabled(state.testMode);
        if (state.testMode && controls) {
            controls.enabled = false;
        }
    }
}

elChoiceBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        if (elNextChallenge.style.display === 'block') return;

        const selectedAnswer = btn.getAttribute('data-answer');
        const challenge = challenges[currentChallengeIndex];

        if (selectedAnswer === challenge.answer) {
            btn.classList.add('selected-correct');
            elChallengeFeedback.textContent = '🎉 CORRECT! deflection is ' + challenge.answer.toUpperCase().replace('INWARDS', 'INTO SCREEN').replace('OUTWARDS', 'OUT OF SCREEN') + '.';
            elChallengeFeedback.className = 'feedback-text correct';
            state.score += 10;
        } else {
            btn.classList.add('selected-incorrect');
            elChallengeFeedback.textContent = '❌ INCORRECT. Re-align your Left Hand and try again!';
            elChallengeFeedback.className = 'feedback-text incorrect';
            state.score = Math.max(0, state.score - 5);
            
            // Highlight correct choice
            elChoiceBtns.forEach(b => {
                if (b.getAttribute('data-answer') === challenge.answer) {
                    b.classList.add('selected-correct');
                }
            });
        }
        
        elScoreBadge.textContent = 'Score: ' + state.score;
        elNextChallenge.style.display = 'block';
    });
});

elNextChallenge.addEventListener('click', loadChallenge);

// Initialize everything on load
window.addEventListener('DOMContentLoaded', () => {
    initThree();
    loadChallenge();
});
