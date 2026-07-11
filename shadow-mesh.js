/**
 * PrivaXion — Shadow-Mesh Protocol (Автономная Mesh-сеть)
 * 
 * Логика обнаружения устройств и передачи сообщений
 * через Bluetooth / Wi-Fi Direct без интернета.
 *
 * Для Electron (десктоп): использует Web Bluetooth API.
 * Для Capacitor (Android): использует Capacitor Bluetooth / Wi-Fi Direct плагины.
 *
 * Архитектура:
 *   Каждое устройство — узел Mesh-сети. Сообщение передаётся по цепочке
 *   от узла к узлу (multi-hop relay), пока не достигнет получателя.
 *   Дублирование предотвращается через messageId (уже виденные ID отбрасываются).
 */

const crypto = require('crypto');

// =========================================================================
// 4. SHADOW-MESH PROTOCOL
// =========================================================================

class ShadowMeshProtocol {
    /**
     * @param {Object} opts
     * @param {string} opts.deviceId  — уникальный ID этого узла
     * @param {number} opts.ttl       — максимальное количество прыжков (hops)
     * @param {Function} opts.onMessageReceived — колбэк при получении сообщения для нас
     * @param {Function} opts.onPeerDiscovered   — колбэк при обнаружении нового пира
     */
    constructor(opts = {}) {
        this.deviceId = opts.deviceId || crypto.randomBytes(8).toString('hex');
        this.maxTTL = opts.ttl || 5;
        this.onMessageReceived = opts.onMessageReceived || (() => {});
        this.onPeerDiscovered = opts.onPeerDiscovered || (() => {});

        // Множество уже обработанных сообщений (защита от зацикливания)
        this.seenMessages = new Set();

        // Карта известных пиров: peerId → { lastSeen, rssi, connection }
        this.peers = new Map();

        // Очередь исходящих сообщений (для offline retry)
        this.outbox = [];

        // Таймер очистки старых seenMessages (чтобы Set не рос бесконечно)
        setInterval(() => {
            if (this.seenMessages.size > 10000) {
                this.seenMessages.clear();
            }
        }, 5 * 60 * 1000);
    }

    // ─── Формат сообщения ────────────────────────────────────────────────

    /**
     * Создаёт Mesh-пакет.
     * @param {string} recipientId — ID получателя (или '*' для broadcast)
     * @param {string} payload     — текст сообщения (уже зашифрованный E2E)
     */
    createPacket(recipientId, payload) {
        return {
            id: crypto.randomUUID(),
            from: this.deviceId,
            to: recipientId,
            payload: payload,
            ttl: this.maxTTL,
            timestamp: Date.now(),
            hops: [this.deviceId]
        };
    }

    // ─── Обработка входящего пакета ──────────────────────────────────────

    /**
     * Вызывается при получении пакета от любого пира (BT/WiFi).
     * Решает: доставить локально или переслать дальше по цепочке.
     */
    handleIncomingPacket(packet) {
        // 1. Уже видели это сообщение? → Отбрасываем (анти-петля)
        if (this.seenMessages.has(packet.id)) return;
        this.seenMessages.add(packet.id);

        // 2. TTL исчерпан? → Дропаем
        if (packet.ttl <= 0) return;

        // 3. Сообщение адресовано нам?
        if (packet.to === this.deviceId || packet.to === '*') {
            this.onMessageReceived(packet);
        }

        // 4. Relay: если TTL > 0 и мы не конечный получатель, пересылаем дальше
        if (packet.to !== this.deviceId || packet.to === '*') {
            this._relayPacket(packet);
        }
    }

    /**
     * Пересылка пакета всем известным пирам (кроме отправителя и тех, кто уже в hops).
     */
    _relayPacket(packet) {
        const relayed = {
            ...packet,
            ttl: packet.ttl - 1,
            hops: [...packet.hops, this.deviceId]
        };

        for (const [peerId, peerInfo] of this.peers) {
            // Не отправляем обратно отправителю и узлам, через которые пакет уже прошёл
            if (relayed.hops.includes(peerId)) continue;

            this._sendToPeer(peerId, relayed);
        }
    }

    // ─── Отправка сообщения ──────────────────────────────────────────────

