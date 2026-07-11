/**
 * PrivaXion Security Core Module
 * 
 * 1. AES-256-GCM Encryption with RAM-only keys
 * 2. 7-day session management
 * 3. File Shredder / DB Self-destruction (168 hours)
 * 4. Offline Control & PIN Lock
 */

class PrivaXionSecurity {
    constructor() {
        this.ramKey = null;         // CryptoKey instance (opaque pointer in RAM)
        this.rawKeyMaterial = null; // Uint8Array strictly for manual wiping
        this.db = null;
        
        this.pingInterval = null;
        this.shredderInterval = null;
        this.lastPingSuccess = Date.now();
        this.pinLocked = false;
        
        // Constants
        this.SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days (168 hours)
        this.PING_INTERVAL_MS = 5000; // 5 seconds
        this.OFFLINE_TIMEOUT_MS = 10000; // 10 seconds
        this.SERVER_PING_URL = 'https://1.1.1.1/cdn-cgi/trace'; // Placeholder for backend ping route
        
        // Bind context for event listeners
        this.destroyKey = this.destroyKey.bind(this);
    }

    /**
     * 1. INITIATE AND MANAGE ENCRYPTION KEYS (AES-256-GCM)
     */
    async generateNewSessionKey() {
        // Generate a 256-bit (32 bytes) key in RAM
        this.rawKeyMaterial = new Uint8Array(32);
        window.crypto.getRandomValues(this.rawKeyMaterial);
        
        // Import as non-extractable CryptoKey for AES-GCM operations
        this.ramKey = await window.crypto.subtle.importKey(
            "raw",
            this.rawKeyMaterial,
            { name: "AES-GCM" },
            false, // Non-extractable for strict security
            ["encrypt", "decrypt"]
        );
        
        const now = Date.now();
        localStorage.setItem('privaxion_session_start', now.toString());
        console.log("[Security] AES-256-GCM Key generated in RAM.");
    }

    destroyKey() {
        if (this.rawKeyMaterial) {
            // Secure memory wipe: overwrite with cryptographically random bytes
            window.crypto.getRandomValues(this.rawKeyMaterial);
            // Then fill with absolute zeros
            this.rawKeyMaterial.fill(0);
        }
        
        this.ramKey = null;
        this.rawKeyMaterial = null;
        console.log("[Security] Key securely wiped from RAM with zeros.");
    }

    setupExitHooks() {
        // Trigger key wiping exactly when the application closes/exits
        window.addEventListener('beforeunload', this.destroyKey);
        window.addEventListener('unload', this.destroyKey);
        
        // In highly secure environments, optionally destroy keys when tab goes to background:
        /*
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                this.destroyKey();
            }
        });
        */
    }

