const token = localStorage.getItem('knowme_token') || '';
let socket = null;
let currentChatId = null;
let currentCallId = null;
let currentPeerId = null;
let localStream = null;
let peerConnection = null;
let iceConfig = { iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }] };
let keyPair = null;
const chatKeys = new Map();

const messagesEl = document.getElementById('messages');
const typingEl = document.getElementById('typing');
const chatIdEl = document.getElementById('chat-id');
const presenceEl = document.getElementById('presence');
const callStatusEl = document.getElementById('call-status');
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const assistantMemoryEl = document.getElementById('assistant-memory');
const assistantInputEl = document.getElementById('assistant-input');
const assistantSendBtn = document.getElementById('assistant-send');

const authHeaders = {
  'Content-Type': 'application/json',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
};

const te = new TextEncoder();
const td = new TextDecoder();

function toB64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
}

function fromB64(value) {
  const bin = atob(value);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

async function loadOrCreateKeyPair() {
  const priv = localStorage.getItem('knowme_priv_key');
  const pub = localStorage.getItem('knowme_pub_key');

  if (priv && pub) {
    const privateKey = await crypto.subtle.importKey('pkcs8', fromB64(priv), { name: 'RSA-OAEP', hash: 'SHA-256' }, true, ['decrypt']);
    const publicKey = await crypto.subtle.importKey('spki', fromB64(pub), { name: 'RSA-OAEP', hash: 'SHA-256' }, true, ['encrypt']);
    keyPair = { privateKey, publicKey };
    return;
  }

  keyPair = await crypto.subtle.generateKey({ name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['encrypt', 'decrypt']);
  const exportedPriv = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
  const exportedPub = await crypto.subtle.exportKey('spki', keyPair.publicKey);
  localStorage.setItem('knowme_priv_key', toB64(exportedPriv));
  localStorage.setItem('knowme_pub_key', toB64(exportedPub));
}

async function publishPublicKey() {
  const pub = localStorage.getItem('knowme_pub_key');
  if (!pub) return;
  await fetch('/api/crypto/keys/public', {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({ publicKey: pub, algorithm: 'RSA-OAEP-2048' }),
  });
}

async function getUserPublicKey(userId) {
  const res = await fetch(`/api/crypto/keys/public/${userId}`, { headers: authHeaders });
  const data = await res.json();
  return crypto.subtle.importKey('spki', fromB64(data.publicKey), { name: 'RSA-OAEP', hash: 'SHA-256' }, true, ['encrypt']);
}

async function ensureChatKey(chatId, peerUserId) {
  if (chatKeys.has(chatId)) return chatKeys.get(chatId);

  const myEnvelopeRes = await fetch(`/api/crypto/chats/${chatId}/envelopes/me?keyVersion=1`, { headers: authHeaders });
  if (myEnvelopeRes.ok) {
    const env = await myEnvelopeRes.json();
    const raw = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, keyPair.privateKey, fromB64(env.encryptedKey));
    const key = await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
    chatKeys.set(chatId, key);
    return key;
  }

  const aesKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const raw = await crypto.subtle.exportKey('raw', aesKey);

  const myPub = keyPair.publicKey;
  const peerPub = await getUserPublicKey(peerUserId);

  const myWrapped = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, myPub, raw);
  const peerWrapped = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, peerPub, raw);

  await fetch('/api/crypto/chats/envelopes', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      chatId,
      keyVersion: 1,
      envelopes: [
        { userId: JSON.parse(atob(token.split('.')[1])).userId, encryptedKey: toB64(myWrapped) },
        { userId: peerUserId, encryptedKey: toB64(peerWrapped) },
      ],
    }),
  });

  chatKeys.set(chatId, aesKey);
  return aesKey;
}

async function encryptForChat(chatId, plainObject) {
  const key = chatKeys.get(chatId);
  if (!key) throw new Error('Missing chat key');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, te.encode(JSON.stringify(plainObject)));
  return { encryptedPayload: toB64(cipher), encryptionIv: toB64(iv.buffer), encryptionAlg: 'AES-GCM', encryptionVersion: 1 };
}

