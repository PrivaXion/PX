import os
import re

def fix_app_js():
    with open('app.js', 'r', encoding='utf-8') as f:
        content = f.read()

    # Fix Login
    login_regex = re.compile(
        r"const username = document\.getElementById\('login-username'\)\.value\.trim\(\);\s+"
        r"const password = document\.getElementById\('login-password'\)\.value;\s+"
        r"const captcha  = document\.getElementById\('login-captcha-input'\)\.value\.trim\(\);\s+"
        r"(.*?)"
        r"try \{\s+"
        r"const result = await loginUserByKeyFile\(keyData\);\s+"
        r"if \(result\.error\) \{",
        re.DOTALL
    )
    
    new_login = """const username = document.getElementById('login-username').value.trim();
        const keyFile = document.getElementById('login-keyfile-input').files[0];
        const captcha  = document.getElementById('login-captcha-input').value.trim();
        \\1
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
            
            const users = await apiGet(`users?username=${encodeURIComponent(username)}`);
            if (users.length === 0) {
                showError(loginErrorDiv, 'Пользователь не найден');
                refreshLoginCaptcha(); return;
            }
            const user = users[0];

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
"""
    if "const keyFile = document.getElementById('login-keyfile-input').files[0];" not in content:
        content = login_regex.sub(new_login, content)

    # Fix Register
    reg_regex = re.compile(
        r"const username = document\.getElementById\('register-username'\)\.value\.trim\(\);\s+"
        r"const password = document\.getElementById\('register-password'\)\.value;\s+"
        r"const confirmPassword = document\.getElementById\('register-confirm-password'\)\.value;\s+"
        r"(.*?)const id = '#' \+ Math\.random\(\)\.toString\(36\)\.substr\(2, 9\);\s+"
        r"const newUser = \{\s+"
        r"username,\s+"
        r"password,\s+"
        r"id,",
        re.DOTALL
    )
    
    new_reg = """async function sha256(message) {
        const msgBuffer = new TextEncoder().encode(message);                    
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    const username = document.getElementById('register-username').value.trim();
        const password = document.getElementById('register-password').value;
        const confirmPassword = document.getElementById('register-confirm-password').value;
        \\1const id = '#' + Math.random().toString(36).substr(2, 9);
        const passwordHash = await sha256(password);
        
        const newUser = {
            username,
            password: passwordHash,
            passwordHash: passwordHash,
            id,"""
            
    if "async function sha256" not in content:
        content = reg_regex.sub(new_reg, content)

    # Add file download after registration
    download_regex = re.compile(
        r"await apiPost\('users', newUser\);\s+"
        r"showToast\('Регистрация успешна! Теперь войдите\.', 'success'\);\s+"
        r"document\.getElementById\('go-to-login'\)\.click\(\);"
    )
    
    new_download = """await apiPost('users', newUser);
            
            // Download key file
            const keyData = { username: newUser.username, id: newUser.id, passwordHash: newUser.passwordHash, generatedAt: Date.now() };
            const blob = new Blob([JSON.stringify(keyData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `privaxion_key_${newUser.username}.json`;
            a.click();
            URL.revokeObjectURL(url);
            
            showToast('Ключ-файл сохранен! Теперь войдите.', 'success');
            document.getElementById('go-to-login').click();"""
            
    if "Download key file" not in content:
        content = download_regex.sub(new_download, content)

    with open('app.js', 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    fix_app_js()
    print("Done")
