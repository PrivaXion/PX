import sys

def patch_app_js():
    with open('app.js', 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. API functions for rooms
    api_code = """
    // ================== ROOMS API ==================
    async function getRooms() {
        try {
            const res = await fetch(`${API_BASE}/rooms`);
            if (res.ok) return await res.json();
            return [];
        } catch(e) { return []; }
    }
    async function saveRoom(room) {
        try {
            const rooms = await getRooms();
            const existing = rooms.find(r => r.id === room.id);
            if (existing) {
                await fetch(`${API_BASE}/rooms/${room.id}`, {
                    method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(room)
                });
            } else {
                await fetch(`${API_BASE}/rooms`, {
                    method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(room)
                });
            }
        } catch(e) {}
    }
    async function deleteRoomApi(roomId) {
        try {
            await fetch(`${API_BASE}/rooms/${roomId}`, { method: 'DELETE' });
        } catch(e) {}
    }
    // ===============================================
"""
    if "async function getRooms()" not in content:
        # Insert after "async function saveUser("
        idx = content.find("async function saveUser(")
        if idx != -1:
            content = content[:idx] + api_code + content[idx:]

    # 2. Modify doSearch to be async and search rooms
    search_old = """    function doSearch() {
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
                <div class="search-user-avatar">?</div>
                <div class="search-user-info">
                    <div class="search-user-nickname">${found.username}</div>
                    <div class="search-user-id">${found.id}</div>
                </div>
            </div>
            <button class="btn-primary" id="search-btn-write" style="width:100%; margin-top:15px;">Написать сообщение</button>
        `;

        document.getElementById('search-btn-write').addEventListener('click', () => {
            openChat(found);
            switchScreen('screen-chat');
        });
    }"""
    
    search_new = """    async function doSearch() {
        const query = document.getElementById('search-input').value.trim();
        const result = document.getElementById('search-result');
        result.innerHTML = '';
        result.classList.remove('hidden');

        if (!query) {
            result.innerHTML = '<p class="search-no-result">Введите ID или название для поиска.</p>';
            return;
        }

        let foundUser = null;
        let foundRooms = [];

        if (query.startsWith('#')) {
            foundUser = await findUserById(query);
            const allRooms = await getRooms();
            foundRooms = allRooms.filter(r => r.id.toLowerCase() === query.toLowerCase());
        } else {
            const allRooms = await getRooms();
            foundRooms = allRooms.filter(r => r.isPublic && r.name.toLowerCase().includes(query.toLowerCase()));
        }

        if (!foundUser && foundRooms.length === 0) {
            result.innerHTML = '<p class="search-no-result">❌ Ничего не найдено.</p>';
            return;
        }

        let html = '';
        
        if (foundUser) {
            if (currentUser && foundUser.username.toLowerCase() === currentUser.username.toLowerCase()) {
                html += '<p class="search-no-result">Это вы сами 😄</p>';
            } else {
                html += `
                    <div class="search-user-card" style="margin-bottom:10px;">
                        <div class="search-user-avatar">?</div>
                        <div class="search-user-info">
                            <div class="search-user-nickname">${foundUser.username}</div>
                            <div class="search-user-id">${foundUser.id}</div>
                        </div>
                    </div>
                    <button class="btn-primary" id="search-btn-write" style="width:100%; margin-top:15px; margin-bottom:15px;">Написать пользователю</button>
                `;
            }
        }

        if (foundRooms.length > 0) {
            html += `<h3 style="margin-top:10px; color:var(--text-main); font-size:14px;">Найденные каналы/группы:</h3>`;
            foundRooms.forEach(r => {
                html += `
                    <div class="search-user-card" style="margin-top:10px; cursor:pointer;" id="join-room-${r.id.replace('#','')}">
                        <div class="search-user-avatar" style="background:var(--primary); color:#000;">${r.type === 'channel' ? '📢' : '👥'}</div>
                        <div class="search-user-info">
                            <div class="search-user-nickname">${r.name}</div>
                            <div class="search-user-id">${r.type === 'channel' ? 'Канал' : 'Группа'} • ${r.id}</div>
                        </div>
                    </div>
                `;
            });
        }

        result.innerHTML = html;

        if (foundUser && document.getElementById('search-btn-write')) {
            document.getElementById('search-btn-write').addEventListener('click', () => {
                openChat(foundUser);
                switchScreen('screen-chat');
            });
        }

        foundRooms.forEach(r => {
            const el = document.getElementById(`join-room-${r.id.replace('#','')}`);
            if (el) {
                el.addEventListener('click', async () => {
                    // Check members limit
                    if (!r.members.includes(currentUser.id)) {
                        if (r.type === 'group' && r.members.length >= 25) {
                            alert("Группа переполнена (максимум 25 участников).");
                            return;
                        }
                        if (r.type === 'channel' && r.members.length >= 1000000) {
                            alert("Канал переполнен.");
                            return;
                        }
                        r.members.push(currentUser.id);
                        await saveRoom(r);
                    }
                    
                    // Create mock targetUser for openChat
                    const roomUser = {
                        username: r.id, // we use ID as activeChatUser
                        id: r.id,
                        status: 'online',
                        isRoom: true,
                        roomData: r
                    };
                    openChat(roomUser);
                    switchScreen('screen-chat');
                });
            }
        });
    }"""
    
    if search_old in content:
        content = content.replace(search_old, search_new)

    # 3. Add UI logic for rooms at the end of the file
    rooms_ui_code = """
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
            
            // Reload chats
            const currentChatsStr = localStorage.getItem(`px_chats_${currentUser.username.toLowerCase()}`);
            let ch = currentChatsStr ? JSON.parse(currentChatsStr) : {};
            if(!ch[id]) ch[id] = [];
            localStorage.setItem(`px_chats_${currentUser.username.toLowerCase()}`, JSON.stringify(ch));
            
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
"""
    if "ROOMS UI LOGIC" not in content:
        content += "\n" + rooms_ui_code

    with open('app.js', 'w', encoding='utf-8') as f:
        f.write(content)

    print("Patched app.js successfully!")

if __name__ == '__main__':
    patch_app_js()
