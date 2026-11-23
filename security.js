import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut as fbSignOut
} from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js';

// === 1. CONFIGURATION ===
const WORKER_URL = 'https://alighiq-gate.levaun2024.workers.dev';
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyC1FSP-PqyWeW7Lg2AAm5mNDd1egzFSR2Q',
  authDomain: 'aligniq-13df6.firebaseapp.com',
  projectId: 'aligniq-13df6',
  appId: '1:407475266998:web:56cb0b82f9f12185f20d17'
};

const app = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

function getDeviceId() {
  let id = localStorage.getItem('aligniq_device_id');
  if (!id) {
    id = (crypto.randomUUID ? crypto.randomUUID() : 'dev-' + Math.random().toString(36).slice(2) + Date.now());
    localStorage.setItem('aligniq_device_id', id);
  }
  return id;
}

async function applyRememberPreference() {
  const box = document.getElementById('remember-device');
  const remember = box ? box.checked : true;
  await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
}

let currentToken = '';
window.ALIGNIQ_IS_OWNER = false;

// === 2. PROXY ODDS API CALLS THROUGH HIDDEN CLOUDFLARE WORKER ===
const originalFetch = window.fetch.bind(window);
window.fetch = async (input, init = {}) => {
  const urlStr = typeof input === 'string' ? input : (input && input.url ? input.url : '');
  if (urlStr.includes('api.the-odds-api.com')) {
    const parsed = new URL(urlStr);
    parsed.searchParams.delete('apiKey');
    const proxyUrl = `${WORKER_URL}/odds${parsed.pathname}${parsed.search}`;
    const headers = new Headers(init.headers || {});
    if (auth.currentUser) currentToken = await auth.currentUser.getIdToken();
    if (currentToken) headers.set('Authorization', `Bearer ${currentToken}`);
    headers.set('X-Device-Id', getDeviceId());
    return originalFetch(proxyUrl, { ...init, headers });
  }
  return originalFetch(input, init);
};

// === 3. HELP AI SENSITIVE-INFO GUARDRAIL ===
function installHelpGuardrail() {
  if (typeof window.getHelpAnswer === 'function' && !window.getHelpAnswer._guarded) {
    const baseFn = window.getHelpAnswer;
    const wrapped = function (q) {
      if (/api[\s_-]?key|secret|token|password|source\s?code|github|script|backend|worker|firebase|cloudflare|kv|admin|ban|geoblock|exploit|hack|prompt|system/i.test(String(q || ''))) {
        return "I can't share technical details, code, or private API/account information. Ask me about confidence scores, +EV, Gematria, or how to use AlignIQ's features.";
      }
      return baseFn(q);
    };
    wrapped._guarded = true;
    window.getHelpAnswer = wrapped;
  }
}
installHelpGuardrail();
setTimeout(installHelpGuardrail, 800);

// === 4. LOCKOUT SCREEN ===
function showLockout(reason) {
  let el = document.getElementById('aligniq-lockout');
  if (!el) {
    el = document.createElement('div');
    el.id = 'aligniq-lockout';
    el.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#080d17;color:#f1f5f9;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;';
    document.body.appendChild(el);
  }
  el.innerHTML = `
    <div style="max-width:340px;background:#0f172a;border:1px solid #ef4444;border-radius:16px;padding:22px;">
      <div style="font-size:30px;margin-bottom:8px;">🚫</div>
      <h2 style="margin:0 0 8px;font-size:18px;">Access Restricted</h2>
      <p style="margin:0 0 16px;font-size:13px;color:#94a3b8;line-height:1.45;">${reason || 'Your access to AlignIQ has been restricted.'}</p>
      <button onclick="window.signOut()" style="background:#ef4444;color:#fff;border:none;border-radius:10px;padding:10px 18px;font-weight:700;cursor:pointer;">Sign Out</button>
    </div>
  `;
}

function setOwnerVisibility(show) {
  window.ALIGNIQ_IS_OWNER = show;
  document.querySelectorAll('.owner-only').forEach((el) => {
    el.style.display = show ? '' : 'none';
  });
}

// === 5. REAL AUTH HANDLERS WITH REMEMBER-DEVICE SUPPORT ===
function setAuthError(msg) {
  const el = document.getElementById('auth-error');
  if (el) { el.textContent = msg || ''; el.style.display = msg ? 'block' : 'none'; }
}

window.signInGoogle = async () => {
  setAuthError('');
  try {
    await applyRememberPreference();
    await signInWithPopup(auth, googleProvider);
  } catch (err) {
    setAuthError(err.message.replace('Firebase: ', ''));
  }
};

window.signInEmail = async (isSignUp = false) => {
  setAuthError('');
  const email = (document.getElementById('auth-email')?.value || '').trim();
  const pass = document.getElementById('auth-password')?.value || '';
  if (!email || pass.length < 6) {
    setAuthError('Enter a valid email and a password (6+ characters).');
    return;
  }
  try {
    await applyRememberPreference();
    if (isSignUp) await createUserWithEmailAndPassword(auth, email, pass);
    else await signInWithEmailAndPassword(auth, email, pass);
  } catch (err) {
    setAuthError(err.message.replace('Firebase: ', ''));
  }
};

window.signOut = async () => {
  await fbSignOut(auth);
  localStorage.removeItem('aligniq_user');
  const lock = document.getElementById('aligniq-lockout');
  if (lock) lock.remove();
  setOwnerVisibility(false);
  document.getElementById('dashboard').style.display = 'none';
  document.getElementById('auth-screen').style.display = 'flex';
};

