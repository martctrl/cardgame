// A fixed namespace for this game so random strangers don't land in your room.
// The actual room code below is what keeps two specific players together.
const APP_ID = 'match-the-cof-live-1v1-1a2b3c';

// Loaded lazily (see loadTrystero) so a CDN hiccup shows a message
// instead of silently breaking every button on the page.
let joinRoom = null;

async function loadTrystero(){
  if(joinRoom) return joinRoom;
  const sources = [
    'https://esm.sh/@trystero-p2p/torrent',
    'https://esm.run/@trystero-p2p/torrent',
    'https://esm.sh/trystero/torrent',
    'https://esm.run/trystero/torrent'
  ];
  let lastErr = null;
  for(const url of sources){
    try{
      const mod = await import(url);
      joinRoom = mod.joinRoom;
      if(joinRoom) return joinRoom;
    }catch(err){
      lastErr = err;
    }
  }
  throw lastErr || new Error('Multiplayer engine failed to load.');
}

// Surface anything that goes wrong so the setup screen never just
// sits there doing nothing with no explanation.
window.addEventListener('error', (e) => {
  showSetupError('Something went wrong: ' + (e.message || 'unknown error') + '. Check the browser console (F12) for details.');
});
window.addEventListener('unhandledrejection', (e) => {
  showSetupError('Connection problem: ' + (e.reason?.message || e.reason || 'unknown error') + '. Check the browser console (F12) for details.');
});

function showSetupError(msg){
  const el = document.getElementById('setupError');
  if(!el) return;
  el.textContent = msg;
  el.style.display = 'block';
}

const friends = [
  { id: 1,  name: "Yuri",    color: "#E4572E", img: "images/yuri.jpg" },
  { id: 2,  name: "Henry",   color: "#F3A712", img: "images/henry.jpg" },
  { id: 3,  name: "Josh",    color: "#A8C686", img: "images/josh.jpg" },
  { id: 4,  name: "Jasler",  color: "#669BBC", img: "images/jas.jpg" },
  { id: 5,  name: "Julius",  color: "#C1121F", img: "images/juls.jpg" },
  { id: 6,  name: "Jehtro",  color: "#DDA15E", img: "images/jeth.jpg" },
  { id: 7,  name: "Gino",    color: "#8E7CC3", img: "images/gino.jpg" },
  { id: 8,  name: "Sam",     color: "#1B998B", img: "images/sam.jpg" },
  { id: 9,  name: "Trisha",  color: "#FF8FA3", img: "images/trisha.jpg" },
  { id: 10, name: "Sachie",  color: "#4D9078", img: "images/sachie.jpg" },
  { id: 11, name: "Shea",    color: "#B5838D", img: "images/sheainah.jpg" },
  { id: 12, name: "Chanel",  color: "#FFD166", img: "images/chanel.jpg" },
];

function initials(name){ return name.slice(0,2).toUpperCase(); }

function formatTime(s){
  const m = Math.floor(s/60);
  const sec = s%60;
  return m + ':' + String(sec).padStart(2,'0');
}

function shuffle(arr){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}

function randomRoomCode(){
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for(let i=0;i<5;i++) code += chars[Math.floor(Math.random()*chars.length)];
  return code;
}

// ---------- DOM references ----------
const board = document.getElementById('board');
const movesEl = document.getElementById('moves');
const timerEl = document.getElementById('timer');
const liveStats = document.getElementById('liveStats');

const screenSetup = document.getElementById('screen-setup');
const screenWaiting = document.getElementById('screen-waiting');
const screenPlay = document.getElementById('screen-play');

const modeToggle = document.getElementById('modeToggle');
const hostPane = document.getElementById('hostPane');
const joinPane = document.getElementById('joinPane');
const myNameInput = document.getElementById('myName');
const roomCodeInput = document.getElementById('roomCodeInput');
const setupError = document.getElementById('setupError');

const roomCodeBlock = document.getElementById('roomCodeBlock');
const roomCodeDisplay = document.getElementById('roomCodeDisplay');
const waitStatus = document.getElementById('waitStatus');
const waitSpinner = document.getElementById('waitSpinner');