async function decryptForChat(chatId, encryptedPayload, encryptionIv) {
  const key = chatKeys.get(chatId);
  if (!key || !encryptedPayload || !encryptionIv) return null;
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(fromB64(encryptionIv)) }, key, fromB64(encryptedPayload));
  return JSON.parse(td.decode(plain));
}

async function fetchIceConfig() {
  const res = await fetch('/api/calls/ice-config', { headers: authHeaders });
  if (res.ok) {
    const data = await res.json();
    iceConfig = { iceServers: data.iceServers || iceConfig.iceServers };
  }
}

function setCallStatus(text) {
  callStatusEl.textContent = text;
}

function renderAssistantContext(context) {
  if (!assistantMemoryEl) return;
  assistantMemoryEl.innerHTML = '';

  const memoryTitle = document.createElement('div');
  memoryTitle.className = 'meta';
  memoryTitle.textContent = `Memoria: ${(context.memories || []).map((m) => `${m.key}=${m.value}`).join(' | ') || 'vacía'}`;
  assistantMemoryEl.appendChild(memoryTitle);

  (context.messages || []).forEach((msg) => {
    const row = document.createElement('div');
    row.className = 'msg';
    row.innerHTML = `<strong>${msg.role === 'ASSISTANT' ? 'CloudBot' : 'You'}</strong>: ${msg.content}`;
    assistantMemoryEl.appendChild(row);
  });

  assistantMemoryEl.scrollTop = assistantMemoryEl.scrollHeight;
}

async function refreshAssistantContext() {
  const res = await fetch('/api/assistant/memory', { headers: authHeaders });
  if (!res.ok) return;
  const data = await res.json();
  renderAssistantContext(data);
}

async function sendAssistantMessage() {
  const message = assistantInputEl?.value?.trim();
  if (!message) return;
  const res = await fetch('/api/assistant/message', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ message }),
  });
  if (res.ok) {
    assistantInputEl.value = '';
    await refreshAssistantContext();
  }
}

async function renderMessage(message) {
  const item = document.createElement('div');
  item.className = `msg ${message.deletedForEveryone ? 'deleted' : ''}`;

  let body = '[encrypted message]';
  let payload = null;
  try {
    payload = await decryptForChat(message.chatId, message.encryptedPayload, message.encryptionIv);
  } catch {
    payload = null;
  }

  if (message.messageType === 'DELETED') body = '[deleted]';
  else if (payload?.voiceUrl) body = `<audio controls src="${payload.voiceUrl}"></audio>`;
  else if (payload?.text) body = payload.text;

  item.innerHTML = `
    <div><strong>${message.sender?.username || message.senderId}</strong>: ${body}</div>
    <div class="meta">${message.messageType} | receipts: ${(message.readReceipts || []).length} | reactions: ${(message.reactions || []).map((r)=>r.emoji).join(' ')}</div>
    <button data-react="${message.id}">👍</button>
    <button data-read="${message.id}">Mark read</button>
    <button data-delete="${message.id}">Delete for everyone</button>
  `;

  messagesEl.appendChild(item);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

async function loadHistory() {
  if (!currentChatId) return;
  const res = await fetch(`/api/chat/${currentChatId}/messages`, { headers: authHeaders });
  const data = await res.json();
  messagesEl.innerHTML = '';
  for (const msg of (data.messages || [])) {
    // eslint-disable-next-line no-await-in-loop
    await renderMessage(msg);
  }
  bindMessageButtons();
}

assistantSendBtn?.addEventListener('click', () => {
  sendAssistantMessage();
});

assistantInputEl?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    sendAssistantMessage();
  }
});

function bindMessageButtons() {
  document.querySelectorAll('button[data-react]').forEach((button) => {
    button.onclick = async () => {
      await fetch(`/api/chat/messages/${button.dataset.react}/reactions`, {
        method: 'POST', headers: authHeaders, body: JSON.stringify({ emoji: '👍' }),
      });
    };
  });

  document.querySelectorAll('button[data-read]').forEach((button) => {
    button.onclick = async () => {
      if (!currentChatId) return;
      await fetch(`/api/chat/${currentChatId}/read`, {
        method: 'POST', headers: authHeaders, body: JSON.stringify({ messageId: button.dataset.read }),
      });
      socket?.emit('chat:message:read', { chatId: currentChatId, messageId: button.dataset.read });
    };
  });

  document.querySelectorAll('button[data-delete]').forEach((button) => {
    button.onclick = async () => {
      await fetch(`/api/chat/messages/${button.dataset.delete}/delete-for-everyone`, {
        method: 'POST', headers: authHeaders,
      });
    };
  });
}

