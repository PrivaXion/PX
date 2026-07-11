import sys

def patch_app_js():
    with open('app.js', 'r', encoding='utf-8') as f:
        content = f.read()

    # PATCH 1: setChatHeaderTypingState
    old_header = """        chatHeader.innerHTML = `
            <div class="header-chat-info">
                <div class="header-chat-name">${escapeHtml(peerName)}</div>
                <div class="header-chat-status ${statusClass}" id="chat-header-status-line">${statusText} · E2EE</div>
            </div>

            <div class="chat-call-controls">
                <button type="button" class="btn-call" id="btn-call" ${disableCalling ? 'disabled' : ''}>📞 Позвонить</button>
                <button type="button" class="btn-call btn-call-danger hidden" id="btn-hangup">⛔ Отбой</button>

                <div class="mic-control-row">
                    <button type="button" class="btn-mic" id="btn-mic-off">🎙️ Микрофон ВКЛ</button>
                    <span class="mic-status-text" id="mic-status-text">mic: on</span>
                </div>
            </div>
        `;"""
        
    new_header = """        let settingsBtn = '';
        if (activeChatPeer && activeChatPeer.isRoom && activeChatPeer.roomData && activeChatPeer.roomData.ownerId === currentUser?.id) {
            settingsBtn = `<button class="btn-primary" style="margin-right:10px;" onclick="openRoomSettings('${activeChatPeer.id}')">⚙️ Настройки</button>`;
        }

        chatHeader.innerHTML = `
            <div class="header-chat-info">
                <div class="header-chat-name">${escapeHtml(peerName)}</div>
                <div class="header-chat-status ${statusClass}" id="chat-header-status-line">${statusText} ${activeChatPeer && activeChatPeer.isRoom ? '' : '· E2EE'}</div>
            </div>

            <div class="chat-call-controls" style="display:flex; align-items:center;">
                ${settingsBtn}
                <button type="button" class="btn-call" id="btn-call" ${disableCalling ? 'disabled' : ''}>📞 Позвонить</button>
                <button type="button" class="btn-call btn-call-danger hidden" id="btn-hangup">⛔ Отбой</button>

                <div class="mic-control-row">
                    <button type="button" class="btn-mic" id="btn-mic-off">🎙️ Микрофон ВКЛ</button>
                    <span class="mic-status-text" id="mic-status-text">mic: on</span>
                </div>
            </div>
        `;"""
    
    if old_header in content:
        content = content.replace(old_header, new_header)

    # PATCH 2: Input box blocking
    # Look for "function openChat("
    # Actually, we can add logic in "renderChatMessages()" or at the end of "openChat()"
    old_open_chat_end = """        setTimeout(() => {
            const btnCall = document.getElementById('btn-call');"""
            
    new_open_chat_end = """        const chatInputArea = document.querySelector('.chat-input-area');
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
            const btnCall = document.getElementById('btn-call');"""
            
    if old_open_chat_end in content:
        content = content.replace(old_open_chat_end, new_open_chat_end)

    # PATCH 3: renderChatList / getChatUsernamesByFolder
    # Let's override getChatUsernamesByFolder
    old_get_chat_usernames = """    async function getChatUsernamesByFolder() {
        const usernames = Object.keys(chats);
        if (chatFolderMode === 'home') return usernames;

        const results = [];
        for (const uname of usernames) {
            if (await isFriendByUsername(uname)) results.push(uname);
        }
        return results;
    }"""
    
    new_get_chat_usernames = """    async function getChatUsernamesByFolder() {
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
    }"""
    
    if old_get_chat_usernames in content:
        content = content.replace(old_get_chat_usernames, new_get_chat_usernames)

    # Override getActiveUserOrRoom 
    # Find place where we get the name of the chat for chat list
    old_list_item = """        for (const uname of filteredUsernames) {
            const msgs = chats[uname] || [];
            const lastMsgObj = msgs[msgs.length - 1];
            let lastMsg = lastMsgObj ? (lastMsgObj.text.startsWith('data:audio') ? '🎤 Голосовое сообщение' : lastMsgObj.text) : 'Нет сообщений';
            
            const users = await getUsers();
            const peer = users.find(u => u.username.toLowerCase() === uname.toLowerCase());
            const displayAv = peer && peer.avatar ? `<img src="${peer.avatar}" class="chat-item-photo">` : '?';"""
            
    new_list_item = """        for (const uname of filteredUsernames) {
            const msgs = chats[uname] || [];
            const lastMsgObj = msgs[msgs.length - 1];
            let lastMsg = lastMsgObj ? (lastMsgObj.text.startsWith('data:audio') ? '🎤 Голосовое сообщение' : lastMsgObj.text) : 'Нет сообщений';
            
            const users = await getUsers();
            let peer = users.find(u => u.username.toLowerCase() === uname.toLowerCase());
            
            // if it's a room
            if (uname.startsWith('#ch_') || uname.startsWith('#gr_')) {
                const allRooms = await getRooms();
                const room = allRooms.find(r => r.id === uname);
                if (room) {
                    peer = {
                        username: room.name,
                        id: room.id,
                        avatar: room.logo,
                        status: 'online',
                        isRoom: true,
                        roomData: room
                    };
                } else {
                    continue; // Room deleted
                }
            }
            
            const displayAv = peer && peer.avatar ? `<img src="${peer.avatar}" class="chat-item-photo">` : (peer && peer.isRoom ? (peer.roomData.type === 'channel' ? '📢' : '👥') : '?');
            const finalUsername = peer ? peer.username : uname;
            const peerObjJson = peer ? encodeURIComponent(JSON.stringify(peer)) : '';"""
            
    if old_list_item in content:
        content = content.replace(old_list_item, new_list_item)
        
    old_list_click = """                <div class="chat-list-item-avatar">${displayAv}</div>
                <div class="chat-list-item-info">
                    <div class="chat-list-item-name">${escapeHtml(uname)}</div>
                    <div class="chat-list-item-lastmsg" data-last="${uname}">${escapeHtml(lastMsg)}</div>
                </div>
                ${unreadCount > 0 ? `<div class="chat-list-item-badge">${unreadCount}</div>` : ''}
            `;

            item.addEventListener('click', async () => {
                const users2 = await getUsers();
                const found = users2.find(u => u.username.toLowerCase() === uname.toLowerCase());
                if (!found) return;
                openChat(found);
            });"""
            
    new_list_click = """                <div class="chat-list-item-avatar" ${peer && peer.isRoom && !peer.avatar ? 'style="background:var(--primary);color:#000;"' : ''}>${displayAv}</div>
                <div class="chat-list-item-info">
                    <div class="chat-list-item-name">${escapeHtml(finalUsername)}</div>
                    <div class="chat-list-item-lastmsg" data-last="${uname}">${escapeHtml(lastMsg)}</div>
                </div>
                ${unreadCount > 0 ? `<div class="chat-list-item-badge">${unreadCount}</div>` : ''}
            `;

            item.addEventListener('click', async () => {
                if (peerObjJson) {
                    const found = JSON.parse(decodeURIComponent(peerObjJson));
                    openChat(found);
                }
            });"""

    if old_list_click in content:
        content = content.replace(old_list_click, new_list_click)

    with open('app.js', 'w', encoding='utf-8') as f:
        f.write(content)

    print("Patched app.js UI logic successfully!")

if __name__ == '__main__':
    patch_app_js()
