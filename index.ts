import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { join } from 'path';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const PORT = 3000;

// 静的ファイルの配信
app.use(express.static('public'));

// ルートにアクセスした時にHTMLを返す
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

// WebSocketクライアントを管理するMap
interface WebSocketClient extends WebSocket {
  id?: string;
}

const clients = new Map<string, WebSocketClient>();

// WebSocket接続の処理（シグナリングサーバー）
wss.on('connection', (ws: WebSocketClient) => {
  // クライアントにユニークIDを割り当て
  const clientId = generateId();
  ws.id = clientId;
  clients.set(clientId, ws);

  console.log(`クライアントが接続しました: ${clientId}`);
  console.log(`現在の接続数: ${clients.size}`);

  // 接続したクライアントに自分のIDと他のクライアントのリストを送信
  ws.send(JSON.stringify({
    type: 'init',
    id: clientId,
    clients: Array.from(clients.keys()).filter(id => id !== clientId)
  }));

  // 他のクライアントに新しいクライアントを通知
  broadcastToOthers(clientId, {
    type: 'new-client',
    id: clientId
  });

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log(`受信 [${clientId}]:`, data.type);

      // ターゲットが指定されている場合は、そのクライアントに転送
      if (data.target) {
        const targetClient = clients.get(data.target);
        if (targetClient && targetClient.readyState === WebSocket.OPEN) {
          targetClient.send(JSON.stringify({
            ...data,
            from: clientId
          }));
          console.log(`転送: ${clientId} -> ${data.target} (${data.type})`);
        }
      }
    } catch (error) {
      console.error('メッセージの処理エラー:', error);
    }
  });

  ws.on('close', () => {
    console.log(`クライアントが切断しました: ${clientId}`);
    clients.delete(clientId);

    // 他のクライアントに切断を通知
    broadcastToOthers(clientId, {
      type: 'client-disconnected',
      id: clientId
    });

    console.log(`現在の接続数: ${clients.size}`);
  });

  ws.on('error', (error) => {
    console.error(`WebSocketエラー [${clientId}]:`, error);
  });
});

// ID生成関数
function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

// 特定のクライアント以外にブロードキャスト
function broadcastToOthers(excludeId: string, message: any) {
  clients.forEach((client, id) => {
    if (id !== excludeId && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

server.listen(PORT, () => {
  console.log(`サーバーが起動しました: http://localhost:${PORT}`);
  console.log(`WebRTCシグナリングサーバーが起動しています`);
});