async function ensurePeerConnection() {
  if (peerConnection) return peerConnection;
  peerConnection = new RTCPeerConnection(iceConfig);

  peerConnection.onicecandidate = async (event) => {
    if (event.candidate && currentCallId && currentChatId) {
      const encryptedCandidate = await encryptForChat(currentChatId, { candidate: event.candidate });
      socket?.emit('call:ice-candidate', { callId: currentCallId, encryptedCandidate });
    }
  };

  peerConnection.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
  };

  return peerConnection;
}

async function startLocalMedia(callType) {
  if (localStream) return localStream;
  const constraints = callType === 'VIDEO' ? { audio: true, video: true } : { audio: true, video: false };
  localStream = await navigator.mediaDevices.getUserMedia(constraints);
  localVideo.srcObject = localStream;
  return localStream;
}

async function attachTracks(pc, stream) {
  const senders = pc.getSenders();
  stream.getTracks().forEach((track) => {
    const existing = senders.find((s) => s.track && s.track.kind === track.kind);
    if (!existing) pc.addTrack(track, stream);
  });
}

async function initiateCall(callType) {
  if (!currentChatId || !currentPeerId) return alert('Open direct chat first');
  await fetchIceConfig();
  const pc = await ensurePeerConnection();
  const stream = await startLocalMedia(callType);
  await attachTracks(pc, stream);

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  const encryptedOffer = await encryptForChat(currentChatId, { sdp: pc.localDescription });

  socket?.emit('call:initiate', {
    receiverId: currentPeerId,
    callType,
    chatId: currentChatId,
    encryptedOffer,
  }, async (ack) => {
    if (!ack?.ok) {
      setCallStatus(`Call failed: ${ack?.error || 'unknown'}`);
      return;
    }
    currentCallId = ack.callId;
    setCallStatus(`Calling (${callType})...`);
  });
}

async function acceptIncomingCall({ callId, fromUserId, chatId, callType, encryptedOffer }) {
  currentCallId = callId;
  currentPeerId = fromUserId;
  currentChatId = chatId || currentChatId;
  await ensureChatKey(currentChatId, fromUserId);
  await fetchIceConfig();
  const pc = await ensurePeerConnection();
  const stream = await startLocalMedia(callType);
  await attachTracks(pc, stream);

  const offerData = await decryptForChat(currentChatId, encryptedOffer.encryptedPayload, encryptedOffer.encryptionIv);
  await pc.setRemoteDescription(new RTCSessionDescription(offerData.sdp));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  const encryptedAnswer = await encryptForChat(currentChatId, { sdp: pc.localDescription });
  socket?.emit('call:accept', { callId, encryptedAnswer }, (ack) => {
    if (!ack?.ok) {
      setCallStatus(`Accept failed: ${ack?.error || 'unknown'}`);
      return;
    }
    setCallStatus('Call connected');
  });
}

async function endCurrentCall(reason = 'ENDED') {
  if (currentCallId) {
    socket?.emit('call:end', { callId: currentCallId, reason });
    await fetch(`/api/calls/${currentCallId}/end`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ endReason: reason }),
    }).catch(() => {});
  }

  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  if (localStream) {
    localStream.getTracks().forEach((t) => t.stop());
    localStream = null;
  }

  localVideo.srcObject = null;
  remoteVideo.srcObject = null;
  currentCallId = null;
  setCallStatus('Idle');
}

