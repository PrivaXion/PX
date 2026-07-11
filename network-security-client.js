/**
 * PrivaXion — Клиентский сетевой модуль (Браузер / Capacitor WebView)
 * 
 * Включает:
 *   6. RAM-only Zero-Footprint Streaming (медиа в памяти)
 *   + клиентская часть Traffic Camouflage и Chaff
 */

// =========================================================================
// 6. RAM-ONLY ZERO-FOOTPRINT STREAMING
// =========================================================================

class RamOnlyMediaPlayer {
    constructor() {
        // Хранилище Blob URL → ревокация при закрытии чата
        this.activeBlobs = new Map(); // chatId -> Set<blobUrl>
    }

    /**
     * Потоковая загрузка медиа-файла напрямую в оперативную память.
     * Не записывает на диск (никакого Cache API, localStorage, IndexedDB).
     *
     * @param {string} mediaUrl — URL файла на сервере
     * @param {string} chatId  — ID активного чата
     * @returns {Promise<string>} — blob: URL для <img>, <video>, <audio>
     */
    async loadToRam(mediaUrl, chatId) {
        const response = await fetch(mediaUrl, {
            cache: 'no-store',  // Жёсткий запрет HTTP-кэша
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate',
                'Pragma': 'no-cache'
            }
        });

        if (!response.ok) throw new Error(`Ошибка загрузки: ${response.status}`);

        // Читаем поток ЦЕЛИКОМ в ArrayBuffer (RAM)
        const arrayBuffer = await response.arrayBuffer();
        const blob = new Blob([arrayBuffer], { type: response.headers.get('Content-Type') || 'application/octet-stream' });
        const blobUrl = URL.createObjectURL(blob);

        // Регистрируем blob URL для последующей очистки
        if (!this.activeBlobs.has(chatId)) {
            this.activeBlobs.set(chatId, new Set());
        }
        this.activeBlobs.get(chatId).add(blobUrl);

        return blobUrl;
    }

    /**
     * Потоковое воспроизведение видео/аудио через MediaSource API.
     * Данные поступают чанками, никогда не пишутся на диск.
     *
     * @param {HTMLMediaElement} mediaElement — элемент <video> или <audio>
     * @param {string} mediaUrl — URL на сервере
     * @param {string} mimeType — MIME-тип (например, 'video/mp4; codecs="avc1.42E01E"')
     * @param {string} chatId
     */
    async streamToRam(mediaElement, mediaUrl, mimeType, chatId) {
        if (!('MediaSource' in window)) {
            // Фоллбэк: полная загрузка в Blob
            const blobUrl = await this.loadToRam(mediaUrl, chatId);
            mediaElement.src = blobUrl;
            return;
        }

        const mediaSource = new MediaSource();
        const blobUrl = URL.createObjectURL(mediaSource);
        mediaElement.src = blobUrl;

        // Регистрируем для очистки
        if (!this.activeBlobs.has(chatId)) {
            this.activeBlobs.set(chatId, new Set());
        }
        this.activeBlobs.get(chatId).add(blobUrl);

        mediaSource.addEventListener('sourceopen', async () => {
            const sourceBuffer = mediaSource.addSourceBuffer(mimeType);
            const response = await fetch(mediaUrl, { cache: 'no-store' });
            const reader = response.body.getReader();

            const pump = async () => {
                const { done, value } = await reader.read();
                if (done) {
                    if (!sourceBuffer.updating) {
                        mediaSource.endOfStream();
                    } else {
                        sourceBuffer.addEventListener('updateend', () => mediaSource.endOfStream(), { once: true });
                    }
                    return;
                }

                // Дожидаемся готовности SourceBuffer
                if (sourceBuffer.updating) {
                    await new Promise(resolve => sourceBuffer.addEventListener('updateend', resolve, { once: true }));
                }

                sourceBuffer.appendBuffer(value);
                await new Promise(resolve => sourceBuffer.addEventListener('updateend', resolve, { once: true }));
                pump();
            };

            pump();
        });
    }

    /**
     * Закрытие чата → полная очистка всех медиа из RAM.
     * Вызывается при переключении чата или выходе.
     */
    purgeChat(chatId) {
        const blobs = this.activeBlobs.get(chatId);
        if (!blobs) return;

        for (const blobUrl of blobs) {
            URL.revokeObjectURL(blobUrl);
        }

        this.activeBlobs.delete(chatId);
        console.log(`[RAM-MEDIA] Чат ${chatId}: все медиа уничтожены из памяти.`);
    }

    /**
     * Полная очистка всех чатов (при логауте или закрытии приложения).
     */
    purgeAll() {
        for (const chatId of this.activeBlobs.keys()) {
            this.purgeChat(chatId);
        }
    }
}


// =========================================================================
// КЛИЕНТСКИЙ CHAFF TRAFFIC (Работает в браузере)
// =========================================================================

class ClientChaffTraffic {
    constructor() {
        this.timer = null;
        this.isRunning = false;
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this._schedule();
    }

    stop() {
        this.isRunning = false;
        if (this.timer) clearTimeout(this.timer);
    }

    _schedule() {
        if (!this.isRunning) return;
        // Случайный интервал от 3 до 20 секунд
        const delay = 3000 + Math.random() * 17000;

        this.timer = setTimeout(async () => {
            await this._sendNoise();
            this._schedule();
        }, delay);
    }

    async _sendNoise() {
        // Генерируем случайные байты через Web Crypto API
        const size = 64 + Math.floor(Math.random() * 1024);
        const noiseBuffer = new Uint8Array(size);
        crypto.getRandomValues(noiseBuffer);

        // Шифруем одноразовым AES-ключом
        const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt']);
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, noiseBuffer);

        // Fire-and-forget на собственный сервер (маршрут /chaff)
        try {
            await fetch('/chaff', {
                method: 'POST',
                headers: { 'Content-Type': 'application/octet-stream' },
                body: new Uint8Array(encrypted),
                cache: 'no-store'
            });
        } catch {
            // Ожидаемо: цель может не ответить
        }
    }
}


// =========================================================================
// КЛИЕНТСКИЙ TRAFFIC CAMOUFLAGE (обёртка запросов)
// =========================================================================

class ClientCamouflage {
    /**
     * Отправляет реальный payload, замаскированный под запрос к легитимному API.
     * @param {string} realEndpoint — настоящий URL на PrivaXion-сервере
     * @param {Object} realPayload  — JSON с данными
     * @returns {Promise<Object>}   — ответ сервера
     */
    static async sendCamouflaged(realEndpoint, realPayload) {
        const payloadStr = JSON.stringify(realPayload);

        // Обёртка: данные выглядят как ответ от Windows Update check-in
        const disguised = {
            batchrsp: {
                ver: '1.0',
                rsp: [{
                    id: crypto.randomUUID(),
                    cache: btoa(payloadStr),
                    ttl: 3600
                }]
            }
        };

        const response = await fetch(realEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Windows-Update-Agent/10.0.19041.1',
                'X-Request-ID': crypto.randomUUID()
            },
            body: JSON.stringify(disguised),
            cache: 'no-store'
        });

        const responseData = await response.json();

        // Разворачиваем ответ (сервер тоже камуфлирует)
        if (responseData.batchrsp) {
            return JSON.parse(atob(responseData.batchrsp.rsp[0].cache));
        }
        return responseData;
    }
}


// =========================================================================
// ЭКСПОРТ (для использования в <script> или ESM)
// =========================================================================

window.RamOnlyMediaPlayer = RamOnlyMediaPlayer;
window.ClientChaffTraffic = ClientChaffTraffic;
window.ClientCamouflage = ClientCamouflage;
