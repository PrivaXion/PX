import os

def patch_app():
    with open('index.html', 'r', encoding='utf-8') as f:
        html = f.read()

    # 1. Update Watermark
    old_watermark = """    <!-- ВОДЯНОЙ ЗНАК -->
    <div style="position: fixed; top: 10px; left: 0; width: 100%; text-align: center; z-index: 999999; opacity: 0.35; color: var(--text-muted); font-size: 11px; pointer-events: none; font-weight: 500; letter-spacing: 1.5px; text-transform: uppercase;">
        by WT STUDIO powered by MinBelPower
    </div>"""
    new_watermark = """    <!-- ВОДЯНОЙ ЗНАК -->
    <div id="main-watermark" style="position: fixed; top: 10px; left: 0; width: 100%; text-align: center; z-index: 999999; opacity: 0.35; color: var(--text-muted); font-size: 11px; pointer-events: none; font-weight: 500; letter-spacing: 1.5px; text-transform: uppercase;">
        by WT STUDIO powered by MinBelPower
    </div>"""
    if old_watermark in html:
        html = html.replace(old_watermark, new_watermark)

    # 2. Add Admin button to Help Screen
    help_actions_old = """                            <button type="button" class="help-link-btn" id="help-open-news">Новости</button>
                            <button type="button" class="help-link-btn" id="help-open-settings">Настройки безопасности</button>
                        </div>"""
    help_actions_new = """                            <button type="button" class="help-link-btn" id="help-open-news">Новости</button>
                            <button type="button" class="help-link-btn" id="help-open-settings">Настройки безопасности</button>
                            <button type="button" class="help-link-btn hidden" id="help-open-admin" style="color:#ff3b5c; border-color: rgba(255, 59, 92, 0.3);">⚙️ Панель администратора</button>
                        </div>"""
    if help_actions_old in html:
        html = html.replace(help_actions_old, help_actions_new)

    # 3. Add Admin Modals
    admin_modals = """
    <!-- ЭКРАН: ПАНЕЛЬ АДМИНИСТРАТОРА (Модальное окно) -->
    <div id="admin-modal" class="modal hidden">
        <div class="modal-content" style="max-width: 600px; width: 90%; background: var(--bg-color); border: 1px solid rgba(255,59,92,0.3);">
            <h2 class="modal-title" style="color: #ff3b5c;">🛡️ Панель администратора</h2>
            <div class="search-bar-wrapper" style="margin-bottom:10px;">
                <input type="text" id="admin-search-input" class="search-input" placeholder="Поиск по ID или Нику">
            </div>
            <div style="display:flex; gap:10px; margin-bottom:15px;">
                <button id="admin-sort-az" class="btn-primary" style="flex:1; padding: 10px; font-size: 12px;">Сорт: A-Z</button>
                <button id="admin-sort-id" class="btn-primary" style="flex:1; padding: 10px; font-size: 12px;">Сорт: ID (0-1000)</button>
            </div>
            <div id="admin-users-list" style="max-height: 400px; overflow-y: auto; display:flex; flex-direction:column; gap:10px;"></div>
            <button id="btn-admin-close" class="btn-primary" style="margin-top:20px; width:100%;">Закрыть</button>
        </div>
    </div>

    <!-- Блокировка -->
    <div id="admin-ban-modal" class="modal hidden" style="z-index: 9999999;">
        <div class="modal-content" style="max-width: 400px; width: 90%;">
            <h2 class="modal-title" style="color: #ff3b5c;">Заблокировать</h2>
            <p id="ban-target-name" style="margin-bottom:10px; color:var(--text-muted);"></p>
            <input type="text" id="ban-reason" class="modal-input" placeholder="Причина (напр. Спам)" style="margin-bottom:10px;">
            <input type="text" id="ban-time" class="modal-input" placeholder="Время (напр. Навсегда или 30 дней)" style="margin-bottom:10px;">
            <input type="text" id="ban-desc" class="modal-input" placeholder="Подробное описание" style="margin-bottom:10px;">
            <button id="btn-ban-submit" class="btn-primary" style="margin-top:10px; width:100%; border-color: #ff3b5c; color: #ff3b5c;">Ударить банхаммером</button>
            <button id="btn-ban-cancel" class="btn-primary" style="margin-top:10px; width:100%;">Отмена</button>
        </div>
    </div>
"""
    if 'id="admin-modal"' not in html:
        # Insert before </body>
        idx = html.rfind('</body>')
        html = html[:idx] + admin_modals + html[idx:]

    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(html)

    # ---------------------------------------------------------
    # PATCH APP.JS
    # ---------------------------------------------------------
    with open('app.js', 'r', encoding='utf-8') as f:
        js = f.read()

    # Helper function to get badges
    badges_fn = """
    function getUserBadgesHTML(user) {
        if (!user) return '';
        let html = '';
        if (user.redCheckmark) html += '<span style="margin-left:5px; font-size:0.9em;" title="Разработчик">🔴</span>';
        if (user.blueCheckmark) html += '<span style="margin-left:5px; font-size:0.9em;" title="Верифицирован">☑️</span>';
        return html;
    }
    """
    if "getUserBadgesHTML" not in js:
        # Insert somewhere at top
        idx = js.find('function saveUser')
        js = js[:idx] + badges_fn + js[idx:]

    # Inject badges into UI
    # 1. search user card
    old_search_nick = '<div class="search-user-nickname">${foundUser.username}</div>'
    new_search_nick = '<div class="search-user-nickname">${foundUser.username}${getUserBadgesHTML(foundUser)}</div>'
    js = js.replace(old_search_nick, new_search_nick)
    
    # 2. chat list (we need to pass badges to chat list item)
    old_list_name = '<div class="chat-list-item-name">${escapeHtml(finalUsername)}</div>'
    new_list_name = '<div class="chat-list-item-name">${escapeHtml(finalUsername)}${getUserBadgesHTML(peer)}</div>'
    js = js.replace(old_list_name, new_list_name)

    # 3. chat header
    old_chat_name = '<div class="header-chat-name">${escapeHtml(peerName)}</div>'
    new_chat_name = '<div class="header-chat-name">${escapeHtml(peerName)}${getUserBadgesHTML(activeChatPeer)}</div>'
    js = js.replace(old_chat_name, new_chat_name)

    # 4. login block check
    old_login_success = "return { user };"
    new_login_success = """
      if (user.isBanned) {
          return { error: `Аккаунт заблокирован!\\nПричина: ${user.banReason || 'Не указана'}\\nСрок: ${user.banTime || 'Навсегда'}\\nДетали: ${user.banDesc || ''}` };
      }
      return { user };
"""
    js = js.replace(old_login_success, new_login_success)

    # 5. admin logic and watermark logic
    admin_logic = """
// ================== ADMIN MENU & WATERMARK ==================
document.addEventListener('DOMContentLoaded', () => {
    // Watermark logic
    const wm = document.getElementById('main-watermark');
    function updateWatermarkVisibility() {
        if (!wm) return;
        const isAuthActive = document.body.classList.contains('auth-active') || document.body.classList.contains('home-active') === false;
        const isHelpActive = !document.getElementById('screen-help').classList.contains('hidden');
        if (isAuthActive || isHelpActive) {
            wm.style.display = 'block';
        } else {
            wm.style.display = 'none';
        }
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
"""
    if "ADMIN MENU & WATERMARK" not in js:
        js += "\n" + admin_logic

    with open('app.js', 'w', encoding='utf-8') as f:
        f.write(js)

if __name__ == '__main__':
    patch_app()
