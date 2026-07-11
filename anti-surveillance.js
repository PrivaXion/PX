/**
 * PrivaXion — Anti-Surveillance Engine v1.0
 *
 * Модули:
 *   1. XSS Sanitizer       — жёсткая очистка входящих сообщений
 *   2. RAM Clipboard        — изолированный буфер обмена в памяти (TTL 30s)
 *   3. Duress Password      — пароль под принуждением → фейковый интерфейс
 *   4. Anti-Neural Screen   — динамический SVG-шум + перехват PrintScreen
 *
 * Подключение: <script src="anti-surveillance.js"></script>
 *              Вызов: const ASE = new AntiSurveillanceEngine(); ASE.init();
 */

'use strict';

// ============================================================================
// CONSTANTS
// ============================================================================
const ASE_CONFIG = {
    // RAM clipboard wipe delay (ms)
    CLIPBOARD_TTL_MS: 30_000,

    // PrintScreen → forced logout delay (ms)
    SCREENSHOT_LOGOUT_DELAY_MS: 5_000,

    // Noise layer update rate (ms) — how often the noise SVG re-seeds
    NOISE_REFRESH_MS: 2_000,

    // Duress mode — PIN stored as hex-encoded SHA-256 digest (see duressAuth)
    // Default duress PIN "DURESS" is stored here as its SHA-256 digest.
    // Replace BOTH hashes during real deployment via PrivaXionASE.setPasswords()
    REAL_PASSWORD_HASH:   '3fc4ccfe745870e2c0d99f71f30ff0656c8dedd41cc1d7d3d376b0dbe685e2f3', // "PrivaXion2026!"
    DURESS_PASSWORD_HASH: 'b14a7b8059d9c055954c92674ce60032c2d4021b4f185dd3e80e6ea4e8b7e949', // "DURESS"
};

// ============================================================================
// UTILITY — Secure SHA-256 via WebCrypto
// ============================================================================
async function sha256hex(str) {
    const buf = new TextEncoder().encode(str);
    const digest = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(digest))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

// Constant-time string comparison (prevents timing attacks)
function constantTimeEqual(a, b) {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
        diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return diff === 0;
}

// ============================================================================
// MODULE 1: XSS SANITIZER
// ============================================================================
class XSSSanitizer {
    constructor() {
        // Dangerous HTML tags — complete list including SVG/MathML vectors
        this.BLOCKED_TAGS = /(<\s*\/?\s*(script|iframe|object|embed|link|meta|base|form|input|button|select|textarea|applet|frame|frameset|svg|math|style|template|slot|portal|xmp|noscript|noframes|plaintext|listing|xml)[^>]*>)/gi;

        // Event-handler attributes (covers all on* variants)
        this.BLOCKED_ATTRS = /\s+on\w+\s*=\s*["'][^"']*["']/gi;

        // Dangerous href/src/action/formaction protocols
        this.DANGEROUS_PROTO = /\s+(href|src|action|formaction|data|xlink:href)\s*=\s*["']?\s*(javascript|vbscript|data|blob)\s*:/gi;

        // CSS expression() — IE legacy but still in parsers
        this.CSS_EXPRESSION = /expression\s*\([^)]*\)/gi;
    }

