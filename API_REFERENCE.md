# 📚 API Справка по функциям безопасности

## 🔐 Основные функции

### 1. Функции шифрования

#### `encryptMessageTriple(text, realKey)`
Шифрует текст с использованием тройного уровня защиты.

**Параметры:**
- `text` (string) - текст для шифрования
- `realKey` (string) - настоящий E2E ключ канала

**Возвращает:** (string) - зашифрованный текст в Base64

**Пример:**
```javascript
const encrypted = encryptMessageTriple("Hello World", "px_secret_alice_bob");
// Результат: "eyJlbmNyeXB0ZWQiOiJYYzJGdVoyOXBaMnQwVUhWT1N...aW1lIjogMTcxNzg1ODgwMDAwMH0="
```

---

#### `decryptMessageTriple(encText, realKey)`
Расшифровывает текст с проверкой целостности.

**Параметры:**
- `encText` (string) - зашифрованный текст
- `realKey` (string) - настоящий E2E ключ канала

**Возвращает:** (string) - расшифрованный текст или сообщение об ошибке

**Примеры:**
```javascript
// Правильный ключ
const decrypted = decryptMessageTriple(encrypted, "px_secret_alice_bob");
// Результат: "Hello World"

// Неправильный ключ
const wrong = decryptMessageTriple(encrypted, "wrong_key");
// Результат: "🔐 [Сообщение зашифровано неправильным ключом]"
```

---

### 2. Функции управления IP

#### `getIPAddress()`
Получает текущий IP адрес устройства пользователя.

**Параметры:** нет

**Возвращает:** Promise<string>

**Пример:**
```javascript
const ip = await getIPAddress();
console.log(ip); // "123.45.67.89"
```

---

#### `isIPBlocked(ip)`
Проверяет находится ли IP адрес в черном списке.

**Параметры:**
- `ip` (string) - IP адрес для проверки

**Возвращает:** (boolean) - true если заблокирован, false если нет

**Пример:**
```javascript
if (isIPBlocked("123.45.67.89")) {
    console.log("IP заблокирован!");
}
```

---

#### `addBlockedIP(ip, reason)`
Добавляет IP адрес в черный список.

**Параметры:**
- `ip` (string) - IP адрес
- `reason` (string, опционально) - причина блокировки

**Возвращает:** void

**Пример:**
```javascript
addBlockedIP("192.168.1.100", "Множественные попытки взлома");
// Локально сохранится в localStorage.px_blocked_ips
// Будет показано модальное окно блокировки
```

---

#### `logDecryptionAttempt(key, success)`
Логирует попытку расшифровки для отслеживания взломов.

**Параметры:**
- `key` (string) - используемый ключ (или его часть)
- `success` (boolean) - успешна ли была попытка

**Возвращает:** Promise<object> - { blocked: boolean, ip: string }

**Пример:**
```javascript
const result = await logDecryptionAttempt("px_sec...", false);
if (result.blocked) {
    console.log("IP заблокирован после 5 попыток!");
}
```

---

### 3. Функции безопасности

#### `showSecurityLockdown(ip, reason)`
Показывает модальное окно блокировки при обнаружении взлома.

**Параметры:**
- `ip` (string) - IP адрес
- `reason` (string) - причина блокировки

**Возвращает:** void

**Пример:**
```javascript
showSecurityLockdown("123.45.67.89", "Попытка использовать неправильный ключ");
```

---

## 📊 Вспомогательные данные

### Структура зашифрованного сообщения

```javascript
{
    "text": "eyJlbmNyeXB0ZWQiOiI..." // Основной шифрованный текст (Layer 1)
    "meta": {
        "realKeyHash": "px_secre",      // Первые 10 символов настоящего ключа
        "fakeKey": "dGVzdGZha2VrZXk=", // Фейковый ключ в Base64
        "timestamp": 1717858800000,     // Время шифрования
        "version": 3                     // Версия алгоритма
    },
    "useTripleEncryption": true         // Флаг использования новой версии
}
```

---

### Структура попытки расшифровки

```javascript
{
    "time": 1717858800000,    // Timestamp попытки
    "key": "px_sec...",       // Используемый ключ (частичный)
    "success": false          // Результат попытки
}
```

