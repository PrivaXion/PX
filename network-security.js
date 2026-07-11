/**
 * PrivaXion — Network Security & Offline Routing Core
 * 
 * Включает:
 *   1. Traffic Camouflage и Chaff Traffic (маскировка + ложный трафик)
 *   2. Metadata Stripping (удаление EXIF/GPS из JPEG/PNG)
 *   3. RAM-only Streaming (загрузка медиа в память без дискового кэша)
 *   4. Shadow-Mesh Protocol (P2P автономная маршрутизация)
 */

'use strict';

// ============================================================================
// 1. TRAFFIC CAMOUFLAGE & CHAFF TRAFFIC
// ============================================================================
class TrafficObfuscator {
    constructor() {
        this.chaffTimer = null;
        this.isChaffActive = false;
        
        // Список легитимных адресов для отвлечения внимания
        this.chaffTargets = [
            'https://en.wikipedia.org/w/api.php?action=query',
            'https://api.openweathermap.org/data/2.5/weather',
            'https://update.microsoft.com/v9/windowsupdate/redir/muv4wuredir.cab'
        ];
    }

    /**
     * Маскировка реального payload-а (WebSocket/HTTP) под легитимный HTTPS запрос.
     * Заворачиваем данные в JSON-структуру, имитирующую Windows Update или другой API.
     */
    camouflagePayload(realPayload) {
        const payloadStr = typeof realPayload === 'string' ? realPayload : JSON.stringify(realPayload);
        // Base64 encode the payload to hide binary/JSON signatures
        const encoded = btoa(unescape(encodeURIComponent(payloadStr)));
        
        return JSON.stringify({
            batchrsp: {
                ver: '1.0',
                rsp: [{
                    id: crypto.randomUUID(),
                    cache: encoded, // Реальные зашифрованные данные спрятаны здесь
                    ttl: 3600
                }]
            }
        });
    }

    /**
     * Распаковка замаскированного payload-а.
     */
    extractPayload(camouflagedPayload) {
        try {
            const parsed = JSON.parse(camouflagedPayload);
            const encoded = parsed.batchrsp.rsp[0].cache;
            return decodeURIComponent(escape(atob(encoded)));
        } catch (e) {
            console.error('[Network] Failed to extract camouflaged payload', e);
            return null;
        }
    }

    /**
     * Запуск генератора фонового ложного трафика (Chaff Traffic).
     * Усложняет тайминг-атаки и анализ размеров пакетов (Traffic Analysis).
     */
    startChaff() {
        if (this.isChaffActive) return;
        this.isChaffActive = true;
        this._scheduleChaff();
        console.info('[Network] Chaff Traffic generator started.');
    }

    stopChaff() {
        this.isChaffActive = false;
        clearTimeout(this.chaffTimer);
        console.info('[Network] Chaff Traffic generator stopped.');
    }

    _scheduleChaff() {
        if (!this.isChaffActive) return;
        // Случайный интервал от 3 до 15 секунд
        const delay = 3000 + Math.random() * 12000;
        
        this.chaffTimer = setTimeout(async () => {
            await this._sendChaffPacket();
            this._scheduleChaff();
        }, delay);
    }

    async _sendChaffPacket() {
        try {
            // Размер пустышки от 64 до 2048 байт
            const size = Math.floor(64 + Math.random() * 1984);
            const noise = new Uint8Array(size);
            crypto.getRandomValues(noise);
            
            // Шифруем случайным эфемерным ключом, чтобы энтропия соответствовала реальным данным
            const key = await crypto.subtle.generateKey({name: 'AES-GCM', length: 256}, false, ['encrypt']);
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const encryptedNoise = await crypto.subtle.encrypt({name: 'AES-GCM', iv}, key, noise);
            
            const targetUrl = this.chaffTargets[Math.floor(Math.random() * this.chaffTargets.length)];
            
            // Отправляем как 'no-cors' fire-and-forget, игнорируя ответ
            fetch(targetUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/octet-stream',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                    'X-Request-ID': crypto.randomUUID()
                },
                body: encryptedNoise,
                mode: 'no-cors',
                cache: 'no-store'
            }).catch(() => {});
        } catch (e) {
            // Глушим ошибки, чтобы не засорять консоль ложным трафиком
        }
    }
}


// ============================================================================
// 2. METADATA STRIPPING (EXIF / GPS)
// ============================================================================
class MetadataStripper {
    /**
     * Очищает файл (File/Blob) от метаданных на уровне байтов.
     * Не полагается на canvas/re-encoding, гарантируя сохранение оригинального качества.
     */
    static async strip(file) {
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        
        // Магические байты JPEG (FF D8)
        if (bytes[0] === 0xFF && bytes[1] === 0xD8) {
            const strippedBytes = this._stripJpeg(bytes);
            return new File([strippedBytes], file.name, { type: 'image/jpeg' });
        }
        
        // Магические байты PNG (89 50 4E 47)
        if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
            const strippedBytes = this._stripPng(bytes);
            return new File([strippedBytes], file.name, { type: 'image/png' });
        }
        