    /**
     * Главный метод отправки текстового сообщения.
     * @param {string} recipientId — ID получателя
     * @param {string} encryptedPayload — зашифрованные E2E данные
     */
    send(recipientId, encryptedPayload) {
        const packet = this.createPacket(recipientId, encryptedPayload);
        this.seenMessages.add(packet.id);

        if (this.peers.size === 0) {
            // Нет пиров — в очередь
            this.outbox.push(packet);
            console.log(`[MESH] Нет пиров. Пакет ${packet.id} в очереди.`);
            return;
        }

        for (const [peerId] of this.peers) {
            this._sendToPeer(peerId, packet);
        }
    }

    /**
     * Отправка пакета конкретному пиру (абстрактный транспорт).
     * Реальная реализация зависит от платформы (BT/WiFi Direct).
     */
    _sendToPeer(peerId, packet) {
        const peerInfo = this.peers.get(peerId);
        if (!peerInfo || !peerInfo.connection) {
            console.warn(`[MESH] Пир ${peerId} отключен, пропуск.`);
            return;
        }

        const data = JSON.stringify(packet);

        try {
            // === Bluetooth (Web Bluetooth API) ===
            if (peerInfo.connection.type === 'bluetooth') {
                const characteristic = peerInfo.connection.characteristic;
                const encoder = new TextEncoder();
                // Разбиваем на чанки по 512 байт (ограничение BLE)
                const chunks = this._chunkBuffer(encoder.encode(data), 512);
                for (const chunk of chunks) {
                    characteristic.writeValue(chunk);
                }
            }

            // === Wi-Fi Direct (через TCP сокет) ===
            if (peerInfo.connection.type === 'wifi-direct') {
                const socket = peerInfo.connection.socket;
                socket.write(data + '\n'); // Разделитель — символ новой строки
            }

            console.log(`[MESH] → Отправлен пакет ${packet.id.slice(0, 8)}... → ${peerId.slice(0, 8)}`);
        } catch (err) {
            console.error(`[MESH] Ошибка отправки к ${peerId}:`, err.message);
        }
    }

    // ─── Обнаружение пиров ───────────────────────────────────────────────

    /**
     * Регистрирует нового обнаруженного пира (вызывается из транспорта BT/WiFi).
     */
    registerPeer(peerId, connection) {
        this.peers.set(peerId, {
            lastSeen: Date.now(),
            connection: connection
        });

        this.onPeerDiscovered(peerId);
        console.log(`[MESH] Пир обнаружен: ${peerId}. Всего пиров: ${this.peers.size}`);

        // Сбрасываем очередь исходящих на нового пира
        this._flushOutbox(peerId);
    }

    /**
     * Удаляет пира (отключился или вышел из зоны).
     */
    removePeer(peerId) {
        this.peers.delete(peerId);
        console.log(`[MESH] Пир отключен: ${peerId}. Осталось: ${this.peers.size}`);
    }

    /**
     * Отправляем все накопившиеся сообщения из очереди.
     */
    _flushOutbox(peerId) {
        while (this.outbox.length > 0) {
            const packet = this.outbox.shift();
            this._sendToPeer(peerId, packet);
        }
    }

    // ─── Утилиты ─────────────────────────────────────────────────────────

    _chunkBuffer(buffer, chunkSize) {
        const chunks = [];
        for (let i = 0; i < buffer.length; i += chunkSize) {
            chunks.push(buffer.slice(i, i + chunkSize));
        }
        return chunks;
    }

    /**
     * Статус текущего узла.
     */
    getStatus() {
        return {
            deviceId: this.deviceId,
            peersConnected: this.peers.size,
            outboxSize: this.outbox.length,
            seenMessagesCount: this.seenMessages.size
        };
    }
}


// =========================================================================
// BLUETOOTH DISCOVERY (Обёртка для Web Bluetooth / Capacitor BLE)
// =========================================================================

class BluetoothMeshTransport {
    static MESH_SERVICE_UUID = '12345678-1234-5678-1234-56789abcdef0';
    static MESH_CHAR_UUID = '12345678-1234-5678-1234-56789abcdef1';

