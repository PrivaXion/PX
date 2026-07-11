/**
 * PrivaXion - Фронтенд-модуль защиты от слежки (Anti-Surveillance UI)
 */

class AntiSurveillanceUI {
    constructor(authModule) {
        this.authModule = authModule;
        this.ramClipboard = null;
        this.clipboardTimer = null;
        this.isDuressMode = false;
        
        this.initAntiScreenshot();
        this.initRamClipboard();
        this.listenForElectronShield();
    }

    // =========================================================================
    // 1. ЗАЩИТА ОТ СКРИНШОТОВ (Клавиатурный перехват + Electron IPC)
    // =========================================================================
    initAntiScreenshot() {
        // Базовый перехват PrintScreen (на случай если не сработала защита Electron)
        window.addEventListener('keyup', (e) => {
            if (e.key === 'PrintScreen') {
                this.triggerScreenshotAlert();
            }
        });

        // Отключение контекстного меню убрано
    }

    triggerScreenshotAlert() {
        // Вывод предупреждения поверх всего интерфейса
        const alertOverlay = document.createElement('div');
        alertOverlay.id = 'privaxion-screenshot-alert';
        alertOverlay.innerHTML = `
            <div style="position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(255,0,0,0.9); z-index:99999; display:flex; justify-content:center; align-items:center; color:#fff; font-size:40px; font-weight:bold; font-family:sans-serif;">
                Ай ай ай делать скриншоты запрещено!
            </div>
        `;
        document.body.appendChild(alertOverlay);

        // Принудительный разлогин через 5 секунд
        setTimeout(() => {
            this.authModule.logout();
            window.location.href = '/login.html'; // Выброс на экран логина
        }, 5000);
    }

    // =========================================================================
    // 3. ПАРОЛЬ ПОД ПРИНУЖДЕНИЕМ (Duress Password)
    // =========================================================================
    async attemptLogin(username, password) {
        const user = await this.authModule.getUser(username);
        
        if (password === user.duressPassword) {
            // Введен пароль под принуждением
            this.isDuressMode = true;
            this.loadFakeInterface();
            return true;
        } else if (password === user.realPassword) {
            // Обычный вход
            this.isDuressMode = false;
            this.loadRealInterface();
            return true;
        }
        return false;
    }

    loadFakeInterface() {
        console.warn("[SECURITY] Активирован режим под принуждением (Duress Mode).");
        // Загрузка пустых чатов, ботов-заглушек или невинных переписок
        document.body.innerHTML = '<h1>PrivaXion - Добро пожаловать</h1><p>У вас нет новых сообщений.</p>';
    }

    loadRealInterface() {
        // Обычная загрузка приложения
    }

    // =========================================================================
    // 4. RAM-ONLY БУФЕР ОБМЕНА (Изолированное копирование)
    // =========================================================================
    initRamClipboard() {
        document.addEventListener('keydown', (e) => {
            // Перехват Ctrl+C / Cmd+C
            if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                e.preventDefault(); // Блокируем системный буфер
                const selection = window.getSelection().toString();
                if (selection) {
                    this.ramClipboard = selection;
                    console.log("[SECURITY] Текст скопирован в изолированный RAM-буфер.");
                    
                    // Автоудаление через 30 секунд
                    clearTimeout(this.clipboardTimer);
                    this.clipboardTimer = setTimeout(() => {
                        this.ramClipboard = null;
                        console.log("[SECURITY] RAM-буфер обмена очищен.");
                    }, 30000);
                }
            }
            
            // Перехват Ctrl+V / Cmd+V
            if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
                e.preventDefault(); // Блокируем системную вставку
                if (this.ramClipboard) {
                    // Вставка из RAM (простейшая реализация для input/textarea)
                    const activeEl = document.activeElement;
                    if (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') {
                        const start = activeEl.selectionStart;
                        const end = activeEl.selectionEnd;
                        activeEl.value = activeEl.value.slice(0, start) + this.ramClipboard + activeEl.value.slice(end);
                        activeEl.selectionStart = activeEl.selectionEnd = start + this.ramClipboard.length;
                    }
                }
            }
        });
    }

    // =========================================================================
    // Слушатель команд от Electron Shield (п. 2)
    // =========================================================================
    listenForElectronShield() {
        if (window.electronAPI) {
            window.electronAPI.onCaptureDetected(() => {
                // Полностью замазываем окно черным цветом при обнаружении записи
                document.documentElement.style.background = '#000';
                document.body.style.display = 'none';
            });
            window.electronAPI.onScreenshotAttempt(() => {
                this.triggerScreenshotAlert();
            });
        }
    }
}

// Экспорт для использования в основном файле
window.AntiSurveillanceUI = AntiSurveillanceUI;
