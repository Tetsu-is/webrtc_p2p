import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { server } from './index'; // Import the actual server
import { WebSocket } from 'ws';

describe('WebSocket Signaling Server', () => {
  const port = 3001; // Use a different port for testing

  beforeAll(() => {
    server.listen(port);
  });

  afterAll(() => {
    server.close();
  });

  it('should handle client connection, messaging, and disconnection', async () => {
    const ws1 = new WebSocket(`ws://localhost:${port}`);
    let ws1Id: string;

    const ws2 = new WebSocket(`ws://localhost:${port}`);
    let ws2Id: string;

    const p1 = new Promise<void>((resolve) => {
      ws1.on('message', (message) => {
        const data = JSON.parse(message.toString());
        if (data.type === 'init') {
          expect(data.id).toBeString();
          ws1Id = data.id;
          expect(data.clients).toEqual([]);
          resolve();
        }
      });
    });

    const p2 = new Promise<void>((resolve) => {
      ws2.on('message', (message) => {
        const data = JSON.parse(message.toString());
        if (data.type === 'init') {
          expect(data.id).toBeString();
          ws2Id = data.id;
          // ws1 is already connected
          expect(data.clients).toContain(ws1Id);
          resolve();
        }
      });
    });

    await Promise.all([p1, p2]);

    // Test message forwarding
    const testMessage = { type: 'offer', sdp: 'test-sdp' };

    const p3 = new Promise<void>((resolve) => {
        ws2.on('message', (message) => {
            const data = JSON.parse(message.toString());
            if(data.type === 'offer') {
                expect(data.from).toBe(ws1Id);
                expect(data.sdp).toBe('test-sdp');
                resolve();
            }
        });
        ws1.send(JSON.stringify({ ...testMessage, target: ws2Id }));
    });

    await p3;

    // Test disconnection
    const p4 = new Promise<void>((resolve) => {
      ws2.on('message', (message) => {
        const data = JSON.parse(message.toString());
        if (data.type === 'client-disconnected') {
          expect(data.id).toBe(ws1Id);
          resolve();
        }
      });
      ws1.close();
    });

    await p4;

    ws2.close();
  }, 10000); // Increase timeout for async operations
});