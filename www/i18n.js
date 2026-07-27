const i18nDict = {
    ru: {
        settings_sessions_title: "🛡️ Активные сессии",
        settings_sessions_desc: "Список устройств, подключённых к вашему аккаунту.",
        settings_sessions_btn: "Завершить все другие сеансы",
        settings_lang_title: "🌐 Язык интерфейса и авто-перевод",
        settings_lang_desc: "Выберите язык приложения. Все входящие сообщения будут автоматически переводиться на этот язык.",
        chat_placeholder: "Напишите сообщение...",
        search_placeholder: "Введите ID пользователя или название",
        news_title: "📰 Новости PrivaXion",
        profile_title: "Мой профиль",
        home_btn: "Главная",
        friends_btn: "друзья",
        profile_btn: "профиль",
        chat_empty: "Пока нет чатов",
        call_title: "Звонок",
        call_hangup: "⛔ Отбой",
        call_mic: "🎙️ Микрофон ВКЛ"
    },
    en: {
        settings_sessions_title: "🛡️ Active Sessions",
        settings_sessions_desc: "List of devices connected to your account.",
        settings_sessions_btn: "Terminate all other sessions",
        settings_lang_title: "🌐 Interface Language & Auto-translate",
        settings_lang_desc: "Choose the app language. All incoming messages will be automatically translated to this language.",
        chat_placeholder: "Type a message...",
        search_placeholder: "Enter user ID or name",
        news_title: "📰 PrivaXion News",
        profile_title: "My Profile",
        home_btn: "Home",
        friends_btn: "Friends",
        profile_btn: "Profile",
        chat_empty: "No chats yet",
        call_title: "Call",
        call_hangup: "⛔ Hang up",
        call_mic: "🎙️ Mic ON"
    },
    pl: {
        settings_sessions_title: "🛡️ Aktywne Sesje",
        settings_sessions_desc: "Lista urządzeń podłączonych do twojego konta.",
        settings_sessions_btn: "Zakończ wszystkie inne sesje",
        settings_lang_title: "🌐 Język interfejsu i Auto-tłumaczenie",
        settings_lang_desc: "Wybierz język aplikacji. Wszystkie wiadomości przychodzące zostaną automatycznie przetłumaczone na ten język.",
        chat_placeholder: "Napisz wiadomość...",
        search_placeholder: "Wprowadź identyfikator użytkownika lub nazwę",
        news_title: "📰 Wiadomości PrivaXion",
        profile_title: "Mój profil",
        home_btn: "Główna",
        friends_btn: "Znajomi",
        profile_btn: "Profil",
        chat_empty: "Jeszcze brak czatów",
        call_title: "Połączenie",
        call_hangup: "⛔ Rozłącz",
        call_mic: "🎙️ Mikrofon WŁ"
    },
    de: {
        settings_sessions_title: "🛡️ Aktive Sitzungen",
        settings_sessions_desc: "Liste der mit Ihrem Konto verbundenen Geräte.",
        settings_sessions_btn: "Alle anderen Sitzungen beenden",
        settings_lang_title: "🌐 Oberflächensprache & Auto-Übersetzung",
        settings_lang_desc: "Wählen Sie die App-Sprache. Alle eingehenden Nachrichten werden automatisch in diese Sprache übersetzt.",
        chat_placeholder: "Nachricht schreiben...",
        search_placeholder: "Benutzer-ID oder Namen eingeben",
        news_title: "📰 PrivaXion Nachrichten",
        profile_title: "Mein Profil",
        home_btn: "Start",
        friends_btn: "Freunde",
        profile_btn: "Profil",
        chat_empty: "Noch keine Chats",
        call_title: "Anruf",
        call_hangup: "⛔ Auflegen",
        call_mic: "🎙️ Mikrofon EIN"
    },
    es: {
        settings_sessions_title: "🛡️ Sesiones Activas",
        settings_sessions_desc: "Lista de dispositivos conectados a tu cuenta.",
        settings_sessions_btn: "Terminar todas las demás sesiones",
        settings_lang_title: "🌐 Idioma de la interfaz y Autotraducción",
        settings_lang_desc: "Elige el idioma de la app. Todos los mensajes entrantes se traducirán automáticamente a este idioma.",
        chat_placeholder: "Escribe un mensaje...",
        search_placeholder: "Introduce el ID de usuario o nombre",
        news_title: "📰 Noticias PrivaXion",
        profile_title: "Mi Perfil",
        home_btn: "Inicio",
        friends_btn: "Amigos",
        profile_btn: "Perfil",
        chat_empty: "Aún no hay chats",
        call_title: "Llamada",
        call_hangup: "⛔ Colgar",
        call_mic: "🎙️ Mic ON"
    }
};

window.currentAppLang = localStorage.getItem('px_app_lang') || 'ru';

window.applyTranslations = function(lang) {
    if (!i18nDict[lang]) return;
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (i18nDict[lang][key]) {
            el.innerHTML = i18nDict[lang][key];
        }
    });
    
    // Handle specific inputs/placeholders
    const chatInput = document.getElementById('chat-message-input');
    if (chatInput && i18nDict[lang].chat_placeholder) chatInput.placeholder = i18nDict[lang].chat_placeholder;
    
    const searchInput = document.getElementById('search-input');
    if (searchInput && i18nDict[lang].search_placeholder) searchInput.placeholder = i18nDict[lang].search_placeholder;
    
    // Save to local storage
    localStorage.setItem('px_app_lang', lang);
    window.currentAppLang = lang;
};

document.addEventListener('DOMContentLoaded', () => {
    // Inject event listener for the language select dropdown
    const langSelect = document.getElementById('app-language-select');
    if (langSelect) {
        langSelect.value = window.currentAppLang;
        langSelect.addEventListener('change', (e) => {
            window.applyTranslations(e.target.value);
        });
    }
    // Apply on load
    window.applyTranslations(window.currentAppLang);
});

// Memoization cache for translations
const translationCache = {};

window.autoTranslateMessage = async function(text) {
    if (window.currentAppLang === 'ru') return text; // Default assumption, or we could translate everything to target. 
    // To be safe, we always translate if target isn't Russian, or we could let API detect source.
    
    const cacheKey = text + '|' + window.currentAppLang;
    if (translationCache[cacheKey]) return translationCache[cacheKey];

    try {
        // MyMemory Translation API (Free, 10k words/day)
        const res = await fetch(https://api.mymemory.translated.net/get?q=&langpair=autodetect|);
        const data = await res.json();
        if (data.responseData && data.responseData.translatedText) {
            translationCache[cacheKey] = data.responseData.translatedText;
            return data.responseData.translatedText;
        }
    } catch(e) {
        console.error('Translation error:', e);
    }
    return text; // fallback to original
};