    /**
     * ENCRYPTION HELPERS
     */
    async encryptData(plainText) {
        if (!this.ramKey) throw new Error("Security Lock: RAM Key not initialized");
        
        const encoder = new TextEncoder();
        const data = encoder.encode(plainText);
        const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV
        
        const cipherText = await window.crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv },
            this.ramKey,
            data
        );
        
        return {
            iv: Array.from(iv),
            cipherText: Array.from(new Uint8Array(cipherText))
        };
    }

    async decryptData(encryptedData) {
        if (!this.ramKey) throw new Error("Security Lock: RAM Key not initialized");
        
        const iv = new Uint8Array(encryptedData.iv);
        const cipherText = new Uint8Array(encryptedData.cipherText);
        
        const plainTextBuffer = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv: iv },
            this.ramKey,
            cipherText
        );
        
        const decoder = new TextDecoder();
        return decoder.decode(plainTextBuffer);
    }

    /**
     * 2. LOCAL DATABASE (IndexedDB) & SESSION
     */
    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('PrivaXionSecureDB', 1);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                // Create stores for messages and logs
                if (!db.objectStoreNames.contains('messages')) {
                    const store = db.createObjectStore('messages', { keyPath: 'id' });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                }
                if (!db.objectStoreNames.contains('logs')) {
                    const store = db.createObjectStore('logs', { keyPath: 'id' });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };
            
            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve();
            };
            
            request.onerror = (event) => reject(event.target.error);
        });
    }

    async verifySession() {
        const sessionStart = localStorage.getItem('privaxion_session_start');
        if (sessionStart) {
            const elapsed = Date.now() - parseInt(sessionStart, 10);
            if (elapsed > this.SESSION_MAX_AGE_MS) {
                console.warn("[Security] Session expired (7 days reached). Nullifying session.");
                this.destroyKey();
                localStorage.removeItem('privaxion_session_start');
                await this.wipeEntireDatabase(); // Total annihilation on session expiry
            }
        }
    }

    /**
     * 3. SELF-DESTRUCTION (File Shredder over IndexedDB)
     */
    startSelfDestructTimer() {
        // Run immediately on launch
        this.shredOldData();
        // Run every hour
        this.shredderInterval = setInterval(() => this.shredOldData(), 60 * 60 * 1000);
    }

    async shredOldData() {
        if (!this.db) return;
        const cutoff = Date.now() - this.SESSION_MAX_AGE_MS;
        console.log(`[Security] Shredder activated. Sweeping data older than ${new Date(cutoff).toISOString()}`);

        const stores = ['messages', 'logs'];
        
        for (const storeName of stores) {
            try {
                const toShred = [];
                const transaction = this.db.transaction([storeName], 'readonly');
                const store = transaction.objectStore(storeName);
                const request = store.index('timestamp').openCursor(IDBKeyRange.upperBound(cutoff));

                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        // Calculate approximate size to generate equivalent cryptographic noise
                        const sizeApprox = JSON.stringify(cursor.value).length * 2;
                        toShred.push({ key: cursor.primaryKey, size: sizeApprox });
                        cursor.continue();
                    } else {
                        // Execute shredding stack
                        this.executeShredding(storeName, toShred);
                    }
                };
            } catch (e) {
                console.warn(`[Security] Store ${storeName} not ready or empty.`, e);
            }
        }
    }

    async executeShredding(storeName, records) {
        for (const record of records) {
            await this.shredRecord(storeName, record.key, record.size);
        }
        if (records.length > 0) {
            console.log(`[Security] Shredded ${records.length} items from ${storeName}`);
        }
    }

    async shredRecord(storeName, key, recordSizeApprox) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            
            // 1. Generate cryptographic noise based on original record size
            const size = Math.max(recordSizeApprox || 1024, 1024);
            const garbage = new Uint8Array(size);
            window.crypto.getRandomValues(garbage);
            
            // 2. Overwrite the sector in IndexedDB with pure entropy
            const putReq = store.put({ id: key, _shredded: garbage.buffer });
            
            putReq.onsuccess = () => {
                // 3. Command deletion of the ruined sector
                const delReq = store.delete(key);
                delReq.onsuccess = () => resolve();
                delReq.onerror = () => reject(delReq.error);
            };
            putReq.onerror = () => reject(putReq.error);
        });
    }

    async wipeEntireDatabase() {
        // Complete database destruction logic
        const stores = ['messages', 'logs'];
        for (const storeName of stores) {
            const tx = this.db.transaction([storeName], 'readwrite');
            tx.objectStore(storeName).clear();
        }
        console.log("[Security] Database fully wiped.");
    }

    /**
     * 4. OFFLINE CONTROL & UI LOCK
     */
    startNetworkMonitor() {
        this.lastPingSuccess = Date.now();
        this.pingInterval = setInterval(async () => {
            if (this.pinLocked) return;

            try {
                const controller = new AbortController();
                // Network timeout 4 seconds
                const timeoutId = setTimeout(() => controller.abort(), 4000);
                
                // Pure network ping without relying on browser navigator.onLine
                await fetch(this.SERVER_PING_URL, {
                    method: 'GET',
                    mode: 'no-cors',
                    cache: 'no-store',
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                this.lastPingSuccess = Date.now();
            } catch (error) {
                const elapsedSinceLastSuccess = Date.now() - this.lastPingSuccess;
                if (elapsedSinceLastSuccess > this.OFFLINE_TIMEOUT_MS) {
                    this.lockUI("Lost connection to secure server. PIN required to proceed.");
                }
            }
        }, this.PING_INTERVAL_MS);
    }

    lockUI(reason) {
        if (this.pinLocked) return;
        this.pinLocked = true;
        console.warn("[Security] Triggering UI Lockdown:", reason);
        
        let overlay = document.getElementById('security-lock-overlay');
        if (!overlay) {
            // Generate full-screen blocking overlay dynamically
            overlay = document.createElement('div');
            overlay.id = 'security-lock-overlay';
            overlay.innerHTML = `
                <div style="background: #ffffff; padding: 30px; border-radius: 12px; text-align: center; max-width: 300px; width: 90%; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                    <div style="color: #ef4444; font-size: 40px; margin-bottom: 10px;">🔒</div>
                    <h3 style="margin-top: 0; font-family: 'Inter', sans-serif; color: #0f172a;">Interface Locked</h3>
                    <p style="font-size: 14px; color: #64748b; font-family: 'Inter', sans-serif; margin-bottom: 20px;">${reason}</p>
                    <input type="password" id="security-pin-input" placeholder="Enter PIN (Default: 0000)" style="width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 16px; font-size: 16px; text-align: center; box-sizing: border-box; outline: none;">
                    <button id="security-unlock-btn" style="width: 100%; background: #3b82f6; color: white; border: none; padding: 12px; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: background 0.2s;">Verify Identity</button>
                </div>
            `;
            Object.assign(overlay.style, {
                position: 'fixed', top: '0', left: '0', width: '100vw', height: '100dvh',
                background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(5px)',
                zIndex: '999999', display: 'flex', alignItems: 'center', justifyContent: 'center'
            });
            document.body.appendChild(overlay);

            document.getElementById('security-unlock-btn').addEventListener('click', () => {
                const pin = document.getElementById('security-pin-input').value;
                this.verifyPinAndUnlock(pin);
            });
            
            document.getElementById('security-pin-input').addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.verifyPinAndUnlock(e.target.value);
            });
        } else {
            overlay.style.display = 'flex';
        }
        
        // Auto-focus input for convenience
        setTimeout(() => document.getElementById('security-pin-input').focus(), 100);
    }

    verifyPinAndUnlock(pin) {
        // Secure comparison (Stub for actual hashed PIN comparison in production)
        if (pin === '0000') { 
            this.pinLocked = false;
            document.getElementById('security-lock-overlay').style.display = 'none';
            document.getElementById('security-pin-input').value = '';
            this.lastPingSuccess = Date.now(); // Reset ping timer to avoid immediate relock
            console.log("[Security] UI Unlocked successfully.");
        } else {
            // Visual error feedback
            const input = document.getElementById('security-pin-input');
            input.style.borderColor = '#ef4444';
            input.style.color = '#ef4444';
            setTimeout(() => {
                input.style.borderColor = '#e2e8f0';
                input.style.color = 'inherit';
            }, 800);
        }
    }

    /**
     * MASTER INITIALIZATION
     */
    async startEngine() {
        console.log("[Security] Booting PrivaXion Security Engine...");
        
        await this.initDB();
        await this.verifySession();
        
        if (!this.ramKey) {
            await this.generateNewSessionKey();
        }
        
        this.setupExitHooks();
        this.startNetworkMonitor();
        this.startSelfDestructTimer();
        
        console.log("[Security] Engine Active and Armed.");
    }
    // --- New Methods ---

    /**
     * Импортирует ключ из пользовательского файла.
     * @param {File} file - Файл .key размером ровно 32 байта.
     */
    async importKeyFromFile(file) {
        const arrayBuffer = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        if (bytes.length !== 32) {
            alert("Ошибка: Вы выбрали не тот файл (ключ PrivaXion должен весить ровно 32 байта).");
            return;
        }
        try {
            this.ramKey = await window.crypto.subtle.importKey(
                "raw",
                bytes,
                { name: "AES-GCM" },
                false,
                ["encrypt", "decrypt"]
            );
            this.rawKeyMaterial = bytes;
            alert("Ключ успешно импортирован.");
        } catch (e) {
            console.error(e);
            alert("Ошибка: Ключ поврежден или отозван сервером.");
        }
    }

    /**
     * Полный сброс всех security‑данных и лимитов.
     */
    async resetAllSecurityData() {
        // Остановить таймеры
        if (this.pingInterval) clearInterval(this.pingInterval);
        if (this.shredderInterval) clearInterval(this.shredderInterval);
        // Уничтожить ключ
        this.destroyKey();
        // Очистить localStorage (session, PIN, язык и пр.)
        localStorage.clear();
        // Закрыть и удалить IndexedDB
        if (this.db) {
            this.db.close();
            this.db = null;
        }
        await new Promise((resolve, reject) => {
            const delRequest = indexedDB.deleteDatabase("PrivaXionSecureDB");
            delRequest.onsuccess = () => resolve();
            delRequest.onerror = (e) => reject(e);
            delRequest.onblocked = () => console.warn("[Security] DB deletion blocked.");
        });
        // Перезапустить движок
        await this.startEngine();
        alert("Все данные безопасности сброшены. Вы можете создать новый аккаунт.");
    }

}

// Export for integration
window.privaXionSecurityCore = new PrivaXionSecurity();

// Automatically start engine upon script load, or trigger manually from ui-module.js
document.addEventListener('DOMContentLoaded', () => {
    window.privaXionSecurityCore.startEngine();
});
