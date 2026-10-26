const GRID = 20;
const SIZE = 480;
const CELL = SIZE / GRID;

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const startBox = document.getElementById("startBox");
const overBox = document.getElementById("overBox");
const finalText = document.getElementById("finalText");
const saveRow = document.getElementById("saveRow");
const nameInput = document.getElementById("nameInput");

const SCORES_URL = document.body.dataset.scoresUrl;
const CSRF = document.body.dataset.csrf;

let snake, dir, queue, apple, score, timer, running, paused;
let best = 0;

function reset() {
  snake = [{x: 10, y: 10}, {x: 9, y: 10}, {x: 8, y: 10}];
  dir = {x: 1, y: 0};
  queue = [];
  score = 0;
  paused = false;
  scoreEl.textContent = 0;
  placeApple();
}

function placeApple() {
  do {
    apple = {x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID)};
  } while (snake.some(s => s.x === apple.x && s.y === apple.y));
}

function speed() {
  // càng nhiều điểm càng nhanh, tối thiểu 70ms
  return Math.max(70, 140 - score * 3);
}

function start() {
  reset();
  startBox.hidden = true;
  overBox.hidden = true;
  running = true;
  draw();
  loop();
}

function loop() {
  clearTimeout(timer);
  if (!running) return;
  if (!paused) step();
  if (running) timer = setTimeout(loop, speed());
}

function step() {
  if (queue.length) dir = queue.shift();
  const head = {x: snake[0].x + dir.x, y: snake[0].y + dir.y};

  const hitWall = head.x < 0 || head.y < 0 || head.x >= GRID || head.y >= GRID;
  const hitSelf = snake.some(s => s.x === head.x && s.y === head.y);
  if (hitWall || hitSelf) return gameOver();

  snake.unshift(head);
  if (head.x === apple.x && head.y === apple.y) {
    score++;
    scoreEl.textContent = score;
    if (score > best) { best = score; bestEl.textContent = best; }
    placeApple();
  } else {
    snake.pop();
  }
  draw();
}

function gameOver() {
  running = false;
  clearTimeout(timer);
  finalText.textContent = "Bạn ăn được " + score + " quả táo.";
  saveRow.hidden = score === 0;
  overBox.hidden = false;
  if (score > 0) nameInput.focus();
}

function turn(nx, ny) {
  const last = queue.length ? queue[queue.length - 1] : dir;
  if (last.x === -nx && last.y === -ny) return;   // không quay đầu 180 độ
  if (last.x === nx && last.y === ny) return;
  if (queue.length < 2) queue.push({x: nx, y: ny});
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

function draw() {
  ctx.clearRect(0, 0, SIZE, SIZE);

  // ô cờ nhạt
  ctx.fillStyle = "rgba(0,0,0,.06)";
  for (let x = 0; x < GRID; x++)
    for (let y = 0; y < GRID; y++)
      if ((x + y) % 2) ctx.fillRect(x * CELL, y * CELL, CELL, CELL);

  // táo
  ctx.fillStyle = "#c8402f";
  ctx.beginPath();
  ctx.arc(apple.x * CELL + CELL / 2, apple.y * CELL + CELL / 2 + 1, CELL * 0.38, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#b5d06f";
  roundRect(apple.x * CELL + CELL / 2 - 1, apple.y * CELL + 1, 3, 7, 2);

  // rắn
  snake.forEach((s, i) => {
    ctx.fillStyle = i === 0 ? "#efe9da" : (i % 2 ? "#b5d06f" : "#9fbd5a");
    roundRect(s.x * CELL + 1.5, s.y * CELL + 1.5, CELL - 3, CELL - 3, i === 0 ? 9 : 6);
  });

  // mắt
  const h = snake[0];
  ctx.fillStyle = "#1c1610";
  const ex = dir.x !== 0 ? 0 : 1, ey = dir.y !== 0 ? 0 : 1;
  const cx = h.x * CELL + CELL / 2 + dir.x * 4, cy = h.y * CELL + CELL / 2 + dir.y * 4;
  [-1, 1].forEach(k => {
    ctx.beginPath();
    ctx.arc(cx + k * 4 * ey, cy + k * 4 * ex, 2.2, 0, Math.PI * 2);
    ctx.fill();
  });
}

// ----- điều khiển -----
const KEYS = {
  ArrowUp: [0, -1], w: [0, -1], W: [0, -1],
  ArrowDown: [0, 1], s: [0, 1], S: [0, 1],
  ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0],
  ArrowRight: [1, 0], d: [1, 0], D: [1, 0],
};

document.addEventListener("keydown", e => {
  if (e.target === nameInput) return;
  if (e.key === " ") {
    e.preventDefault();
    if (running) paused = !paused;
    return;
  }
  if (KEYS[e.key] && running) {
    e.preventDefault();
    turn(...KEYS[e.key]);
  }
});

let touch = null;
canvas.addEventListener("touchstart", e => {
  touch = {x: e.touches[0].clientX, y: e.touches[0].clientY};
}, {passive: true});
canvas.addEventListener("touchend", e => {
  if (!touch || !running) return;
  const dx = e.changedTouches[0].clientX - touch.x;
  const dy = e.changedTouches[0].clientY - touch.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
  if (Math.abs(dx) > Math.abs(dy)) turn(dx > 0 ? 1 : -1, 0);
  else turn(0, dy > 0 ? 1 : -1);
  touch = null;
});

// ----- bảng xếp hạng (gọi API Django) -----
async function loadBoard() {
  try {
    const res = await fetch(SCORES_URL);
    renderBoard(await res.json());
  } catch (_) { /* bỏ qua lỗi mạng */ }
}

function renderBoard(list) {
  const ol = document.getElementById("board");
  ol.innerHTML = "";
  if (!list.length) {
    const li = document.createElement("li");
    li.textContent = "Chưa có ai. Bạn sẽ là người đầu tiên?";
    ol.appendChild(li);
    return;
  }
  if (list[0].score > best) { best = list[0].score; bestEl.textContent = best; }
  list.forEach(item => {
    const li = document.createElement("li");
    li.textContent = item.name;
    const sp = document.createElement("span");
    sp.textContent = item.score;
    li.appendChild(sp);
    ol.appendChild(li);
  });
}

document.getElementById("saveBtn").addEventListener("click", async () => {
  const res = await fetch(SCORES_URL, {
    method: "POST",
    headers: {"Content-Type": "application/json", "X-CSRFToken": CSRF},
    body: JSON.stringify({name: nameInput.value, score})
  });
  if (res.ok) {
    renderBoard(await res.json());
    saveRow.hidden = true;
  }
});

document.getElementById("startBtn").addEventListener("click", start);
document.getElementById("againBtn").addEventListener("click", start);

reset();
draw();
loadBoard();