---

## 🎯 Типичные use cases

### Use Case 1: Отправить безопасное сообщение

```javascript
// 1. Получить ключ канала
const channelKey = getChannelKey(username1, username2);

// 2. Зашифровать сообщение
const encrypted = encryptMessageTriple(messageText, channelKey);

// 3. Сохранить в localStorage или отправить
localStorage.setItem('message', encrypted);

// 4. При загрузке - расшифровать
const decrypted = decryptMessageTriple(encrypted, channelKey);
console.log(decrypted); // Исходный текст
```

---

### Use Case 2: Проверить IP при входе

```javascript
async function checkIP() {
    const ip = await getIPAddress();
    
    if (isIPBlocked(ip)) {
        showToast('⛔ Ваш IP заблокирован!', 'error');
        showSecurityLockdown(ip, 'IP адрес заблокирован');
        logout();
        return false;
    }
    
    return true;
}

// Использование
if (await checkIP()) {
    enterSystem(user);
}
```

---

### Use Case 3: Мониторить попытки взлома

```javascript
// Каждый раз при попытке расшифровки
try {
    const decrypted = decryptMessageTriple(encrypted, key);
    const result = await logDecryptionAttempt(key, true);
} catch (e) {
    const result = await logDecryptionAttempt(key, false);
    
    // Проверить заблокирован ли IP
    if (result.blocked) {
        console.log(`IP ${result.ip} заблокирован!`);
        showSecurityLockdown(result.ip, '5 неудачных попыток расшифровки');
    }
}
```

---

## ⚙️ Конфигурация

### Изменить количество попыток перед блокировкой

В файле `app.js` найдите:
```javascript
const failedAttempts = recentAttempts.filter(a => !a.success).length;

if (failedAttempts === 5) { // ИЗМЕНИТЕ ЧИСЛО ТУТ
    addBlockedIP(ip, '5 неудачных попыток расшифровки');
}
```

---

### Изменить количество попыток DevTools перед logout

```javascript
const maxDevtoolsAttempts = 3; // ИЗМЕНИТЕ ТУТ

if (devtoolsOpenAttempts > maxDevtoolsAttempts) {
    const ip = await getIPAddress();
    addBlockedIP(ip, 'Многократные попытки открыть DevTools');
    logout();
}
```

---

## 🔧 Отладка

### Проверить все заблокированные IP:
```javascript
console.log(JSON.parse(localStorage.getItem('px_blocked_ips')));
```

### Проверить все попытки расшифровки:
```javascript
console.log(JSON.parse(localStorage.getItem('px_decryption_attempts')));
```

### Очистить черный список (ТОЛЬКО ДЛЯ РАЗРАБОТКИ):
```javascript
localStorage.setItem('px_blocked_ips', '[]');
```

### Просмотреть ключи метаданных:
```javascript
const encrypted = encryptMessageTriple("test", "key");
const layer3 = atob(encrypted);
const layer2 = JSON.parse(layer3);
console.log("Метаданные:", layer2.meta);
```

---

## 📈 Производительность

| Операция | Время (мс) | Примечание |
|----------|-----------|-----------|
| encryptMessageTriple | 0.5-1.0 | Зависит от длины текста |
| decryptMessageTriple | 0.3-0.8 | Зависит от сложности проверок |
| logDecryptionAttempt | 0.1-0.5 | Асинхронная операция |
| getIPAddress | 50-200 | Network call |
| isIPBlocked | <0.1 | Локальная проверка |

---

## 🚀 Roadmap

### V3.1 (Планируется)
- [ ] Двухфакторная аутентификация
- [ ] Резервные коды восстановления
- [ ] Биометрическая аутентификация

### V3.2 (Планируется)
- [ ] Отслеживание сессий в реальном времени
- [ ] Push уведомления о подозрительной активности
- [ ] Географическое отслеживание IP

### V4.0 (Планируется)
- [ ] Защита голосовых звонков тройным шифрованием
- [ ] Защита видеозвонков тройным шифрованием
- [ ] Quantum-resistant encryption

---

**Версия документации**: 3.0
**Последнее обновление**: 2026-06-08
**Авторское право**: PrivaXion GLOBAL
