(async function () {
  const AGENT_NAME = 'Maya';
  const STORAGE_NAME_KEY = 'aligniq_user_name';
  const STORAGE_INTRO_KEY = 'aligniq_maya_introduced';

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
  let waveTimer = 0;
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
      position: fixed; z-index: 88; width: 74px; height: 74px;
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

  // --- 3. THREE.JS SCENE & STUDIO LIGHTING ---
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;

  const scene = new THREE.Scene();

  // Bird's-eye overhead camera with slight tilt so legs, posture & clipboard read clearly
  const PATROL_CAM_POS = new THREE.Vector3(0, 11.8, 1.35);
  const PATROL_CAM_TGT = new THREE.Vector3(0, 0, 0);

  const camera = new THREE.PerspectiveCamera(44, window.innerWidth / window.innerHeight, 0.05, 100);
  camera.position.copy(PATROL_CAM_POS);
  camera.lookAt(PATROL_CAM_TGT);

  const camTarget = PATROL_CAM_TGT.clone();
  const desiredCamPos = PATROL_CAM_POS.clone();
  const desiredCamTarget = PATROL_CAM_TGT.clone();

  const patrolRayCam = camera.clone();
  const raycaster = new THREE.Raycaster();
  const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 1.5));
  const keyLight = new THREE.DirectionalLight(0xfff6eb, 1.7);
  keyLight.position.set(3, 10, 6);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xe0f2fe, 0.95);
  fillLight.position.set(-4, 6, 4);
  scene.add(fillLight);
  const rimLight = new THREE.DirectionalLight(0x34d399, 0.7);
  rimLight.position.set(0, 5, -5);
  scene.add(rimLight);

  // --- 4. AVATURN RIG + HIGH-VISIBILITY CLIPBOARD & PEN ---
  const avatarRoot = new THREE.Group();
  scene.add(avatarRoot);

  const shadowDisc = new THREE.Mesh(
    new THREE.CircleGeometry(0.36, 24),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.36 })
  );
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.y = 0.01;
  avatarRoot.add(shadowDisc);

  function createClipboardProp() {
    const grp = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.5 });
    const paper = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x475569, emissiveIntensity: 0.45, roughness: 0.35 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.25, metalness: 0.85 });
    const green = new THREE.MeshBasicMaterial({ color: 0x10b981 });
    const blue = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

    const board = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.42, 0.018), wood);
    grp.add(board);

    const sheet = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.35, 0.020), paper);
    sheet.position.set(0, -0.01, 0.002);
    grp.add(sheet);

    const clip = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.036, 0.028), gold);
    clip.position.set(0, 0.18, 0.009);
    grp.add(clip);

    [0.10, 0.03, -0.04, -0.11].forEach((ly, idx) => {
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.022, 0.024), idx % 2 === 0 ? green : blue);
      line.position.set(0.01, ly, 0.003);
      grp.add(line);
    });
    grp.visible = false;
    return grp;
  }

  function createPenProp() {
    const grp = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.010, 0.007, 0.22, 10),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.2, metalness: 0.85 })
    );
    body.rotation.x = Math.PI / 2;
    grp.add(body);
    grp.visible = false;
    return grp;
  }

  const clipboardProp = createClipboardProp();
  const penProp = createPenProp();
  scene.add(clipboardProp);
  scene.add(penProp);

  let avatarModel = null;
  let baseModelY = 0;
  let armDropRad = 0.72;
  const bones = {};
  const restLocalQuat = {};
  const morphMeshes = [];

  const _rootQuatInv = new THREE.Quaternion();
  const _parentWorldQ = new THREE.Quaternion();
  const _parentCharQ = new THREE.Quaternion();
  const _parentCharQInv = new THREE.Quaternion();
  const _deltaQ = new THREE.Quaternion();
  const _targetLocalQ = new THREE.Quaternion();
  const _euler = new THREE.Euler(0, 0, 0, 'XYZ');
  const _vA = new THREE.Vector3();
  const _vB = new THREE.Vector3();
  const _qTmp = new THREE.Quaternion();

  // Character-space rotation solver (handles any Avaturn / Mixamo bone orientation)
  // rx: negative swings forward/up (+Z in char space); positive swings backward (-Z)
  // ry: positive turns character-left; negative turns character-right
  // rz: positive raises leftArm / lowers rightArm; negative lowers leftArm / raises rightArm
  function poseBone(key, rx, ry, rz, lerpAmt = 0.25) {
    const b = bones[key];
    const rQ = restLocalQuat[key];
    if (!b || !rQ || !b.parent) return;

    b.parent.updateWorldMatrix(true, false);
    b.parent.getWorldQuaternion(_parentWorldQ);
    _parentCharQ.copy(_rootQuatInv).multiply(_parentWorldQ);
    _parentCharQInv.copy(_parentCharQ).invert();

    _euler.set(rx, ry, rz, 'XYZ');
    _deltaQ.setFromEuler(_euler);

    _targetLocalQ.copy(_parentCharQInv).multiply(_deltaQ).multiply(_parentCharQ).multiply(rQ);
    b.quaternion.slerp(_targetLocalQ, lerpAmt);
  }

  function setMorph(names, value) {
    for (let i = 0; i < morphMeshes.length; i++) {
      const m = morphMeshes[i];
      const dict = m.morphTargetDictionary;
      for (let j = 0; j < names.length; j++) {
        const idx = dict[names[j]];
        if (idx !== undefined) {
          m.morphTargetInfluences[idx] = value;
          break;
        }
      }
    }
  }

  // Fuzzy matcher catches LeftArm, LeftArm_01, LeftShoulder, LeftUpLeg, etc.
  function matchBone(name) {
    const n = (name || '').toLowerCase().replace(/^mixamorig[:_]?/, '').replace(/[^a-z]/g, '');
    if (n === 'hips' || n === 'pelvis') return 'hips';
    if (n === 'spine') return 'spine';
    if (n === 'chest' || n === 'upperchest') return 'chest';
    if (n === 'neck') return 'neck';
    if (n === 'head') return 'head';
    if (n.includes('left') && (n.includes('upleg') || n.includes('upperleg') || n.includes('thigh'))) return 'leftUpLeg';
    if (n.includes('left') && (n === 'leftleg' || n.includes('lowerleg') || n.includes('calf') || n.includes('shin'))) return 'leftLeg';
    if (n.includes('left') && n.includes('foot')) return 'leftFoot';
    if (n.includes('right') && (n.includes('upleg') || n.includes('upperleg') || n.includes('thigh'))) return 'rightUpLeg';
    if (n.includes('right') && (n === 'rightleg' || n.includes('lowerleg') || n.includes('calf') || n.includes('shin'))) return 'rightLeg';
    if (n.includes('right') && n.includes('foot')) return 'rightFoot';
    if (n.includes('left') && n.includes('shoulder')) return 'leftShoulder';
    if (n.includes('right') && n.includes('shoulder')) return 'rightShoulder';
    if (n.includes('left') && (n === 'leftarm' || n.includes('upperarm'))) return 'leftArm';
    if (n.includes('left') && (n.includes('forearm') || n.includes('lowerarm'))) return 'leftForeArm';
    if (n.includes('left') && n.includes('hand') && !n.includes('thumb') && !n.includes('index') && !n.includes('middle') && !n.includes('ring') && !n.includes('pinky')) return 'leftHand';
    if (n.includes('right') && (n === 'rightarm' || n.includes('upperarm'))) return 'rightArm';
    if (n.includes('right') && (n.includes('forearm') || n.includes('lowerarm'))) return 'rightForeArm';
    if (n.includes('right') && n.includes('hand') && !n.includes('thumb') && !n.includes('index') && !n.includes('middle') && !n.includes('ring') && !n.includes('pinky')) return 'rightHand';
    return null;
  }

  const loader = new GLTFLoader();
  loader.load(
    './maya.glb?v=6',
    (gltf) => {
      avatarModel = gltf.scene;

      const box = new THREE.Box3().setFromObject(avatarModel);
      const size = box.getSize(new THREE.Vector3());
      const scale = 1.92 / (size.y || 1.92);
      avatarModel.scale.setScalar(scale);

      const scaledBox = new THREE.Box3().setFromObject(avatarModel);
      baseModelY = -scaledBox.min.y;
      avatarModel.position.y = baseModelY;

      avatarModel.traverse((obj) => {
        if (obj.isMesh) {
          obj.frustumCulled = false;
          if (obj.morphTargetDictionary && obj.morphTargetInfluences) {
            morphMeshes.push(obj);
          }
        }
        if (obj.isBone) {
          const key = matchBone(obj.name);
          if (key && !bones[key]) {
            bones[key] = obj;
            restLocalQuat[key] = obj.quaternion.clone();
          }
        }
      });

      avatarRoot.add(avatarModel);
      avatarRoot.updateMatrixWorld(true);

      if (bones.leftArm && bones.leftForeArm) {
        bones.leftArm.getWorldPosition(_vA);
        bones.leftForeArm.getWorldPosition(_vB);
        _vB.sub(_vA).normalize();
        const currentDownAngle = Math.atan2(-_vB.y, Math.abs(_vB.x));
        armDropRad = Math.max(0.15, 1.32 - currentDownAngle);
      }

      clipboardProp.visible = true;
      penProp.visible = true;
    },
    undefined,
    (err) => console.warn('Could not load ./maya.glb:', err)
  );

  // --- 5. SCREEN-TO-FLOOR RAYCASTING ---
  function screenToWorld(px, py) {
    patrolRayCam.aspect = window.innerWidth / window.innerHeight;
    patrolRayCam.position.copy(PATROL_CAM_POS);
    patrolRayCam.lookAt(PATROL_CAM_TGT);
    patrolRayCam.updateProjectionMatrix();
    patrolRayCam.updateMatrixWorld(true);

    const ndc = new THREE.Vector2((px / window.innerWidth) * 2 - 1, -(py / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, patrolRayCam);
    const hit = new THREE.Vector3();
    raycaster.ray.intersectPlane(floorPlane, hit);
    return hit;
  }

  function getBorderWaypoints() {
    const appEl = document.getElementById('app');
    const r = appEl ? appEl.getBoundingClientRect() : { left: 0, right: window.innerWidth };
    const leftX = Math.max(34, r.left + 34);
    const rightX = Math.min(window.innerWidth - 34, r.right - 34);
    const topY = 108;
    const botY = window.innerHeight - 64;
    return [
      { pos: screenToWorld(rightX, topY + 25), pause: true, faceIn: -Math.PI / 2 },
      { pos: screenToWorld(rightX, botY - 125), pause: true, faceIn: -Math.PI / 2 },
      { pos: screenToWorld(rightX, botY), pause: false, faceIn: -Math.PI / 2 },
      { pos: screenToWorld(leftX, botY), pause: true, faceIn: Math.PI / 2 },
      { pos: screenToWorld(leftX, topY + 125), pause: true, faceIn: Math.PI / 2 },
      { pos: screenToWorld(leftX, topY + 25), pause: false, faceIn: Math.PI / 2 }
    ];
  }

  let waypoints = getBorderWaypoints();
  let wpIdx = 0;
  let targetPos = waypoints[0].pos.clone();
  avatarRoot.position.copy(waypoints[0].pos);
  let pauseTimer = 0;
  let isWalking = false;
  let isPointing = false;
  let walkCycle = 0;
  let blinkTimer = 2.6;

  // --- 6. VOICE ---
  function speak(text) {
    if (!('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();
      const pref = voices.find(v => /samantha|google us english|aria|jenny|zira|female/i.test(v.name)) || voices.find(v => v.lang.startsWith('en'));
      if (pref) u.voice = pref;
      u.rate = 1.02;
      u.pitch = 1.07;
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
    waveTimer = 0;
    clearHighlight();
    walkDock.classList.remove('open');
    stageUI.classList.remove('open');
    document.body.classList.remove('maya-3d-focus');
    hitbox.classList.remove('hidden');
    desiredCamPos.copy(PATROL_CAM_POS);
    desiredCamTarget.copy(PATROL_CAM_TGT);
    waypoints = getBorderWaypoints();
    targetPos.copy(waypoints[wpIdx % waypoints.length].pos);
  }

  function openCloseup() {
    mode = 'closeup';
    isPointing = false;
    waveTimer = 1.6;
    clearHighlight();
    walkDock.classList.remove('open');
    hitbox.classList.add('hidden');
    document.body.classList.add('maya-3d-focus');
    stageUI.classList.add('open');

    const mx = avatarRoot.position.x, mz = avatarRoot.position.z;
    desiredCamPos.set(mx, 1.56, mz + 1.62);
    desiredCamTarget.set(mx, 1.22, mz);

    if (!hasIntroduced) {
      hasIntroduced = true;
      localStorage.setItem(STORAGE_INTRO_KEY, '1');
      waitingForName = !userName;
      const intro = userName
        ? `Hi ${userName}! I'm ${AGENT_NAME}, your AlignIQ assistant. I keep count of your dashboard inventory and can walk you right over to any feature. How can I help you today?`
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

    desiredCamPos.copy(PATROL_CAM_POS);
    desiredCamTarget.copy(PATROL_CAM_TGT);

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
        const px = Math.max(36, Math.min(window.innerWidth - 36, r.right - 10));
        const py = Math.max(85, Math.min(window.innerHeight - 145, r.bottom + 14));
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
      runVisualWalkthrough('button[onclick*="toggleTuner"]', 'Follow me to the AI Agent panel. Here you can check your 60-day verified record, adjust pillar weights, and save your private Odds API key.', () => {
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

  // --- 9. 60FPS ANIMATION LOOP ---
  const clock = new THREE.Clock();
  const projVec = new THREE.Vector3();

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    camera.position.lerp(desiredCamPos, Math.min(1, dt * 4.5));
    camTarget.lerp(desiredCamTarget, Math.min(1, dt * 5.0));
    camera.lookAt(camTarget);

    isWalking = false;
    let desiredYaw = avatarRoot.rotation.y;

    if (mode === 'patrol' || mode === 'walkthrough') {
      const dx = targetPos.x - avatarRoot.position.x;
      const dz = targetPos.z - avatarRoot.position.z;
      const dist = Math.hypot(dx, dz);

      if (dist > 0.08) {
        isWalking = true;
        const speed = mode === 'walkthrough' ? 3.8 : 1.5;
        const step = Math.min(dist, speed * dt);
        avatarRoot.position.x += (dx / dist) * step;
        avatarRoot.position.z += (dz / dist) * step;
        desiredYaw = Math.atan2(dx, dz);
      } else if (mode === 'patrol') {
        const curWp = waypoints[wpIdx % waypoints.length];
        if (pauseTimer <= 0) {
          pauseTimer = curWp.pause ? 3.6 : 0.25;
        } else {
          pauseTimer -= dt;
          desiredYaw = curWp.faceIn ?? 0;
          if (pauseTimer <= 0) {
            wpIdx = (wpIdx + 1) % waypoints.length;
            targetPos.copy(waypoints[wpIdx].pos);
          }
        }
      } else if (mode === 'walkthrough') {
        desiredYaw = 0;
      }
    } else if (mode === 'closeup') {
      desiredYaw = 0;
    }

    let yawDiff = desiredYaw - avatarRoot.rotation.y;
    while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
    while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
    avatarRoot.rotation.y += yawDiff * Math.min(1, dt * 6.5);

    avatarRoot.updateMatrixWorld(true);
    _rootQuatInv.copy(avatarRoot.quaternion).invert();

    // --- PROCEDURAL NATURAL HUMANOID MOTION ---
    if (avatarModel) {
      if (isWalking) {
        walkCycle += dt * 7.8;
        const s = Math.sin(walkCycle);
        const c = Math.cos(walkCycle);

        // Smooth human walk cycle
        poseBone('hips', 0.04, s * 0.10, s * 0.06, 0.28);
        poseBone('spine', 0.05, -s * 0.08, -s * 0.04, 0.24);
        poseBone('chest', 0.04, -s * 0.06, 0, 0.22);

        poseBone('leftUpLeg', -s * 0.60, 0, 0, 0.30);
        poseBone('rightUpLeg', s * 0.60, 0, 0, 0.30);
        poseBone('leftLeg', Math.max(0.08, (c + 0.35) * 0.72), 0, 0, 0.30);
        poseBone('rightLeg', Math.max(0.08, (-c + 0.35) * 0.72), 0, 0, 0.30);
        poseBone('leftFoot', -s * 0.22, 0, 0, 0.26);
        poseBone('rightFoot', s * 0.22, 0, 0, 0.26);

        // Left arm cradles clipboard in front; right arm swings naturally
        poseBone('leftShoulder', 0, 0.08, 0.05, 0.2);
        poseBone('leftArm', -0.52, 0.22, -armDropRad + 0.18, 0.24);
        poseBone('leftForeArm', -1.02, -0.35, 0, 0.24);

        poseBone('rightShoulder', 0, -s * 0.06, 0, 0.2);
        poseBone('rightArm', s * 0.38 - 0.10, 0, armDropRad, 0.24);
        poseBone('rightForeArm', -0.38 - Math.max(0, s * 0.30), 0, 0, 0.24);

        poseBone('neck', 0.12, 0, 0, 0.16);
        poseBone('head', 0.18, Math.sin(t * 1.8) * 0.14, 0, 0.16);

        avatarModel.position.y = baseModelY + Math.abs(c) * 0.048;
      } else {
        // Relaxed standing stance with gentle weight shift
        const sway = Math.sin(t * 1.2);
        poseBone('hips', 0, sway * 0.04, sway * 0.025, 0.14);
        poseBone('leftUpLeg', 0.03, 0.05, -0.02, 0.16);
        poseBone('rightUpLeg', -0.03, -0.05, 0.02, 0.16);
        poseBone('leftLeg', 0.06, 0, 0, 0.16);
        poseBone('rightLeg', 0.06, 0, 0, 0.16);
        poseBone('leftFoot', 0, 0, 0, 0.16);
        poseBone('rightFoot', 0, 0, 0, 0.16);
        avatarModel.position.y = baseModelY + Math.sin(t * 2.1) * 0.006;

        if (mode === 'patrol') {
          // COUNTING & CHECKING INVENTORY: Look out & count games (1-2-3), then look down & check off clipboard
          const cycle = t % 3.4;
          const isCheckingBoard = cycle > 1.85;

          poseBone('spine', 0.05 + Math.sin(t * 2.1) * 0.015, sway * 0.05, 0, 0.16);
          poseBone('chest', 0.04, 0, 0, 0.16);
          poseBone('leftShoulder', 0, 0.12, 0.06, 0.16);
          poseBone('leftArm', -0.68, 0.32, -armDropRad + 0.14, 0.20);
          poseBone('leftForeArm', -1.15, -0.45, 0, 0.20);

          if (isCheckingBoard) {
            // Checking items off the clipboard with pen
            poseBone('rightShoulder', 0, -0.10, 0, 0.18);
            poseBone('rightArm', -0.62, -0.35, armDropRad - 0.14, 0.22);
            poseBone('rightForeArm', -1.12 + Math.sin(t * 14) * 0.14, 0.42 + Math.cos(t * 11) * 0.12, 0, 0.24);
            poseBone('neck', 0.24, 0, 0, 0.16);
            poseBone('head', 0.34 + Math.sin(t * 6) * 0.04, 0.12, 0, 0.16);
          } else {
            // Counting games on dashboard with pen gestures & head nods
            const countNod = Math.sin(t * 5.8) * 0.14;
            poseBone('rightShoulder', 0, -0.06, 0, 0.18);
            poseBone('rightArm', -0.82 + countNod, -0.18 + Math.sin(t * 2.2) * 0.22, armDropRad - 0.22, 0.20);
            poseBone('rightForeArm', -0.74 + countNod, 0.15, 0, 0.20);
            poseBone('neck', -0.04, Math.sin(t * 2.2) * 0.16, 0, 0.16);
            poseBone('head', -0.05 + Math.sin(t * 5.8) * 0.06, Math.sin(t * 2.2) * 0.26, 0, 0.16);
          }
        } else if (mode === 'walkthrough' && isPointing) {
          poseBone('spine', 0.04, -0.14, 0, 0.16);
          poseBone('chest', 0.02, -0.10, 0, 0.16);
          poseBone('leftArm', -0.52, 0.25, -armDropRad + 0.15, 0.18);
          poseBone('leftForeArm', -1.0, -0.3, 0, 0.18);
          poseBone('rightShoulder', 0, -0.12, -0.08, 0.18);
          poseBone('rightArm', -1.35 + Math.sin(t * 4.5) * 0.09, -0.22, armDropRad - 0.55, 0.20);
          poseBone('rightForeArm', -0.25, 0, 0, 0.20);
          poseBone('neck', 0.06, -0.1, 0, 0.16);
          poseBone('head', 0.1, Math.sin(t * 2) * 0.08, 0, 0.16);
        } else {
          // CLOSE-UP INTERACTION: Natural breathing, friendly wave, expressive talking gestures
          poseBone('spine', Math.sin(t * 2.0) * 0.02, sway * 0.035, sway * 0.02, 0.14);
          poseBone('chest', Math.sin(t * 2.0) * 0.025, 0, 0, 0.14);

          poseBone('leftShoulder', 0, 0.08, 0.04, 0.14);
          poseBone('leftArm', -0.42, 0.25, -armDropRad + 0.12, 0.16);
          poseBone('leftForeArm', -0.96, -0.35, 0, 0.16);

          if (waveTimer > 0) {
            waveTimer -= dt;
            poseBone('rightShoulder', 0, -0.08, -0.12, 0.20);
            poseBone('rightArm', -0.62, -0.20, armDropRad - 0.92, 0.22);
            poseBone('rightForeArm', -1.32, 0.18, Math.sin(t * 11) * 0.30, 0.24);
            poseBone('neck', -0.02, 0, 0.05, 0.16);
            poseBone('head', -0.03, 0.04, 0.07, 0.16);
          } else if (isSpeaking) {
            const g1 = Math.sin(t * 3.5);
            const g2 = Math.cos(t * 4.8);
            poseBone('rightShoulder', 0, -0.05, 0, 0.16);
            poseBone('rightArm', -0.52 + g1 * 0.16, -0.18 + g2 * 0.12, armDropRad - 0.18, 0.16);
            poseBone('rightForeArm', -1.02 + g2 * 0.20, 0.25 + g1 * 0.14, 0, 0.16);
            poseBone('neck', Math.sin(t * 3.2) * 0.04, Math.sin(t * 1.9) * 0.05, 0, 0.14);
            poseBone('head', Math.sin(t * 3.8) * 0.06, Math.sin(t * 2.1) * 0.09, Math.sin(t * 1.4) * 0.04, 0.14);
          } else {
            poseBone('rightShoulder', 0, 0, 0, 0.14);
            poseBone('rightArm', -0.20, -0.06, armDropRad - 0.04, 0.14);
            poseBone('rightForeArm', -0.56 + Math.sin(t * 1.3) * 0.06, 0.20, 0, 0.14);
            poseBone('neck', Math.sin(t * 1.1) * 0.02, Math.sin(t * 0.7) * 0.03, 0, 0.12);
            poseBone('head', Math.sin(t * 1.1) * 0.03, Math.sin(t * 0.8) * 0.06, Math.sin(t * 0.6) * 0.04, 0.12);
          }
        }
      }

      // Sync Clipboard & Pen to real-world hand positions
      avatarRoot.updateMatrixWorld(true);
      if (bones.leftHand) {
        bones.leftHand.getWorldPosition(_vA);
        bones.leftHand.getWorldQuaternion(_qTmp);
        clipboardProp.position.copy(_vA);
        clipboardProp.quaternion.copy(_qTmp);
        clipboardProp.translateY(0.11);
        clipboardProp.translateZ(0.06);
        clipboardProp.rotateX(-0.65);
        clipboardProp.rotateY(0.28);
      }
      if (bones.rightHand) {
        bones.rightHand.getWorldPosition(_vA);
        bones.rightHand.getWorldQuaternion(_qTmp);
        penProp.position.copy(_vA);
        penProp.quaternion.copy(_qTmp);
        penProp.translateY(0.08);
        penProp.translateZ(0.04);
      }
    }

    // --- ARKIT FACIAL EXPRESSIONS ---
    if (morphMeshes.length) {
      blinkTimer -= dt;
      if (blinkTimer <= 0) blinkTimer = 2.4 + Math.random() * 2.8;
      const blinkVal = blinkTimer < 0.13 ? Math.sin((blinkTimer / 0.13) * Math.PI) : 0;
      setMorph(['eyeBlinkLeft', 'eyesClosed'], blinkVal);
      setMorph(['eyeBlinkRight', 'eyesClosed'], blinkVal);

      const smileBase = mode === 'closeup' ? (waveTimer > 0 ? 0.60 : 0.38) : 0.20;
      setMorph(['mouthSmileLeft', 'mouthSmile'], smileBase);
      setMorph(['mouthSmileRight', 'mouthSmile'], smileBase);
      setMorph(['cheekSquintLeft'], smileBase * 0.45);
      setMorph(['cheekSquintRight'], smileBase * 0.45);

      speechPulse = Math.max(0, speechPulse - dt * 5.0);
      if (isSpeaking) {
        const jawVal = Math.min(0.80, 0.16 + Math.abs(Math.sin(t * 13.0) * Math.cos(t * 6.4)) * 0.54 + speechPulse * 0.22);
        const funnelVal = Math.max(0, Math.sin(t * 9.2) * 0.34);
        const puckerVal = Math.max(0, Math.cos(t * 7.8) * 0.25);
        setMorph(['jawOpen', 'viseme_aa', 'mouthOpen'], jawVal);
        setMorph(['mouthFunnel', 'viseme_O'], funnelVal);
        setMorph(['mouthPucker', 'viseme_U'], puckerVal);
        setMorph(['browInnerUp'], 0.20 + Math.sin(t * 3.4) * 0.10);
      } else {
        setMorph(['jawOpen', 'viseme_aa', 'mouthOpen'], 0);
        setMorph(['mouthFunnel', 'viseme_O'], 0);
        setMorph(['mouthPucker', 'viseme_U'], 0);
        setMorph(['browInnerUp'], waveTimer > 0 ? 0.26 : 0.04);
      }
    }

    if (mode !== 'closeup') {
      projVec.copy(avatarRoot.position).add(new THREE.Vector3(0, 1.0, 0)).project(camera);
      const sx = (projVec.x * 0.5 + 0.5) * window.innerWidth;
      const sy = (-projVec.y * 0.5 + 0.5) * window.innerHeight;
      hitbox.style.left = `${sx}px`;
      hitbox.style.top = `${sy}px`;
    }

    renderer.render(scene, camera);
  }
  animate();

  // --- 10. EVENTS ---
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