const oppNameLabel = document.getElementById('oppNameLabel');
const oppPairsEl = document.getElementById('oppPairs');
const oppMovesEl = document.getElementById('oppMoves');

const countdownOverlay = document.getElementById('countdownOverlay');
const countdownNum = document.getElementById('countdownNum');
const finishWaitOverlay = document.getElementById('finishWaitOverlay');
const myFinishStats = document.getElementById('myFinishStats');
const oppWaitName = document.getElementById('oppWaitName');
const resultsOverlay = document.getElementById('resultsOverlay');
const winnerLine = document.getElementById('winnerLine');
const resultsRows = document.getElementById('resultsRows');
const rematchStatus = document.getElementById('rematchStatus');
const disconnectOverlay = document.getElementById('disconnectOverlay');

// ---------- Game / network state ----------
let mode = 'host';
let myName = 'You';
let oppName = 'Opponent';
let isHost = false;
let room = null;
let peerId = null;

let helloAction, startAction, progressAction, finishAction, rematchAction;

let flipped = [];
let matchedCount = 0;
let moves = 0;
let seconds = 0;
let timerHandle = null;
let lock = false;

let myStats = null;
let oppStats = null;
let myRematchReady = false;
let oppRematchReady = false;
let gameLive = false;

function showScreen(el){
  [screenSetup, screenWaiting, screenPlay].forEach(s => s.classList.remove('active'));
  el.classList.add('active');
}

function hideAllOverlays(){
  [countdownOverlay, finishWaitOverlay, resultsOverlay, disconnectOverlay]
    .forEach(o => o.classList.remove('show'));
}

// ---------- Setup screen ----------
modeToggle.addEventListener('click', (e) => {
  const btn = e.target.closest('.mode-btn');
  if(!btn) return;
  mode = btn.dataset.mode;
  [...modeToggle.querySelectorAll('.mode-btn')].forEach(b => b.classList.toggle('active', b === btn));
  hostPane.style.display = mode === 'host' ? 'block' : 'none';
  joinPane.style.display = mode === 'join' ? 'block' : 'none';
  setupError.style.display = 'none';
});

document.getElementById('createBtn').addEventListener('click', async () => {
  const btn = document.getElementById('createBtn');
  setupError.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Connecting…';
  try{
    await loadTrystero();
    myName = myNameInput.value.trim() || 'Host';
    isHost = true;
    const code = randomRoomCode();
    connectToRoom(code);
    roomCodeBlock.style.display = 'block';
    roomCodeDisplay.textContent = code;
    waitStatus.textContent = 'Waiting for opponent to join…';
    showScreen(screenWaiting);
  }catch(err){
    showSetupError('Could not start multiplayer: ' + (err?.message || err) + '. Check your internet connection and try again.');
  }finally{
    btn.disabled = false;
    btn.textContent = 'Create room';
  }
});

document.getElementById('joinBtn').addEventListener('click', async () => {
  const code = roomCodeInput.value.trim().toUpperCase();
  if(!code){
    showSetupError('Enter the room code your host sent you.');
    return;
  }
  const btn = document.getElementById('joinBtn');
  setupError.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Connecting…';
  try{
    await loadTrystero();
    myName = myNameInput.value.trim() || 'Guest';
    isHost = false;
    connectToRoom(code);
    roomCodeBlock.style.display = 'none';
    waitStatus.textContent = 'Connecting to room…';
    showScreen(screenWaiting);
  }catch(err){
    showSetupError('Could not join: ' + (err?.message || err) + '. Check your internet connection and try again.');
  }finally{
    btn.disabled = false;
    btn.textContent = 'Join room';
  }
});

document.getElementById('copyCodeBtn').addEventListener('click', () => {
  navigator.clipboard?.writeText(roomCodeDisplay.textContent).catch(() => {});
  const btn = document.getElementById('copyCodeBtn');
  const original = btn.textContent;
  btn.textContent = 'Copied!';
  setTimeout(() => btn.textContent = original, 1200);
});

document.getElementById('cancelWaitBtn').addEventListener('click', () => {
  leaveRoom();
  showScreen(screenSetup);
});