function connectSocket() {
  if (!token) {
    presenceEl.textContent = 'Set localStorage knowme_token first.';
    return;
  }

  socket = io('/', { auth: { token } });

  socket.on('connect', () => {
    presenceEl.textContent = `Connected: ${socket.id}`;
    if (currentChatId) socket.emit('chat:join', { chatId: currentChatId });
  });

  socket.on('presence:update', (payload) => {
    presenceEl.textContent = `Presence: user ${payload.userId} is ${payload.status}`;
  });

  socket.on('chat:typing', ({ chatId, userId, isTyping }) => {
    if (chatId !== currentChatId) return;
    typingEl.textContent = isTyping ? `${userId} typing...` : '';
  });

  socket.on('chat:message:new', async (message) => {
    if (message.chatId !== currentChatId) return;
    await renderMessage(message);
    bindMessageButtons();
  });

  socket.on('chat:reaction:update', ({ chatId }) => {
    if (chatId === currentChatId) loadHistory();
  });

  socket.on('chat:message:deleted', ({ chatId }) => {
    if (chatId === currentChatId) loadHistory();
  });

  socket.on('chat:read:update', ({ chatId }) => {
    if (chatId === currentChatId) loadHistory();
  });

  socket.on('call:incoming', async (payload) => {
    setCallStatus(`Incoming ${payload.callType} call from ${payload.fromUserId}`);
    await acceptIncomingCall(payload);
  });

  socket.on('call:accepted', async ({ callId, encryptedAnswer }) => {
    if (callId !== currentCallId || !peerConnection || !currentChatId) return;
    const answerData = await decryptForChat(currentChatId, encryptedAnswer.encryptedPayload, encryptedAnswer.encryptionIv);
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answerData.sdp));
    setCallStatus('Call connected');
  });

  socket.on('call:ice-candidate', async ({ callId, encryptedCandidate }) => {
    if (callId !== currentCallId || !peerConnection || !currentChatId || !encryptedCandidate) return;
    const candData = await decryptForChat(currentChatId, encryptedCandidate.encryptedPayload, encryptedCandidate.encryptionIv);
    await peerConnection.addIceCandidate(new RTCIceCandidate(candData.candidate));
  });

  socket.on('call:rejected', ({ callId }) => {
    if (callId !== currentCallId) return;
    setCallStatus('Call rejected');
    endCurrentCall('REJECTED');
  });

  socket.on('call:ended', ({ callId }) => {
    if (callId !== currentCallId) return;
    setCallStatus('Call ended');
    endCurrentCall('ENDED_REMOTE');
  });
}

document.getElementById('open-direct').onclick = async () => {
  const peerUserId = document.getElementById('peer-id').value.trim();
  currentPeerId = peerUserId;
  const res = await fetch('/api/chat/direct', {
    method: 'POST', headers: authHeaders, body: JSON.stringify({ peerUserId }),
  });
  const chat = await res.json();
  currentChatId = chat.id;
  chatIdEl.textContent = `Chat ID: ${chat.id}`;
  await ensureChatKey(chat.id, peerUserId);
  socket?.emit('chat:join', { chatId: chat.id });
  await loadHistory();
};

document.getElementById('message-text').addEventListener('input', () => {
  if (!currentChatId) return;
  socket?.emit('chat:typing', { chatId: currentChatId, isTyping: true });
  clearTimeout(window.__typingTimer);
  window.__typingTimer = setTimeout(() => socket?.emit('chat:typing', { chatId: currentChatId, isTyping: false }), 700);
});

document.getElementById('send-text').onclick = async () => {
  const text = document.getElementById('message-text').value.trim();
  if (!text || !currentChatId) return;
  const encrypted = await encryptForChat(currentChatId, { text });
  socket?.emit('chat:message:send', { chatId: currentChatId, messageType: 'TEXT', ...encrypted });
  document.getElementById('message-text').value = '';
};

document.getElementById('send-voice').onclick = async () => {
  const voiceUrl = document.getElementById('voice-url').value.trim();
  if (!voiceUrl || !currentChatId) return;
  const encrypted = await encryptForChat(currentChatId, { voiceUrl });
  socket?.emit('chat:message:send', { chatId: currentChatId, messageType: 'VOICE', voiceDurationSec: 4, ...encrypted });
  document.getElementById('voice-url').value = '';
};

document.getElementById('start-audio-call').onclick = () => initiateCall('AUDIO');
document.getElementById('start-video-call').onclick = () => initiateCall('VIDEO');
document.getElementById('end-call').onclick = () => endCurrentCall('MANUAL');

(async () => {
  if (token) {
    await loadOrCreateKeyPair();
    await publishPublicKey();
    await refreshAssistantContext();
  }
  connectSocket();
})();