        // Для других форматов возвращаем как есть (или можно заблокировать)
        return file;
    }

    static _stripJpeg(bytes) {
        const segments = [];
        segments.push(new Uint8Array([0xFF, 0xD8])); // SOI маркер
        
        let offset = 2;
        while (offset < bytes.length) {
            if (bytes[offset] !== 0xFF) break;
            const marker = bytes[offset + 1];
            
            // Start of Scan (SOS) или End of Image (EOI) — начало бинарных данных изображения
            if (marker === 0xDA || marker === 0xD9) {
                segments.push(bytes.subarray(offset));
                break;
            }
            
            const segmentLength = (bytes[offset + 2] << 8) | bytes[offset + 3];
            
            // APP1..APP15 (0xE1 - 0xEF) = EXIF, XMP, IPTC и COM (0xFE) = Комментарии
            // Пропускаем (удаляем) их. APP0 (0xE0) оставляем для структуры.
            if ((marker >= 0xE1 && marker <= 0xEF) || marker === 0xFE) {
                // пропускаем сегмент
            } else {
                segments.push(bytes.subarray(offset, offset + 2 + segmentLength));
            }
            offset += 2 + segmentLength;
        }
        
        const totalLength = segments.reduce((sum, seg) => sum + seg.length, 0);
        const result = new Uint8Array(totalLength);
        let pos = 0;
        for (const seg of segments) {
            result.set(seg, pos);
            pos += seg.length;
        }
        return result;
    }

    static _stripPng(bytes) {
        const signature = bytes.subarray(0, 8);
        const segments = [signature];
        let offset = 8;
        
        // Метаданные PNG
        const forbiddenChunks = ['tEXt', 'zTXt', 'iTXt', 'tIME', 'eXIf', 'dSIG', 'cHRM', 'gAMA', 'sRGB'];
        
        while (offset < bytes.length) {
            const dataLength = (bytes[offset] << 24) | (bytes[offset+1] << 16) | (bytes[offset+2] << 8) | bytes[offset+3];
            const chunkTypeBytes = bytes.subarray(offset+4, offset+8);
            const chunkTypeStr = String.fromCharCode(...chunkTypeBytes);
            
            const fullChunkLength = 4 + 4 + dataLength + 4; // Length(4) + Type(4) + Data + CRC(4)
            
            if (!forbiddenChunks.includes(chunkTypeStr)) {
                segments.push(bytes.subarray(offset, offset + fullChunkLength));
            }
            offset += fullChunkLength;
        }
        
        const totalLength = segments.reduce((sum, seg) => sum + seg.length, 0);
        const result = new Uint8Array(totalLength);
        let pos = 0;
        for (const seg of segments) {
            result.set(seg, pos);
            pos += seg.length;
        }
        return result;
    }
}


// ============================================================================
// 3. RAM-ONLY STREAMING
// ============================================================================
class RAMMediaStreamer {
    constructor() {
        this.activeUrls = new Set();
    }

    /**
     * Потоковая загрузка медиа напрямую в RAM, обходя кэш диска.
     * @param {string} mediaUrl URL ресурса
     * @param {HTMLMediaElement} mediaElement <video> или <audio> тег
     * @param {string} mimeType Тип контента (например 'video/mp4; codecs="avc1.42E01E"')
     */
    async streamMedia(mediaUrl, mediaElement, mimeType) {
        // Если MediaSource API не поддерживается (например, старые iOS), используем полную загрузку в Blob
        if (!window.MediaSource) {
            return this._loadAsBlob(mediaUrl, mediaElement);
        }

        const mediaSource = new MediaSource();
        const objectUrl = URL.createObjectURL(mediaSource);
        this.activeUrls.add(objectUrl);
        mediaElement.src = objectUrl;

        await new Promise(resolve => {
            mediaSource.addEventListener('sourceopen', resolve, { once: true });
        });

        // Жесткий запрет кэширования
        const response = await fetch(mediaUrl, { cache: 'no-store' });
        if (!response.ok) throw new Error('Network response was not ok');

        const reader = response.body.getReader();
        const sourceBuffer = mediaSource.addSourceBuffer(mimeType);

        const appendNextChunk = async () => {
            const { done, value } = await reader.read();
            
            if (done) {
                if (!sourceBuffer.updating) mediaSource.endOfStream();
                else sourceBuffer.addEventListener('updateend', () => mediaSource.endOfStream(), { once: true });
                return;
            }

            if (sourceBuffer.updating) {
                await new Promise(resolve => sourceBuffer.addEventListener('updateend', resolve, { once: true }));
            }
            
            sourceBuffer.appendBuffer(value);
            
            sourceBuffer.addEventListener('updateend', () => {
                appendNextChunk();
            }, { once: true });
        };

        appendNextChunk();
    }

