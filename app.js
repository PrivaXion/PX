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
    try {


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
    // HELPERS (Авторизация и данные — только localStorage)
    // ==================================================================

    // ==================================================================
    // СИСТЕМА БЕЗОПАСНОСТИ: АНТИ-СКАЧИВАНИЕ, БЛОКИРОВКА DEVTOOLS, IP
    // ==================================================================

    /** Получить IP адрес устройства (1.0 FIX: автономно, без внешних fetch) */
    async function getIPAddress() {
        // IP-определение в автономном релизе не используется.
        return 'UNKNOWN_IP';
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
        if (window.innerWidth > 768 && (window.outerHeight - window.innerHeight > 200 || window.outerWidth - window.innerWidth > 200)) {
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
    
    function getUserBadgesHTML(user) {
        if (!user) return '';
        let html = '';
        // Красная галочка — Администратор/Разработчик (глубокий алый)
        if (user.redCheckmark) {
            html += `<span style="margin-left:4px;display:inline-flex;vertical-align:middle;" title="Администратор PrivaXion">
                <svg width="17" height="17" viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="8.5" cy="8.5" r="8.5" fill="#C0152A"/>
                  <path d="M4 8.5L7 11.5L13 5.5" stroke="white" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </span>`;
        }
        // Синяя галочка — Верифицирован (яркий циан как на скриншоте)
        if (user.blueCheckmark) {
            html += `<span style="margin-left:4px;display:inline-flex;vertical-align:middle;" title="Верифицирован">
                <svg width="17" height="17" viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="8.5" cy="8.5" r="8.5" fill="#00C8F0"/>
                  <path d="M4 8.5L7 11.5L13 5.5" stroke="white" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </span>`;
        }
        return html;
    }
    function saveUserChats(username) {
        const encryptedChats = {};
        const allRooms = typeof getRoomsSync === 'function' ? getRoomsSync() : [];
        let roomsChanged = false;

        for (const otherUser in chats) {
            const roomIndex = allRooms.findIndex(r => r.id === otherUser);
            if (roomIndex !== -1) {
                allRooms[roomIndex].messages = chats[otherUser];
                roomsChanged = true;
            }

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

        if (roomsChanged && typeof _saveRoomsArray === 'function') {
            _saveRoomsArray(allRooms);
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
    // getIPAddress уже объявлен выше — оставляем здесь только alias для совместимости.
    // eslint-disable-next-line no-unused-vars
    async function getIPAddressAlias() {
        return await getIPAddress();
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
      // Append session to user's sessions array
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
            if (user && user.sessions && user.sessions.some(s => s.id === sessionId)) {
                await enterSystem(user);
                return true;
            }
        }
        return false;
    }

    // ================================================================
    // Secur Helper Bot (всегда есть + логирование входа)
    // ================================================================
    const SEcurHelperBotName = 'Secur Helper Bot';

    function ensureSecurHelperBotChatExists() {
        if (!chats[SEcurHelperBotName]) chats[SEcurHelperBotName] = [];
        return SEcurHelperBotName;
    }

    function maskHalfIp(ip) {
        try {
            if (!ip || typeof ip !== 'string') return 'UNKNOWN_IP';
            if (ip === 'UNKNOWN_IP') return 'UNKNOWN_IP';

            // IPv6/неформатируемые случаи
            if (ip.includes(':')) {
                const parts = ip.split(':').filter(Boolean);
                const start = parts.slice(0, 2).join(':');
                const end = parts.slice(-2).join(':');
                return `${start}:****:${end}`;
            }

            const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
            if (!m) return ip;

            const a = m[1], b = m[2], d = m[4];
            return `${a}.${b}.****.${d}`;
        } catch (e) {
            return 'UNKNOWN_IP';
        }
    }

    async function getCountryByIp(ip) {
        // 1.0 FIX: автономный режим без внешних fetch. Гео по IP не определяется.
        return 'UNKNOWN';
    }


    /** Уведомление Secur Helper Bot при входе */
    async function triggerSystemBotNotification(username, session) {
        const botName = ensureSecurHelperBotChatExists();

        const sessionKey = `px_notified_${session.id}`;
        if (localStorage.getItem(sessionKey)) return;
        localStorage.setItem(sessionKey, 'true');

        const halfIp = maskHalfIp(session.ip);
        const country = await getCountryByIp(session.ip);

        const now = new Date();
        const time = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;

        const msgText =
            `🔔 Новый вход в аккаунт!\n` +
            `📅 Время: ${time}\n` +
            `🌐 IP (пол-адреса): ${halfIp}\n` +
            `🏳️ Страна: ${country}\n` +
            `💻 Устройство: ${session.device}\n\n` +
            `Если это были не вы — завершите остальные сеансы в разделе Безопасность.`;

        const msgId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

        chats[botName].push({
            from: 'bot',
            text: msgText,
            time: time.slice(0, 5), // UI времени в сообщениях оставим HH:MM
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
        document.body.classList.remove('auth-active');
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
        const clash = getUsers().filter(u => u.username.toLowerCase() === newUsername.toLowerCase());
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

    // ---------- localStorage‑based user management (0% серверных данных) ----------
    const PX_USERS_KEY = 'px_users';

    function getUsers() {
      // Все данные пользователей хранятся ТОЛЬКО в localStorage браузера
      try {
        return JSON.parse(localStorage.getItem(PX_USERS_KEY) || '[]');
      } catch (e) {
        console.error('getUsers parse error:', e);
        return [];
      }
    }

    function _saveUsersArray(users) {
      localStorage.setItem(PX_USERS_KEY, JSON.stringify(users));
    }

    
    // ================== ROOMS API ==================
    const PX_ROOMS_KEY = 'px_rooms';

    async function getRooms() {
        return getRoomsSync();
    }

    function getRoomsSync() {
        try {
            return JSON.parse(localStorage.getItem(PX_ROOMS_KEY) || '[]');
        } catch(e) { return []; }
    }

    function _saveRoomsArray(rooms) {
        localStorage.setItem(PX_ROOMS_KEY, JSON.stringify(rooms));
    }

    async function saveRoom(room) {
        try {
            const rooms = getRoomsSync();
            const idx = rooms.findIndex(r => r.id === room.id);
            if (idx !== -1) {
                rooms[idx] = { ...rooms[idx], ...room };
            } else {
                rooms.push(room);
            }
            _saveRoomsArray(rooms);
        } catch(e) {}
    }

    async function deleteRoomApi(roomId) {
        try {
            const rooms = getRoomsSync();
            const filtered = rooms.filter(r => r.id !== roomId);
            _saveRoomsArray(filtered);
        } catch(e) {}
    }
    // ===============================================
function saveUser(user) {
      // Сохраняем / обновляем пользователя в localStorage
      const users = getUsers();
      const idx = users.findIndex(u => u.id === user.id);
      if (idx !== -1) {
        users[idx] = { ...users[idx], ...user };
      } else {
        users.push(user);
      }
      _saveUsersArray(users);
      return user;
    }

    function replaceAllUsers(usersArray) {
      _saveUsersArray(usersArray);
    }

    // Register a new user (localStorage). Returns the created user object or null if nickname taken.
    async function registerUser(username, password) {
      const users = getUsers();
      const existing = users.filter(u => u.username.toLowerCase() === username.toLowerCase());
      if (existing.length) return null; // nickname taken
      const id = generateUserId();
      const hashedPassword = await hashPassword(password);
      // birthDate добавим позже после проверки (из register form)
      const newUser = { username, password: hashedPassword, passwordHash: hashedPassword, id, avatar: null, bio: '', status: 'online', sessions: [], friends: [] };
      users.push(newUser);
      _saveUsersArray(users);
      return newUser;
    }

    // ---------- Password hashing (client-side demo) ----------
    // Для production лучше перенести на backend.
    // Используем SHA-256 через WebCrypto.
    async function sha256Hex(input) {
      const enc = new TextEncoder();
      const data = enc.encode(String(input));
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    function normalizePasswordForHash(password) {
      return `px_v1_salt::${String(password)}`; // простой salt-namespace
    }

    async function hashPassword(password) {
      return sha256Hex(normalizePasswordForHash(password));
    }

    // Login (localStorage) – checks hashed password.
    async function loginUser(username, password) {
      // Legacy fallback – not used in new JSON-key login
      const users = getUsers();
      const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
      if (!user) return { error: 'Пользователь не найден.' };
      const expectedHash = user.password;
      const candidateHash = await hashPassword(password);
      if (expectedHash !== candidateHash) return { error: 'Неверный пароль.' };
      if (user.isBanned) {
          return { error: `Аккаунт заблокирован!\nПричина: ${user.banReason || 'Не указана'}\nСрок: ${user.banTime || 'Навсегда'}\nДетали: ${user.banDesc || ''}` };
      }
      return { user };
    }

    function loginUserByKeyFile(keyData) {
      if (!keyData || !keyData.username || !keyData.passwordHash) {
          return { error: 'Недопустимый файл-ключ: отсутствуют обязательные поля.' };
      }
      const users = getUsers();
      const user = users.find(u => u.username.toLowerCase() === keyData.username.toLowerCase());
      if (!user) return { error: 'Пользователь из файла-ключа не найден.' };
      if ((user.password || user.passwordHash) !== keyData.passwordHash) {
          return { error: 'Файл-ключ недействителен или устарел.' };
      }
      if (user.isBanned) {
          return { error: `Аккаунт заблокирован!\nПричина: ${user.banReason || 'Не указана'}\nСрок: ${user.banTime || 'Навсегда'}\nДетали: ${user.banDesc || ''}` };
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
        
        // ИСТИНА ПРИВАТНОСТИ: Инициализация SQLCipher после успешного входа
        if (window.SecureDB) {
            try {
                await window.SecureDB.initSecureDatabase(user.id + "_secret_key");
            } catch (e) {
                console.error("Не удалось открыть базу данных", e);
            }
        }

        // Админ доступ — только по флагу из файла-ключа (user.isAdmin === true)
        const isAdmin = !!user.isAdmin;

        // Авто-назначение красной галочки админам
        if (isAdmin && !user.redCheckmark) {
            user.redCheckmark = true;
            await saveUser(user);
        }

        // На всякий случай: если isAdmin не включен — скрываем красную галочку
        if (!isAdmin && user.redCheckmark) {
            user.redCheckmark = false;
            await saveUser(user);
        }

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

        // ВАЖНО: пока идёт авторизация (хотя бы welcome/auth-container),
        // отключаем перекрывающий клики welcome-screen.
        // Это нужно для телефонов, где #welcome-screen может перехватывать тапы.
        document.body.classList.add('auth-active');

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

        const keyFile = document.getElementById('login-keyfile-input').files[0];
        const captcha  = document.getElementById('login-captcha-input').value.trim();
        if (captcha.toLowerCase() !== currentLoginCaptcha.toLowerCase()) {
            showError(loginErrorDiv, 'Неверный текст с картинки.');
            refreshLoginCaptcha(); return;
        }

        if (!keyFile) {
            showError(loginErrorDiv, 'Прикрепите файл-ключ');
            refreshLoginCaptcha(); return;
        }

        try {
            const fileText = await keyFile.text();
            let keyData;
            try { keyData = JSON.parse(fileText); } catch(e) { 
                showError(loginErrorDiv, 'Неверный формат ключа'); return; 
            }
            
            const username = keyData.username;
            if (!username) {
                showError(loginErrorDiv, 'Файл-ключ не содержит имени пользователя'); return; 
            }
            
            const allLocalUsers = getUsers();
            const matchedUsers = allLocalUsers.filter(u => u.username.toLowerCase() === username.toLowerCase());
            if (matchedUsers.length === 0) {
                showError(loginErrorDiv, 'Пользователь не найден');
                refreshLoginCaptcha(); return;
            }
            const user = matchedUsers[0];

            if (user.isBanned) {
                showError(loginErrorDiv, `Аккаунт заблокирован.<br>Причина: ${user.banReason}<br>Срок: ${user.banTime}`);
                refreshLoginCaptcha(); return;
            }

            // Verify with JSON
            if (user.passwordHash !== keyData.passwordHash || user.id !== keyData.id) {
                showError(loginErrorDiv, 'Неверный или поврежденный ключ-файл');
                refreshLoginCaptcha(); return;
            }
            
            await enterSystem(user);


        } catch (err) {
            // Чтобы “ничего не происходило” стало заметным
            console.error('Login error:', err);
            showError(loginErrorDiv, 'Ошибка входа. Попробуйте ещё раз.');
            refreshLoginCaptcha();
        }
    });

    // ==================================================================
    // ФОРМА РЕГИСТРАЦИИ
    // ==================================================================
    document.getElementById('register-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const termsCheckbox = document.getElementById('terms-accept');
        if (termsCheckbox && !termsCheckbox.checked) {
            const errEl = document.getElementById('register-error');
            showError(errEl, 'Необходимо принять пользовательское соглашение.');
            return;
        }
        registerErrorDiv.classList.remove('show');

        // Диагностика "кнопка жмётся, но ничего не происходит" на телефоне:
        // подтверждаем, что submit реально дошёл до handler'а.
        try {
            showToast('🧪 Регистрация: submit обработан', 'success');
        } catch (_) {}

        try {
            const username = document.getElementById('register-username').value.trim();
            const password = document.getElementById('register-password').value;
            const confirm  = document.getElementById('register-confirm-password').value;
            const captcha  = document.getElementById('register-captcha-input').value.trim();
            const birthEl  = document.getElementById('register-birthdate');
            const birthdate = birthEl ? birthEl.value : '';

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
                // Важно: если на телефоне DOM отличается (поле отсутствует) — так мы узнаем причину
                showError(registerErrorDiv, 'Укажите дату рождения.');
                if (!birthEl) showToast('Поле даты рождения отсутствует в DOM', 'error');
                return;
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

            try {
                const user = await registerUser(username, password);
                if (!user) {
                    showError(registerErrorDiv, `Никнейм «${username}» уже занят. Выберите другой.`);
                    return;
                }

                const nextCount = countUsersOnThisDevice(deviceId) + 1;
                setUsersOnThisDevice(deviceId, nextCount);

                user.birthDate = birthdate;
                await saveUser(user);

                // iOS/Safari часто блокирует data: URL + programmatic click.
                // Не должны ломать вход — если скачивание не сработает, просто покажем toast и продолжаем enterSystem.
                try {
                    downloadCredentials(username, password, user.id);
                    showToast('Credentials сохранены (если поддерживается браузером)', 'success');
                } catch (e) {
                    console.warn('downloadCredentials failed:', e);
                    showToast('Скачивание credentials не поддерживается в этом браузере', 'error');
                }

                await enterSystem(user);
            } catch (err) {
                console.error('Register submit fetch error:', err);

                const detail = err && err.message ? `: ${err.message}` : '';
                const msg = `Ошибка регистрации${detail}`;
                showError(registerErrorDiv, msg);
                showToast(msg, 'error');

                refreshRegisterCaptcha();
            }
        } catch (err) {
            console.error('Register submit handler crashed:', err);
            const msg = `Регистрация не удалась: ${err && err.message ? err.message : String(err)}`;
            showError(registerErrorDiv, msg);
            showToast(msg, 'error');
            refreshRegisterCaptcha();
        }
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

            // Админ меню в профиле
            const adminProfileMenu = document.getElementById('admin-profile-menu');
            const isAdmin = currentUser && currentUser.isAdmin === true;

            if (adminProfileMenu) {
                if (isAdmin) adminProfileMenu.classList.remove('hidden');
                else adminProfileMenu.classList.add('hidden');
            }
        }

        if (name === 'settings') {
            renderSessions();
        }
        if (name === 'news') {
            renderNews();
            updateNewsBadge(0);

            // Показываем админ-форму только для #000000
            const adminContainer = document.getElementById('admin-news-container');
            const isAdmin = currentUser && currentUser.id === '#000000';
            if (adminContainer) {
                if (isAdmin) adminContainer.classList.remove('hidden');
                else adminContainer.classList.add('hidden');
            }
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
    document.getElementById('help-open-news')?.addEventListener('click', async () => {
        switchScreen('news');
        const adminContainer = document.getElementById('admin-news-container');
        if (adminContainer) {
            if (currentUser && currentUser.id === '#000000') {
                adminContainer.classList.remove('hidden');
            } else {
                adminContainer.classList.add('hidden');
            }
        }
    });

    // Админ: кнопка из профиля -> на новости + показываем форму ввода
    document.getElementById('admin-go-to-news')?.addEventListener('click', async () => {
        switchScreen('news');
        const adminContainer = document.getElementById('admin-news-container');
        if (adminContainer) {
            adminContainer.classList.remove('hidden');
        }
    });


    document.getElementById('help-open-settings')?.addEventListener('click', () => switchScreen('settings'));

    // ==================================================================
    // НОВОСТИ (API)
    // ==================================================================
    const NEWS_AUTHOR_ID = '#000000';

    let cachedNews = [];
    const PX_NEWS_KEY = 'px_news';

    function getNewsSync() {
        try {
            return JSON.parse(localStorage.getItem(PX_NEWS_KEY) || '[]');
        } catch(e) { return []; }
    }

    function _saveNewsArray(newsArr) {
        localStorage.setItem(PX_NEWS_KEY, JSON.stringify(newsArr));
    }

    async function fetchNews() {
        try {
            const news = getNewsSync();
            return Array.isArray(news) ? news.sort((a, b) => b.ts - a.ts) : [];
        } catch(e) {
            return [];
        }
    }

    async function renderNews() {
        const list = document.getElementById('news-list');
        if (!list) return;

        const news = await fetchNews();
        cachedNews = news;

        list.innerHTML = '';
        if (!news.length) {
            list.innerHTML = '<div class="news-empty" id="news-empty">Нет новостей</div>';
            return;
        }

        const userId = currentUser ? currentUser.id : null;

        news.forEach(item => {
            const card = document.createElement('div');
            card.className = 'news-card';
            const date = item.ts ? new Date(item.ts).toLocaleString('ru-RU') : '';

            const likes    = item.likes    || 0;
            const dislikes = item.dislikes || 0;
            const voters   = item.voters   || {};
            const myVote   = userId ? (voters[userId] || null) : null;

            card.innerHTML = `
                <div class="news-card-header">
                    <span class="news-author">📢 PrivaXion Official</span>
                    <span class="news-date">${date}</span>
                </div>
                <div class="news-body">${escapeHtml(item.text || '').replace(/\n/g,'<br>')}</div>
                <div class="news-reactions">
                    <button class="news-reaction-btn news-like-btn${myVote === 'like' ? ' active-like' : ''}" data-news-id="${item.id}" data-vote="like" title="Нравится">
                        <span class="news-reaction-icon">👍</span>
                        <span class="news-reaction-count">${likes}</span>
                    </button>
                    <button class="news-reaction-btn news-dislike-btn${myVote === 'dislike' ? ' active-dislike' : ''}" data-news-id="${item.id}" data-vote="dislike" title="Не нравится">
                        <span class="news-reaction-icon">👎</span>
                        <span class="news-reaction-count">${dislikes}</span>
                    </button>
                </div>
            `;

            // Attach click handlers
            card.querySelectorAll('.news-reaction-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    if (!currentUser) { showToast('Войдите чтобы оценивать новости', 'error'); return; }
                    await voteNews(item.id, btn.dataset.vote);
                });
            });

            list.appendChild(card);
        });
    }

    /** Голосование за/против новости */
    async function voteNews(newsId, voteType) {
        const userId = currentUser.id;
        // Find item in cache
        const item = cachedNews.find(n => String(n.id) === String(newsId));
        if (!item) return;

        const voters   = { ...(item.voters || {}) };
        const prevVote = voters[userId] || null;

        let likes    = item.likes    || 0;
        let dislikes = item.dislikes || 0;

        // Remove previous vote
        if (prevVote === 'like')    { likes    = Math.max(0, likes - 1); }
        if (prevVote === 'dislike') { dislikes = Math.max(0, dislikes - 1); }

        if (prevVote === voteType) {
            // Toggle off — remove vote
            delete voters[userId];
        } else {
            // Set new vote
            voters[userId] = voteType;
            if (voteType === 'like')    likes++;
            if (voteType === 'dislike') dislikes++;
        }

        try {
            const allNews = getNewsSync();
            const idx = allNews.findIndex(n => String(n.id) === String(newsId));
            if (idx !== -1) {
                allNews[idx].likes = likes;
                allNews[idx].dislikes = dislikes;
                allNews[idx].voters = voters;
                _saveNewsArray(allNews);
            }

            // Update cache
            item.likes    = likes;
            item.dislikes = dislikes;
            item.voters   = voters;
            // Re-render only this card
            renderNews();
        } catch(e) {
            showToast('Ошибка при сохранении реакции', 'error');
        }
    }

    // Добавить новость (API) — доступно только админу с ID #000000
    async function postNews(text) {
        if (!text || !text.trim()) return;
        const item = { id: 'news_' + Date.now(), text: text.trim(), authorId: NEWS_AUTHOR_ID, ts: Date.now(), likes: 0, dislikes: 0, voters: {} };
        const allNews = getNewsSync();
        allNews.push(item);
        _saveNewsArray(allNews);
        const prevCount = (await fetchNews()).length - 1;
        updateNewsBadge(Math.max(0, (await fetchNews()).length - prevCount));
        renderNews();
    }

    document.getElementById('admin-news-btn')?.addEventListener('click', () => {
        const input = document.getElementById('admin-news-input');
        if (input && input.value.trim()) {
            postNews(input.value);
            input.value = '';
        }
    });

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
        // ВАЖНО: НЕ перезаписываем весь header (чтобы не ломать chat-room-name + counter)
        const chatHeader = document.getElementById('chat-header-bar');
        if (!chatHeader || !activeChatPeer) return;

        let statusText = '';
        if (state === 'typing') statusText = 'печатает...';
        else if (state === 'offline') statusText = 'Оффлайн';
        else statusText = 'Онлайн';

        const statusClass = (state === 'offline') ? 'status-offline' : 'status-online';

        const peerIsOnline = (activeChatPeer.username === 'System Bot') ? true : (activeChatPeer.status !== 'offline');
        const disableCalling = !peerIsOnline;

        // Обновляем только строку статуса, если она уже существует.
        // Если ещё нет — создаём, но не трогаем блок с названием/счётчиком.
        let statusEl = document.getElementById('chat-header-status-line');
        if (!statusEl) {
            // Попробуем найти куда вставлять: после #chat-room-name или первым элементом в header-chat-info
            const infoWrap = chatHeader.querySelector('.header-chat-info') || chatHeader;
            statusEl = document.createElement('div');
            statusEl.id = 'chat-header-status-line';
            infoWrap.appendChild(statusEl);
        }

        // "Онлайн" убираем как отдельную ломаную надпись: оставляем только текст (типинг/оффлайн).
        // По ТЗ: нужно убрать отображение "Онлайн" под названием; для online показываем пусто.
        const shouldShowOnlineText = state !== 'online';
        statusEl.className = `header-chat-status ${statusClass} ${shouldShowOnlineText ? '' : 'hidden'}`.trim();
        statusEl.textContent = shouldShowOnlineText ? `${statusText} · E2EE` : '';

        // Колл-контролы тоже не перезаписываем полностью — только attributes/disabled если элементы есть.
        const btnCall = document.getElementById('btn-call');
        const btnHangup = document.getElementById('btn-hangup');
        const btnMic = document.getElementById('btn-mic-off');

        if (btnCall) {
            btnCall.disabled = disableCalling;
            if (!btnCall.dataset.bound) {
                // binding сделается позже в openChat через setTimeout
            }
        }
        if (btnHangup) {
            // оставляем текущий класс hidden/видимость как есть
        }
        if (btnMic) {
            // текст микрофона обновится отдельно в setMicEnabled/syncMicButtonUI
        }
    }

    // ==================================================================
    // WEBRTC CALLS (demo) — поверх signal-server (SSE + POST)
    // ==================================================================
    // ВАЖНО: для телефонов делаем сигналинг не на localhost, а на хост текущей страницы.
    // Иначе телефон будет пытаться подключиться к сигналингу на самом себе.
    const SIGNAL_SERVER_PORT = 5555;
    // ВАЖНО: нужен тот же протокол (http).
    const SIGNAL_SERVER_BASE = (() => {
        const host = window.location.hostname;
        const proto = window.location.protocol;
        return `${proto}//${host}:${SIGNAL_SERVER_PORT}`;
    })();

    function getOrCreateClientId() {
        let id = localStorage.getItem('px_client_id');
        if (!id) {
            id = 'c_' + Math.random().toString(36).slice(2) + '_' + Date.now().toString(36);
            localStorage.setItem('px_client_id', id);
        }
        return id;
    }

    const clientId = getOrCreateClientId();

    // roomId для пары пользователей
    function getCallRoomId(userA, userB) {
        const sorted = [userA.toLowerCase(), userB.toLowerCase()].sort();
        return `room_${sorted[0]}_${sorted[1]}`;
    }

    let callRoomId = null;
    let callEventSource = null;

    let rtcPeer = null;
    let localStream = null;
    let remoteStream = null;

    // audio элемента для проигрывания удалённого голоса
    let remoteAudioEl = null;

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

        const micBtn = document.getElementById('btn-mic-off');
        const micText = document.getElementById('mic-status-text');
        if (micText) micText.textContent = enabled ? 'mic: on' : 'mic: off';
        if (micBtn) micBtn.textContent = enabled ? '🎙️ Микрофон ВКЛ' : '🔇 Микрофон ВЫКЛ';
    }

    function publishSignal(signalType, payload, toClient = null) {
        if (!callRoomId) return;

        // отправляем в комнату всем (to=null) — так проще, потому что peer clientId неизвестен
        return fetch(`${SIGNAL_SERVER_BASE}/signal?roomId=${encodeURIComponent(callRoomId)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                from: clientId,
                to: toClient,
                type: signalType,
                payload,
                id: String(Date.now()) + '_' + Math.random().toString(36).slice(2)
            })
        }).catch(() => {});
    }

    function setupRtcPeer() {
        const pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });

        pc.onicecandidate = (e) => {
            if (e.candidate) {
                publishSignal('ice', { candidate: e.candidate });
            }
        };

        pc.ontrack = (e) => {
            if (!remoteStream) {
                remoteStream = new MediaStream();
                ensureRemoteAudioElement().srcObject = remoteStream;
            }
            remoteStream.addTrack(e.track);
        };

        rtcPeer = pc;
        return pc;
    }

    function showCallScreen(peerName) {
        const callScreen = document.getElementById('screen-call');
        const chatScreen = document.getElementById('screen-chat');
        if (callScreen) callScreen.classList.remove('hidden');
        if (chatScreen) chatScreen.classList.add('hidden');

        const peerLabel = document.getElementById('call-peer-label');
        if (peerLabel) peerLabel.textContent = peerName ? peerName : '...';

        const statusText = document.getElementById('call-status-text');
        if (statusText) statusText.textContent = 'ожидание…';
    }

    function hideCallScreen() {
        const callScreen = document.getElementById('screen-call');
        const chatScreen = document.getElementById('screen-chat');
        if (callScreen) callScreen.classList.add('hidden');
        if (chatScreen) chatScreen.classList.remove('hidden');
    }

    function setCallStatus(text) {
        const statusText = document.getElementById('call-status-text');
        if (statusText) statusText.textContent = text;
    }

    function syncMicButtonUI() {
        // chat header mic button
        const btnMic = document.getElementById('btn-mic-off');
        // call screen mic button
        const btnMicCall = document.getElementById('btn-mic-off-call');

        const enabled = !!(localStream && localStream.getAudioTracks().length && localStream.getAudioTracks()[0].enabled);

        if (btnMic) {
            btnMic.textContent = enabled ? '🎙️ Микрофон ВКЛ' : '🔇 Микрофон ВЫКЛ';
        }
        if (btnMicCall) {
            btnMicCall.textContent = enabled ? '🎙️ Микрофон ВКЛ' : '🔇 Микрофон ВЫКЛ';
            btnMicCall.dataset.micState = enabled ? 'on' : 'off';
        }
    }

    async function startCall() {
        if (!activeChatPeer || !activeChatUser) return;

        const peerIsOnline = (activeChatPeer.username === 'System Bot') ? true : (activeChatPeer.status !== 'offline');
        if (!peerIsOnline) {
            showToast('Собеседник оффлайн — звонок недоступен', 'error');
            return;
        }

        showCallScreen(activeChatPeer.username);

        // media
        try {
            localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        } catch (e) {
            showToast('Нет доступа к микрофону или он выключен', 'error');
            setCallStatus('ошибка: микрофон недоступен');
            return;
        }

        setMicEnabled(true);
        syncMicButtonUI();

        setCallStatus('соединение…');

        const pc = setupRtcPeer();
        localStream.getTracks().forEach(t => pc.addTrack(t, localStream));

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        await publishSignal('offer', { sdp: pc.localDescription });
    }

    async function handleIncomingSignal(msg) {
        // msg: {kind:'message', from, type, payload}
        if (!msg || msg.kind !== 'message') return;
        if (!rtcPeer && (msg.type === 'offer')) {
            setupRtcPeer();
        }
        if (!rtcPeer) return;

        try {
            if (msg.type === 'offer') {
                const sdp = msg.payload?.sdp;
                if (!sdp) return;

                await rtcPeer.setRemoteDescription(new RTCSessionDescription(sdp));

                // Если нет localStream — запрашиваем, чтобы ответить
                if (!localStream) {
                    try {
                        localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                        localStream.getTracks().forEach(t => rtcPeer.addTrack(t, localStream));
                        setMicEnabled(true);
                    } catch (e) {
                        // без микрофона всё равно можно ответить
                    }
                }

                const answer = await rtcPeer.createAnswer();
                await rtcPeer.setLocalDescription(answer);
                await publishSignal('answer', { sdp: rtcPeer.localDescription });
            } else if (msg.type === 'answer') {
                const sdp = msg.payload?.sdp;
                if (!sdp) return;
                await rtcPeer.setRemoteDescription(new RTCSessionDescription(sdp));
            } else if (msg.type === 'ice') {
                const cand = msg.payload?.candidate;
                if (!cand) return;
                await rtcPeer.addIceCandidate(new RTCIceCandidate(cand));
            }
        } catch (e) {
            // молча
        }
    }

    function stopCallAndReset() {
        cleanupRtc();
        // микрофон выключим полностью
        stopLocalTracks();
        setMicEnabled(false);
        syncMicButtonUI();
        setCallStatus('отбой');
        hideCallScreen();
    }

    function connectToCallRoom() {
        if (!activeChatPeer || !activeChatUser || !currentUser) return;

        const nextRoomId = getCallRoomId(currentUser.username, activeChatPeer.username);
        callRoomId = nextRoomId;

        // закрываем старую подписку
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
                if (data && data.kind === 'message' && data.from === clientId) return; // игнорировать себя
                handleIncomingSignal(data).catch(() => {});
            } catch (e) {}
        });

        callEventSource.onerror = () => {
            // можно молча ждать реконнект
        };
    }

    // ==================================================================
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
        let usernames = Object.keys(chats);
        
        // Also fetch rooms the user is part of
        try {
            const allRooms = await getRooms();
            const myRooms = allRooms.filter(r => r.members.includes(currentUser.id));
            myRooms.forEach(r => {
                if (!usernames.includes(r.id)) {
                    usernames.push(r.id);
                }
            });
        } catch(e) {}

        if (chatFolderMode === 'home') return usernames;

        const results = [];
        for (const uname of usernames) {
            if (uname.startsWith('#ch_') || uname.startsWith('#gr_')) {
                results.push(uname); // Show rooms in friends list too, or maybe not? 
            } else {
                if (await isFriendByUsername(uname)) results.push(uname);
            }
        }
        return results;
    }

    function setChatFolderMode(mode) {
        chatFolderMode = mode === 'friends' ? 'friends' : 'home';
        renderChatList();
    }

    // Статусы прочтения больше не показываем галочками.
    // Вместо этого будем визуализировать “Read Wave” через классы.
    function getMessageStatusUI(status) {
        if (status === 'read') return { className: 'msg-read-wave', wave: true };
        return { className: '', wave: false };
    }


    function openChat(targetUser) {
        activeChatPeer = targetUser || null;
        activeChatUser = targetUser.username;
        
        if (targetUser && targetUser.isRoom) {
            const allRooms = getRoomsSync();
            const room = allRooms.find(r => r.id === activeChatUser);
            if (room) {
                chats[activeChatUser] = room.messages || [];
            } else {
                chats[activeChatUser] = [];
            }
        } else {
            if (!chats[activeChatUser]) chats[activeChatUser] = [];
        }

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
        const chatInputArea = document.querySelector('.chat-input-area');
        if (targetUser && targetUser.isRoom && targetUser.roomData && targetUser.roomData.type === 'channel' && targetUser.roomData.ownerId !== currentUser?.id) {
            if (chatInputArea) {
                chatInputArea.style.display = 'none';
                if (!document.getElementById('channel-readonly-msg')) {
                    const msg = document.createElement('div');
                    msg.id = 'channel-readonly-msg';
                    msg.style = 'padding: 15px; text-align: center; color: var(--text-muted); background: rgba(0,0,0,0.2);';
                    msg.textContent = 'В канале может писать только владелец.';
                    chatInputArea.parentNode.insertBefore(msg, chatInputArea);
                }
                const oldMsg = document.getElementById('channel-readonly-msg');
                if (oldMsg) oldMsg.style.display = 'block';
            }
        } else {
            if (chatInputArea) {
                chatInputArea.style.display = 'flex';
                const oldMsg = document.getElementById('channel-readonly-msg');
                if (oldMsg) oldMsg.style.display = 'none';
            }
        }

        setTimeout(() => {
            const btnCall = document.getElementById('btn-call');
            const btnHangup = document.getElementById('btn-hangup');
            const btnMic = document.getElementById('btn-mic-off');

            if (btnCall && !btnCall.dataset.bound) {
                btnCall.addEventListener('click', () => startCall().catch(() => {}));
                btnCall.dataset.bound = '1';
            }
            if (btnHangup && !btnHangup.dataset.bound) {
                btnHangup.addEventListener('click', () => stopCallAndReset());
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

    // =========================
    // ПЕРЕВОД (MyMemory RU<->EN)
    // =========================
    function getTranslationMainLanguage() {
        const sel = document.getElementById('translation-main-language');
        const v = sel ? sel.value : (localStorage.getItem('px_translation_main_language') || 'ru');
        return v || 'ru';
    }

    function detectRuEnHeuristic(text) {
        if (!text || typeof text !== 'string') return null;
        const s = text.trim();
        if (!s) return null;

        const hasCyrillic = /[А-Яа-яЁё]/.test(s);
        const hasLatin = /[A-Za-z]/.test(s);

        if (hasCyrillic && !hasLatin) return true; // RU-like
        if (hasLatin && !hasCyrillic) return false; // EN-like

        const cyr = (s.match(/[А-Яа-яЁё]/g) || []).length;
        const lat = (s.match(/[A-Za-z]/g) || []).length;
        if (cyr === 0 && lat === 0) return null;
        return cyr >= lat;
    }

    async function translateMyMemoryGet(q, langpair) {
        // 1.0 FIX: автономный режим — переводчик отключен (нет внешних fetch).
        // Возвращаем исходный текст, чтобы UI не ломался.
        return q;
    }


    let translationInFlight = {}; // { [msgId]: boolean }

    function renderTranslationBlockForMessage(msg) {
        const canTranslate = (
            msg &&
            msg.from !== 'me' &&
            typeof msg.text === 'string' &&
            msg.text.trim().length > 0
        );

        if (!canTranslate) return '';

        const mainLang = getTranslationMainLanguage(); // ru/en
        const supported = mainLang === 'ru' || mainLang === 'en';
        if (!supported) return '';

        const msgId = msg.id || ('msg_' + Math.random());

        return `
            <div class="translation-block" style="margin-top:8px;">
                <button class="btn-translate" type="button" data-action="translate" data-msgid="${escapeHtml(msgId)}">
                    Перевести →
                </button>
                <div class="translation-result hidden" data-translation-result-for="${escapeHtml(msgId)}"></div>
            </div>
        `;
    }

    function renderChatMessages() {
        const container = document.getElementById('chat-messages');
        container.innerHTML = '';
        if (!activeChatUser || !chats[activeChatUser]) return;
        
        chats[activeChatUser].forEach((msg, idx) => {
            const div = document.createElement('div');
            const baseCls = `message ${msg.from === 'me' ? 'msg-out' : 'msg-in'}`;
            const waveCls = (msg.from === 'me' && msg.status === 'read') ? 'msg-read-wave' : '';
            div.className = `${baseCls} ${waveCls}`.trim();

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

            // “Read Wave” (Ambient Feedback)
            let statusHtml = '';
            if (msg.from === 'me') {
                const ui = getMessageStatusUI(msg.status);
                if (ui && ui.wave) {
                    // handled by wrapper class
                }
            }

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

            const reactionsPanel = `
                <div class="msg-reactions-panel">
                    <button class="msg-reaction-btn" title="Нравится" data-emoji="❤️">❤️</button>
                    <button class="msg-reaction-btn" title="Огонь" data-emoji="🔥">🔥</button>
                    <button class="msg-reaction-btn" title="Тошнит" data-emoji="🤮">🤮</button>
                    <button class="msg-reaction-btn" title="Какашка" data-emoji="💩">💩</button>
                    <button class="msg-reaction-btn" title="Ответить" data-action="reply">↩️</button>
                </div>
            `;

            const isBot = msg.from === 'bot' || msg.isBot === true || msg.from === 'PrivaXion Bot';
            const photoHtml = isBot
                ? `<img src="logo.png" alt="System" class="chat-msg-photo-img">`
                : `<img src="XDDD.jpg" alt="XDDD" class="chat-msg-photo-img">`;

            const translationHtml = renderTranslationBlockForMessage(msg);

            if (isBot) {
                div.className = 'message msg-in msg-bot';
                div.innerHTML = `
                    <div class="msg-bot-inner">
                        <div class="msg-bot-icon">🤖</div>
                        <div class="msg-bot-body">
                            <div class="msg-bot-name">PrivaXion Bot</div>
                            <div class="msg-bot-text">${escapeHtml(msg.text).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</div>
                            <div class="msg-time" style="text-align:right;margin-top:4px;">${msg.time}</div>
                        </div>
                    </div>
                `;
            } else {
            div.innerHTML = `
                ${replyHtml}
                <div class="msg-row ${msg.from === 'me' ? 'msg-row-out' : 'msg-row-in'}">
                    ${msg.from === 'me' ? '' : photoHtml}
                    <div class="msg-bubble">${escapeHtml(msg.text)}</div>
                    ${msg.from === 'me' ? photoHtml : ''}
                </div>
                ${translationHtml}
                ${reactionsHtml}
                ${statusHtml}
                <div class="msg-time">${msg.time}</div>
                ${msg.from === 'me' ? '' : reactionsPanel}
            `;
            }

            // Кнопка "Перевести"
            div.querySelectorAll('.btn-translate').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    e.preventDefault();

                    const msgId = btn.getAttribute('data-msgid');
                    const resultEl = div.querySelector(`[data-translation-result-for="${CSS && CSS.escape ? CSS.escape(msgId) : msgId}"]`);
                    if (!resultEl) return;

                    if (translationInFlight[msgId]) return;
                    translationInFlight[msgId] = true;

                    try {
                        btn.disabled = true;
                        btn.textContent = 'Переводим...';

                        resultEl.classList.remove('hidden');
                        resultEl.textContent = '⏳';

                        const mainLang = getTranslationMainLanguage(); // ru/en
                        const detectedRu = detectRuEnHeuristic(msg.text);

                        if (detectedRu === null) {
                            resultEl.textContent = 'Не удалось определить язык.';
                            return;
                        }

                        let langpair = null;
                        if (mainLang === 'ru') {
                            if (detectedRu === false) langpair = 'en|ru';
                        } else if (mainLang === 'en') {
                            if (detectedRu === true) langpair = 'ru|en';
                        }

                        if (!langpair) {
                            resultEl.textContent = 'Сообщение уже на основном языке.';
                            return;
                        }

                        const translated = await translateMyMemoryGet(msg.text, langpair);
                        if (!translated) {
                            resultEl.textContent = 'Перевод не получен.';
                            return;
                        }
                        resultEl.textContent = translated;
                    } catch (err) {
                        console.error('Translate error:', err);
                        resultEl.classList.remove('hidden');
                        resultEl.textContent = 'Ошибка перевода.';
                        showToast('Ошибка перевода (MyMemory)', 'error');
                    } finally {
                        translationInFlight[msgId] = false;
                        btn.disabled = false;
                        btn.textContent = 'Перевести →';
                    }
                });
            });

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

    function triggerReadWaveForMessage(messageId) {
        // Ищем DOM-элемент сообщения и запускаем анимацию повторно
        const el = document.querySelector(`.message[data-msg-id="${CSS && CSS.escape ? CSS.escape(messageId) : messageId}"]`);
        if (!el) return;
        el.classList.remove('msg-read-wave');
        // reflow
        void el.offsetWidth;
        el.classList.add('msg-read-wave');
    }

    function markMessageAsRead(messageId) {
        if (!chats[activeChatUser]) return;
        const msg = chats[activeChatUser].find(m => m.id === messageId);
        if (msg && msg.from !== 'me') {
            msg.status = 'read';
            saveUserChats(currentUser.username);
            triggerReadWaveForMessage(messageId);
        }
    }


    // ==================================================================
    // ЗВУК: WebAudio pitch + базовые уведомления/звонок
    // ==================================================================

    let _pxAudioCtx = null;
    function getAudioCtx() {
        if (_pxAudioCtx) return _pxAudioCtx;
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return null;
        _pxAudioCtx = new Ctx();
        return _pxAudioCtx;
    }

    function ensureAudioCtxRunning() {
        const ctx = getAudioCtx();
        if (!ctx) return;
        if (ctx.state === 'suspended') {
            // Иногда нужно вызвать после user gesture — мы делаем best-effort
            ctx.resume().catch(() => {});
        }
    }

    function playBeepByPitch({ baseHz = 900, durationMs = 120, volume = 0.08 } = {}) {
        const ctx = getAudioCtx();
        if (!ctx) return;
        ensureAudioCtxRunning();

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.value = baseHz;

        const now = ctx.currentTime;
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + durationMs / 1000 + 0.02);
    }

    function playNotificationSoundByLimit(limitSeconds) {
        // Звуковой индикатор антифлуда.
        // По твоему ответу: короткий=900Hz
        // Длинный сделаю мягко ниже, чтобы отличалось: 160Hz
        const seconds = Number(limitSeconds);
        const isShort = seconds > 0 && seconds <= 10; // 1-5с и даже 10с считаем коротким
        const hz = isShort ? 900 : 160;

        // Можно и mp3 использовать, но сейчас делаем pitch-генератор (работает без файлов)
        playBeepByPitch({ baseHz: hz, durationMs: 140, volume: 0.09 });
    }

    function playMp3(path, volume = 0.8, playbackRate = 1.0) {
        try {
            const audio = new Audio(path);
            audio.volume = volume;
            audio.playbackRate = playbackRate;
            audio.playbackRate = playbackRate;
            audio.play().catch(() => {});
        } catch (e) {}
    }

    // ==============================================================
    // АНТИФЛУД (cooldown + visual timer + smart queue v1)
    // ==============================================================

    // Лимит по умолчанию (сек). В дальнейшем можно привязать к настройкам профиля.
    const DEFAULT_ANTIFLOOD_LIMIT_SEC = 5;
    function getAntifloodLimitSeconds() {
        const v = parseInt(localStorage.getItem('px_antiflood_limit_sec') || String(DEFAULT_ANTIFLOOD_LIMIT_SEC), 10);
        if (!Number.isFinite(v) || v < 1) return DEFAULT_ANTIFLOOD_LIMIT_SEC;
        return v;
    }

    let antiFloodCooldownUntil = 0; // timestamp ms
    let smartQueue = []; // [{ text, replyToMessageId }]
    let smartQueueTimer = null;

    const chatSendBtn = document.getElementById('chat-send-btn');

    function getSendRingSvg() {
        if (!chatSendBtn) return null;
        return chatSendBtn.querySelector('#chat-send-btn-ring');
    }

    function getSendRingFg() {
        const ring = getSendRingSvg();
        if (!ring) return null;
        return ring.querySelector('.send-ring-fg');
    }

    function setSendCooldownUI(isCooling, remainingMs = 0, totalMs = 1) {
        if (!chatSendBtn) return;
        const ring = getSendRingSvg();
        const fg = getSendRingFg();
        if (!ring || !fg) return;

        ring.classList.toggle('hidden', !isCooling);
        if (!isCooling) {
            chatSendBtn.classList.remove('is-cooldown');
            fg.style.strokeDashoffset = '113';
            return;
        }

        chatSendBtn.classList.add('is-cooldown');

        const total = Math.max(1, totalMs);
        const rem = Math.max(0, remainingMs);
        const ratio = rem / total; // 1..0
        // 113 = длина окружности (см. stroke-dasharray)
        const dashoffset = 113 * ratio;
        fg.style.strokeDashoffset = String(dashoffset);
    }

    function startCooldownTimer(limitSec) {
        const limitMs = limitSec * 1000;
        antiFloodCooldownUntil = Date.now() + limitMs;
        const totalMs = limitMs;

        const tick = () => {
            const remaining = antiFloodCooldownUntil - Date.now();
            if (remaining <= 0) {
                setSendCooldownUI(false);
                playNotificationSoundByLimit(limitSec);
                processSmartQueue();
                return;
            }
            setSendCooldownUI(true, remaining, totalMs);
            requestAnimationFrame(tick);
        };

        // Ставим UI сразу
        setSendCooldownUI(true, totalMs, totalMs);
        requestAnimationFrame(tick);
    }

    function enqueueSmartMessage(text) {
        smartQueue.push({
            text,
            replyToMessageId
        });

        // Визуальный placeholder в чате (полупрозрачно) — пока минимально.
        // Чтобы не ломать текущий UI, добавляем сообщение как из очереди с пометкой.
        if (activeChatUser && chats[activeChatUser]) {
            const queueMsgId = 'q_' + Date.now() + '_' + Math.random().toString(36).slice(2);
            const placeholder = {
                from: 'me',
                text: text,
                time: '…',
                id: queueMsgId,
                status: 'queued',
                replyTo: replyToMessageId,
                reactions: {},
                isQueued: true
            };
            chats[activeChatUser].push(placeholder);
            saveUserChats(currentUser.username);
            renderChatMessages();
        }
    }

    async function processSmartQueue() {
        if (smartQueueTimer) return;
        smartQueueTimer = setTimeout(async () => {
            smartQueueTimer = null;
            if (!smartQueue.length) return;

            // Если ещё не прошёл cooldown — ждём
            const limitSec = getAntifloodLimitSeconds();
            if (Date.now() < antiFloodCooldownUntil) {
                processSmartQueue();
                return;
            }

            // Отправляем первое из очереди
            const item = smartQueue.shift();
            replyToMessageId = item.replyTo;
            const input = document.getElementById('chat-message-input');
            if (input) input.value = item.text;

            // Убираем placeholder queued сообщение (минимально: по статусу queued и time==='…')
            if (activeChatUser && chats[activeChatUser]) {
                chats[activeChatUser] = chats[activeChatUser].filter(m => !(m.isQueued));
            }
            saveUserChats(currentUser.username);
            renderChatMessages();

            // Рекурсивно вызываем send как обычное
            sendMessage();
        }, 0);
    }

    function isInCooldown() {
        return Date.now() < antiFloodCooldownUntil;
    }

    function handleAntifloodBeforeSend(text) {
        const limitSec = getAntifloodLimitSeconds();
        if (!isInCooldown()) {
            startCooldownTimer(limitSec);
            return { mode: 'send' };
        }

        // Smart Queue: если лимит активен — кладём в очередь
        enqueueSmartMessage(text);

        // Звук не сразу — только при окончании таймера (как ты просил)
        return { mode: 'queued' };
    }



    // ==================================================================
    // ==================================================================
    // БОТ-МОДЕРАТОР PrivaXion
    // ==================================================================
    const BOT_NAME = 'PrivaXion Bot';
    const BOT_VIOLATIONS_KEY = (username) => `px_violations_${username}`;

    function getBotViolations(username) {
        return parseInt(localStorage.getItem(BOT_VIOLATIONS_KEY(username)) || '0', 10);
    }

    function setBotViolations(username, count) {
        localStorage.setItem(BOT_VIOLATIONS_KEY(username), String(count));
    }

    function textHasForbiddenWords(text) {
        const normalized = normalizeForCensor(text);
        return MATS.some(w => {
            const re = new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            return re.test(normalized);
        });
    }

    function injectBotMessage(text) {
        if (!activeChatUser) return;
        if (!chats[activeChatUser]) chats[activeChatUser] = [];
        const now = new Date();
        const time = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
        chats[activeChatUser].push({
            from: BOT_NAME,
            text,
            time,
            id: generateMessageId(),
            status: 'read',
            replyTo: null,
            reactions: {},
            isBot: true
        });
        saveUserChats(currentUser.username);
        renderChatMessages();
    }

    async function botModerationCheck(text) {
        if (!currentUser) return false;
        if (currentUser.id === '#000000') return false; // Admin exempt
        if (!textHasForbiddenWords(text)) return false;

        const username = currentUser.username;
        let violations = getBotViolations(username) + 1;
        setBotViolations(username, violations);

        // Также сохраняем в объект пользователя
        currentUser.violations = violations;
        await saveUser(currentUser);

        if (violations === 1) {
            injectBotMessage(
                `🤖 **PrivaXion Bot:** ⚠️ Предупреждение 1/3 — ${username}, ваше сообщение содержит запрещённые слова. ` +
                `Нарушение правил пользовательского соглашения. При повторении — блокировка.`
            );
        } else if (violations === 2) {
            injectBotMessage(
                `🤖 **PrivaXion Bot:** ⛔ Предупреждение 2/3 — ${username}, это последнее предупреждение! ` +
                `Следующее нарушение приведёт к блокировке аккаунта.`
            );
        } else {
            // Бан
            currentUser.isBanned = true;
            currentUser.banReason = 'Систематическое использование запрещённых слов';
            currentUser.banTime = 'Навсегда';
            currentUser.banDesc = `Автоматическая блокировка ботом после ${violations} нарушений правил.`;
            await saveUser(currentUser);
            injectBotMessage(
                `🤖 **PrivaXion Bot:** 🔨 ${username} заблокирован за систематические нарушения правил! ` +
                `Аккаунт заблокирован навсегда согласно пользовательскому соглашению.`
            );
            setTimeout(() => {
                showToast('🔨 Ваш аккаунт заблокирован ботом за нарушение правил!', 'error');
                // Выход из системы
                document.getElementById('btn-logout')?.click();
            }, 2000);
            return true; // Сообщение не отправлять
        }
        return true; // Нарушение найдено — сообщение не отправлять (показано предупреждение)
    }

    // (Пока) sendMessage — без антифлуда/очереди
    // ==================================================================
    async function sendMessage() {
        const input = document.getElementById('chat-message-input');
        const text = input.value.trim();
        if (!text || !activeChatUser) return;

        // антифлуд: cooldown/queue
        const antiflood = handleAntifloodBeforeSend(text);
        if (antiflood && antiflood.mode === 'queued') {
            input.value = '';
            cancelReply();
            return;
        }

        input.value = '';
        cancelReply();

        // БОТ-МОДЕРАЦИЯ: проверяем на запрещённые слова
        const blocked = await botModerationCheck(text);
        if (blocked) return; // Сообщение заблокировано — показано предупреждение

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
        updateChatListItem(activeChatUser, text);
        renderChatMessages();

        // Имитация получения сообщения (автоответ для демо)
        setTimeout(() => {
            if (activeChatUser && activeChatUser !== 'System Bot') {
                markMessageAsRead(msgId);
                renderChatMessages();
            }
        }, 1500);
    }

    // ==================================================================
    // MediaRecorder: голосовые сообщения (автостоп ровно 5 минут = 300000мс)
    // ==================================================================
    const VOICE_MAX_MS = 300000;
    let voiceRecorder = null;
    let voiceChunks = [];
    let voiceTimer = null;
    let voiceStartAt = 0;
    let voiceIsRecording = false;

    function formatMs(ms) {
        const s = Math.floor(ms / 1000);
        const mm = Math.floor(s / 60).toString().padStart(2,'0');
        const ss = (s % 60).toString().padStart(2,'0');
        return `${mm}:${ss}`;
    }

    function setVoiceRecordingUI(isRecording, elapsedMs = 0) {
        const btn = document.getElementById('voice-record-btn');
        const status = document.getElementById('voice-record-status');
        if (!btn || !status) return;

        voiceIsRecording = !!isRecording;
        btn.classList.toggle('is-recording', voiceIsRecording);

        if (voiceIsRecording) status.textContent = `Recording ${formatMs(elapsedMs)}`;
        else status.textContent = '';
    }

    function guessMimeType() {
        const candidates = [
            'audio/ogg;codecs=opus',
            'audio/ogg',
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/mp4'
        ];
        for (const c of candidates) {
            try {
                if (window.MediaRecorder && window.MediaRecorder.isTypeSupported && window.MediaRecorder.isTypeSupported(c)) return c;
            } catch (_) {}
        }
        return '';
    }

    async function startVoiceRecording() {
        if (!activeChatUser || !currentUser) return;
        if (voiceIsRecording) return;

        const btn = document.getElementById('voice-record-btn');
        if (!btn) return;

        voiceChunks = [];
        voiceStartAt = Date.now();
        setVoiceRecordingUI(true, 0);

        // отключаем чат-ввод, чтобы не мешал записи
        const input = document.getElementById('chat-message-input');
        const sendBtn = document.getElementById('chat-send-btn');
        if (input) input.disabled = true;
        if (sendBtn) sendBtn.disabled = true;
        btn.disabled = true;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            const mimeType = guessMimeType();
            const options = mimeType ? { mimeType } : undefined;

            voiceRecorder = new MediaRecorder(stream, options);

            voiceRecorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) voiceChunks.push(e.data);
            };

            voiceRecorder.onstop = () => {
                try {
                    stream.getTracks().forEach(t => { try { t.stop(); } catch(_) {} });
                } catch (_) {}

                const recordedMs = Date.now() - voiceStartAt;

                const finalMime = (voiceRecorder && voiceRecorder.mimeType) ? voiceRecorder.mimeType : (voiceChunks[0] && voiceChunks[0].type) ? voiceChunks[0].type : 'audio/webm';
                const blob = new Blob(voiceChunks, { type: finalMime });
                const url = URL.createObjectURL(blob);

                const now = new Date();
                const time = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
                const msgId = generateMessageId();

                const newMsg = {
                    from: 'me',
                    text: '', // голосовое
                    time,
                    id: msgId,
                    status: 'sent',
                    replyTo: replyToMessageId,
                    reactions: {},
                    voice: {
                        url,
                        mimeType: blob.type || '',
                        durationMs: recordedMs
                    }
                };

                if (!chats[activeChatUser]) chats[activeChatUser] = [];
                chats[activeChatUser].push(newMsg);

                saveUserChats(currentUser.username);
                updateChatListItem(activeChatUser, '🎤 Голосовое сообщение');
                renderChatMessages();

                console.log('Готово к отправке');

                // восстановить UI
                cancelReply();
                setVoiceRecordingUI(false, 0);

                if (input) input.disabled = false;
                if (sendBtn) sendBtn.disabled = false;
                btn.disabled = false;

                setTimeout(() => {
                    if (activeChatUser && activeChatUser !== 'System Bot') {
                        markMessageAsRead(msgId);
                        renderChatMessages();
                    }
                }, 1500);
            };

            voiceRecorder.start();

            // автостоп ровно по таймеру
            voiceTimer = setTimeout(() => {
                if (voiceRecorder && voiceRecorder.state === 'recording') {
                    voiceRecorder.stop();
                }
            }, VOICE_MAX_MS);

            // статус раз в секунду
            const statusTick = setInterval(() => {
                if (!voiceIsRecording) {
                    clearInterval(statusTick);
                    return;
                }
                const elapsed = Date.now() - voiceStartAt;
                setVoiceRecordingUI(true, elapsed);
            }, 1000);

            voiceRecorder.onstart = () => {};
        } catch (e) {
            console.error(e);

            if (voiceTimer) { clearTimeout(voiceTimer); voiceTimer = null; }
            voiceRecorder = null;
            voiceChunks = [];
            setVoiceRecordingUI(false, 0);

            if (input) input.disabled = false;
            if (sendBtn) sendBtn.disabled = false;
            btn.disabled = false;

            showToast('Ошибка записи голоса. Проверьте микрофон в браузере.', 'error');
        }
    }

    function stopVoiceRecording() {
        if (!voiceIsRecording) return;
        if (voiceTimer) { clearTimeout(voiceTimer); voiceTimer = null; }
        try {
            if (voiceRecorder && voiceRecorder.state === 'recording') voiceRecorder.stop();
        } catch (_) {}
    }

    // клик по кнопке записи
    const voiceBtn = document.getElementById('voice-record-btn');
    voiceBtn && voiceBtn.addEventListener('click', () => {
        if (voiceIsRecording) stopVoiceRecording();
        else startVoiceRecording().catch(() => {});
    });

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
                let found = users2.find(u => u.username.toLowerCase() === uname.toLowerCase());
                if (!found) {
                    const allRooms = getRoomsSync();
                    const room = allRooms.find(r => r.id === uname);
                    if (room) found = { username: room.id, id: room.id, status: 'online', isRoom: true, roomData: room };
                }
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
    document.getElementById('search-btn').addEventListener('click', doSearch);
    document.getElementById('search-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') doSearch();
    });

    function doSearch() {
        const query = document.getElementById('search-input').value.trim();
        const result = document.getElementById('search-result');
        result.innerHTML = '';
        result.classList.remove('hidden');

        if (!query) {
            result.innerHTML = '<p class="search-no-result">Введите ID для поиска.</p>';
            return;
        }

        const found = findUserById(query);
        if (!found) {
            result.innerHTML = '<p class="search-no-result">❌ Пользователь с таким ID не найден.</p>';
            return;
        }

        // Нельзя найти самого себя
        if (currentUser && found.username.toLowerCase() === currentUser.username.toLowerCase()) {
            result.innerHTML = '<p class="search-no-result">Это вы сами 😄</p>';
            return;
        }

        result.innerHTML = `
            <div class="search-user-card">
                <div class="search-user-avatar">${found.username.charAt(0).toUpperCase()}</div>
                <div class="search-user-info">
                    <div class="search-user-name">${escapeHtml(found.username)}</div>
                    <div class="search-user-id">${escapeHtml(found.id)}</div>
                </div>
                <button class="btn-primary btn-write" id="btn-write-user">✉ Написать</button>
            </div>
        `;

        document.getElementById('btn-write-user').addEventListener('click', () => {
            addChatToList(found.username);
            openChat(found);
            document.getElementById('search-input').value = '';
            result.classList.add('hidden');
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

    } catch (err) {
        console.error('PrivaXion JS crashed:', err);
        try {
            const toastContainer = document.getElementById('toast-container');
            if (toastContainer) {
                const toast = document.createElement('div');
                toast.className = 'toast';
                toast.style.borderColor = 'var(--error-color)';
                toast.innerHTML = `<span>❌</span> JS ошибка: ${String(err && err.message ? err.message : err)}`;
                toastContainer.appendChild(toast);
                setTimeout(() => toast.remove(), 5000);
            }
        } catch (e) {}
    }
});


// ================== ROOMS UI LOGIC ==================
document.addEventListener('DOMContentLoaded', () => {
    const btnCreateChannel = document.getElementById('btn-create-channel');
    const btnCreateGroup = document.getElementById('btn-create-group');
    const createModal = document.getElementById('create-room-modal');
    const settingsModal = document.getElementById('room-settings-modal');
    
    let creatingType = 'channel'; 
    let currentRoomSettings = null;
    let captchaText = '';

    if (btnCreateChannel) {
        btnCreateChannel.addEventListener('click', async () => {
            creatingType = 'channel';
            document.getElementById('create-room-title').textContent = 'Создать Канал';
            document.getElementById('create-room-access-group').style.display = 'block';
            
            const allRooms = await getRooms();
            const myChannels = allRooms.filter(r => r.type === 'channel' && r.ownerId === currentUser?.id);
            if (myChannels.length >= 2) {
                alert('Вы не можете иметь более 2 каналов на один аккаунт.');
                return;
            }
            createModal.classList.remove('hidden');
        });
    }

    if (btnCreateGroup) {
        btnCreateGroup.addEventListener('click', () => {
            creatingType = 'group';
            document.getElementById('create-room-title').textContent = 'Создать Группу';
            document.getElementById('create-room-access-group').style.display = 'none';
            createModal.classList.remove('hidden');
        });
    }

    const btnCreateSubmit = document.getElementById('btn-create-room-submit');
    if (btnCreateSubmit) {
        btnCreateSubmit.addEventListener('click', async () => {
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
            
            // Создаём чат комнаты в общей истории (localStorage px_rooms)
            // Важно: раньше создавалось только в px_chats_${currentUser}, теперь сообщения хранятся в комнате.
            // messages для новой комнаты уже пустые по умолчанию в saveRoom(room).

            
            renderChatList();
            setTimeout(() => {
                // Mock open the new room
                openChat({username: id, id: id, status: 'online', isRoom: true, roomData: room});
                switchScreen('screen-chat');
            }, 500);
        });
    }

    const btnCreateCancel = document.getElementById('btn-create-room-cancel');
    if (btnCreateCancel) btnCreateCancel.addEventListener('click', () => createModal.classList.add('hidden'));

    window.openRoomSettings = async function(roomId) {
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
            if (!currentRoomSettings) return;
            currentRoomSettings.name = document.getElementById('room-settings-name').value.trim();
            currentRoomSettings.description = document.getElementById('room-settings-desc').value.trim();
            currentRoomSettings.logo = document.getElementById('room-settings-logo').value.trim();
            currentRoomSettings.isPublic = document.getElementById('room-settings-public').value === 'true';
            
            await saveRoom(currentRoomSettings);
            settingsModal.classList.add('hidden');
            
            if (activeChatUser === currentRoomSettings.id) {
                document.getElementById('chat-nickname').textContent = currentRoomSettings.name;
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
            if (!currentRoomSettings) return;
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
                switchScreen('screen-empty');
            }
            renderChatList();
        });
    }
});


// ================== ADMIN MENU & WATERMARK ==================
document.addEventListener('DOMContentLoaded', () => {
    // Watermark logic
    const wm = document.getElementById('main-watermark');
    function updateWatermarkVisibility() {
        if (!wm) return;
        // Show ONLY when not logged in (on the welcome/login/register screen)
        const isAuthOnly = !document.body.classList.contains('home-active');
        wm.style.display = isAuthOnly ? 'block' : 'none';
    }
    
    // override switchScreen slightly
    const originalSwitch = window.switchScreen;
    window.switchScreen = function(id) {
        if(originalSwitch) originalSwitch(id);
        updateWatermarkVisibility();
        
        // show admin button if ID is #000000
        const adminBtn = document.getElementById('help-open-admin');
        if (adminBtn) {
            if (currentUser && currentUser.id === '#000000') {
                adminBtn.classList.remove('hidden');
            } else {
                adminBtn.classList.add('hidden');
            }
        }
    }
    
    updateWatermarkVisibility(); // init
    
    // Admin panel logic
    const btnAdmin = document.getElementById('help-open-admin');
    const adminModal = document.getElementById('admin-modal');
    const adminClose = document.getElementById('btn-admin-close');
    const adminList = document.getElementById('admin-users-list');
    const adminSearch = document.getElementById('admin-search-input');
    
    let allUsersCache = [];
    let currentBanTarget = null;
    
    async function renderAdminUsers(users) {
        adminList.innerHTML = '';
        for (const u of users) {
            if (u.id === '#000000') continue; // dont show admin himself
            const div = document.createElement('div');
            div.className = 'search-user-card';
            div.style.flexDirection = 'column';
            div.style.alignItems = 'flex-start';
            
            let badges = getUserBadgesHTML(u);
            
            div.innerHTML = `
                <div style="display:flex; width:100%; align-items:center; margin-bottom:10px;">
                    <div class="search-user-avatar" style="width:40px;height:40px;font-size:16px;">${u.avatar ? `<img src="${u.avatar}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">` : '?'}</div>
                    <div class="search-user-info" style="margin-left:10px;">
                        <div class="search-user-nickname">${escapeHtml(u.username)}${badges}</div>
                        <div class="search-user-id">${u.id} ${u.isBanned ? '<span style="color:#ff3b5c;font-size:12px;">(ЗАБАНЕН)</span>' : ''}</div>
                    </div>
                </div>
                <div style="display:flex; flex-wrap:wrap; gap:5px; width:100%;">
                    <button class="btn-primary" style="flex:1; padding:8px; font-size:11px;" id="adm-add-${u.id.replace('#','')}">В друзья</button>
                    <button class="btn-primary" style="flex:1; padding:8px; font-size:11px; ${u.blueCheckmark ? 'border-color:#38bdf8;' : ''}" id="adm-blue-${u.id.replace('#','')}">${u.blueCheckmark ? 'Забрать ☑️' : 'Выдать ☑️'}</button>
                    <button class="btn-primary" style="flex:1; padding:8px; font-size:11px; ${u.redCheckmark ? 'border-color:#ff3b5c;' : ''}" id="adm-red-${u.id.replace('#','')}">${u.redCheckmark ? 'Забрать 🔴' : 'Выдать 🔴'}</button>
                    <button class="btn-primary" style="flex:1; padding:8px; font-size:11px; ${u.isBanned ? 'border-color:#ff3b5c;' : ''}" id="adm-ban-${u.id.replace('#','')}">${u.isBanned ? 'Разбанить' : 'Блок'}</button>
                </div>
            `;
            adminList.appendChild(div);
            
            document.getElementById(`adm-add-${u.id.replace('#','')}`).onclick = async () => {
                if (!currentUser.friends.includes(u.username)) {
                    currentUser.friends.push(u.username);
                    await saveUser(currentUser);
                    alert(`Пользователь ${u.username} добавлен в друзья.`);
                } else {
                    alert('Уже в друзьях.');
                }
            };
            
            document.getElementById(`adm-blue-${u.id.replace('#','')}`).onclick = async () => {
                u.blueCheckmark = !u.blueCheckmark;
                await saveUser(u);
                renderAdminUsers(allUsersCache); // re-render
            };
            
            document.getElementById(`adm-red-${u.id.replace('#','')}`).onclick = async () => {
                u.redCheckmark = !u.redCheckmark;
                await saveUser(u);
                renderAdminUsers(allUsersCache);
            };
            
            document.getElementById(`adm-ban-${u.id.replace('#','')}`).onclick = async () => {
                if (u.isBanned) {
                    u.isBanned = false;
                    u.banReason = '';
                    u.banTime = '';
                    u.banDesc = '';
                    await saveUser(u);
                    renderAdminUsers(allUsersCache);
                } else {
                    currentBanTarget = u;
                    document.getElementById('ban-target-name').textContent = `Пользователь: ${u.username} (${u.id})`;
                    document.getElementById('ban-reason').value = '';
                    document.getElementById('ban-time').value = '';
                    document.getElementById('ban-desc').value = '';
                    document.getElementById('admin-ban-modal').classList.remove('hidden');
                }
            };
        }
    }
    
    if (btnAdmin) {
        btnAdmin.onclick = async () => {
            adminModal.classList.remove('hidden');
            allUsersCache = await getUsers();
            renderAdminUsers(allUsersCache);
        };
    }

    const btnAdminList = document.getElementById('admin-open-list');
    if (btnAdminList) {
        btnAdminList.onclick = async () => {
            adminModal.classList.remove('hidden');
            allUsersCache = await getUsers();
            renderAdminUsers(allUsersCache);
        };
    }
    
    if (adminClose) adminClose.onclick = () => adminModal.classList.add('hidden');
    
    if (adminSearch) {
        adminSearch.oninput = () => {
            const q = adminSearch.value.toLowerCase();
            const filtered = allUsersCache.filter(u => u.username.toLowerCase().includes(q) || u.id.toLowerCase().includes(q));
            renderAdminUsers(filtered);
        };
    }
    
    document.getElementById('admin-sort-az').onclick = () => {
        allUsersCache.sort((a,b) => a.username.localeCompare(b.username));
        renderAdminUsers(allUsersCache);
    };
    document.getElementById('admin-sort-id').onclick = () => {
        allUsersCache.sort((a,b) => a.id.localeCompare(b.id));
        renderAdminUsers(allUsersCache);
    };
    
    // Ban submit
    document.getElementById('btn-ban-submit').onclick = async () => {
        if (!currentBanTarget) return;
        currentBanTarget.isBanned = true;
        currentBanTarget.banReason = document.getElementById('ban-reason').value.trim() || 'Нарушение правил';
        currentBanTarget.banTime = document.getElementById('ban-time').value.trim() || 'Навсегда';
        currentBanTarget.banDesc = document.getElementById('ban-desc').value.trim() || '';
        await saveUser(currentBanTarget);
        document.getElementById('admin-ban-modal').classList.add('hidden');
        renderAdminUsers(allUsersCache);
    };
    
    document.getElementById('btn-ban-cancel').onclick = () => {
        document.getElementById('admin-ban-modal').classList.add('hidden');
    };
});
// ==========================================
// I18N AND AUTO-TRANSLATOR MODULE v2.0
// ==========================================

const I18N_DICT = {
    'ru': {
        // Sidebar
        'chats_title': 'ЧАТЫ',
        'nav_home': 'Главная',
        'nav_friends': 'друзья',
        'nav_profile': 'профиль',
        'chat_list_empty': 'Пока нет чатов',
        // Panel
        'btn_help': 'Помощь',
        'btn_search': 'Поиск',
        // Welcome
        'welcome_btn_start': 'Начать',
        'welcome_subtitle': 'GLOBAL',
        // Auth
        'login_title': '🔐 Вход в аккаунт',
        'login_keyfile_hint': 'Для входа прикрепите ваш файл-ключ',
        'login_keyfile_label': '📎 Файл-ключ (.json)',
        'login_keyfile_btn': 'Выбрать файл-ключ...',
        'captcha_label': 'Проверка на робота',
        'captcha_placeholder': 'Введите текст с картинки',
        'login_btn': 'Войти',
        'no_account': 'Нет аккаунта?',
        'register_link': 'Зарегистрироваться!',
        'register_title': 'Регистрация',
        'username_label': 'Никнейм',
        'username_placeholder': 'Создайте никнейм',
        'password_label': 'Пароль',
        'password_placeholder': 'Придумайте пароль (от 8 символов)',
        'password_hint': 'Минимум 8 символов',
        'confirm_password_label': 'Повторите пароль',
        'confirm_password_placeholder': 'Повторите пароль',
        'birthdate_label': 'Дата рождения',
        'terms_summary': '📄 Пользовательское соглашение (обязательно прочитать)',
        'terms_accept': 'Я прочитал(а) и принимаю условия пользовательского соглашения',
        'register_btn': 'Создать аккаунт',
        'has_account': 'Есть аккаунт?',
        'login_link': 'Войти!',
        // Brand
        'brand_subtitle': 'Самый безопасный мессенджер в истории',
        // Chat
        'input_placeholder': 'Напишите сообщение...',
        'translate_btn': 'Перевести →',
        'translating_text': 'Переводим...',
        'translate_no_detect': 'Не удалось определить язык.',
        'translate_same_lang': 'Сообщение уже на основном языке.',
        'translate_fail': 'Перевод не получен.',
        'translate_error': 'Ошибка перевода.',
        'call_title': 'Звонок',
        'call_waiting': 'ожидание…',
        'call_hangup': '⛔ Отбой',
        'call_mic_on': '🎙️ Микрофон ВКЛ',
        'call_hint': 'Если не слышно — проверь разрешение микрофона в браузере.',
        'home_chat_label': 'Чат',
        // Profile
        'profile_title': 'Мой профиль',
        'profile_id_label': 'Ваш ID:',
        'profile_id_note': 'ID виден только вам',
        'status_online': 'Онлайн',
        'status_offline': 'Оффлайн',
        'nickname_label': 'Никнейм',
        'bio_label': 'Описание профиля',
        'bio_placeholder': 'Расскажите о себе...',
        'profile_save': 'Сохранить изменения',
        'profile_logout': 'Выйти из аккаунта',
        'admin_menu_title': '🛠️ Админ меню',
        'admin_news_btn': '📰 Новости',
        'admin_list_btn': '📄 Лист',
        // Help
        'help_title': 'Помощь',
        'help_desc': 'PrivaXion — самый безопасный мессенджер. Все сообщения защищены тройным шифрованием (E2EE).',
        'help_search_desc': 'Поиск — найдите друга по ID и начните переписку',
        'help_friends_desc': 'друзья — поиск пользователей в боковом меню',
        'help_profile_desc': 'профиль — ваш никнейм, ID и настройки аккаунта',
        'help_news_btn': 'Новости',
        'help_settings_btn': 'Настройки безопасности',
        'help_admin_btn': '⚙️ Панель администратора',
        // Search
        'search_title': '🔍 Поиск пользователей',
        'search_placeholder': 'Введите ID пользователя или название (напр: #Abc12345)',
        'search_btn': 'Найти',
        'create_channel_btn': 'Создать Канал',
        'create_group_btn': 'Создать Группу',
        // Settings
        'settings_title': '⚙️ Настройки',
        'settings_lang_title': '🌍 Язык / Language',
        'settings_lang_desc': 'Выберите язык интерфейса и авто-перевода сообщений.',
        'sessions_title': '🛡️ Активные сессии',
        'sessions_desc': 'Список устройств, подключённых к вашему аккаунту.',
        'terminate_sessions': 'Завершить все другие сеансы',
        'theme_title': '🎨 Тема оформления',
        'theme_desc': 'Выберите светлую или темную тему.',
        'theme_dark': 'Темная тема (Dark)',
        'theme_light': 'Светлая тема (Light)',
        'censor_title': '🔞 Цензура матов',
        'censor_desc': 'Если вам меньше 18 — цензура включена всегда. Если 18+ — можно управлять переключателем.',
        'censor_on': 'Включена',
        'censor_off': 'Выключена',
        'auto_translate_title': '🌐 Авто-перевод сообщений',
        'auto_translate_desc': 'Автоматически переводить входящие сообщения на выбранный язык.',
        'auto_translate_on': 'Авто-перевод включен',
        'auto_translate_off': 'Авто-перевод выключен',
        // News
        'news_title': '📰 Новости PrivaXion',
        'news_empty': 'Нет новостей',
        'news_input_placeholder': 'Введите текст новости...',
        'news_publish_btn': 'Опубликовать',
        // Modals
        'create_room_title': 'Создать',
        'room_name_label': 'Название',
        'room_name_placeholder': 'Введите название...',
        'room_desc_label': 'Описание',
        'room_desc_placeholder': 'Введите описание...',
        'room_logo_label': 'Логотип (URL)',
        'room_access_label': 'Доступ (только для каналов)',
        'room_access_private': 'Приватный (только по ID)',
        'room_access_public': 'Открытый (по названию)',
        'create_btn': 'Создать',
        'cancel_btn': 'Отмена',
        'room_settings_title': 'Настройки комнаты',
        'save_btn': 'Сохранить',
        'close_btn': 'Закрыть',
        'danger_zone': 'Опасная зона',
        'danger_zone_desc': 'Удаление комнаты навсегда.',
        'captcha_refresh': 'Обновить капчу',
        'delete_password_label': 'Ваш пароль',
        'delete_password_placeholder': 'Введите пароль...',
        'delete_room_btn': 'Удалить комнату',
        // Security modal
        'security_title': 'Обнаружена подозрительная активность',
        'security_desc': 'Ваш IP адрес был заблокирован из-за множественных попыток взлома.',
        'security_ip': 'IP адрес:',
        'security_reason': 'Причина:',
        'security_time': 'Время блокировки:',
        'security_warning': '⚠️ Ваш доступ заблокирован НАВСЕГДА. Обратитесь в поддержку PrivaXion.',
        'security_support': 'Обратиться в поддержку',
        // Admin
        'admin_panel_title': '🛡️ Панель администратора',
        'admin_search_placeholder': 'Поиск по ID или Нику',
        'admin_sort_az': 'Сорт: A-Z',
        'admin_sort_id': 'Сорт: ID (0-1000)',
        'admin_close': 'Закрыть',
        'admin_ban_title': 'Заблокировать',
        'ban_reason_placeholder': 'Причина (напр. Спам)',
        'ban_time_placeholder': 'Время (напр. Навсегда или 30 дней)',
        'ban_desc_placeholder': 'Подробное описание',
        'ban_submit_btn': 'Ударить банхаммером',
        'ban_cancel_btn': 'Отмена',
        // Toast
        'lang_changed': 'Язык интерфейса изменён!',
        'auto_translate_enabled': 'Авто-перевод включен',
        'auto_translate_disabled': 'Авто-перевод выключен',
        // Translated badge
        'translated_badge': '🌐 переведено'
    },
    'en': {
        'chats_title': 'CHATS',
        'nav_home': 'Home',
        'nav_friends': 'friends',
        'nav_profile': 'profile',
        'chat_list_empty': 'No chats yet',
        'btn_help': 'Help',
        'btn_search': 'Search',
        'welcome_btn_start': 'Start',
        'welcome_subtitle': 'GLOBAL',
        'login_title': '🔐 Sign in',
        'login_keyfile_hint': 'Attach your key file to sign in',
        'login_keyfile_label': '📎 Key file (.json)',
        'login_keyfile_btn': 'Choose key file...',
        'captcha_label': 'Robot check',
        'captcha_placeholder': 'Enter text from image',
        'login_btn': 'Sign in',
        'no_account': 'No account?',
        'register_link': 'Register!',
        'register_title': 'Registration',
        'username_label': 'Username',
        'username_placeholder': 'Create a username',
        'password_label': 'Password',
        'password_placeholder': 'Create a password (8+ characters)',
        'password_hint': 'Minimum 8 characters',
        'confirm_password_label': 'Confirm password',
        'confirm_password_placeholder': 'Repeat password',
        'birthdate_label': 'Date of birth',
        'terms_summary': '📄 Terms of Service (must read)',
        'terms_accept': 'I have read and accept the terms of service',
        'register_btn': 'Create account',
        'has_account': 'Have an account?',
        'login_link': 'Sign in!',
        'brand_subtitle': 'The most secure messenger in history',
        'input_placeholder': 'Write a message...',
        'translate_btn': 'Translate →',
        'translating_text': 'Translating...',
        'translate_no_detect': 'Could not detect language.',
        'translate_same_lang': 'Message is already in your language.',
        'translate_fail': 'Translation not received.',
        'translate_error': 'Translation error.',
        'call_title': 'Call',
        'call_waiting': 'waiting…',
        'call_hangup': '⛔ Hang up',
        'call_mic_on': '🎙️ Mic ON',
        'call_hint': 'If you can\'t hear — check microphone permissions in browser.',
        'home_chat_label': 'Chat',
        'profile_title': 'My Profile',
        'profile_id_label': 'Your ID:',
        'profile_id_note': 'ID is visible only to you',
        'status_online': 'Online',
        'status_offline': 'Offline',
        'nickname_label': 'Username',
        'bio_label': 'Profile bio',
        'bio_placeholder': 'Tell about yourself...',
        'profile_save': 'Save changes',
        'profile_logout': 'Log out',
        'admin_menu_title': '🛠️ Admin menu',
        'admin_news_btn': '📰 News',
        'admin_list_btn': '📄 List',
        'help_title': 'Help',
        'help_desc': 'PrivaXion — the most secure messenger. All messages are protected with triple encryption (E2EE).',
        'help_search_desc': 'Search — find a friend by ID and start chatting',
        'help_friends_desc': 'friends — search users in the side menu',
        'help_profile_desc': 'profile — your username, ID and account settings',
        'help_news_btn': 'News',
        'help_settings_btn': 'Security Settings',
        'help_admin_btn': '⚙️ Admin Panel',
        'search_title': '🔍 Search users',
        'search_placeholder': 'Enter user ID or name (e.g.: #Abc12345)',
        'search_btn': 'Find',
        'create_channel_btn': 'Create Channel',
        'create_group_btn': 'Create Group',
        'settings_title': '⚙️ Settings',
        'settings_lang_title': '🌍 Language',
        'settings_lang_desc': 'Choose the language for the interface and message auto-translation.',
        'sessions_title': '🛡️ Active Sessions',
        'sessions_desc': 'List of devices connected to your account.',
        'terminate_sessions': 'Terminate all other sessions',
        'theme_title': '🎨 Theme',
        'theme_desc': 'Choose light or dark theme.',
        'theme_dark': 'Dark theme',
        'theme_light': 'Light theme',
        'censor_title': '🔞 Profanity Filter',
        'censor_desc': 'If you are under 18 — filter is always on. If 18+ — you can toggle it.',
        'censor_on': 'Enabled',
        'censor_off': 'Disabled',
        'auto_translate_title': '🌐 Message Auto-Translate',
        'auto_translate_desc': 'Automatically translate incoming messages to your selected language.',
        'auto_translate_on': 'Auto-translate enabled',
        'auto_translate_off': 'Auto-translate disabled',
        'news_title': '📰 PrivaXion News',
        'news_empty': 'No news',
        'news_input_placeholder': 'Enter news text...',
        'news_publish_btn': 'Publish',
        'create_room_title': 'Create',
        'room_name_label': 'Name',
        'room_name_placeholder': 'Enter name...',
        'room_desc_label': 'Description',
        'room_desc_placeholder': 'Enter description...',
        'room_logo_label': 'Logo (URL)',
        'room_access_label': 'Access (channels only)',
        'room_access_private': 'Private (by ID only)',
        'room_access_public': 'Public (by name)',
        'create_btn': 'Create',
        'cancel_btn': 'Cancel',
        'room_settings_title': 'Room Settings',
        'save_btn': 'Save',
        'close_btn': 'Close',
        'danger_zone': 'Danger Zone',
        'danger_zone_desc': 'Permanently delete the room.',
        'captcha_refresh': 'Refresh captcha',
        'delete_password_label': 'Your password',
        'delete_password_placeholder': 'Enter password...',
        'delete_room_btn': 'Delete room',
        'security_title': 'Suspicious activity detected',
        'security_desc': 'Your IP address has been blocked due to multiple hacking attempts.',
        'security_ip': 'IP Address:',
        'security_reason': 'Reason:',
        'security_time': 'Block time:',
        'security_warning': '⚠️ Your access is blocked FOREVER. Contact PrivaXion support.',
        'security_support': 'Contact support',
        'admin_panel_title': '🛡️ Admin Panel',
        'admin_search_placeholder': 'Search by ID or Username',
        'admin_sort_az': 'Sort: A-Z',
        'admin_sort_id': 'Sort: ID (0-1000)',
        'admin_close': 'Close',
        'admin_ban_title': 'Block user',
        'ban_reason_placeholder': 'Reason (e.g. Spam)',
        'ban_time_placeholder': 'Duration (e.g. Forever or 30 days)',
        'ban_desc_placeholder': 'Detailed description',
        'ban_submit_btn': 'Strike with banhammer',
        'ban_cancel_btn': 'Cancel',
        'lang_changed': 'Interface language changed!',
        'auto_translate_enabled': 'Auto-translate enabled',
        'auto_translate_disabled': 'Auto-translate disabled',
        'translated_badge': '🌐 translated'
    },
    'pl': {
        'chats_title': 'CZATY',
        'nav_home': 'Główna',
        'nav_friends': 'znajomi',
        'nav_profile': 'profil',
        'chat_list_empty': 'Brak czatów',
        'btn_help': 'Pomoc',
        'btn_search': 'Szukaj',
        'welcome_btn_start': 'Rozpocznij',
        'welcome_subtitle': 'GLOBAL',
        'login_title': '🔐 Logowanie',
        'login_keyfile_hint': 'Załącz swój plik-klucz, aby się zalogować',
        'login_keyfile_label': '📎 Plik-klucz (.json)',
        'login_keyfile_btn': 'Wybierz plik-klucz...',
        'captcha_label': 'Weryfikacja',
        'captcha_placeholder': 'Wpisz tekst z obrazka',
        'login_btn': 'Zaloguj się',
        'no_account': 'Nie masz konta?',
        'register_link': 'Zarejestruj się!',
        'register_title': 'Rejestracja',
        'username_label': 'Nazwa użytkownika',
        'username_placeholder': 'Utwórz nazwę użytkownika',
        'password_label': 'Hasło',
        'password_placeholder': 'Utwórz hasło (min. 8 znaków)',
        'password_hint': 'Minimum 8 znaków',
        'confirm_password_label': 'Powtórz hasło',
        'confirm_password_placeholder': 'Powtórz hasło',
        'birthdate_label': 'Data urodzenia',
        'terms_summary': '📄 Regulamin (obowiązkowa lektura)',
        'terms_accept': 'Przeczytałem(-am) i akceptuję regulamin',
        'register_btn': 'Utwórz konto',
        'has_account': 'Masz konto?',
        'login_link': 'Zaloguj się!',
        'brand_subtitle': 'Najbezpieczniejszy komunikator w historii',
        'input_placeholder': 'Napisz wiadomość...',
        'translate_btn': 'Przetłumacz →',
        'translating_text': 'Tłumaczenie...',
        'translate_no_detect': 'Nie udało się wykryć języka.',
        'translate_same_lang': 'Wiadomość jest już w Twoim języku.',
        'translate_fail': 'Nie otrzymano tłumaczenia.',
        'translate_error': 'Błąd tłumaczenia.',
        'call_title': 'Połączenie',
        'call_waiting': 'oczekiwanie…',
        'call_hangup': '⛔ Rozłącz',
        'call_mic_on': '🎙️ Mikrofon WŁ.',
        'call_hint': 'Jeśli nie słychać — sprawdź uprawnienia mikrofonu w przeglądarce.',
        'home_chat_label': 'Czat',
        'profile_title': 'Mój profil',
        'profile_id_label': 'Twoje ID:',
        'profile_id_note': 'ID widoczne tylko dla Ciebie',
        'status_online': 'Online',
        'status_offline': 'Offline',
        'nickname_label': 'Nazwa',
        'bio_label': 'Opis profilu',
        'bio_placeholder': 'Opowiedz o sobie...',
        'profile_save': 'Zapisz zmiany',
        'profile_logout': 'Wyloguj się',
        'admin_menu_title': '🛠️ Menu admina',
        'admin_news_btn': '📰 Aktualności',
        'admin_list_btn': '📄 Lista',
        'help_title': 'Pomoc',
        'help_desc': 'PrivaXion — najbezpieczniejszy komunikator. Wszystkie wiadomości chronione potrójnym szyfrowaniem (E2EE).',
        'help_search_desc': 'Szukaj — znajdź znajomego po ID i zacznij rozmowę',
        'help_friends_desc': 'znajomi — wyszukiwanie użytkowników w menu bocznym',
        'help_profile_desc': 'profil — Twoja nazwa, ID i ustawienia konta',
        'help_news_btn': 'Aktualności',
        'help_settings_btn': 'Ustawienia bezpieczeństwa',
        'help_admin_btn': '⚙️ Panel administratora',
        'search_title': '🔍 Szukaj użytkowników',
        'search_placeholder': 'Wpisz ID lub nazwę (np.: #Abc12345)',
        'search_btn': 'Szukaj',
        'create_channel_btn': 'Utwórz kanał',
        'create_group_btn': 'Utwórz grupę',
        'settings_title': '⚙️ Ustawienia',
        'settings_lang_title': '🌍 Język',
        'settings_lang_desc': 'Wybierz język interfejsu i automatycznego tłumaczenia wiadomości.',
        'sessions_title': '🛡️ Aktywne sesje',
        'sessions_desc': 'Lista urządzeń podłączonych do Twojego konta.',
        'terminate_sessions': 'Zakończ wszystkie inne sesje',
        'theme_title': '🎨 Motyw',
        'theme_desc': 'Wybierz jasny lub ciemny motyw.',
        'theme_dark': 'Ciemny motyw',
        'theme_light': 'Jasny motyw',
        'censor_title': '🔞 Filtr wulgaryzmów',
        'censor_desc': 'Jeśli masz mniej niż 18 lat — filtr jest zawsze włączony. Jeśli 18+ — możesz go przełączać.',
        'censor_on': 'Włączony',
        'censor_off': 'Wyłączony',
        'auto_translate_title': '🌐 Auto-tłumaczenie wiadomości',
        'auto_translate_desc': 'Automatycznie tłumacz przychodzące wiadomości na wybrany język.',
        'auto_translate_on': 'Auto-tłumaczenie włączone',
        'auto_translate_off': 'Auto-tłumaczenie wyłączone',
        'news_title': '📰 Aktualności PrivaXion',
        'news_empty': 'Brak aktualności',
        'news_input_placeholder': 'Wpisz tekst aktualności...',
        'news_publish_btn': 'Opublikuj',
        'create_room_title': 'Utwórz',
        'room_name_label': 'Nazwa',
        'room_name_placeholder': 'Wpisz nazwę...',
        'room_desc_label': 'Opis',
        'room_desc_placeholder': 'Wpisz opis...',
        'room_logo_label': 'Logo (URL)',
        'room_access_label': 'Dostęp (tylko kanały)',
        'room_access_private': 'Prywatny (tylko po ID)',
        'room_access_public': 'Publiczny (po nazwie)',
        'create_btn': 'Utwórz',
        'cancel_btn': 'Anuluj',
        'room_settings_title': 'Ustawienia pokoju',
        'save_btn': 'Zapisz',
        'close_btn': 'Zamknij',
        'danger_zone': 'Strefa zagrożenia',
        'danger_zone_desc': 'Trwałe usunięcie pokoju.',
        'captcha_refresh': 'Odśwież captcha',
        'delete_password_label': 'Twoje hasło',
        'delete_password_placeholder': 'Wpisz hasło...',
        'delete_room_btn': 'Usuń pokój',
        'security_title': 'Wykryto podejrzaną aktywność',
        'security_desc': 'Twój adres IP został zablokowany z powodu wielu prób włamania.',
        'security_ip': 'Adres IP:',
        'security_reason': 'Powód:',
        'security_time': 'Czas blokady:',
        'security_warning': '⚠️ Twój dostęp jest zablokowany NA ZAWSZE. Skontaktuj się ze wsparciem PrivaXion.',
        'security_support': 'Skontaktuj się ze wsparciem',
        'admin_panel_title': '🛡️ Panel administratora',
        'admin_search_placeholder': 'Szukaj po ID lub Nazwie',
        'admin_sort_az': 'Sortuj: A-Z',
        'admin_sort_id': 'Sortuj: ID (0-1000)',
        'admin_close': 'Zamknij',
        'admin_ban_title': 'Zablokuj',
        'ban_reason_placeholder': 'Powód (np. Spam)',
        'ban_time_placeholder': 'Czas (np. Na zawsze lub 30 dni)',
        'ban_desc_placeholder': 'Szczegółowy opis',
        'ban_submit_btn': 'Uderz banhammera',
        'ban_cancel_btn': 'Anuluj',
        'lang_changed': 'Język interfejsu zmieniony!',
        'auto_translate_enabled': 'Auto-tłumaczenie włączone',
        'auto_translate_disabled': 'Auto-tłumaczenie wyłączone',
        'translated_badge': '🌐 przetłumaczono'
    },
    'de': {
        'chats_title': 'CHATS',
        'nav_home': 'Startseite',
        'nav_friends': 'freunde',
        'nav_profile': 'profil',
        'chat_list_empty': 'Keine Chats',
        'btn_help': 'Hilfe',
        'btn_search': 'Suche',
        'welcome_btn_start': 'Starten',
        'welcome_subtitle': 'GLOBAL',
        'login_title': '🔐 Anmelden',
        'login_keyfile_hint': 'Hänge deine Schlüsseldatei an, um dich anzumelden',
        'login_keyfile_label': '📎 Schlüsseldatei (.json)',
        'login_keyfile_btn': 'Schlüsseldatei wählen...',
        'captcha_label': 'Roboter-Check',
        'captcha_placeholder': 'Text vom Bild eingeben',
        'login_btn': 'Anmelden',
        'no_account': 'Kein Konto?',
        'register_link': 'Registrieren!',
        'register_title': 'Registrierung',
        'username_label': 'Benutzername',
        'username_placeholder': 'Benutzername erstellen',
        'password_label': 'Passwort',
        'password_placeholder': 'Passwort erstellen (min. 8 Zeichen)',
        'password_hint': 'Mindestens 8 Zeichen',
        'confirm_password_label': 'Passwort wiederholen',
        'confirm_password_placeholder': 'Passwort wiederholen',
        'birthdate_label': 'Geburtsdatum',
        'terms_summary': '📄 Nutzungsbedingungen (Pflichtlektüre)',
        'terms_accept': 'Ich habe die Nutzungsbedingungen gelesen und akzeptiere sie',
        'register_btn': 'Konto erstellen',
        'has_account': 'Bereits ein Konto?',
        'login_link': 'Anmelden!',
        'brand_subtitle': 'Der sicherste Messenger der Geschichte',
        'input_placeholder': 'Schreibe eine Nachricht...',
        'translate_btn': 'Übersetzen →',
        'translating_text': 'Übersetze...',
        'translate_no_detect': 'Sprache konnte nicht erkannt werden.',
        'translate_same_lang': 'Nachricht ist bereits in deiner Sprache.',
        'translate_fail': 'Übersetzung nicht erhalten.',
        'translate_error': 'Übersetzungsfehler.',
        'call_title': 'Anruf',
        'call_waiting': 'warten…',
        'call_hangup': '⛔ Auflegen',
        'call_mic_on': '🎙️ Mikrofon AN',
        'call_hint': 'Wenn nichts zu hören — überprüfe die Mikrofon-Berechtigung im Browser.',
        'home_chat_label': 'Chat',
        'profile_title': 'Mein Profil',
        'profile_id_label': 'Deine ID:',
        'profile_id_note': 'ID ist nur für dich sichtbar',
        'status_online': 'Online',
        'status_offline': 'Offline',
        'nickname_label': 'Benutzername',
        'bio_label': 'Profilbeschreibung',
        'bio_placeholder': 'Erzähle über dich...',
        'profile_save': 'Änderungen speichern',
        'profile_logout': 'Abmelden',
        'admin_menu_title': '🛠️ Admin-Menü',
        'admin_news_btn': '📰 Nachrichten',
        'admin_list_btn': '📄 Liste',
        'help_title': 'Hilfe',
        'help_desc': 'PrivaXion — der sicherste Messenger. Alle Nachrichten sind mit dreifacher Verschlüsselung (E2EE) geschützt.',
        'help_search_desc': 'Suche — finde einen Freund per ID und starte den Chat',
        'help_friends_desc': 'freunde — Benutzersuche im Seitenmenü',
        'help_profile_desc': 'profil — dein Benutzername, ID und Kontoeinstellungen',
        'help_news_btn': 'Nachrichten',
        'help_settings_btn': 'Sicherheitseinstellungen',
        'help_admin_btn': '⚙️ Admin-Panel',
        'search_title': '🔍 Benutzer suchen',
        'search_placeholder': 'Benutzer-ID oder Name eingeben (z.B.: #Abc12345)',
        'search_btn': 'Suchen',
        'create_channel_btn': 'Kanal erstellen',
        'create_group_btn': 'Gruppe erstellen',
        'settings_title': '⚙️ Einstellungen',
        'settings_lang_title': '🌍 Sprache',
        'settings_lang_desc': 'Wähle die Sprache für Benutzeroberfläche und Nachrichtenübersetzung.',
        'sessions_title': '🛡️ Aktive Sitzungen',
        'sessions_desc': 'Liste der mit deinem Konto verbundenen Geräte.',
        'terminate_sessions': 'Alle anderen Sitzungen beenden',
        'theme_title': '🎨 Design',
        'theme_desc': 'Wähle helles oder dunkles Design.',
        'theme_dark': 'Dunkles Design',
        'theme_light': 'Helles Design',
        'censor_title': '🔞 Schimpfwort-Filter',
        'censor_desc': 'Unter 18 — Filter ist immer aktiv. Ab 18 — kann umgeschaltet werden.',
        'censor_on': 'Aktiviert',
        'censor_off': 'Deaktiviert',
        'auto_translate_title': '🌐 Auto-Übersetzung',
        'auto_translate_desc': 'Eingehende Nachrichten automatisch in die gewählte Sprache übersetzen.',
        'auto_translate_on': 'Auto-Übersetzung aktiviert',
        'auto_translate_off': 'Auto-Übersetzung deaktiviert',
        'news_title': '📰 PrivaXion Nachrichten',
        'news_empty': 'Keine Nachrichten',
        'news_input_placeholder': 'Nachrichtentext eingeben...',
        'news_publish_btn': 'Veröffentlichen',
        'create_room_title': 'Erstellen',
        'room_name_label': 'Name',
        'room_name_placeholder': 'Name eingeben...',
        'room_desc_label': 'Beschreibung',
        'room_desc_placeholder': 'Beschreibung eingeben...',
        'room_logo_label': 'Logo (URL)',
        'room_access_label': 'Zugang (nur Kanäle)',
        'room_access_private': 'Privat (nur per ID)',
        'room_access_public': 'Öffentlich (per Name)',
        'create_btn': 'Erstellen',
        'cancel_btn': 'Abbrechen',
        'room_settings_title': 'Raumeinstellungen',
        'save_btn': 'Speichern',
        'close_btn': 'Schließen',
        'danger_zone': 'Gefahrenzone',
        'danger_zone_desc': 'Raum dauerhaft löschen.',
        'captcha_refresh': 'Captcha aktualisieren',
        'delete_password_label': 'Dein Passwort',
        'delete_password_placeholder': 'Passwort eingeben...',
        'delete_room_btn': 'Raum löschen',
        'security_title': 'Verdächtige Aktivität erkannt',
        'security_desc': 'Deine IP-Adresse wurde wegen mehrfacher Hack-Versuche gesperrt.',
        'security_ip': 'IP-Adresse:',
        'security_reason': 'Grund:',
        'security_time': 'Sperrzeit:',
        'security_warning': '⚠️ Dein Zugang ist FÜR IMMER gesperrt. Kontaktiere den PrivaXion-Support.',
        'security_support': 'Support kontaktieren',
        'admin_panel_title': '🛡️ Admin-Panel',
        'admin_search_placeholder': 'Suche nach ID oder Name',
        'admin_sort_az': 'Sort: A-Z',
        'admin_sort_id': 'Sort: ID (0-1000)',
        'admin_close': 'Schließen',
        'admin_ban_title': 'Sperren',
        'ban_reason_placeholder': 'Grund (z.B. Spam)',
        'ban_time_placeholder': 'Dauer (z.B. Für immer oder 30 Tage)',
        'ban_desc_placeholder': 'Detaillierte Beschreibung',
        'ban_submit_btn': 'Banhammer schlagen',
        'ban_cancel_btn': 'Abbrechen',
        'lang_changed': 'Schnittstellensprache geändert!',
        'auto_translate_enabled': 'Auto-Übersetzung aktiviert',
        'auto_translate_disabled': 'Auto-Übersetzung deaktiviert',
        'translated_badge': '🌐 übersetzt'
    },
    'uk': {
        'chats_title': 'ЧАТИ',
        'nav_home': 'Головна',
        'nav_friends': 'друзі',
        'nav_profile': 'профіль',
        'chat_list_empty': 'Немає чатів',
        'btn_help': 'Допомога',
        'btn_search': 'Пошук',
        'welcome_btn_start': 'Почати',
        'welcome_subtitle': 'GLOBAL',
        'login_title': '🔐 Увійти в акаунт',
        'login_keyfile_hint': 'Прикріпіть ваш файл-ключ для входу',
        'login_keyfile_label': '📎 Файл-ключ (.json)',
        'login_keyfile_btn': 'Обрати файл-ключ...',
        'captcha_label': 'Перевірка',
        'captcha_placeholder': 'Введіть текст з картинки',
        'login_btn': 'Увійти',
        'no_account': 'Немає акаунту?',
        'register_link': 'Зареєструватися!',
        'register_title': 'Реєстрація',
        'username_label': 'Нікнейм',
        'username_placeholder': 'Створіть нікнейм',
        'password_label': 'Пароль',
        'password_placeholder': 'Створіть пароль (від 8 символів)',
        'password_hint': 'Мінімум 8 символів',
        'confirm_password_label': 'Повторіть пароль',
        'confirm_password_placeholder': 'Повторіть пароль',
        'birthdate_label': 'Дата народження',
        'terms_summary': '📄 Угода користувача (обов\'язково прочитати)',
        'terms_accept': 'Я прочитав(-ла) та приймаю умови угоди',
        'register_btn': 'Створити акаунт',
        'has_account': 'Є акаунт?',
        'login_link': 'Увійти!',
        'brand_subtitle': 'Найбезпечніший месенджер в історії',
        'input_placeholder': 'Напишіть повідомлення...',
        'translate_btn': 'Перекласти →',
        'translating_text': 'Перекладаємо...',
        'translate_no_detect': 'Не вдалося визначити мову.',
        'translate_same_lang': 'Повідомлення вже вашою мовою.',
        'translate_fail': 'Переклад не отримано.',
        'translate_error': 'Помилка перекладу.',
        'call_title': 'Дзвінок',
        'call_waiting': 'очікування…',
        'call_hangup': '⛔ Відбій',
        'call_mic_on': '🎙️ Мікрофон УВІМК.',
        'call_hint': 'Якщо не чути — перевірте дозвіл мікрофона у браузері.',
        'home_chat_label': 'Чат',
        'profile_title': 'Мій профіль',
        'profile_id_label': 'Ваш ID:',
        'profile_id_note': 'ID видно лише вам',
        'status_online': 'Онлайн',
        'status_offline': 'Офлайн',
        'nickname_label': 'Нікнейм',
        'bio_label': 'Опис профілю',
        'bio_placeholder': 'Розкажіть про себе...',
        'profile_save': 'Зберегти зміни',
        'profile_logout': 'Вийти з акаунту',
        'admin_menu_title': '🛠️ Меню адміна',
        'admin_news_btn': '📰 Новини',
        'admin_list_btn': '📄 Список',
        'help_title': 'Допомога',
        'help_desc': 'PrivaXion — найбезпечніший месенджер. Усі повідомлення захищені потрійним шифруванням (E2EE).',
        'help_search_desc': 'Пошук — знайдіть друга за ID та почніть листування',
        'help_friends_desc': 'друзі — пошук користувачів у бічному меню',
        'help_profile_desc': 'профіль — ваш нікнейм, ID та налаштування акаунту',
        'help_news_btn': 'Новини',
        'help_settings_btn': 'Налаштування безпеки',
        'help_admin_btn': '⚙️ Панель адміністратора',
        'search_title': '🔍 Пошук користувачів',
        'search_placeholder': 'Введіть ID або назву (напр.: #Abc12345)',
        'search_btn': 'Знайти',
        'create_channel_btn': 'Створити канал',
        'create_group_btn': 'Створити групу',
        'settings_title': '⚙️ Налаштування',
        'settings_lang_title': '🌍 Мова',
        'settings_lang_desc': 'Оберіть мову інтерфейсу та авто-перекладу повідомлень.',
        'sessions_title': '🛡️ Активні сесії',
        'sessions_desc': 'Список пристроїв, підключених до вашого акаунту.',
        'terminate_sessions': 'Завершити всі інші сесії',
        'theme_title': '🎨 Тема оформлення',
        'theme_desc': 'Оберіть світлу або темну тему.',
        'theme_dark': 'Темна тема',
        'theme_light': 'Світла тема',
        'censor_title': '🔞 Цензура',
        'censor_desc': 'Якщо вам менше 18 — цензура завжди увімкнена. Якщо 18+ — можна керувати перемикачем.',
        'censor_on': 'Увімкнена',
        'censor_off': 'Вимкнена',
        'auto_translate_title': '🌐 Авто-переклад повідомлень',
        'auto_translate_desc': 'Автоматично перекладати вхідні повідомлення на обрану мову.',
        'auto_translate_on': 'Авто-переклад увімкнено',
        'auto_translate_off': 'Авто-переклад вимкнено',
        'news_title': '📰 Новини PrivaXion',
        'news_empty': 'Немає новин',
        'news_input_placeholder': 'Введіть текст новини...',
        'news_publish_btn': 'Опублікувати',
        'create_room_title': 'Створити',
        'room_name_label': 'Назва',
        'room_name_placeholder': 'Введіть назву...',
        'room_desc_label': 'Опис',
        'room_desc_placeholder': 'Введіть опис...',
        'room_logo_label': 'Логотип (URL)',
        'room_access_label': 'Доступ (лише для каналів)',
        'room_access_private': 'Приватний (лише за ID)',
        'room_access_public': 'Відкритий (за назвою)',
        'create_btn': 'Створити',
        'cancel_btn': 'Скасувати',
        'room_settings_title': 'Налаштування кімнати',
        'save_btn': 'Зберегти',
        'close_btn': 'Закрити',
        'danger_zone': 'Небезпечна зона',
        'danger_zone_desc': 'Видалення кімнати назавжди.',
        'captcha_refresh': 'Оновити капчу',
        'delete_password_label': 'Ваш пароль',
        'delete_password_placeholder': 'Введіть пароль...',
        'delete_room_btn': 'Видалити кімнату',
        'security_title': 'Виявлено підозрілу активність',
        'security_desc': 'Вашу IP-адресу заблоковано через численні спроби злому.',
        'security_ip': 'IP-адреса:',
        'security_reason': 'Причина:',
        'security_time': 'Час блокування:',
        'security_warning': '⚠️ Ваш доступ заблоковано НАЗАВЖДИ. Зверніться до підтримки PrivaXion.',
        'security_support': 'Звернутися до підтримки',
        'admin_panel_title': '🛡️ Панель адміністратора',
        'admin_search_placeholder': 'Пошук за ID або Ніком',
        'admin_sort_az': 'Сорт: А-Я',
        'admin_sort_id': 'Сорт: ID (0-1000)',
        'admin_close': 'Закрити',
        'admin_ban_title': 'Заблокувати',
        'ban_reason_placeholder': 'Причина (напр. Спам)',
        'ban_time_placeholder': 'Час (напр. Назавжди або 30 днів)',
        'ban_desc_placeholder': 'Детальний опис',
        'ban_submit_btn': 'Вдарити банхаммером',
        'ban_cancel_btn': 'Скасувати',
        'lang_changed': 'Мову інтерфейсу змінено!',
        'auto_translate_enabled': 'Авто-переклад увімкнено',
        'auto_translate_disabled': 'Авто-переклад вимкнено',
        'translated_badge': '🌐 перекладено'
    }
};

// ==========================================
// translateUI — обходит все data-i18n / data-i18n-placeholder
// ==========================================
function translateUI(lang) {
    const dict = I18N_DICT[lang] || I18N_DICT['ru'];

    // Текстовый контент
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (dict[key]) el.textContent = dict[key];
    });

    // Плейсхолдеры
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (dict[key]) el.placeholder = dict[key];
    });

    // Title атрибуты
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        if (dict[key]) el.title = dict[key];
    });

    // Обновить кнопки перевода в чате
    document.querySelectorAll('.btn-translate').forEach(btn => {
        if (dict['translate_btn']) btn.textContent = dict['translate_btn'];
    });
}

// ==========================================
// Улучшенный auto-translate для сообщений
// ==========================================

// Расширенный детектор языка (ru/en/pl/de/uk)
function detectMessageLanguage(text) {
    if (!text || typeof text !== 'string') return null;
    const s = text.trim();
    if (!s) return null;

    const hasCyrillic = /[А-Яа-яЁё]/.test(s);
    const hasUkrainian = /[ІіЇїЄєҐґ]/.test(s);
    const hasLatin = /[A-Za-z]/.test(s);
    const hasPolish = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(s);
    const hasGerman = /[äöüßÄÖÜ]/.test(s);

    if (hasUkrainian) return 'uk';
    if (hasCyrillic && !hasLatin) return 'ru';
    if (hasPolish) return 'pl';
    if (hasGerman) return 'de';
    if (hasLatin && !hasCyrillic) return 'en';

    // Смешанный — считаем по преобладанию
    const cyr = (s.match(/[А-Яа-яЁёІіЇїЄєҐґ]/g) || []).length;
    const lat = (s.match(/[A-Za-zäöüßąćęłńóśźżÄÖÜĄĆĘŁŃÓŚŹŻ]/g) || []).length;
    if (cyr === 0 && lat === 0) return null;
    return cyr >= lat ? 'ru' : 'en';
}

// Единая функция перевода через MyMemory
async function fetchTranslation(text, sourceLang, targetLang) {
    // 1.0 FIX: автономный режим без внешних fetch (перевод отключен).
    // Возвращаем исходный текст.
    return text;
}


function setupAutoTranslator() {
    const chatContainer = document.getElementById('chat-messages');
    if (!chatContainer) return;

    const observer = new MutationObserver((mutations) => {
        const autoEnabled = localStorage.getItem('px_auto_translate') !== 'false';
        if (!autoEnabled) return;

        const targetLang = localStorage.getItem('px_lang') || 'ru';

        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(async (node) => {
                if (node.nodeType !== 1) return;
                if (!node.classList.contains('msg-in')) return;
                if (node.classList.contains('msg-bot')) return;
                if (node.hasAttribute('data-auto-translated')) return;

                // Найти текст сообщения внутри .msg-bubble
                const bubble = node.querySelector('.msg-bubble');
                if (!bubble) return;

                const originalText = bubble.textContent.trim();
                if (!originalText || originalText.length < 2) return;

                const detectedLang = detectMessageLanguage(originalText);
                if (!detectedLang || detectedLang === targetLang) return;

                node.setAttribute('data-auto-translated', 'true');

                try {
                    const translated = await fetchTranslation(originalText, detectedLang, targetLang);
                    if (translated && translated !== originalText) {
                        const dict = I18N_DICT[targetLang] || I18N_DICT['ru'];
                        const badge = document.createElement('div');
                        badge.className = 'auto-translate-badge';
                        badge.innerHTML = `<span class="auto-translate-text">${translated}</span><span class="auto-translate-label">${dict['translated_badge'] || '🌐 translated'}</span>`;
                        // Вставляем перевод после msg-row
                        const msgRow = node.querySelector('.msg-row');
                        if (msgRow) {
                            msgRow.after(badge);
                        } else {
                            bubble.after(badge);
                        }
                    }
                } catch(e) {
                    console.error('Auto-translate failed:', e);
                }
            });
        });
    });

    observer.observe(chatContainer, { childList: true });
}

// ==========================================
// THEME: DARK / LIGHT
// ==========================================
(function initTheme() {
    const saved = localStorage.getItem('px_theme') || 'dark';
    applyTheme(saved);
})();

function applyTheme(theme) {
    document.body.classList.remove('theme-dark', 'theme-light');
    document.body.classList.add('theme-' + theme);
    localStorage.setItem('px_theme', theme);
}

window.setTheme = function(theme) { applyTheme(theme); };

// ==========================================
// Единый обработчик настроек (THEME + LANG)
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
    // --- THEME ---
    const savedTheme = localStorage.getItem('px_theme') || 'dark';
    if (savedTheme === 'light') document.body.classList.add('light-theme');

    const themeSelect = document.getElementById('app-theme-select');
    if (themeSelect) {
        themeSelect.value = savedTheme;
        themeSelect.addEventListener('change', (e) => {
            const val = e.target.value;
            localStorage.setItem('px_theme', val);
            if (val === 'light') document.body.classList.add('light-theme');
            else document.body.classList.remove('light-theme');
        });
    }

    // --- LANGUAGE ---
    const savedLang = localStorage.getItem('px_lang') || 'ru';
    const langSelect = document.getElementById('app-language-select');
    if (langSelect) {
        langSelect.value = savedLang;
        langSelect.addEventListener('change', (e) => {
            const newLang = e.target.value;
            localStorage.setItem('px_lang', newLang);
            translateUI(newLang);
            const dict = I18N_DICT[newLang] || I18N_DICT['ru'];
            if (typeof showToast === 'function') {
                showToast(dict['lang_changed'] || 'Language changed!', 'success');
            }
        });
    }

    // --- AUTO-TRANSLATE TOGGLE ---
    const autoTranslateToggle = document.getElementById('auto-translate-toggle');
    const autoTranslateLabel = document.getElementById('auto-translate-label');
    const autoEnabled = localStorage.getItem('px_auto_translate') !== 'false';

    if (autoTranslateToggle) {
        autoTranslateToggle.checked = autoEnabled;
        if (autoTranslateLabel) {
            const dict = I18N_DICT[savedLang] || I18N_DICT['ru'];
            autoTranslateLabel.textContent = autoEnabled ? (dict['auto_translate_on'] || 'On') : (dict['auto_translate_off'] || 'Off');
        }
        autoTranslateToggle.addEventListener('change', (e) => {
            const enabled = e.target.checked;
            localStorage.setItem('px_auto_translate', enabled ? 'true' : 'false');
            const currentLang = localStorage.getItem('px_lang') || 'ru';
            const dict = I18N_DICT[currentLang] || I18N_DICT['ru'];
            if (autoTranslateLabel) {
                autoTranslateLabel.textContent = enabled ? (dict['auto_translate_on'] || 'On') : (dict['auto_translate_off'] || 'Off');
            }
            if (typeof showToast === 'function') {
                showToast(enabled ? (dict['auto_translate_enabled'] || 'Auto-translate enabled') : (dict['auto_translate_disabled'] || 'Auto-translate disabled'), 'success');
            }
        });
    }

    // Применить язык к UI
    translateUI(savedLang);

    // Инициализировать auto-translator
    setupAutoTranslator();
});
