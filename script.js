// Edit this list to personalize: give each friend a real name (and later,
// swap the `initial` field for an <img> tag pointing at their photo).
const friends = [
  { id: 1,  name: "Yuri",    initial: "F1",  color: "#E4572E", img: "images/yuri.jpg" },
  { id: 2,  name: "Henry",   initial: "F2",  color: "#F3A712", img: "images/henry.jpg" },
  { id: 3,  name: "Josh",    initial: "F3",  color: "#A8C686", img: "images/josh.jpg" },
  { id: 4,  name: "Jasler",  initial: "F4",  color: "#669BBC", img: "images/jas.jpg" },
  { id: 5,  name: "Julius",  initial: "F5",  color: "#C1121F", img: "images/juls.jpg" },
  { id: 6,  name: "Jehtro",  initial: "F6",  color: "#DDA15E", img: "images/jeth.jpg" },
  { id: 7,  name: "Gino",    initial: "F7",  color: "#8E7CC3", img: "images/gino.jpg" },
  { id: 8,  name: "Sam",     initial: "F8",  color: "#1B998B", img: "images/sam.jpg" },
  { id: 9,  name: "Trisha",  initial: "F9",  color: "#FF8FA3", img: "images/trisha.jpg" },
  { id: 10, name: "Sachie",  initial: "F10", color: "#4D9078", img: "images/sachie.jpg" },
  { id: 11, name: "Shea",    initial: "F11", color: "#B5838D", img: "images/sheainah.jpg" },
  { id: 12, name: "Chanel",  initial: "F12", color: "#FFD166", img: "images/chanel.jpg" },
];

const board = document.getElementById('board');
const movesEl = document.getElementById('moves');
const timerEl = document.getElementById('timer');
const overlay = document.getElementById('overlay');
const winStats = document.getElementById('winStats');

let flipped = [];
let matchedCount = 0;
let moves = 0;
let seconds = 0;
let timerHandle = null;
let lock = false;

function shuffle(arr){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}

function formatTime(s){
  const m = Math.floor(s/60);
  const sec = s%60;
  return m + ':' + String(sec).padStart(2,'0');
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
  stopTimer();
  seconds = 0;
  moves = 0;
  matchedCount = 0;
  flipped = [];
  lock = false;
  timerEl.textContent = '0:00';
  movesEl.textContent = '0';
  overlay.classList.remove('show');

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
        ${friend.img ? `<img src="${friend.img}" alt="${friend.name}">` : friend.initial}
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
  if(lock) return;
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
      if(matchedCount === friends.length * 2){
        stopTimer();
        setTimeout(showWin, 500);
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

function showWin(){
  winStats.textContent = `Solved in ${moves} moves, ${formatTime(seconds)}`;
  overlay.classList.add('show');
}

document.getElementById('resetBtn').addEventListener('click', buildBoard);
document.getElementById('playAgainBtn').addEventListener('click', buildBoard);

buildBoard();