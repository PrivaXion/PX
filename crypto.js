// Глобальный сервис для End-to-End Encryption
window.CryptoService = {
  keyPair: null, // { publicKey, secretKey }

  /**
   * Сгенерировать новую пару ключей (при регистрации)
   */
  generateKeyPair() {
    this.keyPair = nacl.box.keyPair();
    return {
      publicKeyBase64: nacl.util.encodeBase64(this.keyPair.publicKey),
      secretKeyBase64: nacl.util.encodeBase64(this.keyPair.secretKey)
    };
  },

  /**
   * Загрузить существующие ключи
   */
  loadKeys(publicKeyBase64, secretKeyBase64) {
    this.keyPair = {
      publicKey: nacl.util.decodeBase64(publicKeyBase64),
      secretKey: nacl.util.decodeBase64(secretKeyBase64)
    };
  },

  /**
   * Зашифровать сообщение для получателя
   * @param {string} text 
   * @param {string} recipientPublicKeyBase64 
   */
  encryptMessage(text, recipientPublicKeyBase64) {
    if (!this.keyPair) throw new Error("Ключи не загружены");
    
    const recipientPublicKey = nacl.util.decodeBase64(recipientPublicKeyBase64);
    const nonce = nacl.randomBytes(nacl.box.nonceLength);
    const messageUint8 = nacl.util.decodeUTF8(text);
    
    const encrypted = nacl.box(messageUint8, nonce, recipientPublicKey, this.keyPair.secretKey);
    
    return {
      nonce: nacl.util.encodeBase64(nonce),
      ciphertext: nacl.util.encodeBase64(encrypted)
    };
  },

  /**
   * Расшифровать полученное сообщение
   * @param {string} nonceBase64 
   * @param {string} ciphertextBase64 
   * @param {string} senderPublicKeyBase64 
   */
  decryptMessage(nonceBase64, ciphertextBase64, senderPublicKeyBase64) {
    if (!this.keyPair) throw new Error("Ключи не загружены");

    const senderPublicKey = nacl.util.decodeBase64(senderPublicKeyBase64);
    const nonce = nacl.util.decodeBase64(nonceBase64);
    const ciphertext = nacl.util.decodeBase64(ciphertextBase64);

    const decrypted = nacl.box.open(ciphertext, nonce, senderPublicKey, this.keyPair.secretKey);
    if (!decrypted) {
      throw new Error("Не удалось расшифровать сообщение (возможно, неверный ключ или повреждены данные)");
    }

    return nacl.util.encodeUTF8(decrypted);
  }
};