    /**
     * Sanitize a raw incoming string.
     * Returns a safe string that can be set as textContent (never innerHTML).
     * @param {string} raw
     * @returns {string}
     */
    sanitize(raw) {
        if (typeof raw !== 'string') return '';

        let s = raw;

        // 1. Strip null bytes (parser confusion)
        s = s.replace(/\0/g, '');

        // 2. Decode common HTML entities used to bypass regex (&lt; &amp; &#x3C; &#60; \u003c)
        s = this._decodeEntities(s);

        // 3. Remove blocked tags
        s = s.replace(this.BLOCKED_TAGS, '');

        // 4. Remove event-handler attributes
        s = s.replace(this.BLOCKED_ATTRS, '');

        // 5. Remove dangerous protocol hrefs
        s = s.replace(this.DANGEROUS_PROTO, '');

        // 6. Strip CSS expression()
        s = s.replace(this.CSS_EXPRESSION, '');

        // 7. Remove template literal injection markers (backtick-based)
        s = s.replace(/`/g, '');

        // 8. Encode remaining < and > so they render as text only
        s = s.replace(/</g, '&lt;').replace(/>/g, '&gt;');

        return s.trim();
    }

    /**
     * Render a sanitized message safely into a DOM element.
     * Always uses textContent, never innerHTML.
     * @param {HTMLElement} el
     * @param {string} rawText
     */
    renderSafe(el, rawText) {
        // Use textContent after sanitize to guarantee no HTML parsing
        el.textContent = this.sanitize(rawText);
    }

    /**
     * Decode HTML entities to catch bypass attempts like &lt;script&gt;
     * Uses a temporary textarea (parser-safe, no script execution).
     */
    _decodeEntities(str) {
        try {
            const el = document.createElement('textarea');
            // Set value directly — textarea treats content as literal text
            el.innerHTML = str;
            return el.value;
        } catch (_) {
            return str;
        }
    }
}

// ============================================================================
// MODULE 2: RAM CLIPBOARD
// ============================================================================
class RAMClipboard {
    constructor() {
        this._buffer = null;          // Plaintext RAM store (not system clipboard)
        this._bufferBytes = null;     // Uint8Array mirror for secure wipe
        this._wipeTimer = null;
        this._TTL = ASE_CONFIG.CLIPBOARD_TTL_MS;
    }

    /**
     * Attach keyboard interceptors to the document.
     * Must be called once after DOM is ready.
     */
    attach() {
        document.addEventListener('keydown', (e) => this._onKeyDown(e), true);

        // Also intercept the native 'copy' event (right-click → Copy)
        document.addEventListener('copy',  (e) => this._onNativeCopy(e),  true);
        document.addEventListener('paste', (e) => this._onNativePaste(e), true);
        document.addEventListener('cut',   (e) => this._onNativeCut(e),   true);
    }

    // ------- Internal handlers -------

    _onKeyDown(e) {
        const ctrl = e.ctrlKey || e.metaKey;
        if (!ctrl) return;

        if (e.key === 'c' || e.key === 'C') {
            e.preventDefault();
            e.stopImmediatePropagation();
            const sel = window.getSelection()?.toString() ?? '';
            if (sel.length > 0) this._store(sel);
        }

        if (e.key === 'x' || e.key === 'X') {
            e.preventDefault();
            e.stopImmediatePropagation();
            const sel = window.getSelection()?.toString() ?? '';
            if (sel.length > 0) {
                this._store(sel);
                // Delete selected text from active editable
                const active = document.activeElement;
                if (active?.setRangeText) {
                    active.setRangeText('', active.selectionStart, active.selectionEnd, 'end');
                }
            }
        }

        if (e.key === 'v' || e.key === 'V') {
            e.preventDefault();
            e.stopImmediatePropagation();
            if (this._buffer !== null) {
                this._pasteIntoActive(this._buffer);
            }
            // Do NOT fall back to system clipboard — intentional
        }
    }

    _onNativeCopy(e) {
        e.preventDefault();
        e.stopImmediatePropagation();
        const sel = window.getSelection()?.toString() ?? '';
        if (sel.length > 0) this._store(sel);
        // Poison the system clipboard with an empty string
        e.clipboardData?.setData('text/plain', '');
    }

    _onNativeCut(e) {
        e.preventDefault();
        e.stopImmediatePropagation();
        const sel = window.getSelection()?.toString() ?? '';
        if (sel.length > 0) this._store(sel);
        e.clipboardData?.setData('text/plain', '');
    }

    _onNativePaste(e) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (this._buffer !== null) {
            this._pasteIntoActive(this._buffer);
        }
    }

    _store(text) {
        // Securely wipe previous buffer before overwriting
        this._wipeBuffer();

        // Store as Uint8Array for deterministic memory control
        const encoder = new TextEncoder();
        this._bufferBytes = encoder.encode(text);
        this._buffer = text;

        // Arm the 30-second auto-wipe timer
        clearTimeout(this._wipeTimer);
        this._wipeTimer = setTimeout(() => {
            this._wipeBuffer();
            console.info('[ASE] RAM Clipboard wiped (TTL expired).');
        }, this._TTL);

        console.info(`[ASE] Copied ${text.length} chars → RAM clipboard. Auto-wipe in ${this._TTL / 1000}s.`);
    }

    _wipeBuffer() {
        if (this._bufferBytes) {
            // Overwrite bytes with cryptographic noise first
            crypto.getRandomValues(this._bufferBytes);
            // Then zero-fill
            this._bufferBytes.fill(0);
            this._bufferBytes = null;
        }
        this._buffer = null;
        clearTimeout(this._wipeTimer);
    }

    _pasteIntoActive(text) {
        const el = document.activeElement;
        if (!el) return;
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
            const start = el.selectionStart ?? el.value.length;
            const end   = el.selectionEnd   ?? el.value.length;
            el.value = el.value.slice(0, start) + text + el.value.slice(end);
            el.selectionStart = el.selectionEnd = start + text.length;
            el.dispatchEvent(new Event('input', { bubbles: true }));
        } else if (el.isContentEditable) {
            document.execCommand('insertText', false, text);
        }
    }
}

// ============================================================================
// MODULE 3: DURESS PASSWORD SYSTEM
// ============================================================================
class DuressAuth {
    constructor() {
        this.isDuressMode = false;
    }

    /**
     * Set new password hashes. Both inputs are raw plaintext strings —
     * they are hashed internally before storage (no plaintext ever stored).
     * @param {string} realPassword
     * @param {string} duressPassword
     */
    async setPasswords(realPassword, duressPassword) {
        ASE_CONFIG.REAL_PASSWORD_HASH   = await sha256hex(realPassword);
        ASE_CONFIG.DURESS_PASSWORD_HASH = await sha256hex(duressPassword);
    }

    /**
     * Attempt login. Returns { success: boolean, mode: 'real'|'duress'|'fail' }
     * @param {string} password
     */
    async attemptLogin(password) {
        const inputHash = await sha256hex(password);

        if (constantTimeEqual(inputHash, ASE_CONFIG.REAL_PASSWORD_HASH)) {
            this.isDuressMode = false;
            return { success: true, mode: 'real' };
        }

        if (constantTimeEqual(inputHash, ASE_CONFIG.DURESS_PASSWORD_HASH)) {
            this.isDuressMode = true;
            return { success: true, mode: 'duress' };
        }

        return { success: false, mode: 'fail' };
    }

    /**
     * Render the duress (decoy) interface.
     * Replaces app content with a convincingly empty account.
     * @param {HTMLElement} appRoot - The root #app-container element.
     */
    renderDecoyInterface(appRoot) {
        console.warn('[ASE] DURESS MODE ACTIVE — rendering decoy interface.');

        // Completely replace the app content (no real data ever leaks)
        appRoot.innerHTML = `
            <div class="ase-duress-shell" style="
                display: flex; flex-direction: column; height: 100dvh;
                font-family: 'Inter', sans-serif; background: #f5f7fb;
            ">
                <header style="height:60px; background:#fff; border-bottom:1px solid #e2e8f0;
                    display:flex; align-items:center; padding:0 16px; gap:12px;">
                    <span style="font-size:20px; font-weight:600; color:#3b82f6;">PrivaXion</span>
                    <span style="flex:1;"></span>
                    <span style="font-size:22px;">⚙️</span>
                </header>

                <div style="flex:1; display:flex; flex-direction:column; align-items:center;
                    justify-content:center; gap:12px; color:#94a3b8; padding:32px;">
                    <div style="font-size:56px;">💬</div>
                    <div style="font-size:18px; font-weight:500; color:#64748b;">No conversations yet</div>
                    <div style="font-size:14px; text-align:center; max-width:220px; line-height:1.5;">
                        Your messages will appear here once you connect with someone.
                    </div>
                </div>

                <footer style="padding:12px 16px; background:#fff; border-top:1px solid #e2e8f0;">
                    <div style="display:flex; gap:12px; align-items:center;">
                        <input type="text" placeholder="Type a message..."
                            style="flex:1; padding:12px 16px; border:1px solid #e2e8f0;
                            border-radius:24px; font-size:15px; outline:none; background:#f5f7fb;">
                        <button style="background:#3b82f6; color:#fff; border:none;
                            padding:12px 20px; border-radius:24px; font-weight:500; cursor:pointer;">
                            Send
                        </button>
                    </div>
                </footer>
            </div>`;

        // Swallow all network calls and DB access silently
        this._freezeDecoyNetwork();
    }

    _freezeDecoyNetwork() {
        // Override fetch so no real data is loaded while in decoy mode
        const _originalFetch = window.fetch;
        window.fetch = async (...args) => {
            const url = String(args[0]);
            // Allow only innocuous external requests (ping, CDN fonts, etc.)
            if (url.includes('1.1.1.1') || url.startsWith('https://fonts')) {
                return _originalFetch(...args);
            }
            // Silently drop all app API calls
            console.info('[ASE:Duress] Network request suppressed:', url);
            return new Response(JSON.stringify({ ok: false, duress: true }), {
                status: 200, headers: { 'Content-Type': 'application/json' }
            });
        };
    }
}

// ============================================================================
// MODULE 4: ANTI-NEURAL SCREEN FILTER
// ============================================================================
class AntiNeuralFilter {
    constructor() {
        this._noiseLayer   = null;   // Canvas overlay element
        this._svgFilter    = null;   // SVG <filter> element
        this._rafHandle    = null;   // requestAnimationFrame handle
        this._refreshTimer = null;
        this._animTick     = 0;
    }

    /**
     * Inject the noise layer and SVG filter into the document.
     * Must be called after <body> is available.
     */
    inject() {
        this._injectSVGFilter();
        this._injectNoiseCanvas();
        this._startNoiseAnimation();
        this._hookPrintScreen();
        console.info('[ASE] Anti-Neural screen filter active.');
    }

    // --- SVG Displacement Filter (confuses edge-detection in OCR) ---
    _injectSVGFilter() {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('id', 'ase-svg-root');
        svg.setAttribute('width', '0');
        svg.setAttribute('height', '0');
        svg.style.cssText = 'position:absolute;z-index:-9999;pointer-events:none;overflow:hidden;';

        svg.innerHTML = `
            <defs>
                <filter id="ase-ocr-displace" x="0%" y="0%" width="100%" height="100%"
                        color-interpolation-filters="sRGB">
                    <!-- High-freq fractal noise seed changes each refresh cycle -->
                    <feTurbulence id="ase-turbulence"
                        type="fractalNoise"
                        baseFrequency="0.85 0.92"
                        numOctaves="4"
                        seed="1"
                        stitchTiles="stitch"
                        result="noise"/>
                    <!-- Scale=1.2 → subpixel shift; imperceptible to human, breaks OCR baseline -->
                    <feDisplacementMap
                        in="SourceGraphic" in2="noise"
                        scale="1.2"
                        xChannelSelector="R" yChannelSelector="G"/>
                </filter>
            </defs>`;

        document.body.insertAdjacentElement('afterbegin', svg);
        this._svgFilter = svg.querySelector('#ase-turbulence');
    }

    // --- Canvas Noise Overlay (dynamic pixel dithering) ---
    _injectNoiseCanvas() {
        const canvas = document.createElement('canvas');
        canvas.id = 'ase-noise-canvas';
        canvas.style.cssText = `
            position: fixed;
            top: 0; left: 0;
            width: 100vw; height: 100dvh;
            pointer-events: none;
            z-index: 998888;
            opacity: 0.028;
            mix-blend-mode: luminosity;
        `;
        document.body.appendChild(canvas);
        this._noiseLayer = canvas;
        this._resizeCanvas();
        window.addEventListener('resize', () => this._resizeCanvas(), { passive: true });
    }

    _resizeCanvas() {
        if (!this._noiseLayer) return;
        this._noiseLayer.width  = window.innerWidth;
        this._noiseLayer.height = window.innerHeight;
    }

    // --- Animation Loop: Redraw pixel noise every frame ---
    _startNoiseAnimation() {
        const draw = () => {
            this._rafHandle = requestAnimationFrame(draw);
            this._animTick++;

            // Redraw canvas noise every ~3 frames (~20fps) to reduce CPU cost
            if (this._animTick % 3 !== 0) return;

            const canvas = this._noiseLayer;
            if (!canvas) return;

            const ctx = canvas.getContext('2d');
            const W = canvas.width;
            const H = canvas.height;

            // Create raw pixel noise — ImageData is fastest path
            const imageData = ctx.createImageData(W, H);
            const data = imageData.data;

            // Fill with random monochrome grain (RGBA: R=G=B=noise, A=255)
            // Using crypto.getRandomValues in chunks for speed + true entropy
            const randBuf = new Uint8Array(Math.ceil(W * H / 4));
            crypto.getRandomValues(randBuf);

            let rIdx = 0;
            for (let i = 0; i < data.length; i += 16) {
                // Each rand byte covers 2 pixels (4 bits per channel)
                const rv = randBuf[rIdx++ % randBuf.length];
                const v1 = (rv & 0xF0) | (rv >> 4);   // top 4 bits → pixel 1
                const v2 = ((rv & 0x0F) << 4) | (rv & 0x0F); // bot 4 bits → pixel 2

                // Pixel 1
                data[i]     = v1; data[i + 1] = v1; data[i + 2] = v1; data[i + 3] = 255;
                // Pixel 2
                data[i + 4] = v2; data[i + 5] = v2; data[i + 6] = v2; data[i + 7] = 255;
            }

            ctx.putImageData(imageData, 0, 0);
        };

        this._rafHandle = requestAnimationFrame(draw);

        // Re-seed SVG turbulence filter every NOISE_REFRESH_MS for temporal diversity
        this._refreshTimer = setInterval(() => {
            if (this._svgFilter) {
                const newSeed = Math.floor(Math.random() * 65535);
                this._svgFilter.setAttribute('seed', String(newSeed));
            }
        }, ASE_CONFIG.NOISE_REFRESH_MS);
    }

    // --- Apply anti-OCR SVG filter class to all message bubbles ---
    applyToMessageBubbles() {
        // Call this after chat messages are rendered
        document.querySelectorAll('.bubble').forEach(el => {
            el.style.filter = 'url(#ase-ocr-displace)';
        });
    }

    // --- PrintScreen Detection & Forced Logout ---
    _hookPrintScreen() {
        let alertActive = false;

        const handleKey = (e) => {
            // All known PrintScreen / screen-capture shortcut combos
            const isCapture = (
                e.key === 'PrintScreen' ||
                (e.metaKey && e.shiftKey && (e.key === '3' || e.key === '4' || e.key === '5')) || // macOS
                (e.ctrlKey && e.key === 'PrintScreen') // Windows snip
            );

            if (isCapture && !alertActive) {
                e.preventDefault();
                alertActive = true;
                this._showScreenshotWarning();
            }
        };

        // Capture phase to intercept before any other handler
        window.addEventListener('keydown', handleKey, true);
        window.addEventListener('keyup',   handleKey, true);

        // Electron IPC bridge (if running inside Electron)
        if (window.electronAPI?.onScreenshotAttempt) {
            window.electronAPI.onScreenshotAttempt(() => {
                if (!alertActive) {
                    alertActive = true;
                    this._showScreenshotWarning();
                }
            });
        }
    }

    _showScreenshotWarning() {
        // Remove any existing overlay first
        document.getElementById('ase-screenshot-warn')?.remove();

        const overlay = document.createElement('div');
        overlay.id = 'ase-screenshot-warn';

        let countdown = ASE_CONFIG.SCREENSHOT_LOGOUT_DELAY_MS / 1000;

        overlay.innerHTML = `
            <div style="
                background: rgba(15,23,42,0.97); backdrop-filter: blur(4px);
                padding: 32px 28px; border-radius: 16px; text-align: center;
                max-width: 320px; width: 90%; border: 1px solid rgba(239,68,68,0.4);
                box-shadow: 0 0 40px rgba(239,68,68,0.2);
                font-family: 'Inter', sans-serif;
            ">
                <div style="font-size: 48px; margin-bottom: 12px;">⚠️</div>
                <h3 style="color: #ef4444; margin: 0 0 10px; font-size: 18px; font-weight: 700;">
                    Screenshot Detected
                </h3>
                <p style="color: #94a3b8; font-size: 14px; margin: 0 0 18px; line-height: 1.5;">
                    Screen capture is prohibited in PrivaXion. For your security,
                    you will be logged out immediately.
                </p>
                <div id="ase-countdown" style="
                    color: #ef4444; font-size: 32px; font-weight: 700; margin-bottom: 8px;
                ">${countdown}</div>
                <div style="color: #475569; font-size: 12px;">Session terminating...</div>
            </div>`;

        Object.assign(overlay.style, {
            position: 'fixed', top: '0', left: '0',
            width: '100vw', height: '100dvh',
            background: 'rgba(239, 68, 68, 0.15)',
            zIndex: '9999999',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
        });

        document.body.appendChild(overlay);

        // Countdown ticker
        const tick = setInterval(() => {
            countdown--;
            const el = document.getElementById('ase-countdown');
            if (el) el.textContent = String(countdown);
            if (countdown <= 0) clearInterval(tick);
        }, 1000);

        // Forced logout after delay
        setTimeout(() => {
            this._forceLogout();
        }, ASE_CONFIG.SCREENSHOT_LOGOUT_DELAY_MS);
    }

    _forceLogout() {
        // 1. Destroy in-RAM security keys if security module is loaded
        if (window.privaXionSecurityCore?.destroyKey) {
            window.privaXionSecurityCore.destroyKey();
        }

        // 2. Clear all session data
        localStorage.removeItem('privaxion_session_start');
        sessionStorage.clear();

        // 3. Navigate to login / reload
        if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/') {
            window.location.reload();
        } else {
            window.location.href = '/';
        }
    }

    destroy() {
        cancelAnimationFrame(this._rafHandle);
        clearInterval(this._refreshTimer);
        this._noiseLayer?.remove();
        document.getElementById('ase-svg-root')?.remove();
    }
}

// ============================================================================
// MASTER ENGINE — assembles all modules
// ============================================================================
class AntiSurveillanceEngine {
    constructor() {
        this.sanitizer   = new XSSSanitizer();
        this.clipboard   = new RAMClipboard();
        this.duressAuth  = new DuressAuth();
        this.screenFilter = new AntiNeuralFilter();
    }

    /**
     * Bootstrap the entire engine.
     * Call once after DOM is ready.
     */
    init() {
        this.clipboard.attach();
        this.screenFilter.inject();
        console.info('[ASE] Anti-Surveillance Engine initialized.');
    }

    /**
     * Authenticate a user and route to real or duress interface.
     * @param {string} password - Raw password input
     * @param {HTMLElement} appRoot - The root #app-container
     * @returns {Promise<{success: boolean, mode: string}>}
     */
    async authenticate(password, appRoot) {
        const result = await this.duressAuth.attemptLogin(password);
        if (result.mode === 'duress') {
            this.duressAuth.renderDecoyInterface(appRoot);
        }
        return result;
    }

    /**
     * Sanitize a raw incoming message string before rendering.
     * @param {string} rawText
     * @returns {string}
     */
    sanitizeMessage(rawText) {
        return this.sanitizer.sanitize(rawText);
    }

    /**
     * Safely render sanitized text into a DOM element.
     * Uses textContent — never innerHTML.
     * @param {HTMLElement} el
     * @param {string} rawText
     */
    renderMessage(el, rawText) {
        this.sanitizer.renderSafe(el, rawText);
        // Apply anti-OCR filter to this element
        el.style.filter = 'url(#ase-ocr-displace)';
    }
}

// ============================================================================
// BOOTSTRAP
// ============================================================================
window.AntiSurveillanceEngine = AntiSurveillanceEngine;

// Auto-instantiate and expose globally
const _ase = new AntiSurveillanceEngine();
window.privaXionASE = _ase;

// Start after DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => _ase.init());
} else {
    _ase.init();
}
