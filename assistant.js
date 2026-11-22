(function () {
  const AGENT_NAME = 'Maya';
  const STORAGE_NAME_KEY = 'aligniq_user_name';
  const STORAGE_INTRO_KEY = 'aligniq_maya_introduced';

  let state = 'patrol'; // 'patrol' | 'closeup' | 'walkthrough'
  let userName = localStorage.getItem(STORAGE_NAME_KEY) || '';
  let hasIntroduced = localStorage.getItem(STORAGE_INTRO_KEY) === '1';
  let waitingForName = false;
  let lastTapTime = 0;
  let patrolTimer = null;
  let patrolStep = 0;
  let chatHistory = [];
  let recognition = null;
  let isListening = false;

  // --- 1. INJECT STYLES ---
  const style = document.createElement('style');
  style.textContent = `
    #app { transition: transform 0.75s cubic-bezier(0.22, 1, 0.36, 1), filter 0.6s ease; transform-origin: center center; }
    body.maya-swoop-in #app { transform: scale(1.16) translateY(-18px); filter: blur(4px) brightness(0.45); pointer-events: none; }

    /* BIRD'S-EYE PATROL SPRITE */
    #maya-walker {
      position: fixed; z-index: 85; width: 46px; height: 46px;
      cursor: pointer; user-select: none; touch-action: manipulation;
      transition: left 1.1s cubic-bezier(0.34, 1.2, 0.64, 1), top 1.1s cubic-bezier(0.34, 1.2, 0.64, 1), transform 0.45s ease, opacity 0.3s ease;
      filter: drop-shadow(0 4px 8px rgba(0,0,0,0.55));
    }
    #maya-walker.hidden { opacity: 0; pointer-events: none; transform: scale(0.4); }
    #maya-walker .walker-inner { width: 100%; height: 100%; animation: mayaWalkBob 0.55s infinite alternate ease-in-out; }
    #maya-walker.checking .walker-inner { animation: mayaCheckClip 0.9s infinite ease-in-out; }
    #maya-walker .tap-hint {
      position: absolute; bottom: -16px; left: 50%; transform: translateX(-50%);
      background: rgba(15, 23, 38, 0.92); color: #34d399; border: 1px solid rgba(16,185,129,0.45);
      font-size: 8.5px; font-weight: 800; padding: 1px 5px; border-radius: 6px; white-space: nowrap;
      opacity: 0; transition: opacity 0.3s ease; pointer-events: none;
    }
    #maya-walker:hover .tap-hint, #maya-walker.show-hint .tap-hint { opacity: 1; }
    @keyframes mayaWalkBob { 0% { transform: translateY(0px) rotate(-3deg); } 100% { transform: translateY(-2.5px) rotate(3deg); } }
    @keyframes mayaCheckClip { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.07); } }

    /* POINTER RING FOR VISUAL WALKTHROUGHS */
    .maya-highlight-ring {
      position: relative !important;
      box-shadow: 0 0 0 3px #10b981, 0 0 22px rgba(16, 185, 129, 0.85) !important;
      border-radius: 10px !important;
      z-index: 82 !important;
      transition: box-shadow 0.3s ease;
    }

    /* DRAMATIC CLOSE-UP STAGE */
    #maya-stage {
      position: fixed; inset: 0; z-index: 90;
      display: flex; flex-direction: column; justify-content: flex-end; align-items: center;
      background: radial-gradient(circle at 50% 35%, rgba(16, 185, 129, 0.16), rgba(4, 7, 13, 0.88) 72%);
      opacity: 0; pointer-events: none; transform: scale(0.86) translateY(30px);
      transition: opacity 0.55s ease, transform 0.65s cubic-bezier(0.22, 1, 0.36, 1);
      padding: calc(16px + env(safe-area-inset-top, 0px)) 14px calc(16px + env(safe-area-inset-bottom, 0px));
    }
    #maya-stage.open { opacity: 1; pointer-events: auto; transform: scale(1) translateY(0); }

    .maya-portrait-wrap {
      width: 100%; max-width: 440px; flex: 1; min-height: 180px;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      position: relative;
    }
    .maya-portrait-svg {
      width: 210px; height: 240px;
      filter: drop-shadow(0 16px 32px rgba(0,0,0,0.6));
      animation: mayaBreathe 3.2s infinite ease-in-out;
    }
    .maya-portrait-svg.speaking { animation: mayaSpeakBob 0.35s infinite alternate ease-in-out; }
    @keyframes mayaBreathe { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
    @keyframes mayaSpeakBob { 0% { transform: translateY(0) scale(1); } 100% { transform: translateY(-3px) scale(1.015); } }

    .maya-top-controls {
      position: absolute; top: 4px; right: 4px; display: flex; gap: 6px;
    }
    .maya-pill-btn {
      background: rgba(15, 23, 38, 0.9); color: #f1f5f9; border: 1px solid #2b3f63;
      border-radius: 999px; padding: 6px 12px; font-size: 11px; font-weight: 700; cursor: pointer;
    }
    .maya-pill-btn.accent { background: rgba(16, 185, 129, 0.2); border-color: #10b981; color: #34d399; }

    /* CHAT PANEL (CLOSE-UP + MINI DOCK FOR WALKTHROUGH) */
    .maya-chat-card {
      width: 100%; max-width: 440px; background: rgba(15, 23, 38, 0.96);
      border: 1px solid #2b3f63; border-radius: 18px; padding: 12px;
      box-shadow: 0 18px 40px rgba(0,0,0,0.55); display: flex; flex-direction: column; gap: 8px;
    }
    .maya-chat-log {
      max-height: 175px; overflow-y: auto; display: flex; flex-direction: column; gap: 7px; padding-right: 2px;
    }
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

    /* FLOATING WALKTHROUGH CAPTION BAR */
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

  // --- 2. SVG ARTWORK (BIRD'S-EYE WALKER & CLOSE-UP PORTRAIT) ---
  const BIRDS_EYE_SVG = `
    <div class="walker-inner">
      <svg viewBox="0 0 64 64" width="46" height="46" fill="none">
        <!-- Shoulders / Professional Blazer (Bird's Eye) -->
        <ellipse cx="32" cy="34" rx="17" ry="11" fill="#1e293b" stroke="#38bdf8" stroke-width="1.5"/>
        <!-- White Blouse V-Collar -->
        <path d="M26 26 L32 34 L38 26" fill="#f8fafc"/>
        <!-- Clipboard Held in Right Hand -->
        <rect x="40" y="13" width="12" height="16" rx="2" fill="#b45309" stroke="#f59e0b" stroke-width="1"/>
        <rect x="42" y="16" width="8" height="11" rx="1" fill="#f8fafc"/>
        <line x1="43.5" y1="19" x2="48.5" y2="19" stroke="#10b981" stroke-width="1.3"/>
        <line x1="43.5" y1="22" x2="48.5" y2="22" stroke="#64748b" stroke-width="1"/>
        <line x1="43.5" y1="25" x2="47" y2="25" stroke="#10b981" stroke-width="1.3"/>
        <!-- Brown Skin Hands -->
        <circle cx="41" cy="24" r="3.2" fill="#8d5524"/>
        <circle cx="20" cy="28" r="3.2" fill="#8d5524"/>
        <!-- Head (Top-Down) -->
        <circle cx="32" cy="31" r="10.5" fill="#8d5524"/>
        <!-- Natural Afro Hair + High Pulled-Back Bun -->
        <path d="M22 30 C21 20, 43 20, 42 30 C42 38, 22 38, 22 30 Z" fill="#1c1410"/>
        <circle cx="32" cy="39" r="7" fill="#1c1410" stroke="#3b2820" stroke-width="1"/>
        <ellipse cx="32" cy="35" rx="6.5" ry="2" fill="#10b981"/>
        <!-- Glasses Frame Peeking Front -->
        <rect x="24.5" y="21" width="6.5" height="3.2" rx="1.2" fill="rgba(56,189,248,0.35)" stroke="#f59e0b" stroke-width="1.1"/>
        <rect x="33" y="21" width="6.5" height="3.2" rx="1.2" fill="rgba(56,189,248,0.35)" stroke="#f59e0b" stroke-width="1.1"/>
      </svg>
    </div>
    <span class="tap-hint">2× Tap Maya</span>
  `;

  const PORTRAIT_SVG = `
    <svg id="maya-portrait-svg" class="maya-portrait-svg" viewBox="0 0 220 250" fill="none">
      <!-- Natural Afro Bun -->
      <circle cx="110" cy="36" r="28" fill="#1c1410"/>
      <circle cx="98" cy="26" r="10" fill="#261b16"/>
      <circle cx="122" cy="28" r="11" fill="#261b16"/>
      <!-- Emerald Hair Tie -->
      <path d="M88 55 Q110 47 132 55" stroke="#10b981" stroke-width="5" stroke-linecap="round"/>
      <!-- Main Hairline -->
      <ellipse cx="110" cy="82" rx="44" ry="38" fill="#1c1410"/>
      <!-- Neck -->
      <rect x="97" y="122" width="26" height="26" rx="8" fill="#7c471c"/>
      <!-- Face (Warm Brown Skin) -->
      <ellipse cx="110" cy="95" rx="35" ry="40" fill="#8d5524"/>
      <!-- Soft Cheek Highlights -->
      <ellipse cx="88" cy="105" rx="6" ry="3.5" fill="#a86534" opacity="0.5"/>
      <ellipse cx="132" cy="105" rx="6" ry="3.5" fill="#a86534" opacity="0.5"/>
      <!-- Gold Hoop Earrings -->
      <circle cx="74" cy="104" r="5" stroke="#f59e0b" stroke-width="2" fill="none"/>
      <circle cx="146" cy="104" r="5" stroke="#f59e0b" stroke-width="2" fill="none"/>
      <!-- Eyebrows -->
      <path d="M85 83 Q95 79 103 83" stroke="#1c1410" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M117 83 Q125 79 135 83" stroke="#1c1410" stroke-width="2.5" stroke-linecap="round"/>
      <!-- Eyes -->
      <ellipse cx="95" cy="93" rx="5.5" ry="4" fill="#ffffff"/>
      <circle cx="95" cy="93" r="2.6" fill="#1c1410"/>
      <circle cx="96" cy="92" r="0.9" fill="#ffffff"/>
      <ellipse cx="125" cy="93" rx="5.5" ry="4" fill="#ffffff"/>
      <circle cx="125" cy="93" r="2.6" fill="#1c1410"/>
      <circle cx="126" cy="92" r="0.9" fill="#ffffff"/>
      <!-- Stylish Gold-Rimmed Glasses -->
      <rect x="81" y="85" width="26" height="17" rx="6" fill="rgba(56,189,248,0.12)" stroke="#f59e0b" stroke-width="2.2"/>
      <rect x="113" y="85" width="26" height="17" rx="6" fill="rgba(56,189,248,0.12)" stroke="#f59e0b" stroke-width="2.2"/>
      <line x1="107" y1="93" x2="113" y2="93" stroke="#f59e0b" stroke-width="2.2"/>
      <!-- Nose & Warm Smile -->
      <path d="M108 103 Q110 107 113 103" stroke="#633614" stroke-width="2" stroke-linecap="round"/>
      <path d="M98 114 Q110 124 122 114" stroke="#3b1912" stroke-width="2.6" stroke-linecap="round" fill="none"/>
      <path d="M101 115 Q110 120 119 115" fill="#ffffff"/>
      <!-- Professional Tailored Blazer & Crisp Blouse -->
      <path d="M52 242 C54 176, 72 146, 97 144 L110 176 L123 144 C148 146, 166 176, 168 242 Z" fill="#0f172a" stroke="#38bdf8" stroke-width="1.8"/>
      <path d="M97 144 L110 184 L123 144 Z" fill="#f8fafc"/>
      <!-- Blazer Lapels -->
      <path d="M97 144 L86 168 L110 184" fill="#1e293b"/>
      <path d="M123 144 L134 168 L110 184" fill="#1e293b"/>
      <!-- Gold Necklace -->
      <path d="M100 148 Q110 158 120 148" stroke="#f59e0b" stroke-width="1.8" fill="none"/>
      <!-- Clipboard Held Professionally -->
      <rect x="134" y="176" width="52" height="64" rx="6" fill="#b45309" stroke="#f59e0b" stroke-width="2"/>
      <rect x="148" y="171" width="24" height="9" rx="3" fill="#94a3b8"/>
      <rect x="140" y="185" width="40" height="48" rx="3" fill="#f8fafc"/>
      <line x1="146" y1="196" x2="174" y2="196" stroke="#10b981" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="146" y1="206" x2="170" y2="206" stroke="#64748b" stroke-width="2" stroke-linecap="round"/>
      <line x1="146" y1="216" x2="174" y2="216" stroke="#10b981" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="146" y1="225" x2="165" y2="225" stroke="#64748b" stroke-width="2" stroke-linecap="round"/>
      <!-- Hand Holding Clipboard -->
      <ellipse cx="136" cy="212" rx="10" ry="8" fill="#8d5524"/>
    </svg>
  `;

  // --- 3. CREATE DOM ELEMENTS ---
  const walker = document.createElement('div');
  walker.id = 'maya-walker';
  walker.innerHTML = BIRDS_EYE_SVG;
  document.body.appendChild(walker);

  const stage = document.createElement('div');
  stage.id = 'maya-stage';
  stage.innerHTML = `
    <div class="maya-portrait-wrap">
      <div class="maya-top-controls">
        <button class="maya-pill-btn accent" id="maya-done-btn">Back to Inventory</button>
      </div>
      ${PORTRAIT_SVG}
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
  document.body.appendChild(stage);

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

  // --- 4. BIRD'S-EYE BORDER PATROL ---
  function getAppBounds() {
    const appEl = document.getElementById('app');
    const r = appEl ? appEl.getBoundingClientRect() : { left: 0, right: window.innerWidth, width: window.innerWidth };
    return { left: Math.max(4, r.left + 4), right: Math.min(window.innerWidth - 50, r.right - 50), top: 72, bottom: window.innerHeight - 64 };
  }

  function movePatrol() {
    if (state !== 'patrol') return;
    const b = getAppBounds();
    const waypoints = [
      { x: b.right, y: b.top + 40, rot: 180, check: false },
      { x: b.right, y: b.bottom - 140, rot: 180, check: true },
      { x: b.right, y: b.bottom, rot: 270, check: false },
      { x: b.left, y: b.bottom, rot: 0, check: true },
      { x: b.left, y: b.top + 120, rot: 0, check: false },
      { x: b.left, y: b.top + 20, rot: 90, check: true }
    ];
    const wp = waypoints[patrolStep % waypoints.length];
    walker.style.left = `${wp.x}px`;
    walker.style.top = `${wp.y}px`;
    walker.style.transform = `rotate(${wp.rot}deg)`;
    walker.classList.toggle('checking', wp.check);
    patrolStep++;
  }

  function startPatrol() {
    state = 'patrol';
    clearHighlight();
    walkDock.classList.remove('open');
    stage.classList.remove('open');
    document.body.classList.remove('maya-swoop-in');
    walker.classList.remove('hidden');
    movePatrol();
    if (patrolTimer) clearInterval(patrolTimer);
    patrolTimer = setInterval(movePatrol, 3400);
  }

  // --- 5. VOICE (SPEECH SYNTHESIS + RECOGNITION) ---
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
      const svg = document.getElementById('maya-portrait-svg');
      u.onstart = () => svg && svg.classList.add('speaking');
      u.onend = () => svg && svg.classList.remove('speaking');
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
    if (isListening && recognition) {
      recognition.stop();
      return;
    }
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

  // --- 6. CHAT & DRAMATIC SWOOP-IN ---
  function addMessage(role, text, shouldSpeak = false) {
    chatHistory.push({ role, text });
    const log = document.getElementById('maya-chat-log');
    if (log) {
      log.innerHTML = chatHistory.map(m => `<div class="maya-msg ${m.role}">${m.text}</div>`).join('');
      log.scrollTop = log.scrollHeight;
    }
    if (shouldSpeak && role === 'bot') speak(text);
  }

  function openCloseup() {
    state = 'closeup';
    if (patrolTimer) clearInterval(patrolTimer);
    clearHighlight();
    walkDock.classList.remove('open');
    walker.classList.add('hidden');
    document.body.classList.add('maya-swoop-in');
    stage.classList.add('open');

    if (!hasIntroduced) {
      hasIntroduced = true;
      localStorage.setItem(STORAGE_INTRO_KEY, '1');
      waitingForName = !userName;
      const intro = userName
        ? `Hi ${userName}! I'm ${AGENT_NAME}, your AlignIQ assistant. I keep an eye on your dashboard inventory and can walk you right to any feature. How can I help you today?`
        : `Hi! I'm ${AGENT_NAME}, your personal AlignIQ assistant. I patrol your dashboard doing inventory, and I can walk you right through any feature. What's your name?`;
      addMessage('bot', intro, true);
    } else if (chatHistory.length === 0) {
      const greet = userName
        ? `Hey ${userName}! Good to see you. How can I help you today?`
        : `Hey there! How can I help you with AlignIQ today?`;
      addMessage('bot', greet, true);
    } else {
      const greet = userName ? `I'm right here, ${userName}. What do you need?` : `I'm right here. How can I help?`;
      addMessage('bot', greet, true);
    }
  }

  // --- 7. VISUAL WALKTHROUGH (SWOOP OUT, WALK TO FEATURE, TAP & EXPLAIN) ---
  let highlightedEl = null;
  function clearHighlight() {
    if (highlightedEl) { highlightedEl.classList.remove('maya-highlight-ring'); highlightedEl = null; }
  }

  function runVisualWalkthrough(selector, replyText, actionFn) {
    state = 'walkthrough';
    stage.classList.remove('open');
    document.body.classList.remove('maya-swoop-in');
    walker.classList.remove('hidden');

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
        const wx = Math.max(6, Math.min(window.innerWidth - 52, r.right - 22));
        const wy = Math.max(54, Math.min(window.innerHeight - 130, r.top - 10));
        walker.style.left = `${wx}px`;
        walker.style.top = `${wy}px`;
        walker.style.transform = 'rotate(0deg) scale(1.15)';
      }
      if (typeof actionFn === 'function') {
        setTimeout(() => { try { actionFn(); } catch {} }, 850);
      }
    }, 550);
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
        addMessage('bot', `Nice to meet you, ${userName}! You can ask me about CONF percentages, +EV, weight cuts, or tell me to show you any feature on the screen.`, true);
        return;
      }
    }

    const q = text.toLowerCase();
    if (/done|bye|thank|back to inventory|resume|close/.test(q)) {
      const bye = userName ? `You got it, ${userName}! I'll head back to my inventory patrol. Double-tap me anytime.` : `You got it! Heading back to my inventory patrol. Double-tap me anytime.`;
      addMessage('bot', bye, true);
      setTimeout(startPatrol, 1600);
      return;
    }

    if (/agent|weight|api key|credit|slider/.test(q)) {
      runVisualWalkthrough('button[onclick*="toggleTuner"]', 'Let me walk you over to the AI Agent panel. Here you can see your 60-day verified win rate, adjust pillar weights, and save your private Odds API key.', () => {
        const panel = document.getElementById('tuner-panel');
        if (panel && !panel.classList.contains('open') && typeof toggleTuner === 'function') toggleTuner();
      });
      return;
    }

    if (/theme|light|dark|setting/.test(q)) {
      runVisualWalkthrough('button[onclick*="openSettingsModal"]', 'Right here is your Settings menu! I am opening it now so you can switch between Dark Mode and Light Mode anytime.', () => {
        if (typeof openSettingsModal === 'function') openSettingsModal('theme');
      });
      return;
    }

    if (/parlay|slip|calc|arb|ev/.test(q)) {
      runVisualWalkthrough('button[onclick*="openToolsModal"]', 'Follow me to the Calculator and Parlay Slip button. I will open it so you can check your saved legs, split arbitrage bets, or calculate +EV.', () => {
        if (typeof openToolsModal === 'function') openToolsModal('slip');
      });
      return;
    }

    if (/scan|custom|walkout/.test(q)) {
      runVisualWalkthrough('button[onclick*="openScanModal"]', 'Here is the +Scan button. I am opening it now so you can run a custom 4-cipher Gematria scan on any fight or matchup.', () => {
        if (typeof openScanModal === 'function') openScanModal();
      });
      return;
    }

    if (/odds|body|weak|fight|cut|health|game|decode|show/.test(q)) {
      runVisualWalkthrough('.game-card', 'Let me walk over to the top game card and open it for you. Inside, you can check Best Odds, Player Props, the Body Weak-Point Map, and verified sources.', () => {
        const firstCard = document.querySelector('.game-card');
        if (firstCard) firstCard.click();
      });
      return;
    }

    if (/date|math|numerology/.test(q)) {
      runVisualWalkthrough('.date-math-bar', 'Here is your Date Math strip. I am tapping into it to show today’s full numerology breakdown.', () => {
        if (typeof openDateMathModal === 'function') openDateMathModal();
      });
      return;
    }

    // Fallback to AlignIQ's built-in knowledge helper if available
    const ans = typeof getHelpAnswer === 'function'
      ? getHelpAnswer(text)
      : 'Ask me to show you the AI Agent, Settings, Parlay Slip, +Scan, or any Game Decode and I will walk right over to it!';
    addMessage('bot', ans, true);
  }

  // --- 8. EVENT LISTENERS ---
  walker.addEventListener('dblclick', (e) => { e.stopPropagation(); openCloseup(); });
  walker.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTapTime < 340) {
      e.preventDefault();
      e.stopPropagation();
      openCloseup();
    } else {
      walker.classList.add('show-hint');
      setTimeout(() => walker.classList.remove('show-hint'), 1800);
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
    if (e.key === 'Enter') {
      handleUserInput(e.target.value);
      e.target.value = '';
    }
  });
  stage.querySelectorAll('.maya-qchip').forEach(btn => {
    btn.addEventListener('click', () => handleUserInput(btn.getAttribute('data-q')));
  });

  // Start Maya's border inventory patrol once the page loads
  setTimeout(startPatrol, 900);
})();