    /**
     * Сканирование BLE-устройств с Mesh-сервисом PrivaXion.
     * @param {ShadowMeshProtocol} mesh — экземпляр протокола
     */
    static async discoverPeers(mesh) {
        if (!navigator.bluetooth) {
            console.warn('[BT] Web Bluetooth API недоступен.');
            return;
        }

        try {
            const device = await navigator.bluetooth.requestDevice({
                filters: [{ services: [BluetoothMeshTransport.MESH_SERVICE_UUID] }]
            });

            const server = await device.gatt.connect();
            const service = await server.getPrimaryService(BluetoothMeshTransport.MESH_SERVICE_UUID);
            const characteristic = await service.getCharacteristic(BluetoothMeshTransport.MESH_CHAR_UUID);

            // Регистрируем пир в Mesh
            const peerId = device.id || device.name || 'bt-' + Date.now();
            mesh.registerPeer(peerId, {
                type: 'bluetooth',
                characteristic: characteristic,
                device: device
            });

            // Подписываемся на входящие данные
            await characteristic.startNotifications();
            let incomingBuffer = '';

            characteristic.addEventListener('characteristicvaluechanged', (event) => {
                const decoder = new TextDecoder();
                incomingBuffer += decoder.decode(event.target.value);

                // Пробуем распарсить JSON (может прийти несколькими чанками)
                try {
                    const packet = JSON.parse(incomingBuffer);
                    incomingBuffer = '';
                    mesh.handleIncomingPacket(packet);
                } catch {
                    // Ещё не все чанки получены, ждём
                }
            });

            device.addEventListener('gattserverdisconnected', () => {
                mesh.removePeer(peerId);
            });

        } catch (err) {
            console.error('[BT] Ошибка обнаружения:', err.message);
        }
    }
}


// =========================================================================
// Wi-Fi Direct DISCOVERY (Electron / Node.js TCP)
// =========================================================================

class WiFiDirectMeshTransport {
    /**
     * Запуск TCP-сервера для приёма Mesh-подключений по Wi-Fi Direct.
     * @param {ShadowMeshProtocol} mesh
     * @param {number} port — порт для прослушивания (по умолчанию 19200)
     */
    static startListener(mesh, port = 19200) {
        const net = require('net');

        const server = net.createServer((socket) => {
            const peerId = `${socket.remoteAddress}:${socket.remotePort}`;

            mesh.registerPeer(peerId, {
                type: 'wifi-direct',
                socket: socket
            });

            let buffer = '';
            socket.on('data', (data) => {
                buffer += data.toString();
                const lines = buffer.split('\n');
                buffer = lines.pop(); // Остаток (неполная строка)

                for (const line of lines) {
                    if (line.trim()) {
                        try {
                            const packet = JSON.parse(line);
                            mesh.handleIncomingPacket(packet);
                        } catch {
                            // Невалидный пакет, игнорируем
                        }
                    }
                }
            });

            socket.on('close', () => mesh.removePeer(peerId));
            socket.on('error', () => mesh.removePeer(peerId));
        });

        server.listen(port, '0.0.0.0', () => {
            console.log(`[MESH-WIFI] Слушаю Wi-Fi Direct подключения на :${port}`);
        });

        return server;
    }

    /**
     * Подключение к известному пиру по IP (Wi-Fi Direct).
     */
    static connectToPeer(mesh, peerHost, peerPort = 19200) {
        const net = require('net');

        const socket = net.connect(peerPort, peerHost, () => {
            const peerId = `${peerHost}:${peerPort}`;
            mesh.registerPeer(peerId, {
                type: 'wifi-direct',
                socket: socket
            });

            let buffer = '';
            socket.on('data', (data) => {
                buffer += data.toString();
                const lines = buffer.split('\n');
                buffer = lines.pop();

                for (const line of lines) {
                    if (line.trim()) {
                        try {
                            const packet = JSON.parse(line);
                            mesh.handleIncomingPacket(packet);
                        } catch { /* пропуск */ }
                    }
                }
            });

            socket.on('close', () => mesh.removePeer(peerId));
            socket.on('error', () => mesh.removePeer(peerId));
        });
    }
}


// =========================================================================
// ЭКСПОРТ
// =========================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ShadowMeshProtocol, WiFiDirectMeshTransport };
}
if (typeof window !== 'undefined') {
    window.ShadowMeshProtocol = ShadowMeshProtocol;
    window.BluetoothMeshTransport = BluetoothMeshTransport;
}
