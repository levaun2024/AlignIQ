(async function () {
  const AGENT_NAME = 'Maya';
  const STORAGE_NAME_KEY = 'aligniq_user_name';
  const STORAGE_INTRO_KEY = 'aligniq_maya_introduced';

  // Load Three.js dynamically (no build step or HTML changes needed)
  let THREE, GLTFLoader;
  try {
    THREE = await import('https://esm.sh/three@0.160.0');
    const loaderMod = await import('https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader.js');
    GLTFLoader = loaderMod.GLTFLoader;
  } catch (err) {
    console.error('Three.js failed to load:', err);
    return;
  }

  let mode = 'patrol'; // 'patrol' | 'closeup' | 'walkthrough'
  let userName = localStorage.getItem(STORAGE_NAME_KEY) || '';
  let hasIntroduced = localStorage.getItem(STORAGE_INTRO_KEY) === '1';
  let waitingForName = false;
  let lastTapTime = 0;
  let chatHistory = [];
  let recognition = null;
  let isListening = false;
  let isSpeaking = false;
  let speechPulse = 0;
  let highlightedEl = null;

  // --- 1. STYLES ---
  const style = document.createElement('style');
  style.textContent = `
    #app { transition: filter 0.6s ease; }
    body.maya-3d-focus #app { filter: blur(5px) brightness(0.38); pointer-events: none; }

    #maya-3d-canvas {
      position: fixed; inset: 0; width: 100vw; height: 100vh;
      z-index: 86; pointer-events: none;
    }

    #maya-hitbox {
      position: fixed; z-index: 88; width: 64px; height: 64px;
      transform: translate(-50%, -50%); border-radius: 50%;
      cursor: pointer; touch-action: manipulation; background: transparent;
    }
    #maya-hitbox.hidden { pointer-events: none; display: none; }
    #maya-hitbox .tap-hint {
      position: absolute; bottom: -14px; left: 50%; transform: translateX(-50%);
      background: rgba(15, 23, 38, 0.94); color: #34d399; border: 1px solid rgba(16,185,129,0.5);
      font-size: 9px; font-weight: 800; padding: 2px 6px; border-radius: 6px; white-space: nowrap;
      opacity: 0; transition: opacity 0.25s ease; pointer-events: none;
    }
    #maya-hitbox:hover .tap-hint, #maya-hitbox.show-hint .tap-hint { opacity: 1; }

    .maya-highlight-ring {
      position: relative !important;
      box-shadow: 0 0 0 3px #10b981, 0 0 24px rgba(16, 185, 129, 0.9) !important;
      border-radius: 10px !important;
      z-index: 82 !important;
      transition: box-shadow 0.3s ease;
    }

    #maya-stage-ui {
      position: fixed; inset: 0; z-index: 90; pointer-events: none;
      display: flex; flex-direction: column; justify-content: space-between; align-items: center;
      opacity: 0; transform: translateY(18px);
      transition: opacity 0.45s ease, transform 0.5s cubic-bezier(0.22, 1, 0.36, 1);
      padding: calc(14px + env(safe-area-inset-top, 0px)) 14px calc(16px + env(safe-area-inset-bottom, 0px));
    }
    #maya-stage-ui.open { opacity: 1; transform: translateY(0); }
    #maya-stage-ui.open .maya-top-bar, #maya-stage-ui.open .maya-chat-card { pointer-events: auto; }

    .maya-top-bar { width: 100%; max-width: 440px; display: flex; justify-content: flex-end; gap: 6px; }
    .maya-pill-btn {
      background: rgba(15, 23, 38, 0.92); color: #f1f5f9; border: 1px solid #2b3f63;
      border-radius: 999px; padding: 6px 12px; font-size: 11px; font-weight: 700; cursor: pointer;
    }
    .maya-pill-btn.accent { background: rgba(16, 185, 129, 0.22); border-color: #10b981; color: #34d399; }

    .maya-chat-card {
      width: 100%; max-width: 440px; background: rgba(15, 23, 38, 0.94);
      backdrop-filter: blur(10px); border: 1px solid #2b3f63; border-radius: 18px; padding: 12px;
      box-shadow: 0 18px 40px rgba(0,0,0,0.6); display: flex; flex-direction: column; gap: 8px;
    }
    .maya-chat-log { max-height: 155px; overflow-y: auto; display: flex; flex-direction: column; gap: 7px; padding-right: 2px; }
    .maya-msg { max-width: 88%; padding: 8px 11px; border-radius: 12px; font-size: 12px; line-height: 1.4; }
    .maya-msg.bot { align-self: flex-start; background: #131d31; border: 1px solid #1e2d47; color: #f1f5f9; }
    .maya-msg.user { align-self: flex-end; background: #10b981; color: #04130d; font-weight: 700; }

    .maya-quick-row { display: flex; gap: 5px; overflow-x: auto; scrollbar-width: none; }
    .maya-quick-row::-webkit-scrollbar { display: none; }
    .maya-qchip {
      background: #131d31; border: 1px solid #2b3f63; color: #38bdf8;
      border-radius: 999px; padding: 4px 9px; font-size: 10.5px; font-weight: 700;
      cursor: pointer; white-space: nowrap; flex-shrink: 0;
    }

    .maya-input-bar { display: flex; align-items: center; gap: 6px; }
    .maya-input {
      flex: 1; min-width: 0; height: 38px; padding: 0 12px; border-radius: 10px;
      border: 1px solid #2b3f63; background: #080d17; color: #f1f5f9; font-size: 12.5px;
    }
    .maya-send-btn {
      height: 38px; padding: 0 12px; border-radius: 10px; border: none;
      background: #10b981; color: #04130d; font-size: 12px; font-weight: 800; cursor: pointer;
    }
    .maya-mic-btn {
      width: 38px; height: 38px; border-radius: 10px; border: 1px solid #2b3f63;
      background: #131d31; color: #f1f5f9; font-size: 16px; cursor: pointer;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .maya-mic-btn.listening { background: #ef4444; border-color: #f87171; animation: pulse 1s infinite; }

    #maya-walk-dock {
      position: fixed; left: 50%; bottom: calc(14px + env(safe-area-inset-bottom, 0px));
      transform: translateX(-50%); width: calc(100% - 24px); max-width: 450px;
      z-index: 92; background: rgba(15, 23, 38, 0.96); border: 1.5px solid #10b981;
      border-radius: 16px; padding: 11px 12px; box-shadow: 0 16px 36px rgba(0,0,0,0.65);
      display: none; flex-direction: column; gap: 8px;
    }
    #maya-walk-dock.open { display: flex; }
    .maya-walk-text { font-size: 12px; color: #f1f5f9; line-height: 1.4; }
    .maya-walk-actions { display: flex; justify-content: space-between; align-items: center; gap: 6px; }
  `;
  document.head.appendChild(style);

  // --- 2. DOM ELEMENTS ---
  const canvas = document.createElement('canvas');
  canvas.id = 'maya-3d-canvas';
  document.body.appendChild(canvas);

  const hitbox = document.createElement('div');
  hitbox.id = 'maya-hitbox';
  hitbox.innerHTML = `<span class="tap-hint">2× Tap Maya</span>`;
  document.body.appendChild(hitbox);

  const stageUI = document.createElement('div');
  stageUI.id = 'maya-stage-ui';
  stageUI.innerHTML = `
    <div class="maya-top-bar">
      <button class="maya-pill-btn accent" id="maya-done-btn">Back to Inventory</button>
    </div>
    <div class="maya-chat-card">
      <div class="maya-quick-row">
        <button class="maya-qchip" data-q="Show me the AI Agent weights">Show Agent</button>
        <button class="maya-qchip" data-q="Show me Best Odds & Body Map">Show Game Decode</button>
        <button class="maya-qchip" data-q="Show me the Parlay Slip and Calculator">Show Parlay Slip</button>
        <button class="maya-qchip" data-q="Show me Theme and Settings">Show Settings</button>
        <button class="maya-qchip" data-q="Show me Custom Scan">Show +Scan</button>
      </div>
      <div class="maya-chat-log" id="maya-chat-log"></div>
      <div class="maya-input-bar">
        <input id="maya-input" class="maya-input" placeholder="Ask Maya anything or tap the mic..." />
        <button id="maya-send" class="maya-send-btn">Send</button>
        <button id="maya-mic" class="maya-mic-btn" title="Speak to Maya">🎙️</button>
      </div>
    </div>
  `;
  document.body.appendChild(stageUI);

  const walkDock = document.createElement('div');
  walkDock.id = 'maya-walk-dock';
  walkDock.innerHTML = `
    <div class="maya-walk-text" id="maya-walk-text"></div>
    <div class="maya-walk-actions">
      <button class="maya-pill-btn" id="maya-walk-chat-btn">Talk to Maya</button>
      <button class="maya-pill-btn accent" id="maya-walk-done-btn">Done · Resume Inventory</button>
    </div>
  `;
  document.body.appendChild(walkDock);

  // --- 3. THREE.JS SCENE & 3-POINT STUDIO LIGHTING ---
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const OVERHEAD_Y = 12.5;
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, OVERHEAD_Y, 0.05);
  const camTarget = new THREE.Vector3(0, 0, 0);
  const desiredCamPos = new THREE.Vector3(0, OVERHEAD_Y, 0.05);
  const desiredCamTarget = new THREE.Vector3(0, 0, 0);

  // Soft studio lighting
  scene.add(new THREE.HemisphereLight(0xf8fafc, 0x1e293b, 1.35));
  const keyLight = new THREE.DirectionalLight(0xfff7ed, 1.45);
  keyLight.position.set(4, 10, 6);
  scene.add(keyLight);
  const rimLight = new THREE.DirectionalLight(0x34d399, 0.75);
  rimLight.position.set(-5, 6, -4);
  scene.add(rimLight);

  // --- 4. BUILD ARTICULATED 3D MAYA RIG ---
  function buildProceduralMaya() {
    const root = new THREE.Group();
    const skinMat = new THREE.MeshStandardMaterial({ color: 0x8d5524, roughness: 0.45, metalness: 0.05 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x1b120e, roughness: 0.92 });
    const blazerMat = new THREE.MeshStandardMaterial({ color: 0x162447, roughness: 0.58 });
    const blouseMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.45 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.25, metalness: 0.85 });
    const emeraldMat = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.35 });
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0x3f2e26, roughness: 0.4 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.65 });
    const lipMat = new THREE.MeshStandardMaterial({ color: 0x6b2d26, roughness: 0.35 });

    // Soft ground shadow disc
    const shadowDisc = new THREE.Mesh(
      new THREE.CircleGeometry(0.36, 24),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32 })
    );
    shadowDisc.rotation.x = -Math.PI / 2;
    shadowDisc.position.y = 0.01;
    root.add(shadowDisc);

    const hips = new THREE.Group();
    hips.position.y = 0.88;
    root.add(hips);

    // Pelvis / Skirt-Trouser base
    const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.18, 16), blazerMat);
    hips.add(pelvis);

    // Torso
    const torso = new THREE.Group();
    torso.position.y = 0.08;
    hips.add(torso);

    const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.14, 0.44, 18), blazerMat);
    chest.position.y = 0.24;
    chest.scale.set(1.18, 1, 0.72);
    torso.add(chest);

    // Crisp white blouse V-front
    const blouse = new THREE.Mesh(new THREE.ConeGeometry(0.105, 0.28, 12), blouseMat);
    blouse.rotation.x = Math.PI;
    blouse.position.set(0, 0.31, 0.095);
    blouse.scale.set(1, 1, 0.35);
    torso.add(blouse);

    // Neck & Gold Necklace
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.12, 12), skinMat);
    neck.position.y = 0.49;
    torso.add(neck);

    const necklace = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.008, 8, 20), goldMat);
    necklace.rotation.x = Math.PI / 2 + 0.25;
    necklace.position.set(0, 0.45, 0.02);
    torso.add(necklace);

    // Head Group
    const head = new THREE.Group();
    head.position.y = 0.65;
    torso.add(head);

    const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.165, 24, 24), skinMat);
    cranium.scale.set(0.94, 1.08, 0.96);
    head.add(cranium);

    // Natural Afro Hairline + High Pulled-Back Bun
    const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.172, 20, 20, 0, Math.PI * 2, 0, Math.PI * 0.62), hairMat);
    hairCap.position.set(0, 0.02, -0.015);
    hairCap.rotation.x = -0.22;
    head.add(hairCap);

    const bunGroup = new THREE.Group();
    bunGroup.position.set(0, 0.21, -0.05);
    const bunMain = new THREE.Mesh(new THREE.SphereGeometry(0.125, 18, 18), hairMat);
    bunGroup.add(bunMain);
    [[0.06, 0.05, 0.04], [-0.06, 0.04, 0.03], [0, 0.08, -0.02], [0.05, -0.02, -0.05], [-0.05, 0.02, -0.05]].forEach(([x, y, z]) => {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.068, 12, 12), hairMat);
      puff.position.set(x, y, z);
      bunGroup.add(puff);
    });
    head.add(bunGroup);

    const hairTie = new THREE.Mesh(new THREE.TorusGeometry(0.088, 0.014, 8, 20), emeraldMat);
    hairTie.rotation.x = Math.PI / 2 - 0.15;
    hairTie.position.set(0, 0.145, -0.035);
    head.add(hairTie);

    // Gold Hoop Earrings
    [-1, 1].forEach(side => {
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.004, 8, 16), goldMat);
      hoop.rotation.y = Math.PI / 2;
      hoop.position.set(side * 0.16, -0.03, 0);
      head.add(hoop);
    });

    // Eyes + Blinking Eyelids
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
    const pupilMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1 });
    const eyelids = [];
    [-1, 1].forEach(side => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.024, 12, 12), whiteMat);
      eye.position.set(side * 0.055, 0.02, 0.14);
      head.add(eye);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.013, 10, 10), pupilMat);
      pupil.position.set(side * 0.055, 0.02, 0.158);
      head.add(pupil);
      const lid = new THREE.Mesh(new THREE.SphereGeometry(0.026, 12, 12), skinMat);
      lid.position.set(side * 0.055, 0.038, 0.142);
      lid.scale.set(1.05, 0.15, 1.05);
      head.add(lid);
      eyelids.push(lid);

      // Eyebrow
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.009, 0.01), hairMat);
      brow.position.set(side * 0.055, 0.06, 0.146);
      brow.rotation.z = side * -0.08;
      head.add(brow);
    });

    // Thin Gold-Rimmed Glasses
    const lensMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.16, roughness: 0.1, metalness: 0.2 });
    [-1, 1].forEach(side => {
      const frame = new THREE.Mesh(new THREE.TorusGeometry(0.044, 0.0045, 8, 20), goldMat);
      frame.position.set(side * 0.056, 0.02, 0.166);
      head.add(frame);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.042, 18), lensMat);
      lens.position.set(side * 0.056, 0.02, 0.165);
      head.add(lens);
    });
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.005, 0.005), goldMat);
    bridge.position.set(0, 0.028, 0.166);
    head.add(bridge);

    // Nose & Animated Mouth (Lip-Sync Target)
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 10), skinMat);
    nose.position.set(0, -0.018, 0.16);
    nose.scale.set(0.9, 1.1, 0.8);
    head.add(nose);

    const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.032, 14, 10), lipMat);
    mouth.position.set(0, -0.072, 0.148);
    mouth.scale.set(1.25, 0.28, 0.5);
    head.add(mouth);

    // Arms + Clipboard (Left) + Pen (Right)
    function buildArm(side) {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * 0.23, 0.41, 0);
      torso.add(shoulder);

      const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.044, 0.28, 12), blazerMat);
      upper.position.y = -0.14;
      shoulder.add(upper);

      const elbow = new THREE.Group();
      elbow.position.y = -0.28;
      shoulder.add(elbow);

      const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.034, 0.24, 12), blazerMat);
      lower.position.y = -0.12;
      elbow.add(lower);

      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 12), skinMat);
      hand.position.y = -0.25;
      elbow.add(hand);

      return { shoulder, elbow, hand };
    }

    const leftArm = buildArm(-1);
    const rightArm = buildArm(1);

    // Wooden Clipboard in Left Hand
    const clipboard = new THREE.Group();
    clipboard.position.set(0.04, -0.24, 0.08);
    clipboard.rotation.set(-0.85, 0.3, 0.15);
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.29, 0.016), woodMat);
    clipboard.add(board);
    const paper = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.24, 0.018), blouseMat);
    paper.position.z = 0.003;
    clipboard.add(paper);
    const clip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, 0.025), goldMat);
    clip.position.set(0, 0.125, 0.008);
    clipboard.add(clip);
    leftArm.elbow.add(clipboard);

    // Gold Pen in Right Hand
    const pen = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.005, 0.16, 8), goldMat);
    pen.rotation.x = Math.PI / 2;
    pen.position.set(0, -0.25, 0.06);
    rightArm.elbow.add(pen);

    // Legs
    function buildLeg(side) {
      const hip = new THREE.Group();
      hip.position.set(side * 0.09, -0.06, 0);
      hips.add(hip);

      const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.052, 0.42, 12), blazerMat);
      thigh.position.y = -0.21;
      hip.add(thigh);

      const knee = new THREE.Group();
      knee.position.y = -0.42;
      hip.add(knee);

      const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.036, 0.38, 12), blazerMat);
      shin.position.y = -0.19;
      knee.add(shin);

      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.055, 0.16), shoeMat);
      shoe.position.set(0, -0.39, 0.035);
      knee.add(shoe);

      return { hip, knee };
    }

    const leftLeg = buildLeg(-1);
    const rightLeg = buildLeg(1);

    return { root, hips, torso, head, eyelids, mouth, leftArm, rightArm, leftLeg, rightLeg };
  }

  const rig = buildProceduralMaya();
  scene.add(rig.root);

  // Optional upgrade: if user uploads a rigged ./maya.glb later, swap it in cleanly
  let customGlb = null, customMixer = null, customMorphMeshes = [];
  try {
    const loader = new GLTFLoader();
    loader.load('./maya.glb', (gltf) => {
      customGlb = gltf.scene;
      const box = new THREE.Box3().setFromObject(customGlb);
      const h = box.getSize(new THREE.Vector3()).y || 1.7;
      customGlb.scale.setScalar(1.75 / h);
      customGlb.traverse(o => {
        if (o.isMesh && o.morphTargetDictionary) customMorphMeshes.push(o);
      });
      if (gltf.animations && gltf.animations.length) {
        customMixer = new THREE.AnimationMixer(customGlb);
        customMixer.clipAction(gltf.animations[0]).play();
      }
      rig.root.clear();
      rig.root.add(customGlb);
    }, undefined, () => {});
  } catch {}

  // --- 5. COORDINATE HELPERS (2D SCREEN PIXELS <-> 3D WORLD) ---
  function screenToWorld(px, py) {
    const vFov = (camera.fov * Math.PI) / 180;
    const visH = 2 * OVERHEAD_Y * Math.tan(vFov / 2);
    const visW = visH * camera.aspect;
    const nx = (px / window.innerWidth) * 2 - 1;
    const ny = (py / window.innerHeight) * 2 - 1;
    return new THREE.Vector3(nx * (visW / 2), 0, ny * (visH / 2));
  }

  function getBorderWaypoints() {
    const appEl = document.getElementById('app');
    const r = appEl ? appEl.getBoundingClientRect() : { left: 0, right: window.innerWidth };
    const leftX = Math.max(26, r.left + 26);
    const rightX = Math.min(window.innerWidth - 26, r.right - 26);
    const topY = 92;
    const botY = window.innerHeight - 54;
    return [
      { pos: screenToWorld(rightX, topY + 30), pause: false },
      { pos: screenToWorld(rightX, botY - 120), pause: true },
      { pos: screenToWorld(rightX, botY), pause: false },
      { pos: screenToWorld(leftX, botY), pause: true },
      { pos: screenToWorld(leftX, topY + 120), pause: false },
      { pos: screenToWorld(leftX, topY + 20), pause: true }
    ];
  }

  // Movement state
  let waypoints = getBorderWaypoints();
  let wpIdx = 0;
  let targetPos = waypoints[0].pos.clone();
  rig.root.position.copy(waypoints[0].pos);
  let pauseTimer = 0;
  let isWalking = false;
  let isPointing = false;
  let walkCycle = 0;
  let blinkTimer = 2.8;

  // --- 6. VOICE (SPEECH SYNTHESIS + MICROPHONE) ---
  function speak(text) {
    if (!('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();
      const pref = voices.find(v => /samantha|google us english|aria|jenny|zira|female/i.test(v.name)) || voices.find(v => v.lang.startsWith('en'));
      if (pref) u.voice = pref;
      u.rate = 1.03;
      u.pitch = 1.08;
      u.onstart = () => { isSpeaking = true; };
      u.onboundary = () => { speechPulse = 1.0; };
      u.onend = () => { isSpeaking = false; speechPulse = 0; };
      u.onerror = () => { isSpeaking = false; speechPulse = 0; };
      window.speechSynthesis.speak(u);
    } catch {}
  }

  function toggleMic() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      addMessage('bot', 'Voice input is not supported in this browser, but you can type your question right here!');
      return;
    }
    const micBtn = document.getElementById('maya-mic');
    if (isListening && recognition) { recognition.stop(); return; }
    recognition = new SpeechRec();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.onstart = () => { isListening = true; micBtn.classList.add('listening'); };
    recognition.onend = () => { isListening = false; micBtn.classList.remove('listening'); };
    recognition.onresult = (e) => {
      const transcript = e.results?.[0]?.[0]?.transcript || '';
      if (transcript) handleUserInput(transcript);
    };
    recognition.start();
  }

  // --- 7. CAMERA MODES & WALKTHROUGHS ---
  function clearHighlight() {
    if (highlightedEl) { highlightedEl.classList.remove('maya-highlight-ring'); highlightedEl = null; }
  }

  function startPatrol() {
    mode = 'patrol';
    isPointing = false;
    clearHighlight();
    walkDock.classList.remove('open');
    stageUI.classList.remove('open');
    document.body.classList.remove('maya-3d-focus');
    hitbox.classList.remove('hidden');
    desiredCamPos.set(0, OVERHEAD_Y, 0.05);
    desiredCamTarget.set(0, 0, 0);
    waypoints = getBorderWaypoints();
    targetPos.copy(waypoints[wpIdx % waypoints.length].pos);
  }

  function openCloseup() {
    mode = 'closeup';
    isPointing = false;
    clearHighlight();
    walkDock.classList.remove('open');
    hitbox.classList.add('hidden');
    document.body.classList.add('maya-3d-focus');
    stageUI.classList.add('open');

    // Swoop 3D camera dramatically down to waist-up portrait framing above chat box
    const mx = rig.root.position.x, mz = rig.root.position.z;
    desiredCamPos.set(mx, 1.48, mz + 2.65);
    desiredCamTarget.set(mx, 0.92, mz);

    if (!hasIntroduced) {
      hasIntroduced = true;
      localStorage.setItem(STORAGE_INTRO_KEY, '1');
      waitingForName = !userName;
      const intro = userName
        ? `Hi ${userName}! I'm ${AGENT_NAME}, your 3D AlignIQ assistant. I patrol your dashboard doing inventory and can walk right over to any feature. How can I help you today?`
        : `Hi! I'm ${AGENT_NAME}, your personal AlignIQ assistant. I patrol your dashboard doing inventory and can walk you through any feature. What's your name?`;
      addMessage('bot', intro, true);
    } else if (chatHistory.length === 0) {
      addMessage('bot', userName ? `Hey ${userName}! Good to see you. How can I help you today?` : `Hey there! How can I help you with AlignIQ today?`, true);
    } else {
      addMessage('bot', userName ? `I'm right here, ${userName}. What do you need?` : `I'm right here. How can I help?`, true);
    }
  }

  function runVisualWalkthrough(selector, replyText, actionFn) {
    mode = 'walkthrough';
    stageUI.classList.remove('open');
    document.body.classList.remove('maya-3d-focus');
    hitbox.classList.remove('hidden');

    // Swoop camera back out to bird's-eye dashboard view
    desiredCamPos.set(0, OVERHEAD_Y, 0.05);
    desiredCamTarget.set(0, 0, 0);

    addMessage('bot', replyText, true);
    document.getElementById('maya-walk-text').textContent = `${AGENT_NAME}: ${replyText}`;
    walkDock.classList.add('open');

    setTimeout(() => {
      const target = document.querySelector(selector);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        clearHighlight();
        highlightedEl = target;
        target.classList.add('maya-highlight-ring');
        const r = target.getBoundingClientRect();
        const px = Math.max(30, Math.min(window.innerWidth - 30, r.right - 10));
        const py = Math.max(70, Math.min(window.innerHeight - 140, r.bottom + 10));
        targetPos.copy(screenToWorld(px, py));
        isPointing = true;
      }
      if (typeof actionFn === 'function') {
        setTimeout(() => { try { actionFn(); } catch {} }, 1100);
      }
    }, 550);
  }

  // --- 8. CHAT LOGIC ---
  function addMessage(role, text, shouldSpeak = false) {
    chatHistory.push({ role, text });
    const log = document.getElementById('maya-chat-log');
    if (log) {
      log.innerHTML = chatHistory.map(m => `<div class="maya-msg ${m.role}">${m.text}</div>`).join('');
      log.scrollTop = log.scrollHeight;
    }
    if (shouldSpeak && role === 'bot') speak(text);
  }

  function handleUserInput(rawText) {
    const text = (rawText || '').trim();
    if (!text) return;
    addMessage('user', text, false);

    if (waitingForName) {
      const cleanName = text.replace(/^(my name is|i'm|im|call me|it's|its)\s+/i, '').split(/[.,!?]/)[0].trim();
      if (cleanName && cleanName.length <= 24) {
        userName = cleanName;
        localStorage.setItem(STORAGE_NAME_KEY, userName);
        waitingForName = false;
        addMessage('bot', `Nice to meet you, ${userName}! Ask me about CONF percentages, +EV, weight cuts, or tell me to show you any feature on the screen.`, true);
        return;
      }
    }

    const q = text.toLowerCase();
    if (/done|bye|thank|back to inventory|resume|close/.test(q)) {
      addMessage('bot', userName ? `You got it, ${userName}! Heading back to my inventory patrol. Double-tap me anytime.` : `You got it! Heading back to my inventory patrol.`, true);
      setTimeout(startPatrol, 1600);
      return;
    }
    if (/agent|weight|api key|credit|slider/.test(q)) {
      runVisualWalkthrough('button[onclick*="toggleTuner"]', 'Follow me to the AI Agent panel. Here you can view your 60-day verified record, adjust pillar weights, and save your private Odds API key.', () => {
        const panel = document.getElementById('tuner-panel');
        if (panel && !panel.classList.contains('open') && typeof toggleTuner === 'function') toggleTuner();
      });
      return;
    }
    if (/theme|light|dark|setting/.test(q)) {
      runVisualWalkthrough('button[onclick*="openSettingsModal"]', 'Walking over to your Settings menu now so you can switch between Dark Mode and Light Mode.', () => {
        if (typeof openSettingsModal === 'function') openSettingsModal('theme');
      });
      return;
    }
    if (/parlay|slip|calc|arb|ev/.test(q)) {
      runVisualWalkthrough('button[onclick*="openToolsModal"]', 'Right here is your Parlay Slip and Pro Calculator. Opening it so you can check saved legs, arbitrage splits, and +EV.', () => {
        if (typeof openToolsModal === 'function') openToolsModal('slip');
      });
      return;
    }
    if (/scan|custom|walkout/.test(q)) {
      runVisualWalkthrough('button[onclick*="openScanModal"]', 'Here is the +Scan button. Opening it so you can run a custom 4-cipher Gematria scan.', () => {
        if (typeof openScanModal === 'function') openScanModal();
      });
      return;
    }
    if (/odds|body|weak|fight|cut|health|game|decode|show/.test(q)) {
      runVisualWalkthrough('.game-card', 'Walking over to the top game card and opening it so you can inspect Best Odds, Player Props, the Body Weak-Point Map, and verified sources.', () => {
        const firstCard = document.querySelector('.game-card');
        if (firstCard) firstCard.click();
      });
      return;
    }
    if (/date|math|numerology/.test(q)) {
      runVisualWalkthrough('.date-math-bar', 'Here is your Date Math strip. Tapping into it to show today’s numerology breakdown.', () => {
        if (typeof openDateMathModal === 'function') openDateMathModal();
      });
      return;
    }

    const ans = typeof getHelpAnswer === 'function'
      ? getHelpAnswer(text)
      : 'Ask me to show you the AI Agent, Settings, Parlay Slip, +Scan, or any Game Decode and I will walk right over to it!';
    addMessage('bot', ans, true);
  }

  // --- 9. 60FPS ANIMATION LOOP (SKELETAL WALKING, SWOOP, LIP-SYNC, BLINK) ---
  const clock = new THREE.Clock();
  const projVec = new THREE.Vector3();

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    // 1) Smooth cinematic 3D camera swoop
    camera.position.lerp(desiredCamPos, Math.min(1, dt * 4.5));
    camTarget.lerp(desiredCamTarget, Math.min(1, dt * 5.0));
    camera.lookAt(camTarget);

    // 2) Navigation & Orientation
    isWalking = false;
    if (mode === 'patrol' || mode === 'walkthrough') {
      const dx = targetPos.x - rig.root.position.x;
      const dz = targetPos.z - rig.root.position.z;
      const dist = Math.hypot(dx, dz);

      if (dist > 0.08) {
        isWalking = true;
        const speed = mode === 'walkthrough' ? 3.8 : 1.55;
        const step = Math.min(dist, speed * dt);
        rig.root.position.x += (dx / dist) * step;
        rig.root.position.z += (dz / dist) * step;

        const targetAngle = Math.atan2(dx, dz);
        let diff = targetAngle - rig.root.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        rig.root.rotation.y += diff * Math.min(1, dt * 8);
      } else if (mode === 'patrol') {
        if (pauseTimer <= 0) {
          pauseTimer = waypoints[wpIdx % waypoints.length].pause ? 2.2 : 0.2;
        } else {
          pauseTimer -= dt;
          if (pauseTimer <= 0) {
            wpIdx = (wpIdx + 1) % waypoints.length;
            targetPos.copy(waypoints[wpIdx].pos);
          }
        }
      }
    } else if (mode === 'closeup') {
      // Smoothly turn Maya to face the camera directly
      let diff = 0 - rig.root.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      rig.root.rotation.y += diff * Math.min(1, dt * 7);
    }

    // 3) Skeletal Animation (Procedural Rig)
    if (!customGlb) {
      if (isWalking) {
        walkCycle += dt * 8.5;
        const swing = Math.sin(walkCycle);
        rig.leftLeg.hip.rotation.x = swing * 0.55;
        rig.rightLeg.hip.rotation.x = -swing * 0.55;
        rig.leftLeg.knee.rotation.x = Math.max(0, -swing * 0.5);
        rig.rightLeg.knee.rotation.x = Math.max(0, swing * 0.5);
        rig.hips.position.y = 0.88 + Math.abs(Math.cos(walkCycle)) * 0.04;
        rig.torso.rotation.y = swing * 0.08;
        // Left arm cradles clipboard, right arm swings naturally
        rig.leftArm.shoulder.rotation.x = -0.55;
        rig.leftArm.elbow.rotation.x = -0.85;
        rig.rightArm.shoulder.rotation.x = -swing * 0.35;
        rig.rightArm.elbow.rotation.x = -0.35;
        rig.head.rotation.x = 0.22; // glancing down at inventory path
      } else {
        // Idle / Clipboard Check / Closeup / Pointing
        rig.leftLeg.hip.rotation.x *= 0.85;
        rig.rightLeg.hip.rotation.x *= 0.85;
        rig.leftLeg.knee.rotation.x *= 0.85;
        rig.rightLeg.knee.rotation.x *= 0.85;
        rig.hips.position.y = 0.88 + Math.sin(t * 2.2) * 0.012;
        rig.torso.rotation.y *= 0.85;

        // Left arm holds clipboard
        rig.leftArm.shoulder.rotation.x = -0.5;
        rig.leftArm.elbow.rotation.x = -0.95;

        if (mode === 'walkthrough' && isPointing) {
          // Raise right arm to point at the highlighted UI feature
          rig.rightArm.shoulder.rotation.x = -1.35 + Math.sin(t * 5) * 0.08;
          rig.rightArm.elbow.rotation.x = -0.2;
          rig.head.rotation.x = 0.1;
        } else if (mode === 'patrol') {
          // Writing inventory notes on clipboard
          rig.rightArm.shoulder.rotation.x = -0.65;
          rig.rightArm.shoulder.rotation.z = -0.35 + Math.sin(t * 9) * 0.08;
          rig.rightArm.elbow.rotation.x = -0.85;
          rig.head.rotation.x = 0.38;
        } else {
          // Close-up conversational posture + natural gesturing when speaking
          rig.rightArm.shoulder.rotation.z = 0.08;
          rig.rightArm.shoulder.rotation.x = isSpeaking ? (-0.42 + Math.sin(t * 4.5) * 0.14) : -0.25;
          rig.rightArm.elbow.rotation.x = isSpeaking ? (-0.85 + Math.cos(t * 5) * 0.12) : -0.65;
          rig.head.rotation.x = isSpeaking ? (Math.sin(t * 4) * 0.06) : (Math.sin(t * 1.4) * 0.03);
          rig.head.rotation.y = isSpeaking ? (Math.sin(t * 2.3) * 0.09) : (Math.sin(t * 0.9) * 0.04);
        }
      }

      // Natural Eye Blinking
      blinkTimer -= dt;
      if (blinkTimer <= 0) blinkTimer = 2.6 + Math.random() * 2.8;
      const blinkScale = blinkTimer < 0.12 ? 1.05 : 0.14;
      rig.eyelids.forEach(lid => { lid.scale.y = blinkScale; });

      // Real-Time Lip-Sync
      speechPulse = Math.max(0, speechPulse - dt * 4.5);
      const mouthOpen = isSpeaking
        ? 0.35 + Math.abs(Math.sin(t * 14) * Math.cos(t * 7.3)) * 0.85 + speechPulse * 0.35
        : 0.25;
      rig.mouth.scale.y = mouthOpen;
    } else {
      if (customMixer) customMixer.update(dt);
      const openVal = isSpeaking ? Math.min(1, 0.25 + Math.abs(Math.sin(t * 14)) * 0.75) : 0;
      customMorphMeshes.forEach(m => {
        const idx = m.morphTargetDictionary.mouthOpen ?? m.morphTargetDictionary.viseme_aa ?? m.morphTargetDictionary.jawOpen;
        if (idx !== undefined) m.morphTargetInfluences[idx] = openVal;
      });
    }

    // 4) Sync 2D Double-Tap Hitbox to Maya's 3D Screen Position
    if (mode !== 'closeup') {
      projVec.copy(rig.root.position).add(new THREE.Vector3(0, 0.9, 0)).project(camera);
      const sx = (projVec.x * 0.5 + 0.5) * window.innerWidth;
      const sy = (-projVec.y * 0.5 + 0.5) * window.innerHeight;
      hitbox.style.left = `${sx}px`;
      hitbox.style.top = `${sy}px`;
    }

    renderer.render(scene, camera);
  }
  animate();

  // --- 10. EVENTS & RESIZE ---
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    waypoints = getBorderWaypoints();
  });

  hitbox.addEventListener('dblclick', (e) => { e.stopPropagation(); openCloseup(); });
  hitbox.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTapTime < 340) {
      e.preventDefault();
      e.stopPropagation();
      openCloseup();
    } else {
      hitbox.classList.add('show-hint');
      setTimeout(() => hitbox.classList.remove('show-hint'), 1800);
    }
    lastTapTime = now;
  });

  document.getElementById('maya-done-btn').addEventListener('click', startPatrol);
  document.getElementById('maya-walk-done-btn').addEventListener('click', startPatrol);
  document.getElementById('maya-walk-chat-btn').addEventListener('click', openCloseup);
  document.getElementById('maya-mic').addEventListener('click', toggleMic);
  document.getElementById('maya-send').addEventListener('click', () => {
    const inp = document.getElementById('maya-input');
    handleUserInput(inp.value);
    inp.value = '';
  });
  document.getElementById('maya-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { handleUserInput(e.target.value); e.target.value = ''; }
  });
  stageUI.querySelectorAll('.maya-qchip').forEach(btn => {
    btn.addEventListener('click', () => handleUserInput(btn.getAttribute('data-q')));
  });
})();
