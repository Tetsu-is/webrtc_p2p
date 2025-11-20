    // グローバル変数
    let ws;
    let myId;
    let peerConnection;
    let dataChannel;
    let remotePeerId;
    let localStream;
    const availablePeers = new Set();

    // DOM要素
    const myIdSpan = document.getElementById('myId');
    const signalingStatusDiv = document.getElementById('signalingStatus');
    const p2pStatusDiv = document.getElementById('p2pStatus');
    const peerListDiv = document.getElementById('peerList');
    // PC用
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const messagesDiv = document.getElementById('messages');
    // モバイル用
    const messageInputMobile = document.getElementById('messageInputMobile');
    const sendButtonMobile = document.getElementById('sendButtonMobile');
    const messagesDivMobile = document.getElementById('messagesMobile');
    // その他
    const localVideo = document.getElementById('localVideo');
    const remoteVideo = document.getElementById('remoteVideo');
    const startMediaButton = document.getElementById('startMediaButton');
    const stopMediaButton = document.getElementById('stopMediaButton');

    // ICEサーバー設定（STUN）
    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    };

    // メディアストリーム（カメラ・音声）の取得
    async function startMedia() {
      try {
        startMediaButton.disabled = true;
        addMessage('カメラと音声へのアクセスを要求中...', 'system');

        localStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });

        localVideo.srcObject = localStream;
        startMediaButton.disabled = true;
        stopMediaButton.disabled = false;
        addMessage('カメラと音声の取得に成功しました', 'system');

        // 既存の接続がある場合、トラックを追加
        if (peerConnection) {
          localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
          });
        }

        console.log('ローカルストリーム取得:', localStream);
      } catch (error) {
        console.error('メディア取得エラー:', error);
        addMessage(`カメラまたは音声の取得に失敗しました: ${error.message}`, 'system');
        startMediaButton.disabled = false;
      }
    }

    // メディアストリームの停止
    function stopMedia() {
      if (localStream) {
        localStream.getTracks().forEach(track => {
          track.stop();
        });
        localVideo.srcObject = null;
        localStream = null;
        startMediaButton.disabled = false;
        stopMediaButton.disabled = true;
        addMessage('カメラと音声を停止しました', 'system');
      }
    }

    // シグナリングサーバーに接続
    function connectSignaling() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}`;

      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('シグナリングサーバーに接続');
        signalingStatusDiv.textContent = 'シグナリングサーバーに接続中';
        signalingStatusDiv.className = 'status connected';
        addMessage('シグナリングサーバーに接続しました', 'system');
      };

      ws.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        console.log('受信:', data.type, data);

        switch (data.type) {
          case 'init':
            myId = data.id;
            myIdSpan.textContent = myId;
            data.clients.forEach(id => availablePeers.add(id));
            updatePeerList();
            break;

          case 'new-client':
            availablePeers.add(data.id);
            updatePeerList();
            addMessage(`新しいPeerが参加しました: ${data.id}`, 'system');
            break;

          case 'client-disconnected':
            availablePeers.delete(data.id);
            updatePeerList();
            if (remotePeerId === data.id) {
              closeConnection();
              addMessage(`接続していたPeerが切断しました: ${data.id}`, 'system');
            }
            break;

          case 'offer':
            await handleOffer(data.offer, data.from);
            break;

          case 'answer':
            await handleAnswer(data.answer);
            break;

          case 'ice-candidate':
            await handleIceCandidate(data.candidate);
            break;
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocketエラー:', error);
        addMessage('シグナリングサーバーの接続エラー', 'system');
      };

      ws.onclose = () => {
        console.log('シグナリングサーバー切断');
        signalingStatusDiv.textContent = 'シグナリングサーバーから切断されました';
        signalingStatusDiv.className = 'status disconnected';
        addMessage('シグナリングサーバーから切断されました', 'system');
        setTimeout(connectSignaling, 3000);
      };
    }

    // Peerリストの更新
    function updatePeerList() {
      peerListDiv.innerHTML = '';
      if (availablePeers.size === 0) {
        peerListDiv.innerHTML = '<p>他のPeerが見つかりません</p>';
        return;
      }

      availablePeers.forEach(peerId => {
        const peerItem = document.createElement('div');
        peerItem.className = 'peer-item';

        const peerLabel = document.createElement('span');
        peerLabel.textContent = `Peer: ${peerId}`;

        const connectBtn = document.createElement('button');
        connectBtn.textContent = '接続';
        connectBtn.className = 'success';
        connectBtn.disabled = !!remotePeerId;
        connectBtn.onclick = () => createOffer(peerId);

        peerItem.appendChild(peerLabel);
        peerItem.appendChild(connectBtn);
        peerListDiv.appendChild(peerItem);
      });
    }

    // P2P接続の開始（Offer作成）
    async function createOffer(peerId) {
      try {
        remotePeerId = peerId;
        addMessage(`${peerId}への接続を開始...`, 'system');
        p2pStatusDiv.textContent = 'P2P接続を確立中...';
        p2pStatusDiv.className = 'status connecting';

        // PeerConnectionの作成
        peerConnection = new RTCPeerConnection(configuration);
        setupPeerConnection();

        // ローカルストリームがある場合、トラックを追加
        if (localStream) {
          localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
            console.log('トラックを追加:', track.kind);
          });
        }

        // データチャネルの作成（Offer側が作成）
        dataChannel = peerConnection.createDataChannel('chat');
        setupDataChannel();

        // Offerの作成
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        // Offerの送信
        ws.send(JSON.stringify({
          type: 'offer',
          offer: offer,
          target: peerId
        }));

        console.log('Offerを送信:', peerId);
      } catch (error) {
        console.error('Offer作成エラー:', error);
        addMessage('接続の開始に失敗しました', 'system');
      }
    }

    // Offerの受信と処理
    async function handleOffer(offer, from) {
      try {
        remotePeerId = from;
        addMessage(`${from}から接続リクエストを受信`, 'system');
        p2pStatusDiv.textContent = 'P2P接続を確立中...';
        p2pStatusDiv.className = 'status connecting';

        // PeerConnectionの作成
        peerConnection = new RTCPeerConnection(configuration);
        setupPeerConnection();

        // ローカルストリームがある場合、トラックを追加
        if (localStream) {
          localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
            console.log('トラックを追加:', track.kind);
          });
        }

        // リモートディスクリプションの設定
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

        // Answerの作成
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        // Answerの送信
        ws.send(JSON.stringify({
          type: 'answer',
          answer: answer,
          target: from
        }));

        console.log('Answerを送信:', from);
      } catch (error) {
        console.error('Offer処理エラー:', error);
        addMessage('接続の受け入れに失敗しました', 'system');
      }
    }

    // Answerの受信と処理
    async function handleAnswer(answer) {
      try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        console.log('Answerを受信し、リモートディスクリプションを設定');
      } catch (error) {
        console.error('Answer処理エラー:', error);
      }
    }

    // ICE Candidateの受信と処理
    async function handleIceCandidate(candidate) {
      try {
        if (candidate) {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
          console.log('ICE Candidateを追加');
        }
      } catch (error) {
        console.error('ICE Candidate追加エラー:', error);
      }
    }

    // PeerConnectionのセットアップ
    function setupPeerConnection() {
      // ICE候補の送信
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          ws.send(JSON.stringify({
            type: 'ice-candidate',
            candidate: event.candidate,
            target: remotePeerId
          }));
          console.log('ICE Candidateを送信');
        }
      };

      // 接続状態の監視
      peerConnection.onconnectionstatechange = () => {
        console.log('接続状態:', peerConnection.connectionState);
        if (peerConnection.connectionState === 'connected') {
          p2pStatusDiv.textContent = `P2P接続確立: ${remotePeerId}`;
          p2pStatusDiv.className = 'status connected';
          addMessage(`P2P接続が確立しました: ${remotePeerId}`, 'system');
          updatePeerList();
        } else if (peerConnection.connectionState === 'disconnected' ||
                   peerConnection.connectionState === 'failed') {
          closeConnection();
        }
      };

      // リモートトラックの受信
      peerConnection.ontrack = (event) => {
        console.log('リモートトラックを受信:', event.track.kind);
        if (remoteVideo.srcObject !== event.streams[0]) {
          remoteVideo.srcObject = event.streams[0];
          addMessage(`リモートの${event.track.kind === 'video' ? 'ビデオ' : '音声'}トラックを受信しました`, 'system');
        }
      };

      // データチャネルの受信（Answer側）
      peerConnection.ondatachannel = (event) => {
        dataChannel = event.channel;
        setupDataChannel();
      };
    }

    // データチャネルのセットアップ
    function setupDataChannel() {
      dataChannel.onopen = () => {
        console.log('データチャネルが開きました');
        // PC用
        messageInput.disabled = false;
        sendButton.disabled = false;
        // モバイル用
        messageInputMobile.disabled = false;
        sendButtonMobile.disabled = false;
        addMessage('データチャネルが開きました。メッセージを送信できます。', 'system');
      };

      dataChannel.onmessage = (event) => {
        console.log('P2Pメッセージ受信:', event.data);
        addMessage(`受信: ${event.data}`, 'received');
      };

      dataChannel.onclose = () => {
        console.log('データチャネルが閉じました');
        // PC用
        messageInput.disabled = true;
        sendButton.disabled = true;
        // モバイル用
        messageInputMobile.disabled = true;
        sendButtonMobile.disabled = true;
      };
    }

    // メッセージ送信
    function sendMessage() {
      // PC用の入力フィールドから取得（モバイルの場合は空になる）
      let message = messageInput.value.trim();
      // モバイル用の入力フィールドから取得（値があればこちらを使う）
      if (!message) {
        message = messageInputMobile.value.trim();
      }

      if (message && dataChannel && dataChannel.readyState === 'open') {
        dataChannel.send(message);
        addMessage(`送信: ${message}`, 'sent');
        // 両方の入力フィールドをクリア
        messageInput.value = '';
        messageInputMobile.value = '';
      }
    }

    // 接続のクローズ
    function closeConnection() {
      if (dataChannel) {
        dataChannel.close();
        dataChannel = null;
      }
      if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
      }
      remoteVideo.srcObject = null;
      remotePeerId = null;
      // PC用
      messageInput.disabled = true;
      sendButton.disabled = true;
      // モバイル用
      messageInputMobile.disabled = true;
      sendButtonMobile.disabled = true;
      p2pStatusDiv.textContent = 'P2P接続していません';
      p2pStatusDiv.className = 'status disconnected';
      updatePeerList();
    }

    // メッセージ表示
    function addMessage(text, type) {
      // PC用
      const messageElement = document.createElement('div');
      messageElement.className = `message ${type}`;
      messageElement.textContent = text;
      messagesDiv.appendChild(messageElement);
      messagesDiv.scrollTop = messagesDiv.scrollHeight;

      // モバイル用
      const messageElementMobile = document.createElement('div');
      messageElementMobile.className = `message ${type}`;
      messageElementMobile.textContent = text;
      messagesDivMobile.appendChild(messageElementMobile);
      messagesDivMobile.scrollTop = messagesDivMobile.scrollHeight;
    }

    // イベントリスナー
    // PC用
    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        sendMessage();
      }
    });
    // モバイル用
    sendButtonMobile.addEventListener('click', sendMessage);
    messageInputMobile.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        sendMessage();
      }
    });
    // その他
    startMediaButton.addEventListener('click', startMedia);
    stopMediaButton.addEventListener('click', stopMedia);

    // 初期接続
    connectSignaling();
