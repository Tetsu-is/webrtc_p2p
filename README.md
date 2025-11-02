# webrtc_p2p

WebRTCを使ったP2P通信のシグナリングサーバー

## セットアップ

依存関係のインストール:

```bash
bun install
```

## ローカルでの起動

```bash
bun start
```

サーバーは http://localhost:3000 で起動します。

## スマホ2台でテストする方法

スマホでWebRTCをテストするには、HTTPS接続が必要です。ngrokを使って外部公開します。

### 1. 2つのターミナルを開く

**ターミナル1: サーバーを起動**
```bash
bun start
```

**ターミナル2: ngrokで公開**
```bash
bun run ngrok
```

### 2. ngrokのURLを確認

ターミナル2に表示される `https://xxxx-xxx-xxx-xxx.ngrok-free.app` のようなURLをコピーします。

### 3. スマホからアクセス

- スマホ1台目: ブラウザでngrokのURLを開く
- スマホ2台目: 同じngrokのURLを開く

両方のスマホが同じシグナリングサーバーに接続され、WebRTC P2P通信が確立されます。

### 注意事項

- ngrokの無料版では、セッション開始時に警告画面が表示されます。「Visit Site」をクリックして進んでください
- WebRTCはHTTPSが必要なため、localhostでは動作しません（スマホからアクセスする場合）
- 同じWi-Fiネットワーク内であっても、ブラウザのセキュリティ制限によりHTTPSが必要です

This project was created using `bun init` in bun v1.0.18. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
