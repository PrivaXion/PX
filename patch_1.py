import json
import os
import hashlib
import uuid

def patch_db():
    print("Patching db.json...")
    with open('db.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Keep only #000000 user
    admin_user = None
    for u in data.get('users', []):
        if u.get('id') == '#000000':
            admin_user = u
            break
            
    if admin_user:
        # Give admin a hashed password if not already (let's set a default one we know, e.g. 'admin' -> hash)
        pwd_hash = hashlib.sha256('admin'.encode('utf-8')).hexdigest()
        admin_user['passwordHash'] = pwd_hash
        admin_user['password'] = pwd_hash # override plain password
        data['users'] = [admin_user]
    else:
        print("Admin user not found in DB!")
        data['users'] = []
        
    data['sessions'] = [] # Clear sessions
    
    with open('db.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def patch_html():
    print("Patching index.html...")
    with open('index.html', 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Move Copyright
    copyright_html = """    <!-- Присутствие/авторские права/регистрация -->
    <div id="copyright-table" aria-hidden="true">
        <div class="copyright-card">
            <table>
                <thead>
                    <tr>
                        <th colspan="2">Авторские права / Registration</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>США</td>
                        <td>© PrivaXion GLOBAL. Зарегистрировано: 07.06.26 15:28</td>
                    </tr>
                    <tr>
                        <td>СНГ</td>
                        <td>© PrivaXion GLOBAL. Зарегистрировано: 07.06.26 15:28</td>
                    </tr>
                    <tr>
                        <td>ЕС</td>
                        <td>© PrivaXion GLOBAL. Зарегистрировано: 07.06.26 15:28</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>"""
    
    if copyright_html in content:
        content = content.replace(copyright_html, "")
        
        # Insert at the end of help screen
        help_screen_end = "            <button id=\"btn-help-close\" class=\"btn-primary\" style=\"margin-top: 15px;\">Закрыть</button>"
        new_help_screen_end = help_screen_end + "\n\n" + copyright_html
        content = content.replace(help_screen_end, new_help_screen_end)

    # 2. Modify Login form for JSON
    old_login_password = """                <div class="input-group">
                    <label for="login-password">Пароль</label>
                    <input type="password" id="login-password" placeholder="Введите пароль" required>
                </div>"""
    new_login_file = """                <div class="input-group">
                    <label for="login-keyfile">Файл-ключ (.json)</label>
                    <input type="file" id="login-keyfile" accept=".json" required>
                    <span class="input-hint">Прикрепите ваш файл-ключ, скачанный при регистрации</span>
                </div>"""
    content = content.replace(old_login_password, new_login_file)

    # 3. Modify Register form - Add Agreement
    register_btn = """                <div id="register-error" class="error-message"></div>
                <button type="submit" class="btn-primary">Создать аккаунт</button>"""
    agreement_html = """
                <div class="agreement-box">
                    <h4>Пользовательское соглашение</h4>
                    <ol>
                        <li>Запрещен сваттинг (ложные вызовы спецслужб).</li>
                        <li>Запрещен доксинг (публикация личных данных).</li>
                        <li>Запрещен скам и мошенничество.</li>
                        <li>Запрещено распространение спама.</li>
                        <li>Запрещено распространение вредоносного ПО.</li>
                        <li>Запрещено разжигание ненависти.</li>
                        <li>Запрещена продажа запрещенных веществ.</li>
                        <li>Запрещен сексуальный контент с несовершеннолетними.</li>
                        <li>Мессенджер не несет ответственности за действия пользователей.</li>
                        <li>Нарушение правил ведет к вечной блокировке.</li>
                    </ol>
                    <label class="agreement-checkbox">
                        <input type="checkbox" id="register-agreement" required>
                        Я прочитал(а) и принимаю условия
                    </label>
                </div>
"""
    if "agreement-box" not in content:
        content = content.replace(register_btn, agreement_html + register_btn)

    # 4. Settings - Theme Toggle
    censor_block = """                    <!-- ЦЕНЗУРА МАТОВ -->
                    <div class="profile-card">
                        <h3>🔞 Цензура матов</h3>"""
    theme_html = """                    <!-- ТЕМА -->
                    <div class="profile-card" style="margin-bottom:20px;">
                        <h3>🎨 Тема оформления</h3>
                        <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 12px;">Выберите светлую или темную тему.</p>
                        <select id="app-theme-select" style="width:100%; padding:12px; border-radius:10px; background:rgba(0,0,0,0.3); border:1px solid var(--border-color); color:var(--text-main);">
                            <option value="dark">Темная тема (Dark)</option>
                            <option value="light">Светлая тема (Light)</option>
                        </select>
                    </div>

"""
    if "app-theme-select" not in content:
        content = content.replace(censor_block, theme_html + censor_block)
        
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(content)

def patch_css():
    print("Patching style.css...")
    with open('style.css', 'r', encoding='utf-8') as f:
        content = f.read()

    css_additions = """
/* Theme Variables */
:root {
    --bg-main: #0B0E14;
    --bg-panel: #121822;
    --text-main: #E2E8F0;
    --text-muted: #94A3B8;
    --border-color: rgba(255, 255, 255, 0.08);
}

body.light-theme {
    --bg-main: #F8FAFC;
    --bg-panel: #FFFFFF;
    --text-main: #0F172A;
    --text-muted: #64748B;
    --border-color: rgba(0, 0, 0, 0.1);
}

body.light-theme .auth-card, body.light-theme .profile-card, body.light-theme .chat-area, body.light-theme .sidebar {
    background-color: var(--bg-panel);
    color: var(--text-main);
    box-shadow: 0 4px 20px rgba(0,0,0,0.05);
}

body.light-theme .msg-mine .msg-bubble {
    color: #fff;
}
body.light-theme .msg-bubble {
    background: #E2E8F0;
    color: var(--text-main);
}
body.light-theme .message-input-container {
    background: var(--bg-panel);
}

/* Agreement Box */
.agreement-box {
    background: rgba(0,0,0,0.2);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 16px;
    font-size: 11px;
    color: var(--text-muted);
    max-height: 120px;
    overflow-y: auto;
}
body.light-theme .agreement-box { background: rgba(0,0,0,0.02); }
.agreement-box h4 { margin-top: 0; margin-bottom: 8px; color: var(--text-main); font-size: 13px; }
.agreement-box ol { margin: 0 0 12px 0; padding-left: 20px; }
.agreement-box li { margin-bottom: 4px; }
.agreement-checkbox {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--text-main);
    cursor: pointer;
}
.agreement-checkbox input { width: 16px; height: 16px; }
"""
    if ".agreement-box" not in content:
        content += css_additions
        
    # fix watermark bottom
    if "bottom: 10px" not in content:
        with open('index.html', 'r', encoding='utf-8') as f:
            idx = f.read()
        idx = idx.replace("top: 10px;", "bottom: 10px;")
        with open('index.html', 'w', encoding='utf-8') as f:
            f.write(idx)

    with open('style.css', 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    patch_db()
    patch_html()
    patch_css()
    print("Done HTML/CSS/DB.")
