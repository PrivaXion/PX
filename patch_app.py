import os

def patch_app():
    with open('app.js', 'r', encoding='utf-8') as f:
        content = f.read()
        
    # 1. Login Form Logic
    old_login = """    const loginForm = document.getElementById('login-form');
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;"""
        
    new_login = """    const loginForm = document.getElementById('login-form');
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value.trim();
        const keyFile = document.getElementById('login-keyfile').files[0];
        if (!keyFile) {
            showLoginError('Прикрепите файл-ключ');
            return;
        }"""
        
    if old_login in content:
        content = content.replace(old_login, new_login)
        
    old_login_req = """        try {
            const users = await apiGet(`users?username=${encodeURIComponent(username)}`);
            if (users.length === 0) {
                showLoginError('Пользователь не найден');
                return;
            }
            const user = users[0];

            if (user.isBanned) {
                const reason = user.banReason || 'Нарушение правил';
                const time = user.banTime || 'Навсегда';
                const desc = user.banDesc || '';
                showLoginError(`Аккаунт заблокирован.<br>Причина: ${reason}<br>Срок: ${time}<br>${desc}`);
                return;
            }

            if (user.password !== password) {
                showLoginError('Неверный пароль');
                return;
            }"""
            
    new_login_req = """        try {
            const fileText = await keyFile.text();
            const keyData = JSON.parse(fileText);
            
            const users = await apiGet(`users?username=${encodeURIComponent(username)}`);
            if (users.length === 0) {
                showLoginError('Пользователь не найден');
                return;
            }
            const user = users[0];

            if (user.isBanned) {
                showLoginError(`Аккаунт заблокирован.<br>Причина: ${user.banReason}<br>Срок: ${user.banTime}`);
                return;
            }

            // Verify with JSON
            if (user.passwordHash !== keyData.passwordHash || user.id !== keyData.id) {
                showLoginError('Неверный или поврежденный ключ-файл');
                return;
            }"""
    if old_login_req in content:
        content = content.replace(old_login_req, new_login_req)

    # 2. Register Form Logic
    old_reg = """    const registerForm = document.getElementById('register-form');
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('register-username').value.trim();
        const password = document.getElementById('register-password').value;"""
        
    new_reg = """    async function sha256(message) {
        const msgBuffer = new TextEncoder().encode(message);                    
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    const registerForm = document.getElementById('register-form');
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const agree = document.getElementById('register-agreement').checked;
        if (!agree) return;
        const username = document.getElementById('register-username').value.trim();
        const password = document.getElementById('register-password').value;"""
        
    if old_reg in content:
        content = content.replace(old_reg, new_reg)
        
    old_reg_req = """            // Создаем пользователя
            const id = '#' + Math.random().toString(36).substr(2, 9);
            const newUser = {
                username,
                password,
                id,
                avatar: null,
                bio: '',
                status: 'online',
                sessions: [],
                friends: []
            };"""
    new_reg_req = """            // Создаем пользователя и ключ
            const id = '#' + Math.random().toString(36).substr(2, 9);
            const passwordHash = await sha256(password);
            
            const newUser = {
                username,
                password: passwordHash, // backward compat
                passwordHash: passwordHash,
                id,
                avatar: null,
                bio: '',
                status: 'online',
                sessions: [],
                friends: []
            };
            
            // Скачиваем ключ
            const keyData = { username, id, passwordHash, generatedAt: Date.now() };
            const blob = new Blob([JSON.stringify(keyData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `privaxion_key_${username}.json`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('Ключ-файл сохранен на устройство!', 'success');
"""
    if old_reg_req in content:
        content = content.replace(old_reg_req, new_reg_req)

    # 3. Settings Load/Save
    # Add to init / settings loading
    settings_code = """
    // === SETTINGS (THEME / LANG) ===
    const savedTheme = localStorage.getItem('px_theme') || 'dark';
    const savedLang = localStorage.getItem('px_lang') || 'ru';
    
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

    const langSelect = document.getElementById('app-language-select');
    if (langSelect) {
        langSelect.value = savedLang;
        langSelect.addEventListener('change', (e) => {
            localStorage.setItem('px_lang', e.target.value);
            showToast('Язык изменен. Перезагрузите приложение', 'success');
        });
    }
"""
    if "=== SETTINGS (THEME / LANG) ===" not in content:
        content += settings_code

    with open('app.js', 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    patch_app()
    print("Done app.js patching.")