// ---------- Networking ----------
function connectToRoom(code){
  room = joinRoom({ appId: APP_ID }, code);

  helloAction = room.makeAction('hello');
  startAction = room.makeAction('start');
  progressAction = room.makeAction('progress');
  finishAction = room.makeAction('finish');
  rematchAction = room.makeAction('rematch');

  room.onPeerJoin = (id) => {
    peerId = id;
    waitStatus.textContent = 'Opponent found — say hi…';
    helloAction.send({ name: myName }, { target: id });
  };

  room.onPeerLeave = () => {
    peerId = null;
    if(gameLive){
      gameLive = false;
      stopTimer();
      hideAllOverlays();
      disconnectOverlay.classList.add('show');
    }
  };

  helloAction.onMessage = (data, { peerId: id }) => {
    oppName = data.name || 'Opponent';
    oppNameLabel.textContent = oppName;
    waitStatus.textContent = `Connected with ${oppName}!`;
    if(isHost){
      const startAt = Date.now() + 3000;
      startAction.send({ startAt }, { target: id });
      beginCountdown(startAt);
    }
  };

  startAction.onMessage = (data) => {
    beginCountdown(data.startAt);
  };

  progressAction.onMessage = (data) => {
    oppPairsEl.textContent = data.pairs;
    oppMovesEl.textContent = data.moves;
  };

  finishAction.onMessage = (data) => {
    oppStats = data;
    if(myStats){
      showResults();
    } else {
      oppWaitName.textContent = `${oppName} just finished in ${data.moves} moves, ${formatTime(data.seconds)} — keep going!`;
    }
  };

  rematchAction.onMessage = () => {
    oppRematchReady = true;
    maybeStartRematch();
  };
}

function leaveRoom(){
  try{ room?.leave(); }catch(e){}
  room = null;
  peerId = null;
  gameLive = false;
  stopTimer();
  hideAllOverlays();
  liveStats.style.display = 'none';
  myStats = null;
  oppStats = null;
  myRematchReady = false;
  oppRematchReady = false;
}

// ---------- Countdown + turn start ----------
function beginCountdown(startAt){
  hideAllOverlays();
  countdownOverlay.classList.add('show');

  const tick = () => {
    const msLeft = startAt - Date.now();
    const secLeft = Math.max(0, Math.ceil(msLeft / 1000));
    countdownNum.textContent = secLeft > 0 ? secLeft : 'Go!';
    if(msLeft <= 0){
      countdownOverlay.classList.remove('show');
      startMyTurn();
    } else {
      requestAnimationFrame(tick);
    }
  };
  tick();
}

function startMyTurn(){
  gameLive = true;
  moves = 0;
  seconds = 0;
  flipped = [];
  matchedCount = 0;
  lock = false;
  myStats = null;
  oppStats = null;

  movesEl.textContent = '0';
  timerEl.textContent = '0:00';
  liveStats.style.display = 'flex';
  oppPairsEl.textContent = '0';
  oppMovesEl.textContent = '0';

  buildBoard();
  showScreen(screenPlay);
}

function startTimerIfNeeded(){
  if(timerHandle) return;
  timerHandle = setInterval(() => {
    seconds++;
    timerEl.textContent = formatTime(seconds);
  }, 1000);
}

function stopTimer(){
  clearInterval(timerHandle);
  timerHandle = null;
}

function buildBoard(){
  const deck = shuffle([...friends, ...friends]);
  board.innerHTML = '';

  deck.forEach((friend) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.friendId = friend.id;
    card.tabIndex = 0;
    card.setAttribute('role','button');
    card.setAttribute('aria-label', 'Face-down card');

    card.innerHTML = `
      <div class="face back"></div>
      <div class="face front">
        <div class="avatar" style="background:${friend.color}">
          ${friend.img
            ? `<img src="${friend.img}" alt="${friend.name}" onerror="this.replaceWith(Object.assign(document.createElement('span'), {textContent:'${initials(friend.name)}'}))">`
            : initials(friend.name)}
        </div>
      </div>
    `;

    card.addEventListener('click', () => handleFlip(card));
    card.addEventListener('keydown', (e) => {
      if(e.key === 'Enter' || e.key === ' '){
        e.preventDefault();
        handleFlip(card);
      }
    });

    board.appendChild(card);
  });
}

