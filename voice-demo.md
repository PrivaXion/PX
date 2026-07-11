# PrivaXion Voice (WebRTC) — что добавлено

- Добавлен `signal-server.js` — SSE signaling сервер.

## Режим пока что
- Реальные звонки требуют WebRTC + signaling.
- В этой итерации добавлен только сервер сигналинга (SSE). Следующий шаг — интегрировать UI/логика в `index.html` и `app.js`.

## Запуск
1) В одном терминале:
   - `node signal-server.js`
2) Во втором терминале:
   - `npm run start`
3) И открыть приложение в браузере.

## API signaling
- Subscribe (SSE):
  - `GET http://localhost:8090/events?roomId=ROOM&clientId=CLIENT`
- Publish:
  - `POST http://localhost:8090/signal?roomId=ROOM`
  - body: `{ from, to, type, payload }`