localStorage.setItem('aligniq_odds_key', 'PROXY_ACTIVE');

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    currentToken = '';
    setOwnerVisibility(false);
    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('auth-screen').style.display = 'flex';
    return;
  }

  try {
    currentToken = await user.getIdToken(true);
    const res = await originalFetch(`${WORKER_URL}/session`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${currentToken}`,
        'X-Device-Id': getDeviceId()
      }
    });
    const data = await res.json();

    if (!res.ok || !data.allowed) {
      showLockout(data.reason);
      return;
    }

    setOwnerVisibility(Boolean(data.isOwner));
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
    if (typeof window.loadSlate === 'function') window.loadSlate(true);
  } catch {
    setAuthError('Could not verify session. Check your connection.');
  }
});

// === 6. OWNER-ONLY SECURITY ADMIN MODAL ===
async function adminCall(path, method = 'GET', body = null) {
  currentToken = await auth.currentUser.getIdToken();
  const res = await originalFetch(`${WORKER_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${currentToken}`,
      'X-Device-Id': getDeviceId(),
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  return res.json();
}

window.openAdminModal = async () => {
  if (!window.ALIGNIQ_IS_OWNER) return;
  const modal = document.getElementById('admin-modal');
  const body = document.getElementById('admin-body');
  modal.classList.add('open');
  body.innerHTML = '<p style="font-size:12px;color:#94a3b8;">Loading accounts &amp; security rules...</p>';
  await renderAdminPanel();
};

window.adminToggleRule = async (list, value, action) => {
  if (!value) return;
  await adminCall('/admin/update', 'POST', { list, value, action });
  await renderAdminPanel();
};

async function renderAdminPanel() {
  const body = document.getElementById('admin-body');
  const data = await adminCall('/admin/state');
  if (data.error) { body.innerHTML = `<p style="color:#ef4444;">${data.error}</p>`; return; }

  const { bans, users } = data;
  const chip = (list, val) => `
    <span style="display:inline-flex;align-items:center;gap:5px;background:#1e293b;border:1px solid #ef4444;color:#fca5a5;padding:3px 8px;border-radius:999px;font-size:11px;margin:2px;">
      ${val} <button onclick="adminToggleRule('${list}','${val}','remove')" style="background:none;border:none;color:#fff;cursor:pointer;font-weight:800;">×</button>
    </span>`;

  body.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:14px;font-size:12px;">
      <div style="background:#0f172a;border:1px solid #1e2d47;border-radius:12px;padding:10px;">
        <strong style="color:#34d399;">🌍 Geoblock &amp; Manual Rules</strong>
        <div style="display:flex;gap:6px;margin-top:8px;">
          <select id="adm-list" class="form-input" style="width:120px;">
            <option value="countries">Country (2-letter)</option>
            <option value="regions">State / Region</option>
            <option value="ips">IP Address</option>
            <option value="emails">Email</option>
            <option value="devices">Device ID</option>
          </select>
          <input id="adm-val" class="form-input" placeholder="e.g. CA, Texas, 1.2.3.4" />
          <button class="icon-btn accent" onclick="adminToggleRule(document.getElementById('adm-list').value, document.getElementById('adm-val').value, 'add')">Block</button>
        </div>
        <div style="margin-top:8px;">
          ${bans.countries.map(v => chip('countries', v)).join('')}
          ${bans.regions.map(v => chip('regions', v)).join('')}
          ${bans.ips.map(v => chip('ips', v)).join('')}
          ${bans.emails.map(v => chip('emails', v)).join('')}
          ${bans.devices.map(v => chip('devices', v)).join('')}
          ${(!bans.countries.length && !bans.regions.length && !bans.ips.length && !bans.emails.length && !bans.devices.length) ? '<span style="color:#64748b;">No active blocks.</span>' : ''}
        </div>
      </div>

      <div style="background:#0f172a;border:1px solid #1e2d47;border-radius:12px;padding:10px;">
        <strong style="color:#38bdf8;">👥 Active Accounts (${users.length})</strong>
        <div style="display:flex;flex-direction:column;gap:8px;margin-top:8px;max-height:260px;overflow-y:auto;">
          ${users.map(u => `
            <div style="border:1px solid #1e293b;border-radius:10px;padding:8px;background:#080d17;">
              <div style="font-weight:700;color:#f1f5f9;">${u.email}</div>
              <div style="color:#94a3b8;font-size:11px;margin:2px 0 6px;">
                ${u.city ? u.city + ', ' : ''}${u.region} (${u.country}) · IP: ${u.ip}<br/>
                Device: ${u.deviceId.slice(0, 14)}…
              </div>
              <div style="display:flex;gap:5px;flex-wrap:wrap;">
                <button class="icon-btn" style="height:26px;font-size:10px;border-color:#ef4444;color:#fca5a5;" onclick="adminToggleRule('emails','${u.email}','add')">Ban Account</button>
                <button class="icon-btn" style="height:26px;font-size:10px;border-color:#f59e0b;color:#fcd34d;" onclick="adminToggleRule('devices','${u.deviceId}','add')">Block Phone</button>
                <button class="icon-btn" style="height:26px;font-size:10px;" onclick="adminToggleRule('ips','${u.ip}','add')">Block IP</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}
