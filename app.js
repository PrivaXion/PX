/**
 * PrivaXion - GLOBAL: Полная логика приложения
 * - Капча (искажённый текст на Canvas)
 * - Регистрация с уникальным ником (localStorage)
 * - Вход / авто-вход
 * - Навигация между разделами
 * - Профиль: аватар с компрессией, ID
 * - Поиск по ID
 * - Система чатов (локальная, в памяти)
 */

document.addEventListener('DOMContentLoaded', () => {

    // ==================================================================
    // ИНФОРМАЦИОННЫЕ ЛОГИ О БЕЗОПАСНОСТИ
    // ==================================================================
    console.log('%c🔐 PrivaXion GLOBAL - Система безопасности активна', 'color: #00ffaa; font-weight: bold; font-size: 14px;');
    console.log('%c✅ Anti-DevTools: F12, F7, F6, Ctrl+Shift+I, Ctrl+Shift+J, Cmd+Option+I заблокированы', 'color: #00ffaa; font-size: 12px;');
    console.log('%c✅ Тройное шифрование: включено (версия 3)', 'color: #00ffaa; font-size: 12px;');
    console.log('%c✅ IP блокирование: включено (5+ неудачных попыток = бан)', 'color: #00ffaa; font-size: 12px;');
    console.log('%c⚠️  Попытка открыть DevTools приведет к logout и блокировке IP', 'color: #ff3b5c; font-size: 12px;');
    console.log('%c📱 Помните: Все ваши сообщения зашифрованы 3 слоями защиты', 'color: #8393a8; font-size: 12px;');
    console.log('');

    // ==================================================================
    // API HELPERS (json-server на порту 8081)
    // ==================================================================
    const API_BASE = 'http://localhost:8081';

    async function apiGet(path) {
        const res = await fetch(`${API_BASE}/${path}`);
        if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
        return res.json();
    }

    async function apiPost(path, data) {
        const res = await fetch(`${API_BASE}/${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
        return res.json();
    }

    async function apiPatch(path, data) {
        const res = await fetch(`${API_BASE}/${path}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error(`PATCH ${path} failed: ${res.status}`);
        return res.json();
    }

    async function apiDelete(path) {
        const res = await fetch(`${API_BASE}/${path}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(`DELETE ${path} failed: ${res.status}`);
        return true;
    }

    // ==================================================================
    // СИСТЕМА БЕЗОПАСНОСТИ: АНТИ-СКАЧИВАНИЕ, БЛОКИРОВКА DEVTOOLS, IP
    // ==================================================================

    /** Получить IP адрес устройства */
    async function getIPAddress() {
        try {
            const res = await fetch('https://api.ipify.org?format=json');
            const data = await res.json();
            return data.ip;
        } catch (e) {
            return 'UNKNOWN_IP';
        }
    }

    /** Система отслеживания заблокированных IP */
    let blockedIPs = JSON.parse(localStorage.getItem('px_blocked_ips') || '[]');
    
    function addBlockedIP(ip, reason = 'Множественные неудачные попытки расшифровки') {
        if (!blockedIPs.includes(ip)) {
            blockedIPs.push(ip);
            localStorage.setItem('px_blocked_ips', JSON.stringify(blockedIPs));
            console.warn(`⛔ IP ${ip} заблокирован: ${reason}`);
            
            // Показываем модальное окно блокировки
            showSecurityLockdown(ip, reason);
            
            showToast(`⛔ IP заблокирован: ${reason}`, 'error');
        }
    }

    /** Показать модальное окно блокировки */
    function showSecurityLockdown(ip, reason) {
        const modal = document.getElementById('security-lockdown-modal');
        if (!modal) return;
        
        document.getElementById('blocked-ip').textContent = ip;
        document.getElementById('block-reason').textContent = reason;
        document.getElementById('block-time').textContent = new Date().toLocaleString('ru-RU');
        
        modal.classList.remove('hidden');
        
        // Блокируем весь интерфейс
        setTimeout(() => {
            logout();
        }, 3000);
    }

    function isIPBlocked(ip) {
        return blockedIPs.includes(ip);
    }

    /** Лимит аккаунтов на одно устройство (device_id в localStorage) */
    function getOrCreateDeviceId() {
        let deviceId = localStorage.getItem('px_device_id');
        if (!deviceId) {
            deviceId = 'dev_' + Math.random().toString(36).slice(2) + '_' + Date.now().toString(36);
            localStorage.setItem('px_device_id', deviceId);
        }
        return deviceId;
    }

    function countUsersOnThisDevice(deviceId) {
        // localStorage в виде: px_registered_devices = { [deviceId]: number }
        const map = JSON.parse(localStorage.getItem('px_registered_devices') || '{}');
        return map[deviceId] || 0;
    }

    function setUsersOnThisDevice(deviceId, nextCount) {
        const map = JSON.parse(localStorage.getItem('px_registered_devices') || '{}');
        map[deviceId] = nextCount;
        localStorage.setItem('px_registered_devices', JSON.stringify(map));
    }

    function canRegisterMoreAccountsOnDevice(deviceId, limit = 2) {
        return countUsersOnThisDevice(deviceId) < limit;
    }

    /** Система отслеживания попыток взлома */
    let decryptionAttempts = {}; // { ip: [{ time, key, success }] }

    async function logDecryptionAttempt(key, success) {
        const ip = await getIPAddress();
        if (!decryptionAttempts[ip]) {
            decryptionAttempts[ip] = [];
        }
        decryptionAttempts[ip].push({ time: Date.now(), key, success });
        
        // Если 5 неудачных попыток подряд - блокируем
        const recentAttempts = decryptionAttempts[ip].slice(-5);
        const failedAttempts = recentAttempts.filter(a => !a.success).length;
        
        if (failedAttempts === 5) {
            addBlockedIP(ip, '5 неудачных попыток расшифровки');
            localStorage.setItem('px_decryption_attempts', JSON.stringify(decryptionAttempts));
            return { blocked: true, ip };
        }
        
        localStorage.setItem('px_decryption_attempts', JSON.stringify(decryptionAttempts));
        return { blocked: false, ip };
    }

    // ==================================================================
    // АНТИ-F12, F7, F6, СКАЧИВАНИЕ И ИНСПЕКТИРОВАНИЕ
    // ==================================================================

    let devtoolsOpenAttempts = 0;

    // Блокировка F12, F7, F6 и других клавиш для открытия DevTools
    document.addEventListener('keydown', async (e) => {
        // F12 - основные DevTools
        if (e.key === 'F12' || e.code === 'F12') {
            e.preventDefault();
            devtoolsOpenAttempts++;
            showToast('❌ DevTools заблокированы! Попытка ' + devtoolsOpenAttempts, 'error');
            if (devtoolsOpenAttempts > 3) {
                const ip = await getIPAddress();
                addBlockedIP(ip, 'Многократные попытки открыть DevTools');
                logout();
            }
            return false;
        }

        // F7 - отладка потока выполнения
        if (e.key === 'F7' || e.code === 'F7') {
            e.preventDefault();
            devtoolsOpenAttempts++;
            showToast('❌ Отладка заблокирована (F7)! Попытка ' + devtoolsOpenAttempts, 'error');
            if (devtoolsOpenAttempts > 3) {
                const ip = await getIPAddress();
                addBlockedIP(ip, 'Попытки открыть отладку (F7)');
                logout();
            }
            return false;
        }

        // F6 - адресная строка/поиск
        if (e.key === 'F6' || e.code === 'F6') {
            e.preventDefault();
            devtoolsOpenAttempts++;
            showToast('❌ Функция F6 заблокирована! Попытка ' + devtoolsOpenAttempts, 'error');
            if (devtoolsOpenAttempts > 3) {
                const ip = await getIPAddress();
                addBlockedIP(ip, 'Попытки использовать F6');
                logout();
            }
            return false;
        }

        // Ctrl+Shift+I - альтернатива F12 (Windows/Linux)
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'I') {
            e.preventDefault();
            devtoolsOpenAttempts++;
            showToast('❌ DevTools заблокированы (Ctrl+Shift+I)! Попытка ' + devtoolsOpenAttempts, 'error');
            if (devtoolsOpenAttempts > 3) {
                const ip = await getIPAddress();
                addBlockedIP(ip, 'Попытки открыть DevTools (Ctrl+Shift+I)');
                logout();
            }
            return false;
        }

        // Ctrl+Shift+J - консоль
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'J') {
            e.preventDefault();
            devtoolsOpenAttempts++;
            showToast('❌ Консоль заблокирована! Попытка ' + devtoolsOpenAttempts, 'error');
            if (devtoolsOpenAttempts > 3) {
                const ip = await getIPAddress();
                addBlockedIP(ip, 'Попытки открыть консоль');
                logout();
            }
            return false;
        }

        // Cmd+Option+I - DevTools на Mac
        if (e.metaKey && e.altKey && e.key === 'I') {
            e.preventDefault();
            devtoolsOpenAttempts++;
            showToast('❌ DevTools заблокированы (Cmd+Option+I)! Попытка ' + devtoolsOpenAttempts, 'error');
            if (devtoolsOpenAttempts > 3) {
                const ip = await getIPAddress();
                addBlockedIP(ip, 'Попытки открыть DevTools (Mac)');
                logout();
            }
            return false;
        }
    });

    // Блокировка правого клика (но не полностью, только в критичных местах)
    document.addEventListener('contextmenu', (e) => {
        // Позволяем контекстное меню только для сообщений (реакции)
        if (!e.target.closest('.message') && !e.target.closest('.msg-bubble')) {
            e.preventDefault();
            showToast('❌ Инспектирование заблокировано!', 'error');
        }
    });

    // Блокировка Ctrl+S (сохранение)
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            showToast('❌ Сохранение страницы запрещено!', 'error');
            return false;
        }
    });

    // Блокировка переноса/копирования критичного контента (опционально)
    // document.addEventListener('copy', (e) => {
    //     const selected = window.getSelection().toString();
    //     if (selected.length > 100) {
    //         e.preventDefault();
    //         showToast('⚠️ Массовое копирование запрещено!', 'error');
    //     }
    // });

    // Проверка DevTools открыта ли по величине окна
    setInterval(() => {
        if (window.outerHeight - window.innerHeight > 200 || window.outerWidth - window.innerWidth > 200) {
            devtoolsOpenAttempts++;
            if (devtoolsOpenAttempts > 5) {
                console.clear();
                showToast('❌ DevTools обнаружены! Сеанс будет завершен...', 'error');
                setTimeout(() => logout(), 2000);
            }
        }
    }, 1000);

    // ==================================================================
    // ТРОЙНОЕ ШИФРОВАНИЕ С ФЕЙКОВЫМИ КЛЮЧАМИ
    // ==================================================================

    /**
     * Генерирует поддельный ключ похожий на настоящий (для обмана при взломе)
     */
    function generateFakeKey(realKey) {
        let fakeKey = '';
        for (let i = 0; i < realKey.length; i++) {
            const char = realKey.charCodeAt(i);
            // Смещение на случайное число для фейка
            fakeKey += String.fromCharCode(char ^ (Math.random() * 255 | 0));
        }
        return btoa(fakeKey); // Кодируем Base64
    }

    /**
     * Создает метаданные с фейковым ключом для трехслойной защиты
     */
    function getKeyMetadata(realKey) {
        return {
            realKeyHash: realKey.substring(0, 10), // Хеш настоящего ключа (не сам ключ!)
            fakeKey: generateFakeKey(realKey),
            timestamp: Date.now(),
            version: 3 // Версия тройного шифрования
        };
    }

    /**
     * Тройное шифрование текста (СИНХРОННОЕ)
     * Использует реальный ключ + добавляет слой фейковых данных
     */
    function encryptMessageTriple(text, realKey) {
        if (!text) return '';
        
        // Слой 1: основное шифрование с реальным ключом
        let layer1 = '';
        for (let i = 0; i < text.length; i++) {
            layer1 += String.fromCharCode(text.charCodeAt(i) ^ realKey.charCodeAt(i % realKey.length));
        }
        
        // Слой 2: добавляем метаданные с фейковым ключом
        const metadata = getKeyMetadata(realKey);
        const layer2Data = {
            encrypted: btoa(unescape(encodeURIComponent(layer1))),
            meta: metadata
        };
        
        // Слой 3: финальный Base64 слой
        const finalEncrypted = btoa(unescape(encodeURIComponent(JSON.stringify(layer2Data))));
        
        return finalEncrypted;
    }

    /**
     * Тройное дешифрование (СИНХРОННОЕ - для локального использования)
     * Проверка IP происходит асинхронно в отдельной функции
     */
    function decryptMessageTriple(encText, realKey) {
        if (!encText) return '';
        
        try {
            // Слой 3: убираем финальный Base64
            const layer2Str = decodeURIComponent(escape(atob(encText)));
            const layer2Data = JSON.parse(layer2Str);
            
            // Проверка версии шифрования
            if (layer2Data.meta && layer2Data.meta.version !== 3) {
                console.warn('⚠️ Неправильная версия шифрования! Возвращаю исходный текст.');
                return encText;
            }
            
            // Слой 2: проверяем хеш настоящего ключа
            const expectedHash = realKey.substring(0, 10);
            if (layer2Data.meta && layer2Data.meta.realKeyHash !== expectedHash) {
                console.warn('⚠️ Неправильный ключ! Возвращаю сообщение об ошибке.');
                // Логируем попытку в фон (асинхронно)
                logDecryptionAttempt('WRONG_KEY', false).catch(() => {});
                return '🔐 [Сообщение зашифровано неправильным ключом]';
            }
            
            // Слой 1: расшифровываем с настоящим ключом
            let decrypted = decodeURIComponent(escape(atob(layer2Data.encrypted)));
            let result = '';
            for (let i = 0; i < decrypted.length; i++) {
                result += String.fromCharCode(decrypted.charCodeAt(i) ^ realKey.charCodeAt(i % realKey.length));
            }
            
            // Логируем успешную попытку (асинхронно)
            logDecryptionAttempt(realKey.substring(0, 5) + '...', true).catch(() => {});
            return result;
            
        } catch(e) {
            console.error('Ошибка расшифрования:', e);
            logDecryptionAttempt('DECRYPT_ERROR', false).catch(() => {});
            return encText;
        }
    }

    /** Зашифровать сообщение с использованием XOR + Base64 */
    function encryptMessage(text, key) {
        if (!text) return '';
        let enc = '';
        for (let i = 0; i < text.length; i++) {
            enc += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
        }
        return btoa(unescape(encodeURIComponent(enc)));
    }

    /** Расшифровать сообщение */
    function decryptMessage(encText, key) {
        if (!encText) return '';
        try {
            let dec = decodeURIComponent(escape(atob(encText)));
            let res = '';
            for (let i = 0; i < dec.length; i++) {
                res += String.fromCharCode(dec.charCodeAt(i) ^ key.charCodeAt(i % key.length));
            }
            return res;
        } catch(e) {
            return encText;
        }
    }

    /** Сформировать уникальный E2E ключ канала на основе имен пользователей */
    function getChannelKey(userA, userB) {
        const sorted = [userA.toLowerCase(), userB.toLowerCase()].sort();
        return `px_secret_${sorted[0]}_${sorted[1]}`;
    }

    /** Простой XOR шифр для скачиваемого JSON пароля */
    function encryptPassword(password) {
        const key = "PrivaXionSecureKey";
        let result = "";
        for (let i = 0; i < password.length; i++) {
            const charCode = password.charCodeAt(i) ^ key.charCodeAt(i % key.length);
            result += String.fromCharCode(charCode);
        }
        return btoa(unescape(encodeURIComponent(result)));
    }

    /** Загрузить чаты пользователя и дешифровать их */
    function loadUserChats(username) {
        const stored = localStorage.getItem(`px_chats_${username.toLowerCase()}`);
        if (!stored) {
            chats = {};
            return;
        }
        try {
            const encryptedChats = JSON.parse(stored);
            chats = {};
            for (const otherUser in encryptedChats) {
                chats[otherUser] = encryptedChats[otherUser].map(msg => {
                    const key = getChannelKey(username, otherUser);
                    return {
                        from: msg.from,
                        time: msg.time,
                        text: msg.useTripleEncryption 
                            ? decryptMessageTriple(msg.text, key) // Новое тройное шифрование
                            : decryptMessage(msg.text, key), // Старое шифрование для совместимости
                        id: msg.id || 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                        status: msg.status || 'sent',
                        replyTo: msg.replyTo || null,
                        reactions: msg.reactions || {}
                    };
                });
            }
        } catch (e) {
            console.error("Ошибка дешифрования чатов:", e);
            chats = {};
        }
    }

    // ==================================================================
    // ЦЕНЗУРА МАТОВ (chat + опционально в будущем)
    // ==================================================================

    // список матов (ru/en) — >50 слов: базовый набор (можно расширить)
    const MATS = [
        // RU (грубые)
        'пидор','пидорас','пидорашка','педик','педора','педрил','петух','шлюха','шлюхи','шлюш','шмара','проститутка',
        'сука','суки','сучара','сучёнок','урод','уроды','отморозок',
        'ебать','ебу','ебёшь','ебёт','ебут','ебись','ёб','ёбни','ёбище','ебаный','ебан','ебанутый','ебучий','ебучка',
        'нахуй','на хуй','хуй','хуи','хуя','хуйня','вхуй','опущенный','опущен','опущенная',
        'блядь','бляди','бля','блят','пизда','пизды','пиздец','пиздёж','пиздить','пиздишь','пиздит',
        'гондон','гондоны','мразь','мрази','тварь','твари','долбоёб','долбоеб','дебил','тупица','идиот','идиоты',
        'еблан','ебланка','козёл','козлы','козлина','сраный','срать','срань',
        // EN
        'fuck','fucks','fucked','fucking','motherfucker','motherfuckers','shit','shits','shitty','bitch','bitches','bastard','asshole',
        'ass','dick','dicks','cunt','cunts','douche','douchebag','dickhead','dumbass','jackass','whore','whores','slut','sluts',
        'cock','cocks','pussy','pussies','bastards'
    ];

    function normalizeForCensor(s) {
        if (typeof s !== 'string') return '';
        // приводим к нижнему, убираем лишние пробелы
        return s.toLowerCase();
    }

    function isUser18Plus(user) {
        if (!user || !user.birthDate) return false;
        const birth = new Date(user.birthDate);
        if (Number.isNaN(birth.getTime())) return false;
        const now = new Date();
        let ageYears = now.getFullYear() - birth.getFullYear();
        const m = now.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) ageYears--;
        return ageYears >= 18;
    }

    function getCensorToggle() {
        // в localStorage храним "true"/"false"
        return localStorage.getItem('px_censor_mats') === 'true';
    }

    function shouldCensorTextForCurrentUser() {
        const user18 = isUser18Plus(currentUser);
        if (!user18) return true; // <18 всегда цензура
        // 18+ зависит от переключателя
        return getCensorToggle();
    }

    function censorTextIfNeeded(text) {
        if (!text) return text;
        if (!shouldCensorTextForCurrentUser()) return text;

        let out = text;

        // Простая подмена по словам (без сложного морфинга)
        // Т.к. задача фронтенд-демо, делаем regex с границами слова где возможно.
        // Для фраз типа "на хуй" — тоже попробуем.
        const patterns = MATS
            .map(w => w.trim())
            .filter(Boolean)
            .map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

        // Сначала заменяем много-словные выражения как строки, чтобы не ломать границы.
        patterns.forEach((p) => {
            const re = new RegExp(p, 'gi');
            out = out.replace(re, '***');
        });

        return out;
    }

    /** Зашифровать чаты и сохранить в localStorage */
    function saveUserChats(username) {
        const encryptedChats = {};
        for (const otherUser in chats) {
            encryptedChats[otherUser] = chats[otherUser].map(msg => {
                const key = getChannelKey(username, otherUser);
                // Используем новое тройное шифрование для новых сообщений
                const encryptedText = encryptMessageTriple(msg.text, key);
                return {
                    from: msg.from,
                    time: msg.time,
                    text: encryptedText,
                    id: msg.id,
                    status: msg.status,
                    replyTo: msg.replyTo,
                    reactions: msg.reactions,
                    useTripleEncryption: true // Флаг что это тройное шифрование
                };
            });
        }
        localStorage.setItem(`px_chats_${username.toLowerCase()}`, JSON.stringify(encryptedChats));
    }

    /** Управление непрочитанными сообщениями */
    let unreadCounts = {};

    function loadUnreadCounts(username) {
        const stored = localStorage.getItem(`px_unread_${username.toLowerCase()}`);
        unreadCounts = stored ? JSON.parse(stored) : {};
    }

    function saveUnreadCounts(username) {
        localStorage.setItem(`px_unread_${username.toLowerCase()}`, JSON.stringify(unreadCounts));
    }

    function incrementUnread(username) {
        unreadCounts[username] = (unreadCounts[username] || 0) + 1;
        saveUnreadCounts(currentUser.username);
        renderChatList();
    }

    /** Показать всплывающее Toast уведомление */
    function showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = 'toast';
        if (type === 'error') {
            toast.style.borderColor = 'var(--error-color)';
            toast.style.boxShadow = '0 10px 25px rgba(255, 59, 92, 0.2)';
        }
        toast.innerHTML = `<span>${type === 'error' ? '❌' : '✓'}</span> ${message}`;
        container.appendChild(toast);
        setTimeout(() => {
            toast.remove();
        }, 3800);
    }

    /** Получить название устройства */
    function getDeviceName() {
        const ua = navigator.userAgent;
        if (/android/i.test(ua)) return "Android Device";
        if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) return "iOS Device";
        if (/Macintosh/i.test(ua)) return "macOS Computer";
        if (/Windows/i.test(ua)) return "Windows PC";
        if (/Linux/i.test(ua)) return "Linux PC";
        return "Unknown Device";
    }

    /** Получить текущий IP-адрес */
    async function getIPAddress() {
        try {
            const res = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(3000) });
            const data = await res.json();
            return data.ip;
        } catch (e) {
            return '127.0.0.1 (Локальный)';
        }
    }

    // Create a new session record for the user via API.
    async function createSession(username) {
      const users = await getUsers();
      const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
      if (!user) return null;

      const sessionId = 'sess_' + Math.random().toString(36).substr(2, 9);
      const device = getDeviceName();
      const ip = await getIPAddress();
      const loginTime = new Date().toLocaleString('ru-RU');

      const newSession = { id: sessionId, ip, device, loginTime };
      if (chatSendBtn) {
        chatSendBtn.addEventListener('click', () => {
            const val = chatInput.value.trim();
            if (val) {
                sendMsg(val);
                chatInput.value = '';
            }
        });
    }

    // Attach File Logic
    const chatAttachBtn = document.getElementById('chat-attach-btn');
    if (chatAttachBtn) {
        chatAttachBtn.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const maxSize = 4 * 1024 * 1024 * 1024; // 4GB
                if (file.size > maxSize) {
                    showToast('Файл слишком большой! Максимальный размер 4 ГБ.', 'error');
                    return;
                }
                
                const dangerousExtensions = ['.exe', '.bat', '.cmd', '.sh', '.vbs', '.js', '.ps1', '.scr', '.pif'];
                const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
                if (dangerousExtensions.includes(ext)) {
                    showToast('Антивирус PrivaXion: Обнаружен потенциально опасный файл! Отправка заблокирована.', 'error');
                    return;
                } else {
                    showToast('Антивирус PrivaXion: Файл безопасен, отправка...', 'success');
                }
                
                if (file.size > 5 * 1024 * 1024) {
                    sendMessage(`[Файл: ${file.name} отправлен (размер: ${(file.size / 1024 / 1024).toFixed(2)} MB)]`);
                    return;
                }
                const reader = new FileReader();
                reader.onload = (ev) => {
                    sendMessage(`[FILE:${file.name}:${ev.target.result}]`);
                };
                reader.readAsDataURL(file);
            };
            input.click();
        });
    }
    if (!user.sessions) user.sessions = [];
      user.sessions.push(newSession);
      await saveUser(user); // persist change

      localStorage.setItem('px_current_username', username);
      localStorage.setItem('px_current_session_id', sessionId);
      return newSession;
    }

    /** Проверка сессии при авто-входе */
    async function checkAutoLogin() {
        const username = localStorage.getItem('px_current_username');
        const sessionId = localStorage.getItem('px_current_session_id');
        if (username && sessionId) {
            const users = await getUsers();
            const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
            if (user && user.isBanned) {
                showBanScreen(user.banReason, user.banTime);
                localStorage.removeItem('px_current_username');
                localStorage.removeItem('px_current_session_id');
                return false;
            }
            if (user && user.sessions && user.sessions.some(s => s.id === sessionId)) {
                await enterSystem(user);
                return true;
            }
        }
        return false;
    }

    /** Уведомление системного бота при входе */
    async function triggerSystemBotNotification(username, session) {
        const botName = 'System Bot';
        if (!chats[botName]) chats[botName] = [];

        const sessionKey = `px_notified_${session.id}`;
        if (localStorage.getItem(sessionKey)) return;
        localStorage.setItem(sessionKey, 'true');

        const msgText = `🔔 Новый вход в аккаунт!\n📅 Время: ${session.loginTime}\n🌐 IP-адрес: ${session.ip}\n💻 Устройство: ${session.device}\n\nЕсли это были не вы, завершите остальные сеансы в разделе Безопасность.`;
        
        const now = new Date();
        const time = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
        const msgId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        chats[botName].push({ 
            from: 'bot', 
            text: msgText, 
            time,
            id: msgId,
            status: 'read',
            replyTo: null,
            reactions: {}
        });
        saveUserChats(username);
        
        if (activeChatUser !== botName) {
            incrementUnread(botName);
        } else {
            renderChatMessages();
        }
        renderChatList();
    }

    /** Отрисовка сессий в разделе Безопасности */
    function renderSessions() {
        const list = document.getElementById('sessions-list');
        if (!list || !currentUser) return;
        
        list.innerHTML = '';
        const currentSessId = localStorage.getItem('px_current_session_id');
        
        const sessions = currentUser.sessions || [];
        sessions.forEach(sess => {
            const item = document.createElement('div');
            item.className = 'session-item';
            
            const isCurrent = sess.id === currentSessId;
            const badgeHtml = isCurrent ? '<span class="session-badge">Текущий</span>' : '';
            const actionHtml = isCurrent 
                ? '' 
                : `<button class="btn-terminate" data-sess-id="${sess.id}">Завершить</button>`;
            
            item.innerHTML = `
                <div class="session-info">
                    <div class="session-device">${escapeHtml(sess.device)} ${badgeHtml}</div>
                    <div class="session-meta">IP: ${escapeHtml(sess.ip)} • Время: ${escapeHtml(sess.loginTime)}</div>
                </div>
                ${actionHtml}
            `;
            
            const btn = item.querySelector('.btn-terminate');
            if (btn) {
                btn.addEventListener('click', () => {
                    terminateSession(sess.id);
                });
            }
            list.appendChild(item);
        });
    }

    /** Завершить определенную сессию */
    async function terminateSession(sessionId) {
        const user = currentUser;
        if (user && user.sessions) {
            user.sessions = user.sessions.filter(s => s.id !== sessionId);
            await saveUser(user);
            currentUser.sessions = user.sessions;
            renderSessions();
            showToast('Сеанс успешно завершен');
        }
    }

    /** Завершить все остальные сессии */
    async function terminateOtherSessions() {
        const user = currentUser;
        const currentSessId = localStorage.getItem('px_current_session_id');
        if (user && user.sessions) {
            user.sessions = user.sessions.filter(s => s.id === currentSessId);
            await saveUser(user);
            currentUser.sessions = user.sessions;
            renderSessions();
            showToast('Все другие сеансы завершены');
        }
    }

    /** Выйти из аккаунта — с автосохранением профиля */
    async function logout() {
        // Сохраняем текущие данные профиля перед выходом
        if (currentUser) {
            try {
                const nicknameInput = document.getElementById('profile-nickname-input');
                const bioInput = document.getElementById('profile-bio-input');
                const newNick = nicknameInput ? nicknameInput.value.trim() : currentUser.username;
                const newBio = bioInput ? bioInput.value.trim() : currentUser.bio || '';
                if (newNick.length >= 3) {
                    currentUser.username = newNick;
                    currentUser.bio = newBio;
                    await saveUser(currentUser);
                }
            } catch(e) { /* игнорируем ошибки при выходе */ }
        }

        localStorage.removeItem('px_current_username');
        localStorage.removeItem('px_current_session_id');

        currentUser = null;
        activeChatUser = null;

        document.body.classList.remove('home-active');
        welcomeScreen.classList.remove('hidden');
        welcomeScreen.classList.remove('fade-out');
        authContainer.classList.add('hidden');
        loginCard.classList.remove('hidden');
        registerCard.classList.add('hidden');

        try { window.history.pushState({}, '', window.location.pathname); } catch(e) {}
        showToast('Вы вышли из аккаунта');
    }

    /** Скачать credentials в .json */
    function downloadCredentials(username, password, id) {
        const encrypted = encryptPassword(password);
        const data = {
            username: username,
            id: id,
            encrypted_password: encrypted,
            key_explanation: "Пароль зашифрован с использованием XOR шифра с фиксированным ключом. Для расшифровки примените операцию XOR к символам с ключом 'PrivaXionSecureKey'."
        };
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `privaxion_${username}_credentials.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
    }

    // Save profile changes via API.
    async function saveProfileChanges() {
      const newUsername = document.getElementById('profile-nickname-input').value.trim();
      const newBio = document.getElementById('profile-bio-input').value.trim();

      if (newUsername.length < 3) {
        showToast('Никнейм должен быть не короче 3 символов', 'error');
        return;
      }

      // Fetch fresh user list
      const users = await getUsers();
      const user = users.find(u => u.username.toLowerCase() === currentUser.username.toLowerCase());
      if (!user) { showToast('Пользователь не найден', 'error'); return; }

      // Check nickname clash if changed
      if (newUsername.toLowerCase() !== user.username.toLowerCase()) {
        const clash = await apiGet(`users?username=${encodeURIComponent(newUsername)}`);
        if (clash && clash.length) { showToast('Этот никнейм уже занят', 'error'); return; }
      }

      user.username = newUsername;
      user.bio = newBio;
      await saveUser(user);

      // Update UI references
      document.getElementById('home-username-display').innerText = newUsername;
      document.getElementById('profile-nickname-display').innerText = newUsername;
      updateAvatarUI(newUsername, user.avatar);

      // Reload chats for new username (chat storage still in localStorage – keep as is)
      loadUserChats(newUsername);
      renderChatList();

      showToast('Профиль успешно сохранен!');
    }

    // ================== ROOMS UI LOGIC ==================
    document.addEventListener('DOMContentLoaded', () => {
        // Хелпер: получить общий контекст после инициализации первого DOMContentLoaded
        function px() { return window._px || {}; }

        const btnCreateChannel = document.getElementById('btn-create-channel');
        const btnCreateGroup = document.getElementById('btn-create-group');
        const createModal = document.getElementById('create-room-modal');
        const settingsModal = document.getElementById('room-settings-modal');
        
        let creatingType = 'channel'; 
        let currentRoomSettings = null;
        let captchaText = '';

        if (btnCreateChannel) {
            btnCreateChannel.addEventListener('click', async () => {
                const { currentUser, getRooms } = px();
                if (!currentUser) { alert('Необходимо войти в аккаунт.'); return; }
                creatingType = 'channel';
                document.getElementById('create-room-title').textContent = 'Создать Канал';
                document.getElementById('create-room-access-group').style.display = 'block';
                
                const allRooms = await getRooms();
                const myChannels = allRooms.filter(r => r.type === 'channel' && r.ownerId === currentUser.id);
                if (myChannels.length >= 2) {
                    alert('Вы не можете иметь более 2 каналов на один аккаунт.');
                    return;
                }
                createModal.classList.remove('hidden');
            });
        }

        if (btnCreateGroup) {
            btnCreateGroup.addEventListener('click', () => {
                const { currentUser } = px();
                if (!currentUser) { alert('Необходимо войти в аккаунт.'); return; }
                creatingType = 'group';
                document.getElementById('create-room-title').textContent = 'Создать Группу';
                document.getElementById('create-room-access-group').style.display = 'none';
                createModal.classList.remove('hidden');
            });
        }

        const btnCreateSubmit = document.getElementById('btn-create-room-submit');
        if (btnCreateSubmit) {
            btnCreateSubmit.addEventListener('click', async () => {
                const { currentUser, saveRoom, openChat, renderChatList, switchScreen, addChatToList } = px();
                if (!currentUser) { alert('Необходимо войти в аккаунт.'); return; }
                const name = document.getElementById('create-room-name').value.trim();
                const desc = document.getElementById('create-room-desc').value.trim();
                const logo = document.getElementById('create-room-logo').value.trim();
                const isPublic = document.getElementById('create-room-public').value === 'true';

                if (!name) return alert('Введите название!');
                
                const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
                let id = '#ch_';
                if (creatingType === 'group') id = '#gr_';
                for (let i = 0; i < 8; i++) id += chars.charAt(Math.floor(Math.random() * chars.length));

                const room = {
                    id, type: creatingType, name, description: desc, logo,
                    ownerId: currentUser.id, members: [currentUser.id],
                    isPublic: creatingType === 'channel' ? isPublic : false
                };

                await saveRoom(room);
                createModal.classList.add('hidden');
                document.getElementById('create-room-name').value = '';
                document.getElementById('create-room-desc').value = '';
                document.getElementById('create-room-logo').value = '';

                addChatToList(id);
                renderChatList();
                setTimeout(() => {
                    openChat({username: id, id: id, status: 'online', isRoom: true, roomData: room});
                    switchScreen('chat');
                }, 500);
            });
        }

        const btnCreateCancel = document.getElementById('btn-create-room-cancel');
        if (btnCreateCancel) btnCreateCancel.addEventListener('click', () => createModal.classList.add('hidden'));

        window.openRoomSettings = async function(roomId) {
            const { currentUser, getRooms } = px();
            if (!currentUser) return;
            const allRooms = await getRooms();
            const room = allRooms.find(r => r.id === roomId);
            if (!room) return;
            if (room.ownerId !== currentUser.id) return alert('Только владелец может менять настройки!');
            
            currentRoomSettings = room;
            
            document.getElementById('room-settings-name').value = room.name || '';
            document.getElementById('room-settings-desc').value = room.description || '';
            document.getElementById('room-settings-logo').value = room.logo || '';
            document.getElementById('room-settings-public').value = room.isPublic ? 'true' : 'false';
            
            document.getElementById('room-settings-access-group').style.display = room.type === 'channel' ? 'block' : 'none';
            document.getElementById('room-delete-password').value = '';
            document.getElementById('room-delete-captcha-input').value = '';
            
            generateRoomCaptcha();
            settingsModal.classList.remove('hidden');
        };
        
        function generateRoomCaptcha() {
            const canvas = document.getElementById('room-delete-captcha');
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            captchaText = Math.floor(1000 + Math.random() * 9000).toString();
            
            ctx.fillStyle = '#1a1f3c';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.font = '24px monospace';
            ctx.fillStyle = '#00ffaa';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            for(let i=0; i<30; i++) {
                ctx.fillStyle = Math.random() > 0.5 ? '#00ffaa' : '#ff3b5c';
                ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 2, 2);
            }
            
            ctx.fillStyle = '#e0e0e0';
            ctx.fillText(captchaText, canvas.width/2, canvas.height/2);
        }
        
        const btnRefreshCaptcha = document.getElementById('btn-refresh-room-delete-captcha');
        if (btnRefreshCaptcha) btnRefreshCaptcha.addEventListener('click', generateRoomCaptcha);

        const btnSettingsSave = document.getElementById('btn-room-settings-save');
        if (btnSettingsSave) {
            btnSettingsSave.addEventListener('click', async () => {
                const { saveRoom, renderChatList, activeChatUser, escapeHtml } = px();
                if (!currentRoomSettings) return;
                currentRoomSettings.name = document.getElementById('room-settings-name').value.trim();
                currentRoomSettings.description = document.getElementById('room-settings-desc').value.trim();
                currentRoomSettings.logo = document.getElementById('room-settings-logo').value.trim();
                currentRoomSettings.isPublic = document.getElementById('room-settings-public').value === 'true';
                
                await saveRoom(currentRoomSettings);
                settingsModal.classList.add('hidden');
                
                if (activeChatUser === currentRoomSettings.id) {
                    const nickEl = document.getElementById('chat-nickname');
                    if (nickEl) nickEl.textContent = currentRoomSettings.name;
                    if (currentRoomSettings.logo) {
                        const chAva = document.getElementById('chat-avatar-display');
                        if (chAva) chAva.innerHTML = `<img src="${currentRoomSettings.logo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
                    }
                }
                renderChatList();
            });
        }

        const btnSettingsCancel = document.getElementById('btn-room-settings-cancel');
        if (btnSettingsCancel) btnSettingsCancel.addEventListener('click', () => settingsModal.classList.add('hidden'));

        const btnSettingsDelete = document.getElementById('btn-room-delete');
        if (btnSettingsDelete) {
            btnSettingsDelete.addEventListener('click', async () => {
                const { currentUser, hashPassword, deleteRoomApi, switchScreen, renderChatList, activeChatUser } = px();
                if (!currentRoomSettings || !currentUser) return;
                const capInput = document.getElementById('room-delete-captcha-input').value.trim();
                const passInput = document.getElementById('room-delete-password').value.trim();
                
                if (capInput !== captchaText) {
                    alert('Неверная капча!');
                    generateRoomCaptcha();
                    return;
                }
                
                const hash = await hashPassword(passInput);
                if (hash !== currentUser.password) {
                    alert('Неверный пароль!');
                    generateRoomCaptcha();
                    return;
                }
                
                await deleteRoomApi(currentRoomSettings.id);
                alert('Комната удалена.');
                settingsModal.classList.add('hidden');
                
                if (activeChatUser === currentRoomSettings.id) {
                    switchScreen('welcome');
                }
                renderChatList();
            });
        }
    });

    /** Обновить интерфейс статуса (Онлайн / Оффлайн) */
    function updateStatusUI(isOnline) {
        const sidebarStatus = document.getElementById('home-status-display');
        const profileStatusText = document.getElementById('profile-status-text');
        const profileStatusDot = document.getElementById('profile-status-dot');
        
        const statusText = isOnline ? 'Онлайн' : 'Оффлайн';
        
        if (sidebarStatus) {
            sidebarStatus.innerText = statusText;
            sidebarStatus.className = isOnline ? 'status-online' : 'status-offline';
        }
        if (profileStatusText) {
            profileStatusText.innerText = statusText;
        }
        if (profileStatusDot) {
            profileStatusDot.className = isOnline ? 'pulse-green' : 'pulse-gray';
        }
    }

    // ==================================================================
    // БАЗА ДАННЫХ (localStorage)
    // ==================================================================

    // ---------- API‑based user management ----------
    async function getUsers() {
      // Returns an array of user objects
      const users = await apiGet('users');
      return users || [];
    }

    async function saveUser(user) {
      // If user already has an id, PATCH; otherwise POST
      if (user.id) {
        await apiPatch(`users/${user.id}`, user);
      } else {
        const created = await apiPost('users', user);
        return created;
      }
    }

    async function replaceAllUsers(usersArray) {
      // json‑server does not support bulk replace; delete all and repost
      const existing = await apiGet('users');
      for (const u of existing) {
        await apiDelete(`users/${u.id}`);
      }
      for (const u of usersArray) {
        await apiPost('users', u);
      }
    }

    // Register a new user via API. Returns the created user object or null if nickname taken.
    async function registerUser(username, password) {
      const existing = await apiGet(`users?username=${encodeURIComponent(username)}`);
      if (existing && existing.length) return null; // nickname taken
      const id = generateUserId();
      // birthDate добавим позже после проверки (из register form)
      const newUser = { username, password, id, avatar: null, bio: '', status: 'online', sessions: [], friends: [] };
      const created = await apiPost('users', newUser);
      return created;
    }

    // Login via API – checks password and returns user object or error.
    async function loginUser(username, password) {
      const matches = await apiGet(`users?username=${encodeURIComponent(username)}`);
      const user = matches && matches[0];
      if (!user) return { error: 'Пользователь не найден.' };
      if (user.password !== password) return { error: 'Неверный пароль.' };
      if (user.isBanned) {
          showBanScreen(user.banReason, user.banTime);
          return { error: 'Ваш аккаунт заблокирован администратором.' };
      }
      return { user };
    }

    /** Найти пользователя по ID */
    async function findUserById(searchId) {
        const users = await getUsers();
        const normalized = searchId.startsWith('#') ? searchId : '#' + searchId;
        return users.find(u => u.id.toLowerCase() === normalized.toLowerCase()) || null;
    }

    // Save avatar via API (reuse saveUser)
    async function saveUserAvatar(username, dataUrl) {
      const users = await getUsers();
      const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
      if (user) {
        user.avatar = dataUrl;
        await saveUser(user);
      }
    }

    /** ГЕНЕРАЦИЯ ID */
    function generateUserId() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
        let id = '#';
        for (let i = 0; i < 8; i++) id += chars.charAt(Math.floor(Math.random() * chars.length));
        return id;
    }

    // ==================================================================
    // КАПЧА
    // ==================================================================
    const loginCanvas    = document.getElementById('login-captcha-canvas');
    const registerCanvas = document.getElementById('register-captcha-canvas');
    let currentLoginCaptcha    = '';
    let currentRegisterCaptcha = '';

    // Экспортируем капчи в глобальную область видимости для автоматического тестирования
    window.getTestCaptcha = () => ({
        login: currentLoginCaptcha,
        register: currentRegisterCaptcha
    });

    function generateRandomText(len = 5) {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
        let t = '';
        for (let i = 0; i < len; i++) t += chars.charAt(Math.floor(Math.random() * chars.length));
        return t;
    }

    function drawCaptcha(canvas, text) {
        const ctx = canvas.getContext('2d');
        const W = canvas.width, H = canvas.height;
        ctx.fillStyle = '#1e2438';
        ctx.fillRect(0, 0, W, H);
        for (let i = 0; i < 6; i++) {
            ctx.strokeStyle = randColor(100, 200, 0.4);
            ctx.lineWidth = Math.random() * 2 + 1;
            ctx.beginPath();
            ctx.moveTo(Math.random() * W, Math.random() * H);
            ctx.lineTo(Math.random() * W, Math.random() * H);
            ctx.stroke();
        }
        for (let i = 0; i < 60; i++) {
            ctx.fillStyle = randColor(150, 255, 0.5);
            ctx.beginPath();
            ctx.arc(Math.random() * W, Math.random() * H, Math.random() * 1.5 + 0.5, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        const cw = W / (text.length + 1);
        for (let i = 0; i < text.length; i++) {
            const fs = Math.floor(Math.random() * 8) + 24;
            ctx.font = `bold ${fs}px Outfit, Arial`;
            ctx.fillStyle = randColor(180, 255, 1);
            const x = (i + 0.5) * cw + (Math.random() * 6 - 3);
            const y = H / 2 + (Math.random() * 8 - 4);
            const angle = (Math.random() * 50 - 25) * Math.PI / 180;
            ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
            ctx.fillText(text[i], 0, 0);
            ctx.restore();
        }
    }

    function randColor(min, max, a = 1) {
        const r = () => Math.floor(Math.random() * (max - min)) + min;
        return `rgba(${r()},${r()},${r()},${a})`;
    }

    function refreshLoginCaptcha() {
        currentLoginCaptcha = generateRandomText();
        drawCaptcha(loginCanvas, currentLoginCaptcha);
        document.getElementById('login-captcha-input').value = '';
    }
    function refreshRegisterCaptcha() {
        currentRegisterCaptcha = generateRandomText();
        drawCaptcha(registerCanvas, currentRegisterCaptcha);
        document.getElementById('register-captcha-input').value = '';
    }

    refreshLoginCaptcha();
    refreshRegisterCaptcha();
    document.getElementById('login-refresh-captcha').addEventListener('click', refreshLoginCaptcha);
    document.getElementById('register-refresh-captcha').addEventListener('click', refreshRegisterCaptcha);

    // ==================================================================
    // ПРИВЕТСТВЕННЫЙ ЭКРАН
    // ==================================================================
    const welcomeScreen  = document.getElementById('welcome-screen');
    const authContainer  = document.getElementById('auth-container');
    const loginCard      = document.getElementById('login-card');
    const registerCard   = document.getElementById('register-card');
    const loginErrorDiv  = document.getElementById('login-error');
    const registerErrorDiv = document.getElementById('register-error');

    document.getElementById('btn-start').addEventListener('click', () => {
        welcomeScreen.classList.add('fade-out');
        setTimeout(() => {
            welcomeScreen.classList.add('hidden');
            authContainer.classList.remove('hidden');
            loginCard.classList.add('hidden');
            registerCard.classList.remove('hidden');
            refreshRegisterCaptcha();
        }, 500);
    });

    document.getElementById('go-to-register').addEventListener('click', () => {
        loginCard.classList.add('hidden');
        registerCard.classList.remove('hidden');
        loginErrorDiv.classList.remove('show');
        refreshRegisterCaptcha();
    });

    document.getElementById('go-to-login').addEventListener('click', () => {
        registerCard.classList.add('hidden');
        loginCard.classList.remove('hidden');
        registerErrorDiv.classList.remove('show');
        refreshLoginCaptcha();
    });

    // ==================================================================
    // ВХОД В СИСТЕМУ
    // ==================================================================
    let currentUser = null; // Текущий авторизованный пользователь

    async function enterSystem(user) {
        // Проверка IP адреса перед входом
        const currentIP = await getIPAddress();
        if (isIPBlocked(currentIP)) {
            showError(loginErrorDiv, '⛔ Ваш IP адрес заблокирован. Доступ запрещен.');
            showSecurityLockdown(currentIP, 'Доступ с заблокированного IP адреса');
            return;
        }

        currentUser = user;

        // Меняем URL
        try { window.history.pushState({}, '', '#home'); } catch(e) {}

        // Заполняем UI
        document.getElementById('home-username-display').innerText = user.username;
        document.getElementById('profile-nickname-display').innerText = user.username;
        document.getElementById('profile-id-display').innerText = user.id;

        // Аватар
        updateAvatarUI(user.username, user.avatar);

        // Активируем экран
        document.body.classList.add('home-active');

        // Загружаем чаты и счетчики из хранилища
        loadUserChats(user.username);
        loadUnreadCounts(user.username);

        // Устанавливаем статус
        const isOnline = currentUser.status !== 'offline';
        updateStatusUI(isOnline);

        // Загружаем чаты из памяти
        renderChatList();

        // Показываем экран приветствия
        switchScreen('welcome');

        // Создаем сессию и отправляем оповещение
        let sessId = localStorage.getItem('px_current_session_id');
        let session = user.sessions ? user.sessions.find(s => s.id === sessId) : null;
        if (!session) {
            session = await createSession(user.username);
        }
        if (session) {
            await triggerSystemBotNotification(user.username, session);
        }
    }

    // ==================================================================
    // ФОРМА ВХОДА
    // ==================================================================
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        loginErrorDiv.classList.remove('show');
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;
        const captcha  = document.getElementById('login-captcha-input').value.trim();

        if (captcha.toLowerCase() !== currentLoginCaptcha.toLowerCase()) {
            showError(loginErrorDiv, 'Неверный текст с картинки.');
            refreshLoginCaptcha(); return;
        }
        const result = await loginUser(username, password);
        if (result.error) {
            showError(loginErrorDiv, result.error);
            refreshLoginCaptcha(); return;
        }
        await enterSystem(result.user);
    });

    // ==================================================================
    // ФОРМА РЕГИСТРАЦИИ
    // ==================================================================
    document.getElementById('register-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        registerErrorDiv.classList.remove('show');
        const username = document.getElementById('register-username').value.trim();
        const password = document.getElementById('register-password').value;
        const confirm  = document.getElementById('register-confirm-password').value;
        const captcha  = document.getElementById('register-captcha-input').value.trim();
        const birthdate = document.getElementById('register-birthdate')?.value;

        if (username.length < 3) {
            showError(registerErrorDiv, 'Никнейм должен быть не короче 3 символов.'); return;
        }
        if (password.length < 8) {
            showError(registerErrorDiv, 'Пароль должен содержать минимум 8 символов.'); return;
        }
        if (password !== confirm) {
            showError(registerErrorDiv, 'Пароли не совпадают.'); return;
        }
        if (captcha.toLowerCase() !== currentRegisterCaptcha.toLowerCase()) {
            showError(registerErrorDiv, 'Неверный текст с картинки.');
            refreshRegisterCaptcha(); return;
        }
        if (!birthdate) {
            showError(registerErrorDiv, 'Укажите дату рождения.'); return;
        }

        // Валидация возраста: минимум 7 лет
        const birthDateObj = new Date(birthdate);
        if (Number.isNaN(birthDateObj.getTime())) {
            showError(registerErrorDiv, 'Дата рождения некорректна.'); return;
        }
        const now = new Date();
        const ageYears = Math.floor((now.getTime() - birthDateObj.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
        if (ageYears < 7) {
            showError(registerErrorDiv, 'Возраст должен быть минимум 7 лет.');
            return;
        }

        // Лимит аккаунтов на одно устройство (макс 2)
        const deviceId = getOrCreateDeviceId();
        if (!canRegisterMoreAccountsOnDevice(deviceId, 2)) {
            showError(registerErrorDiv, 'На этом устройстве можно зарегистрировать максимум 2 аккаунта.');
            return;
        }

        // Регистрируем пользователя и сохраняем birthDate
        const user = await registerUser(username, password);
        if (!user) {
            showError(registerErrorDiv, `Никнейм «${username}» уже занят. Выберите другой.`);
            return;
        }

        // Увеличиваем счётчик зарегистрированных аккаунтов на этом устройстве
        const nextCount = countUsersOnThisDevice(deviceId) + 1;
        setUsersOnThisDevice(deviceId, nextCount);

        user.birthDate = birthdate;
        await saveUser(user);

        downloadCredentials(username, password, user.id);
        await enterSystem(user);
    });

    function showError(el, msg) {
        el.innerText = msg;
        el.classList.add('show');
    }

    // ==================================================================
    // НАВИГАЦИЯ
    // ==================================================================
    const screens = {
        welcome:  document.getElementById('screen-welcome'),
        chat:     document.getElementById('screen-chat'),
        search:   document.getElementById('screen-search'),
        profile:  document.getElementById('screen-profile'),
        news:     document.getElementById('screen-news'),
        settings: document.getElementById('screen-settings'),
        help:     document.getElementById('screen-help'),
    };
    const navBtns = {
        home:     document.getElementById('nav-home'),
        friends:  document.getElementById('nav-friends'),
        profile:  document.getElementById('nav-profile'),
    };
    const panelBtns = {
        help:   document.getElementById('btn-help'),
        search: document.getElementById('btn-search-top'),
    };

    // Счётчик непрочитанных новостей
    let unreadNews = parseInt(localStorage.getItem('px_unread_news') || '0');

    function updateNewsBadge(count) {
        unreadNews = count;
        localStorage.setItem('px_unread_news', count);
        const badge = document.getElementById('news-badge');
        if (!badge) return;
        if (count > 0) {
            badge.textContent = count > 99 ? '99+' : count;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }

    function switchScreen(name) {
        Object.values(screens).forEach(s => s && s.classList.add('hidden'));
        Object.values(navBtns).forEach(b => b && b.classList.remove('active'));
        Object.values(panelBtns).forEach(b => b && b.classList.remove('active'));
        if (screens[name]) screens[name].classList.remove('hidden');

        if (name === 'welcome' && navBtns.home) navBtns.home.classList.add('active');
        if (name === 'search' && navBtns.friends) navBtns.friends.classList.add('active');
        if (name === 'profile' && navBtns.profile) navBtns.profile.classList.add('active');
        if (name === 'help' && panelBtns.help) panelBtns.help.classList.add('active');
        if (name === 'search' && panelBtns.search) panelBtns.search.classList.add('active');

        // Сбрасываем активный чат в сайдбаре если переходим не в чат
        if (name !== 'chat') {
            document.querySelectorAll('.chat-list-item').forEach(i => i.classList.remove('active'));
            activeChatUser = null;
            const chatHeader = document.getElementById('chat-header-bar');
            if (chatHeader) chatHeader.innerHTML = '';
        }

        // Логика переключения экранов
        if (name === 'profile' && currentUser) {
            document.getElementById('profile-nickname-input').value = currentUser.username;
            document.getElementById('profile-bio-input').value = currentUser.bio || '';
            const isOnline = currentUser.status !== 'offline';
            document.getElementById('profile-status-select').value = isOnline ? 'online' : 'offline';
            updateStatusUI(isOnline);
        }
        if (name === 'settings') {
            renderSessions();
        }
        if (name === 'news') {
            renderNews();
            updateNewsBadge(0);
        }
    }

    navBtns.home && navBtns.home.addEventListener('click', () => {
        // главная папка: показываем список чатов
        if (chatFolderMode !== 'home') {
            setChatFolderMode('home');
        }
        switchScreen('welcome');
    });

    navBtns.friends && navBtns.friends.addEventListener('click', () => {
        // папка друзей: фильтр по friends
        setChatFolderMode('friends');
        switchScreen('welcome');
    });
    navBtns.profile  && navBtns.profile.addEventListener('click',  () => switchScreen('profile'));
    panelBtns.search && panelBtns.search.addEventListener('click', () => switchScreen('search'));
    panelBtns.help   && panelBtns.help.addEventListener('click',   () => switchScreen('help'));
    document.getElementById('help-open-news')?.addEventListener('click', () => switchScreen('news'));
    document.getElementById('help-open-settings')?.addEventListener('click', () => switchScreen('settings'));

    // ==================================================================
    // НОВОСТИ (API)
    // ==================================================================
    const NEWS_AUTHOR_ID = '#QH3jCR65';
    let cachedNews = [];

    async function fetchNews() {
        try {
            const news = await apiGet('news');
            return Array.isArray(news) ? news.sort((a, b) => b.ts - a.ts) : [];
        } catch(e) {
            return [];
        }
    }

    async function renderNews() {
        const list = document.getElementById('news-list');
        const empty = document.getElementById('news-empty');
        if (!list) return;

        const news = await fetchNews();
        cachedNews = news;

        list.innerHTML = '';
        if (!news.length) {
            list.innerHTML = '<div class="news-empty" id="news-empty">Нет новостей</div>';
            return;
        }

        news.forEach(item => {
            const card = document.createElement('div');
            card.className = 'news-card';
            const date = item.ts ? new Date(item.ts).toLocaleString('ru-RU') : '';
            card.innerHTML = `
                <div class="news-card-header">
                    <span class="news-author">📢 PrivaXion Official</span>
                    <span class="news-date">${date}</span>
                </div>
                <div class="news-body">${escapeHtml(item.text || '').replace(/\n/g,'<br>')}</div>
            `;
            list.appendChild(card);
        });
    }

    // Добавить новость (API) — доступно только админу с ID #QH3jCR65
    async function postNews(text) {
        if (!text || !text.trim()) return;
        const item = { text: text.trim(), authorId: NEWS_AUTHOR_ID, ts: Date.now() };
        await apiPost('news', item);
        const prevCount = (await fetchNews()).length - 1;
        updateNewsBadge(Math.max(0, (await fetchNews()).length - prevCount));
        renderNews();
    }

    // ==================================================================
    // СИСТЕМА ЧАТОВ
    // ==================================================================
    let chats = {}; // { username: [{ from, text, time, id, status, replyTo, reactions }] }
    let activeChatUser = null;
    let replyToMessageId = null; // ID сообщения, на которое отвечаем

    // ==============================================================
    // TYPING STATUS (печатает… / в сети / оффлайн) — ТОЛЬКО UI
    // ==============================================================
    let activeChatPeer = null; // объект user для активного чата (нужно status)
    let typingTimeoutId = null;
    let typingIsActive = false;

    function clearTypingTimer() {
        if (typingTimeoutId) {
            clearTimeout(typingTimeoutId);
            typingTimeoutId = null;
        }
    }

    function setChatHeaderTypingState(state, peerStatus) {
        // state: 'typing' | 'online' | 'offline'
        const chatHeader = document.getElementById('chat-header-bar');
        if (!chatHeader || !activeChatPeer) return;

        const peerName = activeChatPeer.username;
        let statusText = '';

        if (state === 'typing') statusText = 'печатает...';
        else if (state === 'offline') statusText = 'Оффлайн';
        else statusText = 'Онлайн';

        const statusClass = (state === 'offline') ? 'status-offline' : 'status-online';

        const peerIsOnline = (activeChatPeer.username === 'System Bot') ? true : (activeChatPeer.status !== 'offline');
        const disableCalling = !peerIsOnline;

        chatHeader.innerHTML = `
            <div class="header-chat-info">
                <div class="header-chat-name">${escapeHtml(peerName)}</div>
                <div class="header-chat-status ${statusClass}" id="chat-header-status-line">${statusText} · E2EE</div>
            </div>

            <div class="chat-call-controls">
                <button type="button" class="btn-call" id="btn-call" ${disableCalling ? 'disabled' : ''}>📞 Позвонить</button>
                <button type="button" class="btn-call btn-call-danger hidden" id="btn-hangup">⛔ Отбой</button>

                <div class="mic-control-row">
                    <button type="button" class="btn-mic" id="btn-mic-off">🎙️ Микрофон ВКЛ</button>
                    <span class="mic-status-text" id="mic-status-text">mic: on</span>
                </div>
            </div>
        `;
    }

    // ==================================================================
    // ==================================================================
    // WEBRTC CALLS (P2P with DTLS-SRTP encryption)
    // ==================================================================
    const SIGNAL_SERVER_BASE = 'http://localhost:5555';

    function getOrCreateClientId() {
        let id = localStorage.getItem('px_client_id');
        if (!id) {
            id = 'c_' + Math.random().toString(36).slice(2) + '_' + Date.now().toString(36);
            localStorage.setItem('px_client_id', id);
        }
        return id;
    }

    const clientId = getOrCreateClientId();

    function getCallRoomId(userA, userB) {
        const sorted = [userA.toLowerCase(), userB.toLowerCase()].sort();
        return `room_${sorted[0]}_${sorted[1]}`;
    }

    let callRoomId = null;
    let callEventSource = null;
    let rtcPeer = null;
    let localStream = null;
    let remoteStream = null;
    let remoteAudioEl = null;
    let callTimerInterval = null;
    let callSeconds = 0;
    let isCallInitiator = false;
    let incomingCallPeer = null;

    function ensureRemoteAudioElement() {
        if (remoteAudioEl) return remoteAudioEl;
        remoteAudioEl = document.createElement('audio');
        remoteAudioEl.autoplay = true;
        remoteAudioEl.playsInline = true;
        remoteAudioEl.style.display = 'none';
        document.body.appendChild(remoteAudioEl);
        return remoteAudioEl;
    }

    function stopLocalTracks() {
        if (localStream) {
            localStream.getTracks().forEach(t => {
                try { t.stop(); } catch (e) {}
            });
        }
        localStream = null;
    }

    function cleanupRtc() {
        try {
            if (rtcPeer) rtcPeer.close();
        } catch (e) {}
        rtcPeer = null;
        stopLocalTracks();

        if (remoteStream) {
            try {
                remoteStream.getTracks().forEach(t => t.stop());
            } catch (e) {}
        }
        remoteStream = null;

        if (remoteAudioEl) {
            remoteAudioEl.srcObject = null;
        }

        clearInterval(callTimerInterval);
        callSeconds = 0;
        incomingCallPeer = null;

        const btnHangup = document.getElementById('btn-hangup');
        const btnCall = document.getElementById('btn-call');
        if (btnHangup) btnHangup.classList.add('hidden');
        if (btnCall) btnCall.classList.remove('hidden');
    }

    function setMicEnabled(enabled) {
        if (!localStream) return;
        localStream.getAudioTracks().forEach(track => {
            track.enabled = !!enabled;
        });

        const btnMicCall = document.getElementById('btn-mic-off-call');
        if (btnMicCall) {
            btnMicCall.textContent = enabled ? '🎙️' : '🔇';
            btnMicCall.style.background = enabled ? '#333' : 'var(--error-color)';
        }
    }

    function publishSignal(signalType, payload, toClient = null) {
        if (!callRoomId) return Promise.resolve();
        return fetch(`${SIGNAL_SERVER_BASE}/signal?roomId=${encodeURIComponent(callRoomId)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                from: clientId,
                to: toClient,
                type: signalType,
                payload: { ...payload, senderUsername: currentUser.username },
                id: String(Date.now()) + '_' + Math.random().toString(36).slice(2)
            })
        }).catch(() => {});
    }

    function setupRtcPeer() {
        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        });

        pc.onicecandidate = (e) => {
            if (e.candidate) {
                publishSignal('webrtc_ice', { candidate: e.candidate });
            }
        };

        pc.ontrack = (e) => {
            if (!remoteStream) {
                remoteStream = new MediaStream();
                ensureRemoteAudioElement().srcObject = remoteStream;
            }
            remoteStream.addTrack(e.track);

            document.getElementById('call-status-text').style.display = 'none';
            document.getElementById('call-timer').style.display = 'block';
            startCallTimer();
        };

        pc.oniceconnectionstatechange = () => {
            if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
                stopCallAndReset();
            }
        };

        rtcPeer = pc;
        return pc;
    }

    function showCallScreen(peerName, statusText) {
        const callScreen = document.getElementById('screen-call');
        const chatScreen = document.getElementById('screen-chat');
        if (callScreen) callScreen.classList.remove('hidden');
        if (chatScreen) chatScreen.classList.add('hidden');

        const peerLabel = document.getElementById('call-peer-label');
        if (peerLabel) peerLabel.textContent = peerName ? peerName : '...';

        const statusLabel = document.getElementById('call-status-text');
        if (statusLabel) {
            statusLabel.style.display = 'block';
            statusLabel.textContent = statusText;
        }

        const timer = document.getElementById('call-timer');
        if (timer) {
            timer.style.display = 'none';
            timer.textContent = '00:00';
        }
    }

    function hideCallScreen() {
        const callScreen = document.getElementById('screen-call');
        const chatScreen = document.getElementById('screen-chat');
        const modal = document.getElementById('incoming-call-modal');
        if (callScreen) callScreen.classList.add('hidden');
        if (chatScreen) chatScreen.classList.remove('hidden');
        if (modal) modal.classList.add('hidden');
    }

    function setCallStatus(text) {
        const statusText = document.getElementById('call-status-text');
        if (statusText) statusText.textContent = text;
    }

    function startCallTimer() {
        clearInterval(callTimerInterval);
        callSeconds = 0;
        const timerEl = document.getElementById('call-timer');
        callTimerInterval = setInterval(() => {
            callSeconds++;
            const m = Math.floor(callSeconds / 60).toString().padStart(2, '0');
            const s = (callSeconds % 60).toString().padStart(2, '0');
            if (timerEl) timerEl.textContent = `${m}:${s}`;
        }, 1000);
    }

    async function startCall() {
        if (!activeChatPeer || !activeChatUser) return;
        const peerIsOnline = (activeChatPeer.username === 'System Bot') ? true : (activeChatPeer.status !== 'offline');
        if (!peerIsOnline) {
            showToast('Собеседник оффлайн — звонок недоступен', 'error');
            return;
        }
        
        isCallInitiator = true;
        showCallScreen(activeChatPeer.username, 'Ожидание ответа...');
        await publishSignal('incoming_call', {});
    }

    async function startWebRTCConnection(createOffer = false) {
        try {
            localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        } catch (e) {
            showToast('Нет доступа к микрофону', 'error');
            publishSignal('call_rejected', {});
            stopCallAndReset();
            return;
        }

        setMicEnabled(true);
        const pc = setupRtcPeer();
        localStream.getTracks().forEach(t => pc.addTrack(t, localStream));

        if (createOffer) {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            await publishSignal('webrtc_offer', { sdp: pc.localDescription });
        }
    }

    async function handleIncomingSignal(msg) {
        if (!msg || msg.kind !== 'message') return;

        if (msg.type === 'chat_message') {
            const { text, id, time, replyTo, senderUsername } = msg.payload;
            if (!senderUsername) return;
            const fromUser = senderUsername;
            
            let decryptedText = text;
            try {
                const key = getChannelKey(currentUser.username, fromUser);
                decryptedText = typeof decryptMessageTriple === 'function' ? decryptMessageTriple(text, key) : text;
            } catch(e) {}

            const newMsg = {
                from: fromUser, text: decryptedText, time, id, status: 'delivered', replyTo, reactions: {}
            };
            if (!chats[fromUser]) chats[fromUser] = [];
            chats[fromUser].push(newMsg);
            saveUserChats(currentUser.username);
            
            if (activeChatUser === fromUser) {
                renderChatMessages();
                markMessageAsRead(id);
            } else {
                unreadCounts[fromUser] = (unreadCounts[fromUser] || 0) + 1;
                saveUnreadCounts(currentUser.username);
                renderChatList();
            }
            updateChatListItem(fromUser, decryptedText.startsWith('[FILE:') ? '[Файл]' : decryptedText);
            return;
        }

        const fromUser = msg.payload?.senderUsername || msg.from;

        if (msg.type === 'incoming_call') {
            incomingCallPeer = fromUser;
            isCallInitiator = false;
            const callerNameEl = document.getElementById('incoming-caller-name');
            if (callerNameEl) callerNameEl.textContent = fromUser;
            const modal = document.getElementById('incoming-call-modal');
            if (modal) modal.classList.remove('hidden');
        } 
        else if (msg.type === 'call_accepted') {
            setCallStatus('Установка защищенного P2P...');
            await startWebRTCConnection(true); 
        }
        else if (msg.type === 'call_rejected') {
            showToast('Пользователь отклонил вызов', 'error');
            stopCallAndReset();
        }
        else if (msg.type === 'webrtc_offer') {
            await startWebRTCConnection(false);
            if (rtcPeer && msg.payload.sdp) {
                await rtcPeer.setRemoteDescription(new RTCSessionDescription(msg.payload.sdp));
                const answer = await rtcPeer.createAnswer();
                await rtcPeer.setLocalDescription(answer);
                publishSignal('webrtc_answer', { sdp: rtcPeer.localDescription });
            }
        }
        else if (msg.type === 'webrtc_answer') {
            if (rtcPeer && msg.payload.sdp) {
                await rtcPeer.setRemoteDescription(new RTCSessionDescription(msg.payload.sdp));
            }
        }
        else if (msg.type === 'webrtc_ice') {
            if (rtcPeer && msg.payload.candidate) {
                await rtcPeer.addIceCandidate(new RTCIceCandidate(msg.payload.candidate));
            }
        }
        else if (msg.type === 'call_hangup') {
            stopCallAndReset();
        }
    }

    function stopCallAndReset() {
        cleanupRtc();
        setCallStatus('отбой');
        hideCallScreen();
    }

    function connectToCallRoom() {
        if (!activeChatPeer || !activeChatUser || !currentUser) return;
        const nextRoomId = getCallRoomId(currentUser.username, activeChatPeer.username);
        callRoomId = nextRoomId;

        if (callEventSource) {
            try { callEventSource.close(); } catch (e) {}
            callEventSource = null;
        }

        callEventSource = new EventSource(
            `${SIGNAL_SERVER_BASE}/events?roomId=${encodeURIComponent(callRoomId)}&clientId=${encodeURIComponent(clientId)}`
        );
        callEventSource.addEventListener('signal', (ev) => {
            try {
                const data = JSON.parse(ev.data);
                if (data && data.kind === 'message' && data.from === clientId) return; 
                handleIncomingSignal(data).catch(() => {});
            } catch (e) {}
        });
        callEventSource.onerror = () => {};
    }


    // ПАПКИ ЧАТОВ: home / friends
    // ==================================================================
    let chatFolderMode = 'home'; // 'home' | 'friends'


    function normalizeFriends(friends) {
        if (!Array.isArray(friends)) return [];
        return friends.filter(x => typeof x === 'string' && x.trim().length > 0);
    }

    function getCurrentUserFriends() {
        if (!currentUser) return [];
        return normalizeFriends(currentUser.friends);
    }

    async function isFriendByUsername(username) {
        if (!currentUser) return false;
        const friends = getCurrentUserFriends();
        const users = await getUsers();
        const target = users.find(u => u.username.toLowerCase() === username.toLowerCase());
        if (!target) return false;
        return friends.includes(target.id);
    }

    async function getChatUsernamesByFolder() {
        const usernames = Object.keys(chats);
        if (chatFolderMode === 'home') return usernames;

        const results = [];
        for (const uname of usernames) {
            if (await isFriendByUsername(uname)) results.push(uname);
        }
        return results;
    }

    function setChatFolderMode(mode) {
        chatFolderMode = mode === 'friends' ? 'friends' : 'home';
        renderChatList();
    }

    function getMessageStatusUI(status) {
        if (status === 'error') return { symbol: '!', className: 'status-error' };
        if (status === 'read') return { symbol: '✓✓', className: 'status-read' };
        return { symbol: '✓', className: 'status-sent' };
    }

    function openChat(targetUser) {
        activeChatPeer = targetUser || null;
        activeChatUser = targetUser.username;
        if (!chats[activeChatUser]) chats[activeChatUser] = [];

        // Сброс typing при смене чата
        clearTypingTimer();
        typingIsActive = false;

        // Отмечаем все входящие сообщения как прочитанные
        if (chats[activeChatUser]) {
            let hasUnread = false;
            chats[activeChatUser].forEach(msg => {
                if (msg.from !== 'me' && msg.status !== 'read') {
                    msg.status = 'read';
                    hasUnread = true;
                }
            });
            if (hasUnread) {
                saveUserChats(currentUser.username);
            }
        }

        // Сброс счетчика непрочитанных
        unreadCounts[activeChatUser] = 0;
        saveUnreadCounts(currentUser.username);

        // Устанавливаем заголовок чата и статус
        const isOnline = targetUser.username === 'System Bot' ? true : (targetUser.status !== 'offline');
        if (isOnline) setChatHeaderTypingState('online');
        else setChatHeaderTypingState('offline');

        // Подключаемся к комнате звонков
        // (SSE подписка и обработчики signal будут активны, пока открыт чат)
        try {
            connectToCallRoom();
        } catch (e) {}

        // Навешиваем обработчики кнопок звонка/микрофона (рендер шапки делается в setChatHeaderTypingState)
        setTimeout(() => {
            const btnCall = document.getElementById('btn-call');
            const btnHangup = document.getElementById('btn-hangup');
            const btnMic = document.getElementById('btn-mic-off');

            if (btnCall && !btnCall.dataset.bound) {
                btnCall.addEventListener('click', () => startCall().catch(() => {}));
                btnCall.dataset.bound = '1';
            }
            if (btnHangup && !btnHangup.dataset.bound) {
                btnHangup.addEventListener('click', () => {
                    publishSignal('call_hangup', {});
                    stopCallAndReset();
                });
                btnHangup.dataset.bound = '1';
            }
            if (btnMic && !btnMic.dataset.bound) {
                btnMic.dataset.micState = 'on';
                btnMic.addEventListener('click', () => {
                    const next = (btnMic.dataset.micState !== 'off');
                    btnMic.dataset.micState = next ? 'off' : 'on';
                    setMicEnabled(next ? false : true);
                });
                btnMic.dataset.bound = '1';
            }
        }, 0);

        const headerTitle = document.getElementById('main-header-title');
        if (headerTitle) {
            headerTitle.innerHTML = escapeHtml(targetUser.username);
        }

        switchScreen('chat');

        // Активируем элемент в списке
        document.querySelectorAll('.chat-list-item').forEach(i => i.classList.remove('active'));
        const listItem = document.querySelector(`.chat-list-item[data-user="${activeChatUser}"]`);
        if (listItem) listItem.classList.add('active');

        renderChatMessages();

        // Фокус на поле ввода
        setTimeout(() => document.getElementById('chat-message-input').focus(), 50);
    }

    function generateMessageId() {
        return 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    function renderChatMessages() {
        const container = document.getElementById('chat-messages');
        container.innerHTML = '';
        if (!activeChatUser || !chats[activeChatUser]) return;
        
        chats[activeChatUser].forEach((msg, idx) => {
            const div = document.createElement('div');
            div.className = `message ${msg.from === 'me' ? 'msg-out' : 'msg-in'}`;
            div.setAttribute('data-msg-id', msg.id);

            let replyHtml = '';
            if (msg.replyTo) {
                const replyMsg = chats[activeChatUser].find(m => m.id === msg.replyTo);
                if (replyMsg) {
                    replyHtml = `
                        <div class="message-reply-info">
                            <span class="message-reply-name">↩ ${msg.from === 'me' ? 'Ты' : escapeHtml(activeChatUser)}</span>
                            <span class="message-reply-text">${escapeHtml(replyMsg.text.substring(0, 50))}${replyMsg.text.length > 50 ? '...' : ''}</span>
                        </div>
                    `;
                }
            }

            // Статус сообщения (! / ✓ / ✓✓)
            let statusHtml = '';
            if (msg.from === 'me') {
                const ui = getMessageStatusUI(msg.status);
                statusHtml = `<div class="message-status"><span class="status-check ${ui.className}">${ui.symbol}</span></div>`;
            }

            // Реакции на сообщение
            let reactionsHtml = '';
            if (msg.reactions && Object.keys(msg.reactions).length > 0) {
                reactionsHtml = '<div class="message-reactions">';
                Object.entries(msg.reactions).forEach(([emoji, names]) => {
                    reactionsHtml += `
                        <div class="reaction-button" title="${names.join(', ')}">
                            <span class="reaction-emoji">${emoji}</span>
                            <span class="reaction-count">${names.length}</span>
                        </div>
                    `;
                });
                reactionsHtml += '</div>';
            }

            // Панель с реакциями (видна при наведении на мобильных при долгом нажатии)
            const reactionsPanel = `
                <div class="msg-reactions-panel">
                    <button class="msg-reaction-btn" title="Нравится" data-emoji="❤️">❤️</button>
                    <button class="msg-reaction-btn" title="Огонь" data-emoji="🔥">🔥</button>
                    <button class="msg-reaction-btn" title="Тошнит" data-emoji="🤮">🤮</button>
                    <button class="msg-reaction-btn" title="Какашка" data-emoji="💩">💩</button>
                    <button class="msg-reaction-btn" title="Ответить" data-action="reply">↩️</button>
                </div>
            `;

            const photoHtml = `<img src="XDDD.jpg" alt="XDDD" class="chat-msg-photo-img">`;
            let messageTextHtml = escapeHtml(msg.text);
            
            if (msg.text && msg.text.startsWith('[FILE:')) {
                const match = msg.text.match(/^\[FILE:([^:]+):(.+)\]$/);
                if (match) {
                    const fileName = escapeHtml(match[1]);
                    const dataUrl = match[2];
                    if (dataUrl.startsWith('data:image/')) {
                         messageTextHtml = `[Файл: ${fileName}]<br><img src="${dataUrl}" style="max-width: 200px; max-height: 200px; border-radius: 8px; margin-top: 5px;"/>`;
                    } else if (dataUrl.startsWith('data:video/')) {
                         messageTextHtml = `[Файл: ${fileName}]<br><video src="${dataUrl}" controls style="max-width: 200px; max-height: 200px; border-radius: 8px; margin-top: 5px;"></video>`;
                    } else {
                         messageTextHtml = `<a href="${dataUrl}" download="${fileName}" style="color: var(--primary); text-decoration: underline;">Скачать файл ${fileName}</a>`;
                    }
                }
            } else if (msg.from === 'me') {
                const words = msg.text.split(' ');
                messageTextHtml = words.map((w, i) => `<span class="word-fly" style="animation-delay: ${i * 0.3}s">${escapeHtml(w)}</span>`).join(' ');
            }

            div.innerHTML = `
                ${replyHtml}
                <div class="msg-row ${msg.from === 'me' ? 'msg-row-out' : 'msg-row-in'}">
                    ${msg.from === 'me' ? '' : photoHtml}
                    <div class="msg-bubble">${messageTextHtml}</div>
                    ${msg.from === 'me' ? photoHtml : ''}
                </div>
                ${reactionsHtml}
                ${statusHtml}
                <div class="msg-time">${msg.time}</div>
                ${msg.from === 'me' ? '' : reactionsPanel}
            `;

            // Обработчики реакций
            div.querySelectorAll('.msg-reaction-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const emoji = btn.getAttribute('data-emoji');
                    const action = btn.getAttribute('data-action');
                    
                    if (action === 'reply') {
                        setReplyTo(msg);
                    } else if (emoji) {
                        addReaction(msg.id, emoji);
                    }
                });
            });

            // Долгое нажатие для открытия реакций на мобильных
            let longPressTimer;
            div.addEventListener('touchstart', () => {
                longPressTimer = setTimeout(() => {
                    const panel = div.querySelector('.msg-reactions-panel');
                    if (panel) {
                        panel.style.display = panel.style.display === 'flex' ? 'none' : 'flex';
                    }
                }, 500);
            });

            div.addEventListener('touchend', () => {
                clearTimeout(longPressTimer);
            });

            // Правый клик для открытия реакций на ПК
            div.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                const panel = div.querySelector('.msg-reactions-panel');
                if (panel) {
                    panel.style.display = panel.style.display === 'flex' ? 'none' : 'flex';
                }
            });

            container.appendChild(div);
        });
        
        container.scrollTop = container.scrollHeight;
    }

    function setReplyTo(message) {
        replyToMessageId = message.id;
        const replyBox = document.getElementById('reply-box');
        const replyName = document.getElementById('reply-name');
        const replyText = document.getElementById('reply-text');
        
        replyName.textContent = message.from === 'me' ? 'Ты' : escapeHtml(activeChatUser);
        replyText.textContent = message.text.substring(0, 60) + (message.text.length > 60 ? '...' : '');
        
        replyBox.classList.remove('hidden');
        document.getElementById('chat-message-input').focus();
    }

    function cancelReply() {
        replyToMessageId = null;
        document.getElementById('reply-box').classList.add('hidden');
        document.getElementById('reply-name').textContent = '';
        document.getElementById('reply-text').textContent = '';
    }

    function addReaction(messageId, emoji) {
        if (!chats[activeChatUser]) return;
        const msg = chats[activeChatUser].find(m => m.id === messageId);
        if (!msg) return;

        if (!msg.reactions) msg.reactions = {};
        if (!msg.reactions[emoji]) msg.reactions[emoji] = [];

        const currentUsername = currentUser.username;
        const hasReacted = msg.reactions[emoji].includes(currentUsername);
        
        if (hasReacted) {
            msg.reactions[emoji] = msg.reactions[emoji].filter(name => name !== currentUsername);
            if (msg.reactions[emoji].length === 0) {
                delete msg.reactions[emoji];
            }
        } else {
            msg.reactions[emoji].push(currentUsername);
        }

        saveUserChats(currentUser.username);
        renderChatMessages();
    }

    function markMessageAsRead(messageId) {
        if (!chats[activeChatUser]) return;
        const msg = chats[activeChatUser].find(m => m.id === messageId);
        if (msg && msg.from !== 'me') {
            msg.status = 'read';
            saveUserChats(currentUser.username);
        }
    }

    function sendMessage(customText = null) {
        let text;
        const input = document.getElementById('chat-message-input');
        if (customText !== null && typeof customText === 'string') {
            text = customText;
        } else if (input instanceof Event) {
            text = input.target.value.trim();
        } else {
            text = input.value.trim();
        }
        
        if (!text || !activeChatUser) return;
        
        if (customText === null && text.length > 5000) {
            showToast('Сообщение слишком длинное! Максимум 5000 символов.', 'error');
            return;
        }
        
        if (customText === null || typeof customText !== 'string') input.value = '';
        cancelReply();

        const now = new Date();
        const time = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
        const msgId = generateMessageId();

        const newMsg = { 
            from: 'me', 
            text, 
            time, 
            id: msgId, 
            status: 'sent',
            replyTo: replyToMessageId,
            reactions: {}
        };

        chats[activeChatUser].push(newMsg);

        // Сохраняем в localStorage
        saveUserChats(currentUser.username);

        // Обновляем последнее сообщение в списке
        updateChatListItem(activeChatUser, text.startsWith('[FILE:') ? '[Файл]' : text);
        renderChatMessages();

        // Отправка через сервер сигналинга
        try {
            const key = getChannelKey(currentUser.username, activeChatUser);
            const encryptedText = typeof encryptMessageTriple === 'function' ? encryptMessageTriple(text, key) : text;
            publishSignal('chat_message', {
                text: encryptedText,
                time,
                id: msgId,
                replyTo: replyToMessageId,
                senderUsername: currentUser.username
            }).catch(e => console.error(e));
        } catch (err) {
            console.error("Ошибка при отправке сигнала", err);
        }

        // Имитация получения сообщения (автоответ для демо)
        if (activeChatUser === 'System Bot') {
            setTimeout(() => {
                if (activeChatUser === 'System Bot') {
                    markMessageAsRead(msgId);
                    renderChatMessages();
                }
            }, 1500);
        }
    }

    document.getElementById('chat-send-btn').addEventListener('click', sendMessage);
    document.getElementById('chat-message-input').addEventListener('keydown', (e) => {
        // Enter = отправка
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();

            // после отправки typing сбрасываем
            clearTypingTimer();
            typingIsActive = false;

            if (activeChatPeer) {
                const peerIsOnline = (activeChatPeer.username === 'System Bot')
                    ? true
                    : (activeChatPeer.status !== 'offline');
                setChatHeaderTypingState(peerIsOnline ? 'online' : 'offline');
            }

            sendMessage();
            return;
        }

        // typing: только когда открыт чат и собеседник online
        if (!activeChatPeer || !activeChatUser) return;

        const peerIsOnline = (activeChatPeer.username === 'System Bot')
            ? true
            : (activeChatPeer.status !== 'offline');

        // если оффлайн — НЕ показываем “печатает…”
        if (!peerIsOnline) {
            clearTypingTimer();
            typingIsActive = false;
            setChatHeaderTypingState('offline');
            return;
        }

        // собеседник online => показываем “печатает…”
        typingIsActive = true;
        setChatHeaderTypingState('typing');

        clearTypingTimer();
        typingTimeoutId = setTimeout(() => {
            typingIsActive = false;

            const p = activeChatPeer;
            if (!p) return;

            const pIsOnline = (p.username === 'System Bot')
                ? true
                : (p.status !== 'offline');

            setChatHeaderTypingState(pIsOnline ? 'online' : 'offline');
        }, 2000);
    });

    // Отмена ответа
    if (document.getElementById('btn-cancel-reply')) {
        document.getElementById('btn-cancel-reply').addEventListener('click', cancelReply);
    }

    function addChatToList(targetUsername) {
        if (!chats[targetUsername]) chats[targetUsername] = [];
        saveUserChats(currentUser.username);
        renderChatList();
    }

    async function renderChatList() {
        const list = document.getElementById('chat-list');
        const empty = document.getElementById('chat-list-empty');
        if (!list || !empty) return;

        list.querySelectorAll('.chat-list-item').forEach(el => el.remove());

        const users = await getChatUsernamesByFolder();

        if (users.length === 0) {
            empty.style.display = 'block';
            empty.textContent = chatFolderMode === 'friends'
                ? 'Пока нет друзей'
                : 'Пока нет чатов';
            return;
        }
        empty.style.display = 'none';

        users.forEach(uname => {
            const item = document.createElement('div');
            item.className = 'chat-list-item';
            if (activeChatUser === uname) item.classList.add('active');
            item.dataset.user = uname;

            const count = unreadCounts[uname] || 0;
            const badgeHtml = count > 0 ? `<div class="chat-list-badge">${count}</div>` : '';

            item.innerHTML = `
                <span class="chat-list-name">${escapeHtml(uname)}</span>
                <div class="chat-list-badge-container">${badgeHtml}</div>
            `;

            item.addEventListener('click', async () => {
                const users2 = await getUsers();
                const found = users2.find(u => u.username.toLowerCase() === uname.toLowerCase());
                if (!found) return;
                openChat(found);
            });

            list.appendChild(item);
        });
    }

    function updateChatListItem(uname, lastMsg) {
        const el = document.querySelector(`[data-last="${uname}"]`);
        if (el) el.innerText = lastMsg.substring(0, 28) + (lastMsg.length > 28 ? '…' : '');
    }

    // ==================================================================
    // ПОИСК
    // ==================================================================
    const searchBtnEl = document.getElementById('search-btn');
    const searchInputEl = document.getElementById('search-input');
    if (searchBtnEl) searchBtnEl.addEventListener('click', doSearch);
    if (searchInputEl) searchInputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') doSearch();
    });

    async function doSearch() {
        const query = (document.getElementById('search-input').value || '').trim();
        const result = document.getElementById('search-result');
        if (!result) return;
        result.innerHTML = '';
        result.classList.remove('hidden');

        if (!query) {
            result.innerHTML = '<p class="search-no-result">Введите ID или название для поиска.</p>';
            return;
        }

        const { findUserById, getRoomsSync, currentUser, addChatToList, openChat, escapeHtml, switchScreen } = window._px || {};
        if (!findUserById) {
            result.innerHTML = '<p class="search-no-result">Поиск недоступен. Войдите в аккаунт.</p>';
            return;
        }

        // Поиск пользователя по ID
        const foundUser = await findUserById(query);

        // Поиск комнаты по ID или названию
        let foundRooms = [];
        if (getRoomsSync) {
            const allRooms = getRoomsSync();
            const q = query.toLowerCase();
            foundRooms = allRooms.filter(r =>
                r.isPublic && (
                    r.id.toLowerCase() === q ||
                    r.name.toLowerCase().includes(q)
                )
            );
        }

        if (!foundUser && foundRooms.length === 0) {
            result.innerHTML = '<p class="search-no-result">❌ Пользователь или канал/группа с таким ID/именем не найдены.</p>';
            return;
        }

        let html = '';

        // Результат: пользователь
        if (foundUser) {
            // Нельзя найти самого себя
            if (currentUser && foundUser.username.toLowerCase() === currentUser.username.toLowerCase()) {
                html += '<p class="search-no-result">Это вы сами 😄</p>';
            } else {
                html += `
                    <div class="search-user-card" data-type="user" data-uname="${escapeHtml(foundUser.username)}">
                        <div class="search-user-avatar">${foundUser.username.charAt(0).toUpperCase()}</div>
                        <div class="search-user-info">
                            <div class="search-user-name">${escapeHtml(foundUser.username)}</div>
                            <div class="search-user-id">${escapeHtml(foundUser.id)}</div>
                        </div>
                        <button class="btn-primary btn-write" data-action="write-user">✉ Написать</button>
                    </div>
                `;
            }
        }

        // Результаты: комнаты
        foundRooms.forEach(room => {
            const icon = room.type === 'channel' ? '📢' : '👥';
            html += `
                <div class="search-user-card" data-type="room" data-room-id="${escapeHtml(room.id)}">
                    <div class="search-user-avatar" style="background:var(--primary);color:#000;font-size:20px;">${icon}</div>
                    <div class="search-user-info">
                        <div class="search-user-name">${escapeHtml(room.name)}</div>
                        <div class="search-user-id">${escapeHtml(room.id)}</div>
                    </div>
                    <button class="btn-primary btn-write" data-action="join-room" data-room-id="${escapeHtml(room.id)}">Войти</button>
                </div>
            `;
        });

        result.innerHTML = html;

        // Обработчик кнопки «Написать» пользователю
        result.querySelectorAll('[data-action="write-user"]').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!foundUser) return;
                addChatToList(foundUser.username);
                openChat(foundUser);
                switchScreen('chat');
                document.getElementById('search-input').value = '';
                result.classList.add('hidden');
            });
        });

        // Обработчик кнопки «Войти» в комнату
        result.querySelectorAll('[data-action="join-room"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const roomId = btn.dataset.roomId;
                const { getRoomsSync, addChatToList, openChat, switchScreen } = window._px || {};
                const room = getRoomsSync().find(r => r.id === roomId);
                if (!room) return;
                addChatToList(room.id);
                openChat({username: room.id, id: room.id, status: 'online', isRoom: true, roomData: room});
                switchScreen('chat');
                document.getElementById('search-input').value = '';
                result.classList.add('hidden');
            });
        });
    }

    // ==================================================================
    // ПРОФИЛЬ: АВАТАР С КОМПРЕССИЕЙ
    // ==================================================================
    let userAvatarDataUrl = null;

    function updateAvatarUI(username, imgSrc) {
        const sidebarAvatar   = document.getElementById('home-user-avatar');
        const profileAvatarDiv = document.getElementById('profile-avatar-display');
        const letter = username.charAt(0).toUpperCase();

        if (imgSrc) {
            const imgTag = `<img src="${imgSrc}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
            if (sidebarAvatar)    sidebarAvatar.innerHTML    = imgTag;
            if (profileAvatarDiv) profileAvatarDiv.innerHTML = imgTag;
        } else {
            if (sidebarAvatar)    sidebarAvatar.innerText    = letter;
            if (profileAvatarDiv) profileAvatarDiv.innerText = letter;
        }
    }

    /** Компрессия изображения через Canvas → круг 200×200 */
    function compressImageToCircle(file, callback) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const SIZE = 200;
                const canvas = document.createElement('canvas');
                canvas.width = SIZE; canvas.height = SIZE;
                const ctx = canvas.getContext('2d');

                // Обрезаем по кругу
                ctx.beginPath();
                ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2);
                ctx.clip();

                // Вписываем изображение как cover
                const scale = Math.max(SIZE / img.width, SIZE / img.height);
                const sw = img.width  * scale;
                const sh = img.height * scale;
                const sx = (SIZE - sw) / 2;
                const sy = (SIZE - sh) / 2;
                ctx.drawImage(img, sx, sy, sw, sh);

                // Компрессия до JPEG 80%
                callback(canvas.toDataURL('image/jpeg', 0.8));
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    const avatarFileInput  = document.getElementById('avatar-file-input');
    const profileAvatarBtn = document.getElementById('profile-avatar-btn');

    profileAvatarBtn.addEventListener('click', () => avatarFileInput.click());

    avatarFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file || !currentUser) return;
        compressImageToCircle(file, (dataUrl) => {
            userAvatarDataUrl = dataUrl;
            updateAvatarUI(currentUser.username, dataUrl);
            saveUserAvatar(currentUser.username, dataUrl);
        });
        avatarFileInput.value = '';
    });

    // Копирование ID
    document.getElementById('btn-copy-id').addEventListener('click', () => {
        const btn    = document.getElementById('btn-copy-id');
        const idText = document.getElementById('profile-id-display').innerText;
        navigator.clipboard.writeText(idText).then(() => {
            btn.innerText = '✓'; btn.classList.add('copied');
            setTimeout(() => { btn.innerText = '⧉'; btn.classList.remove('copied'); }, 1500);
        }).catch(() => {
            const ta = document.createElement('textarea');
            ta.value = idText; document.body.appendChild(ta); ta.select();
            document.execCommand('copy'); document.body.removeChild(ta);
        });
    });

    // Сохранение изменений профиля
    document.getElementById('btn-save-profile').addEventListener('click', saveProfileChanges);

    // Выход из аккаунта
    document.getElementById('btn-logout').addEventListener('click', logout);

    // Завершение других сеансов
    document.getElementById('btn-terminate-other-sessions').addEventListener('click', terminateOtherSessions);

    // Выбор статуса Онлайн/Оффлайн
    document.getElementById('profile-status-select').addEventListener('change', async (e) => {
        const isOnline = e.target.value === 'online';
        currentUser.status = isOnline ? 'online' : 'offline';
        
        const users = await getUsers();
        const user = users.find(u => u.username.toLowerCase() === currentUser.username.toLowerCase());
        if (user) {
            user.status = currentUser.status;
            await saveUser(user);
        }
        
        updateStatusUI(isOnline);
        showToast(`Статус изменен на: ${isOnline ? 'Онлайн' : 'Оффлайн'}`);
    });

    // Проверка авто-входа на старте
    checkAutoLogin();

    // ==================================================================
    // УТИЛИТЫ
    // ==================================================================
    function escapeHtml(str) {
        return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
                  .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
    }

    window.addEventListener('popstate', () => {
        if (document.body.classList.contains('home-active')) {
            document.body.classList.remove('home-active');
        }
    });

    // ==========================================
    // ВСПЛЫВАЮЩЕЕ УВЕДОМЛЕНИЕ О БЛОКИРОВКЕ И АДМИН ПАНЕЛЬ
    // ==========================================
    window.showBanScreen = function(reason, untilTime) {
        const modal = document.getElementById('security-lockdown-modal');
        if (!modal) return;
        modal.querySelector('h1').textContent = 'Аккаунт заблокирован';
        modal.querySelector('p').textContent = 'Ваш аккаунт был заблокирован администратором WorldSviat.';
        const ipElem = document.getElementById('blocked-ip');
        if (ipElem) ipElem.parentElement.style.display = 'none';
        const reasonElem = document.getElementById('block-reason');
        if (reasonElem) reasonElem.textContent = reason || 'Нарушение правил';
        const timeElem = document.getElementById('block-time');
        if (timeElem) timeElem.textContent = untilTime || 'Навсегда';
        const warnElem = modal.querySelector('.lockdown-warning');
        if (warnElem) warnElem.textContent = '⚠️ Доступ к аккаунту ограничен.';
        modal.classList.remove('hidden');
    }

    // Периодическая проверка (чтобы мгновенно выкидывать забаненного)
    setInterval(async () => {
        if (currentUser) {
            const users = await getUsers();
            const me = users.find(u => u.username.toLowerCase() === currentUser.username.toLowerCase());
            if (me && me.isBanned) {
                document.getElementById('btn-logout').click();
                showBanScreen(me.banReason, me.banTime);
            }
        }
    }, 5000);

    // Админская панель для WorldSviat
    const originalSwitch = window.switchScreen;
    window.switchScreen = function(id) {
        if(originalSwitch) originalSwitch(id);
        const adminBtn = document.getElementById('help-open-admin');
        if (adminBtn) {
            if (currentUser && currentUser.username === 'WorldSviat') {
                adminBtn.classList.remove('hidden');
            } else {
                adminBtn.classList.add('hidden');
            }
        }
    };
    if (currentUser && currentUser.username === 'WorldSviat') {
        const adminBtn = document.getElementById('help-open-admin');
        if (adminBtn) adminBtn.classList.remove('hidden');
    }

    const btnAdmin = document.getElementById('help-open-admin');
    const adminModal = document.getElementById('admin-modal');
    const adminClose = document.getElementById('btn-admin-close');
    const adminList = document.getElementById('admin-users-list');
    const adminSearch = document.getElementById('admin-search-input');
    
    let allUsersCache = [];
    let currentBanTarget = null;
    
    async function renderAdminUsers(users) {
        if (!adminList) return;
        adminList.innerHTML = '';
        for (const u of users) {
            if (u.username === 'WorldSviat') continue;
            const div = document.createElement('div');
            div.className = 'search-user-card';
            div.style.flexDirection = 'column';
            div.style.alignItems = 'flex-start';
            
            div.innerHTML = `
                <div style="display:flex; width:100%; align-items:center; margin-bottom:10px;">
                    <div class="search-user-avatar" style="width:40px;height:40px;font-size:16px;">${u.avatar ? '<img src="' + u.avatar + '" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">' : '?'}</div>
                    <div class="search-user-info" style="margin-left:10px;">
                        <div class="search-user-nickname">${escapeHtml(u.username)}</div>
                        <div class="search-user-id">${u.id} ${u.isBanned ? '<span style="color:#ff3b5c;font-size:12px;">(ЗАБАНЕН)</span>' : ''}</div>
                    </div>
                </div>
                <div style="display:flex; flex-wrap:wrap; gap:5px; width:100%;">
                    <button class="btn-primary" style="flex:1; padding:8px; font-size:11px; ${u.isBanned ? 'border-color:#ff3b5c;' : ''}" id="adm-ban-${u.id.replace('#','')}">${u.isBanned ? 'Разбанить' : 'Заблокировать'}</button>
                </div>
            `;
            adminList.appendChild(div);
            
            document.getElementById(`adm-ban-${u.id.replace('#','')}`).onclick = async () => {
                if (u.isBanned) {
                    u.isBanned = false;
                    u.banReason = '';
                    u.banTime = '';
                    await saveUser(u);
                    renderAdminUsers(allUsersCache);
                } else {
                    currentBanTarget = u;
                    const targetName = document.getElementById('ban-target-name');
                    if(targetName) targetName.textContent = `Пользователь: ${u.username} (${u.id})`;
                    const reason = document.getElementById('ban-reason');
                    if(reason) reason.value = '';
                    const time = document.getElementById('ban-time');
                    if(time) time.value = '';
                    const banModal = document.getElementById('admin-ban-modal');
                    if(banModal) banModal.classList.remove('hidden');
                }
            };
        }
    }
    
    if (btnAdmin) {
        btnAdmin.addEventListener('click', async () => {
            if (adminModal) adminModal.classList.remove('hidden');
            allUsersCache = await getUsers();
            renderAdminUsers(allUsersCache);
        });
    }
    if (adminClose) adminClose.onclick = () => { if (adminModal) adminModal.classList.add('hidden'); };
    if (adminSearch) {
        adminSearch.oninput = () => {
            const q = adminSearch.value.toLowerCase();
            const filtered = allUsersCache.filter(u => u.username.toLowerCase().includes(q) || u.id.toLowerCase().includes(q));
            renderAdminUsers(filtered);
        };
    }
    const btnBanSubmit = document.getElementById('btn-ban-submit');
    if (btnBanSubmit) {
        btnBanSubmit.onclick = async () => {
            if (!currentBanTarget) return;
            currentBanTarget.isBanned = true;
            currentBanTarget.banReason = document.getElementById('ban-reason').value.trim() || 'Нарушение правил';
            currentBanTarget.banTime = document.getElementById('ban-time').value.trim() || 'Навсегда';
            await saveUser(currentBanTarget);
            const banModal = document.getElementById('admin-ban-modal');
            if (banModal) banModal.classList.add('hidden');
            renderAdminUsers(allUsersCache);
        };
    }
    const btnBanCancel = document.getElementById('btn-ban-cancel');
    if (btnBanCancel) {
        btnBanCancel.onclick = () => {
            const banModal = document.getElementById('admin-ban-modal');
            if (banModal) banModal.classList.add('hidden');
        };
    }

    // Call UI bindings
    const btnAcceptCall = document.getElementById('btn-accept-call');
    if (btnAcceptCall) {
        btnAcceptCall.addEventListener('click', () => {
            document.getElementById('incoming-call-modal').classList.add('hidden');
            showCallScreen(incomingCallPeer, "Установка защищенного P2P...");
            publishSignal('call_accepted', {});
        });
    }

    const btnDeclineCall = document.getElementById('btn-decline-call');
    if (btnDeclineCall) {
        btnDeclineCall.addEventListener('click', () => {
            document.getElementById('incoming-call-modal').classList.add('hidden');
            publishSignal('call_rejected', {});
            stopCallAndReset();
        });
    }

    // Hangup/Mute in full screen call are already bound when openChat is called, but we have global buttons in screen-call
    const btnHangupCall = document.getElementById('btn-hangup-call');
    if (btnHangupCall) {
        btnHangupCall.addEventListener('click', () => {
            publishSignal('call_hangup', {});
            stopCallAndReset();
        });
    }

    const btnMicOffCall = document.getElementById('btn-mic-off-call');
    if (btnMicOffCall) {
        btnMicOffCall.addEventListener('click', () => {
            if (localStream) {
                const audioTrack = localStream.getAudioTracks()[0];
                if (audioTrack) {
                    audioTrack.enabled = !audioTrack.enabled;
                    btnMicOffCall.textContent = audioTrack.enabled ? '🎙️' : '🔇';
                    btnMicOffCall.style.background = audioTrack.enabled ? '#333' : 'var(--error-color)';
                }
            }
        });
    }
});
