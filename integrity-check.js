/**
 * PrivaXion — Модуль проверки целостности (Integrity Check)
 * 
 * Проверяет:
 *  1. Наличие автора (WorldSviat) в лицензионном файле LICENSE.txt
 *  2. Корректность названия приложения в DOM и манифестах
 *  3. Оригинальность логотипа logo.png по размеру файла
 */

(function () {
    const EXPECTED_APP_NAME = "PrivaXion";
    const EXPECTED_AUTHOR = "WorldSviat";
    const EXPECTED_LOGO_SIZE = 393644; // Точный размер оригинального logo.png в байтах

    async function runIntegrityCheck() {
        try {
            // 1. Проверяем правильность названия приложения в заголовке и DOM
            const titleValid = document.title.includes(EXPECTED_APP_NAME);
            const brandTitle = document.querySelector('.brand-title, .app-header');
            const domNameValid = brandTitle ? brandTitle.textContent.includes(EXPECTED_APP_NAME) : true;

            if (!titleValid || !domNameValid) {
                return triggerLockout("Ошибка целостности: неверное название приложения.");
            }

            // 2. Проверяем файл лицензии LICENSE.txt на сервере/в сборке
            const licenseRes = await fetch('/LICENSE.txt', { cache: 'no-store' });
            if (!licenseRes.ok) {
                return triggerLockout("Ошибка лицензирования: файл LICENSE.txt отсутствует.");
            }
            const licenseText = await licenseRes.text();
            if (!licenseText.includes(EXPECTED_AUTHOR) || !licenseText.includes(EXPECTED_APP_NAME)) {
                return triggerLockout("Ошибка лицензирования: метаданные автора изменены.");
            }

            // 3. Проверяем оригинальность логотипа по его размеру
            const logoRes = await fetch('/logo.png', { cache: 'no-store' });
            if (!logoRes.ok) {
                return triggerLockout("Ошибка целостности: оригинальный логотип logo.png не найден.");
            }
            const logoBlob = await logoRes.blob();
            if (logoBlob.size !== EXPECTED_LOGO_SIZE) {
                return triggerLockout("Ошибка целостности: обнаружена подмена логотипа (размер не совпадает).");
            }

            console.log("[INTEGRITY] Проверка целостности успешно пройдена.");
        } catch (error) {
            // В случае любой ошибки сети/блокировки — также уходим в локаут для безопасности
            triggerLockout("Критический сбой проверки целостности: " + error.message);
        }
    }

    function triggerLockout(reason) {
        console.error("[INTEGRITY LOCKOUT]", reason);

        // Полная блокировка интерфейса приложения
        document.documentElement.style.background = "#090000";
        document.body.innerHTML = `
            <div style="
                position: fixed; 
                top: 0; 
                left: 0; 
                width: 100vw; 
                height: 100vh; 
                background: radial-gradient(circle, #2d0000, #090000); 
                color: #ff3333; 
                display: flex; 
                flex-direction: column; 
                justify-content: center; 
                align-items: center; 
                font-family: 'Courier New', Courier, monospace; 
                text-align: center; 
                padding: 20px; 
                z-index: 9999999;
                box-sizing: border-box;
            ">
                <span style="font-size: 80px; margin-bottom: 20px; animation: blink 1s infinite;">🚨</span>
                <h1 style="font-size: 32px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 10px;">
                    Integrity Lockout
                </h1>
                <p style="font-size: 16px; color: #ff9999; max-width: 600px; margin-bottom: 30px; line-height: 1.5;">
                    Приложение заблокировано. Обнаружено несанкционированное изменение исходного кода, 
                    подмена графических ресурсов или удаление информации об авторе.
                </p>
                <div style="
                    background: rgba(0, 0, 0, 0.4); 
                    border: 1px solid rgba(255, 0, 0, 0.3); 
                    padding: 12px 20px; 
                    border-radius: 6px; 
                    font-size: 13px; 
                    color: #ffaaaa;
                ">
                    Код ошибки: ${reason}
                </div>
            </div>
            <style>
                @keyframes blink {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.4; }
                }
            </style>
        `;

        // Блокируем дальнейшее выполнение скриптов
        throw new Error("Application execution halted due to integrity check failure.");
    }

    // Запускаем проверку при загрузке DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runIntegrityCheck);
    } else {
        runIntegrityCheck();
    }
})();