function handleFlip(card){
  if(!gameLive || lock) return;
  if(card.classList.contains('flipped') || card.classList.contains('matched')) return;
  if(flipped.length === 2) return;

  startTimerIfNeeded();
  card.classList.add('flipped');
  flipped.push(card);

  if(flipped.length === 2){
    moves++;
    movesEl.textContent = moves;
    const [a,b] = flipped;
    if(a.dataset.friendId === b.dataset.friendId){
      a.classList.add('matched');
      b.classList.add('matched');
      flipped = [];
      matchedCount += 2;
      progressAction?.send({ pairs: matchedCount/2, moves });
      if(matchedCount === friends.length * 2){
        finishMyTurn();
      }
    } else {
      lock = true;
      setTimeout(() => {
        a.classList.remove('flipped');
        b.classList.remove('flipped');
        flipped = [];
        lock = false;
      }, 800);
    }
  }
}

function finishMyTurn(){
  stopTimer();
  myStats = { moves, seconds };
  finishAction?.send(myStats);

  if(oppStats){
    showResults();
  } else {
    myFinishStats.textContent = `Solved in ${moves} moves, ${formatTime(seconds)}`;
    oppWaitName.textContent = `Waiting for ${oppName} to finish…`;
    finishWaitOverlay.classList.add('show');
  }
}

// ---------- Results ----------
function decideWinner(){
  if(myStats.moves !== oppStats.moves) return myStats.moves < oppStats.moves ? 'me' : 'opp';
  if(myStats.seconds !== oppStats.seconds) return myStats.seconds < oppStats.seconds ? 'me' : 'opp';
  return 'tie';
}

function showResults(){
  gameLive = false;
  hideAllOverlays();

  const winner = decideWinner();
  if(winner === 'tie'){
    winnerLine.textContent = "It's a tie — same moves and time!";
  } else if(winner === 'me'){
    winnerLine.textContent = `${myName} wins! 🏆`;
  } else {
    winnerLine.textContent = `${oppName} wins! 🏆`;
  }

  resultsRows.innerHTML = '';
  const rowsData = [
    { label: myName, color: 'var(--p1)', stats: myStats, isWinner: winner === 'me' },
    { label: oppName, color: 'var(--p2)', stats: oppStats, isWinner: winner === 'opp' },
  ];
  rowsData.forEach(r => {
    const row = document.createElement('div');
    row.className = 'result-row' + (r.isWinner ? ' winner' : '');
    row.innerHTML = `
      <div class="who"><span class="dot" style="background:${r.color}"></span>${r.label}${r.isWinner ? ' <span class="crown">👑</span>' : ''}</div>
      <div class="figures"><span>Moves <b>${r.stats.moves}</b></span><span>Time <b>${formatTime(r.stats.seconds)}</b></span></div>
    `;
    resultsRows.appendChild(row);
  });

  myRematchReady = false;
  oppRematchReady = false;
  rematchStatus.style.display = 'none';
  resultsOverlay.classList.add('show');
}

// ---------- Rematch ----------
function maybeStartRematch(){
  if(myRematchReady && oppRematchReady && isHost){
    const startAt = Date.now() + 3000;
    startAction.send({ startAt }, { target: peerId });
    resultsOverlay.classList.remove('show');
    beginCountdown(startAt);
  } else if(myRematchReady){
    rematchStatus.textContent = `Waiting for ${oppName} to want a rematch too…`;
    rematchStatus.style.display = 'block';
  }
}

document.getElementById('rematchBtn').addEventListener('click', () => {
  myRematchReady = true;
  rematchAction?.send({});
  maybeStartRematch();
});

document.getElementById('leaveRoomBtn').addEventListener('click', () => {
  leaveRoom();
  showScreen(screenSetup);
});

document.getElementById('disconnectOkBtn').addEventListener('click', () => {
  leaveRoom();
  showScreen(screenSetup);
});
