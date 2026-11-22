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
      position: fixed; z-index: 88; width: 68px; height: 68px;
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

  // --- 3. THREE.JS SCENE & FLATTERING STUDIO LIGHTING ---
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  const OVERHEAD_Y = 12.5;
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.05, 100);
  camera.position.set(0, OVERHEAD_Y, 0.05);
  const camTarget = new THREE.Vector3(0, 0, 0);
  const desiredCamPos = new THREE.Vector3(0, OVERHEAD_Y, 0.05);
  const desiredCamTarget = new THREE.Vector3(0, 0, 0);

  // Studio 3-point lighting for realistic skin & clothing
  scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 1.4));
  const keyLight = new THREE.DirectionalLight(0xfff5e8, 1.6);
  keyLight.position.set(3, 8, 6);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xe0f2fe, 0.85);
  fillLight.position.set(-4, 5, 4);
  scene.add(fillLight);
  const rimLight = new THREE.DirectionalLight(0x34d399, 0.65);
  rimLight.position.set(0, 5, -5);
  scene.add(rimLight);

  // --- 4. LOAD AVATURN MAYA.GLB & BIND SKELETON + ARKIT BLENDSHAPES ---
  const avatarRoot = new THREE.Group();
  scene.add(avatarRoot);

  // Soft ground shadow disc beneath Maya's feet
  const shadowDisc = new THREE.Mesh(
    new THREE.CircleGeometry(0.32, 24),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 })
  );
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.y = 0.01;
  avatarRoot.add(shadowDisc);

  let avatarModel = null;
  let mixer = null;
  const bones = {};
  const restRot = {};
  const morphMeshes = [];

  function normBoneName(name) {
    return (name || '').toLowerCase().replace(/^mixamorig[:_]?/, '').replace(/[^a-z0-9]/g, '');
  }

  function buildClipboardMesh() {
    const grp = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0x9a5b25, roughness: 0.6 });
    const paper = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 });
    const clipMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.3, metalness: 0.8 });

    const board = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.27, 0.012), wood);
    grp.add(board);
    const sheet = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.22, 0.014), paper);
    sheet.position.z = 0.002;
    grp.add(sheet);
    const clip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.025, 0.02), clipMat);
    clip.position.set(0, 0.115, 0.006);
    grp.add(clip);
    return grp;
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

  function setBoneOffset(key, rx = 0, ry = 0, rz = 0, lerpAmt = 0.18) {
    const b = bones[key];
    const r = restRot[key];
    if (!b || !r) return;
    b.rotation.x += (r.x + rx - b.rotation.x) * lerpAmt;
    b.rotation.y += (r.y + ry - b.rotation.y) * lerpAmt;
    b.rotation.z += (r.z + rz - b.rotation.z) * lerpAmt;
  }

  const loader = new GLTFLoader();
  loader.load(
    './maya.glb?v=4',
    (gltf) => {
      avatarModel = gltf.scene;

      // Scale cleanly to 1.72m tall with feet planted on y = 0
      const box = new THREE.Box3().setFromObject(avatarModel);
      const size = box.getSize(new THREE.Vector3());
      const scale = 1.72 / (size.y || 1.72);
      avatarModel.scale.setScalar(scale);

      const scaledBox = new THREE.Box3().setFromObject(avatarModel);
      avatarModel.position.y = -scaledBox.min.y;

      const wanted = {
        hips: ['hips', 'pelvis'],
        spine: ['spine', 'spine01'],
        chest: ['spine1', 'spine2', 'chest', 'upperchest'],
        neck: ['neck', 'neck01'],
        head: ['head'],
        leftUpLeg: ['leftupleg', 'leftupperleg', 'thighl'],
        leftLeg: ['leftleg', 'leftlowerleg', 'calfl'],
        rightUpLeg: ['rightupleg', 'rightupperleg', 'thighr'],
        rightLeg: ['rightleg', 'rightlowerleg', 'calfr'],
        leftArm: ['leftarm', 'leftupperarm', 'upperarml'],
        leftForeArm: ['leftforearm', 'leftlowerarm', 'lowerarml'],
        leftHand: ['lefthand', 'handl'],
        rightArm: ['rightarm', 'rightupperarm', 'upperarmr'],
        rightForeArm: ['rightforearm', 'rightlowerarm', 'lowerarmr'],
        rightHand: ['righthand', 'handr']
      };

      avatarModel.traverse((obj) => {
        if (obj.isMesh) {
          obj.frustumCulled = false;
          if (obj.morphTargetDictionary && obj.morphTargetInfluences) {
            morphMeshes.push(obj);
          }
        }
        if (obj.isBone) {
          const n = normBoneName(obj.name);
          for (const [key, aliases] of Object.entries(wanted)) {
            if (!bones[key] && aliases.includes(n)) {
              bones[key] = obj;
              restRot[key] = obj.rotation.clone();
            }
          }
        }
      });

      // Attach clipboard to Maya's left hand if the bone exists
      if (bones.leftHand) {
        const cb = buildClipboardMesh();
        cb.position.set(0.03, 0.08, 0.04);
        cb.rotation.set(0.2, 0.3, -0.2);
        bones.leftHand.add(cb);
      }

      if (gltf.animations && gltf.animations.length) {
        mixer = new THREE.AnimationMixer(avatarModel);
        mixer.clipAction(gltf.animations[0]).play();
      }

      avatarRoot.add(avatarModel);
    },
    undefined,
    (err) => {
      console.warn('Could not load ./maya.glb yet:', err);
    }
  );

  // --- 5. COORDINATE HELPERS ---
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
    const leftX = Math.max(28, r.left + 28);
    const rightX = Math.min(window.innerWidth - 28, r.right - 28);
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

  let waypoints = getBorderWaypoints();
  let wpIdx = 0;
  let targetPos = waypoints[0].pos.clone();
  avatarRoot.position.copy(waypoints[0].pos);
  let pauseTimer = 0;
  let isWalking = false;
  let isPointing = false;
  let walkCycle = 0;
  let blinkTimer = 2.6;

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

    // Swoop 3D camera cleanly to Maya's head & shoulders above the chat card
    const mx = avatarRoot.position.x, mz = avatarRoot.position.z;
    desiredCamPos.set(mx, 1.50, mz + 1.45);
    desiredCamTarget.set(mx, 1.24, mz);

    if (!hasIntroduced) {
      hasIntroduced = true;
      localStorage.setItem(STORAGE_INTRO_KEY, '1');
      waitingForName = !userName;
      const intro = userName
        ? `Hi ${userName}! I'm ${AGENT_NAME}, your AlignIQ assistant. I patrol your dashboard doing inventory and can walk right over to any feature. How can I help you today?`
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

  // --- 9. 60FPS ANIMATION LOOP (AVATURN BONES + ARKIT LIP-SYNC & BLINK) ---
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
    if (mode === 'patrol' || mode === 'walkthrough') {
      const dx = targetPos.x - avatarRoot.position.x;
      const dz = targetPos.z - avatarRoot.position.z;
      const dist = Math.hypot(dx, dz);

      if (dist > 0.08) {
        isWalking = true;
        const speed = mode === 'walkthrough' ? 3.8 : 1.55;
        const step = Math.min(dist, speed * dt);
        avatarRoot.position.x += (dx / dist) * step;
        avatarRoot.position.z += (dz / dist) * step;

        const targetAngle = Math.atan2(dx, dz);
        let diff = targetAngle - avatarRoot.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        avatarRoot.rotation.y += diff * Math.min(1, dt * 8);
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
      let diff = 0 - avatarRoot.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      avatarRoot.rotation.y += diff * Math.min(1, dt * 7);
    }

    if (mixer) mixer.update(dt);

    // Skeletal procedural motion on Avaturn humanoid rig
    if (avatarModel && !mixer) {
      if (isWalking) {
        walkCycle += dt * 7.8;
        const s = Math.sin(walkCycle);
        setBoneOffset('leftUpLeg', s * 0.48, 0, 0, 0.25);
        setBoneOffset('rightUpLeg', -s * 0.48, 0, 0, 0.25);
        setBoneOffset('leftLeg', Math.max(0, -s * 0.55), 0, 0, 0.25);
        setBoneOffset('rightLeg', Math.max(0, s * 0.55), 0, 0, 0.25);
        setBoneOffset('spine', 0.04, s * 0.06, 0, 0.15);
        setBoneOffset('head', 0.15, 0, 0, 0.12);
        // Relax A-pose arms: left cradles clipboard, right swings naturally
        setBoneOffset('leftArm', 0.42, 0, -0.55, 0.18);
        setBoneOffset('leftForeArm', 0, 0.65, 0.45, 0.18);
        setBoneOffset('rightArm', -s * 0.30, 0, 0.78, 0.18);
        setBoneOffset('rightForeArm', 0, -0.25, 0, 0.18);
        avatarModel.position.y = Math.abs(Math.cos(walkCycle)) * 0.035;
      } else {
        setBoneOffset('leftUpLeg', 0, 0, 0, 0.15);
        setBoneOffset('rightUpLeg', 0, 0, 0, 0.15);
        setBoneOffset('leftLeg', 0, 0, 0, 0.15);
        setBoneOffset('rightLeg', 0, 0, 0, 0.15);
        avatarModel.position.y = Math.sin(t * 2.0) * 0.008;

        // Subtle breathing
        setBoneOffset('spine', Math.sin(t * 2.0) * 0.02, 0, 0, 0.12);

        if (mode === 'walkthrough' && isPointing) {
          setBoneOffset('leftArm', 0.38, 0, -0.55, 0.15);
          setBoneOffset('leftForeArm', 0, 0.6, 0.4, 0.15);
          setBoneOffset('rightArm', -1.1 + Math.sin(t * 5) * 0.06, 0, 0.25, 0.16);
          setBoneOffset('rightForeArm', 0, -0.15, 0, 0.16);
          setBoneOffset('head', 0.12, 0, 0, 0.12);
        } else if (mode === 'patrol') {
          // Checking inventory on clipboard
          setBoneOffset('leftArm', 0.45, 0, -0.52, 0.15);
          setBoneOffset('leftForeArm', 0, 0.72, 0.48, 0.15);
          setBoneOffset('rightArm', 0.42, -0.25 + Math.sin(t * 8) * 0.05, 0.58, 0.15);
          setBoneOffset('rightForeArm', 0, -0.65, -0.35, 0.15);
          setBoneOffset('head', 0.28, 0, 0, 0.12);
        } else {
          // Close-up conversational posture
          setBoneOffset('leftArm', 0.35, 0, -0.62, 0.14);
          setBoneOffset('leftForeArm', 0, 0.65, 0.4, 0.14);
          setBoneOffset('rightArm', isSpeaking ? (0.18 + Math.sin(t * 4.2) * 0.08) : 0.06, 0, 0.75, 0.14);
          setBoneOffset('rightForeArm', 0, isSpeaking ? (-0.45 + Math.cos(t * 4.8) * 0.1) : -0.22, 0, 0.14);
          setBoneOffset('head', isSpeaking ? Math.sin(t * 3.6) * 0.05 : Math.sin(t * 1.2) * 0.02, isSpeaking ? Math.sin(t * 2.1) * 0.07 : Math.sin(t * 0.8) * 0.03, 0, 0.12);
        }
      }
    }

    // ARKit Facial Expressions (Blinking, Warm Smile, Real-Time Lip-Sync)
    if (morphMeshes.length) {
      blinkTimer -= dt;
      if (blinkTimer <= 0) blinkTimer = 2.4 + Math.random() * 3.0;
      const blinkVal = blinkTimer < 0.13 ? Math.sin((blinkTimer / 0.13) * Math.PI) : 0;
      setMorph(['eyeBlinkLeft', 'eyesClosed'], blinkVal);
      setMorph(['eyeBlinkRight', 'eyesClosed'], blinkVal);

      const smileVal = mode === 'closeup' ? 0.38 : 0.2;
      setMorph(['mouthSmileLeft', 'mouthSmile'], smileVal);
      setMorph(['mouthSmileRight', 'mouthSmile'], smileVal);

      speechPulse = Math.max(0, speechPulse - dt * 5.0);
      const jawVal = isSpeaking
        ? Math.min(0.82, 0.18 + Math.abs(Math.sin(t * 13.5) * Math.cos(t * 6.8)) * 0.55 + speechPulse * 0.22)
        : 0;
      setMorph(['jawOpen', 'viseme_aa', 'mouthOpen'], jawVal);
      setMorph(['browInnerUp'], isSpeaking ? 0.18 + Math.sin(t * 3.5) * 0.08 : 0);
    }

    // Sync 2D Double-Tap Hitbox to Maya's 3D Screen Position
    if (mode !== 'closeup') {
      projVec.copy(avatarRoot.position).add(new THREE.Vector3(0, 0.9, 0)).project(camera);
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
