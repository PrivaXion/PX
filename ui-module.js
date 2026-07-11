const translations = {
    en: {
        app_title: "PrivaXion",
        settings: "Settings",
        language: "Language",
        send: "Send",
        type_message: "Type a message...",
        welcome_msg: "Welcome to PrivaXion! This is a secure messenger.",
        hello_msg: "Hello! Testing the UI."
    },
    ru: {
        app_title: "PrivaXion",
        settings: "Настройки",
        language: "Язык",
        send: "Отправить",
        type_message: "Введите сообщение...",
        welcome_msg: "Добро пожаловать в PrivaXion! Это безопасный мессенджер.",
        hello_msg: "Привет! Тестирую интерфейс."
    },
    pl: {
        app_title: "PrivaXion",
        settings: "Ustawienia",
        language: "Język",
        send: "Wyślij",
        type_message: "Wpisz wiadomość...",
        welcome_msg: "Witamy w PrivaXion! To jest bezpieczny komunikator.",
        hello_msg: "Cześć! Testuję interfejs."
    },
    uk: {
        app_title: "PrivaXion",
        settings: "Налаштування",
        language: "Мова",
        send: "Надіслати",
        type_message: "Введіть повідомлення...",
        welcome_msg: "Ласкаво просимо до PrivaXion! Це безпечний месенджер.",
        hello_msg: "Привіт! Тестую інтерфейс."
    },
    de: {
        app_title: "PrivaXion",
        settings: "Einstellungen",
        language: "Sprache",
        send: "Senden",
        type_message: "Nachricht eingeben...",
        welcome_msg: "Willkommen bei PrivaXion! Dies ist ein sicherer Messenger.",
        hello_msg: "Hallo! Ich teste die Benutzeroberfläche."
    }
};

function setLanguage(lang) {
    if (!translations[lang]) return;
    
    // Update HTML lang attribute
    document.documentElement.lang = lang;

    // Update inner text
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[lang][key]) {
            el.innerText = translations[lang][key];
        }
    });

    // Update placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (translations[lang][key]) {
            el.placeholder = translations[lang][key];
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // 1. Splash Screen Logic
    // Exact 2-second timeout before fading out
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        splash.classList.add('fade-out');
        
        // Remove from DOM after fade transition completes (0.5s)
        setTimeout(() => {
            splash.style.display = 'none';
        }, 500);
    }, 2000);

    // 2. Settings Modal Logic
    const settingsBtn = document.getElementById('settings-btn');
    const closeSettingsBtn = document.getElementById('close-settings');
    const settingsModal = document.getElementById('settings-modal');

    settingsBtn.addEventListener('click', () => {
        settingsModal.classList.remove('hidden');
    });

    closeSettingsBtn.addEventListener('click', () => {
        settingsModal.classList.add('hidden');
    });
    
    // Close modal when clicking outside the content
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            settingsModal.classList.add('hidden');
        }
    });

    // 3. Language Switching Logic
    const languageSelect = document.getElementById('language-select');
    
    // Load saved lang or default to EN
    let savedLang = localStorage.getItem('privaxion_lang') || 'en';
    languageSelect.value = savedLang;
    setLanguage(savedLang);

    // Listen for language change
    languageSelect.addEventListener('change', (e) => {
        const newLang = e.target.value;
        setLanguage(newLang);
        localStorage.setItem('privaxion_lang', newLang);
    });
// Reset Security Button handler
    const resetSecurityBtn = document.getElementById('reset-security-btn');
    if (resetSecurityBtn) {
        resetSecurityBtn.addEventListener('click', async () => {
            if (confirm('Вы уверены, что хотите сбросить все данные безопасности и лимиты? Это действие необратимо.')) {
                await window.privaXionSecurityCore.resetAllSecurityData();
            }
        });
    }
});
