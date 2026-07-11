// secure-db.js
// Используем Capacitor глобально, если доступен
const sqlite = window.Capacitor ? window.Capacitor.Plugins.CapacitorSQLite : null;

window.SecureDB = {
  db: null,
  isInitialized: false,

  async initSecureDatabase(secretKey) {
    if (this.isInitialized) return this.db;
    
    // Если мы не на Capacitor (например, Web или Electron без плагина), используем In-Memory заглушку или IndexedDB
    if (!sqlite) {
      console.warn("🔐 SQLCipher недоступен. Работаем в fallback-режиме (In-Memory).");
      this.db = {}; 
      this.isInitialized = true;
      return this.db;
    }

    try {
      console.log("🔐 Инициализация SQLCipher соединения...");
      this.db = await sqlite.createConnection(
        "privacy_truth_db", 
        true,            // Шифрование включено
        "secret",        // Режим
        1,
        false
      );
      
      await this.db.open();
      await this.db.setEncryptionSecret(secretKey);
      
      const initQuery = `
        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          chat_id TEXT,
          sender_id TEXT,
          content TEXT,
          timestamp INTEGER,
          is_read INTEGER DEFAULT 0
        );
      `;
      await this.db.execute({ statements: initQuery });
      this.isInitialized = true;
      console.log("🔐 Истина Приватности: SQLCipher база успешно инициализирована");
      return this.db;
    } catch (error) {
      console.error("⛔ Ошибка доступа к защищенной базе:", error);
      throw error;
    }
  },

  async saveMessageLocal(msg) {
    if (!this.isInitialized) return;
    if (!sqlite) {
      // Fallback
      if (!this.db[msg.chatId]) this.db[msg.chatId] = [];
      this.db[msg.chatId].push(msg);
      return;
    }

    const query = `INSERT OR IGNORE INTO messages (id, chat_id, sender_id, content, timestamp) VALUES (?, ?, ?, ?, ?)`;
    await this.db.run({
      statement: query,
      values: [msg.id, msg.chatId, msg.senderId, msg.content, msg.timestamp || Date.now()]
    });
  },

  async getChatMessages(chatId) {
    if (!this.isInitialized) return [];
    if (!sqlite) {
      return this.db[chatId] || [];
    }

    const query = `SELECT * FROM messages WHERE chat_id = ? ORDER BY timestamp ASC`;
    const result = await this.db.query({
      statement: query,
      values: [chatId]
    });
    return result.values || [];
  },

  async destroySession() {
    if (!this.isInitialized) return;
    if (sqlite && this.db) {
      await this.db.close();
    }
    this.isInitialized = false;
    this.db = null;
    console.log("🔐 Сессия безопасно уничтожена (БД закрыта)");
  }
};