    async _loadAsBlob(mediaUrl, mediaElement) {
        const response = await fetch(mediaUrl, { cache: 'no-store' });
        const arrayBuffer = await response.arrayBuffer();
        const blob = new Blob([arrayBuffer], { type: response.headers.get('Content-Type') || 'application/octet-stream' });
        
        const objectUrl = URL.createObjectURL(blob);
        this.activeUrls.add(objectUrl);
        mediaElement.src = objectUrl;
    }

    /**
     * Уничтожает все ссылки на медиа-ресурсы в оперативной памяти.
     * Вызывать при закрытии чата или выходе из приложения.
     */
    purgeMemory() {
        for (const url of this.activeUrls) {
            URL.revokeObjectURL(url);
        }
        this.activeUrls.clear();
        console.info('[Network] RAM Streamer memory purged.');
    }
}


// ============================================================================
// 4. SHADOW-MESH PROTOCOL (Автономная P2P Маршрутизация)
// ============================================================================
class ShadowMeshProtocol {
    constructor(deviceId) {
        // Уникальный идентификатор узла в mesh-сети
        this.deviceId = deviceId || crypto.randomUUID();
        
        // Память просмотренных сообщений (Дедупликация)
        this.seenMessages = new Set();
        
        // Карта активных пиров: id -> connection_object
        this.peers = new Map();
        
        // Очистка памяти дедупликатора каждые 10 минут
        setInterval(() => {
            if (this.seenMessages.size > 5000) this.seenMessages.clear();
        }, 10 * 60 * 1000);
    }

    /**
     * Создает пакет с метаданными маршрутизации.
     */
    _buildPacket(targetId, encryptedPayload, ttl = 5) {
        return {
            msgId: crypto.randomUUID(), // Уникальный ID для дедупликации
            sender: this.deviceId,
            target: targetId,           // ID получателя (или '*' для broadcast)
            payload: encryptedPayload,
            ttl: ttl,                   // Time To Live (прыжки)
            path: [this.deviceId]       // Защита от возврата (Loop Prevention)
        };
    }

    /**
     * Отправка нового сообщения в сеть.
     */
    send(targetId, encryptedPayload) {
        const packet = this._buildPacket(targetId, encryptedPayload);
        this.seenMessages.add(packet.msgId);
        this._broadcast(packet);
        console.info(`[Mesh] Packet ${packet.msgId} sent to ${targetId}`);
    }

    /**
     * Обработчик входящего пакета от другого пира.
     */
    onReceivePacket(packetStr) {
        try {
            const packet = JSON.parse(packetStr);
            
            // 1. Дедупликация
            if (this.seenMessages.has(packet.msgId)) return;
            this.seenMessages.add(packet.msgId);

            // 2. Это для меня?
            if (packet.target === this.deviceId || packet.target === '*') {
                // Диспатч события локальному UI
                window.dispatchEvent(new CustomEvent('mesh-message-received', { detail: packet }));
            }

            // 3. Маршрутизация дальше (Relay)
            if (packet.target !== this.deviceId && packet.ttl > 1) {
                packet.ttl -= 1;
                packet.path.push(this.deviceId);
                this._broadcast(packet);
            }
        } catch (e) {
            console.error('[Mesh] Invalid packet received', e);
        }
    }

    /**
     * Рассылка пакета всем подключенным узлам (Flood routing).
     */
    _broadcast(packet) {
        const payloadStr = JSON.stringify(packet);
        const encoder = new TextEncoder();
        const dataBytes = encoder.encode(payloadStr);

        for (const [peerId, connection] of this.peers.entries()) {
            // Если узел уже есть в пути пакета, не отправляем ему обратно
            if (packet.path.includes(peerId)) continue;
            
            this._transmit(peerId, connection, dataBytes);
        }
    }

    /**
     * Низкоуровневая передача (зависит от Web Bluetooth / WebRTC).
     */
    _transmit(peerId, connection, dataBytes) {
        try {
            if (connection.type === 'ble') {
                // Передача через BLE Characteristic
                connection.characteristic.writeValue(dataBytes).catch(()=>{});
            } else if (connection.type === 'webrtc') {
                // Передача через Wi-Fi Direct / WebRTC DataChannel
                connection.channel.send(dataBytes);
            }
        } catch (e) {
            console.warn(`[Mesh] Failed to transmit to peer ${peerId}`);
        }
    }

    // Регистрация новых узлов (вызывается модулями обнаружения Bluetooth/WiFi)
    addPeer(peerId, type, connectionObj) {
        this.peers.set(peerId, { type, ...connectionObj });
        console.info(`[Mesh] Connected to peer: ${peerId} via ${type}`);
    }

    removePeer(peerId) {
        this.peers.delete(peerId);
        console.info(`[Mesh] Disconnected peer: ${peerId}`);
    }
}


// Экспорт всех модулей для использования в глобальной области видимости
window.PrivaXionNetwork = {
    TrafficObfuscator: new TrafficObfuscator(),
    MetadataStripper: MetadataStripper,
    RAMMediaStreamer: new RAMMediaStreamer(),
    ShadowMeshProtocol: ShadowMeshProtocol
};
