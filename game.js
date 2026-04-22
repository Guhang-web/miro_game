import { stages } from "./stages.js";

const canvas = document.getElementById("mazeCanvas");
const ctx = canvas.getContext("2d");

const stageLabel = document.getElementById("stageLabel");
const moveCountEl = document.getElementById("moveCount");
const remainingMovesEl = document.getElementById("remainingMoves");
const sideStageEl = document.getElementById("sideStage");
const sideMovesEl = document.getElementById("sideMoves");
const sideMoveLimitEl = document.getElementById("sideMoveLimit");
const sideRemainingEl = document.getElementById("sideRemaining");
const stageTitleEl = document.getElementById("stageTitle");
const stageDescriptionEl = document.getElementById("stageDescription");
const progressFillEl = document.getElementById("progressFill");
const progressTextEl = document.getElementById("progressText");
const fogStatusEl = document.getElementById("fogStatus");
const bestRecordLabelEl = document.getElementById("bestRecordLabel");

const overlayEl = document.getElementById("overlay");
const overlayTagEl = document.getElementById("overlayTag");
const overlayTitleEl = document.getElementById("overlayTitle");
const overlayTextEl = document.getElementById("overlayText");
const overlayPrimaryBtn = document.getElementById("overlayPrimaryBtn");
const overlaySecondaryBtn = document.getElementById("overlaySecondaryBtn");

const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");
const updateStageBtn = document.getElementById("updateStageBtn");

const PLAYER_IMAGE_PATH = "./img/mung1.png";
const GRID_SIZE = 10;
const BASE_CANVAS_SIZE = 480;
const STORAGE_KEY = "cat-maze-best-records";

canvas.width = BASE_CANVAS_SIZE;
canvas.height = BASE_CANVAS_SIZE;

const playerImg = new Image();
playerImg.src = PLAYER_IMAGE_PATH;

let goalPosition = { x: 0, y: 0 };

let keyPosition = null;
let hasKey = false;

let currentStageIndex = 0;
let currentMaze = [];
let moveCount = 0;
let isMoving = false;
let isLocked = false;
let visited = createVisitedGrid();
let tileSize = canvas.width / GRID_SIZE;

const player = {
  x: 0,
  y: 0,
  renderX: 0,
  renderY: 0,
  bounce: 0,
};

function createVisitedGrid() {
  return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(false));
}

function getCurrentStage() {
  return stages[currentStageIndex];
}

function getRemainingMoves() {
  return getCurrentStage().moveLimit - moveCount;
}

function loadBestRecords() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveBestRecord(stageId, value) {
  const records = loadBestRecords();
  const prev = records[stageId];

  if (typeof prev !== "number" || value < prev) {
    records[stageId] = value;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }
}

function getBestRecord(stageId) {
  const records = loadBestRecords();
  return typeof records[stageId] === "number" ? records[stageId] : null;
}

function updateCanvasSize() {
  const wrap = canvas.parentElement;
  if (!wrap) return;

  const wrapWidth = wrap.clientWidth;
  const maxBoardSize =
    window.innerWidth <= 480 ? 360 : window.innerWidth <= 768 ? 420 : 640;
  const displayWidth = Math.min(wrapWidth, maxBoardSize);
  const ratio = window.devicePixelRatio || 1;

  canvas.width = Math.floor(displayWidth * ratio);
  canvas.height = Math.floor(displayWidth * ratio);

  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  tileSize = displayWidth / GRID_SIZE;
}

function resizeCanvasAndDraw() {
  updateCanvasSize();
  drawGame();
}

function markVisited(x, y) {
  visited[y][x] = true;
}

function getRandomGoalPosition(stage) {
  const priorityCandidates = [];
  const fallbackCandidates = [];
  const lastRow = stage.maze.length - 1;
  const lastCol = stage.maze[0].length - 1;

  for (let y = 0; y < stage.maze.length; y++) {
    for (let x = 0; x < stage.maze[y].length; x++) {
      const isPath = stage.maze[y][x] === 0;
      const isStart = x === stage.start.x && y === stage.start.y;

      const isOuterWallLine =
        x === 0 || x === lastCol || y === 0 || y === lastRow;

      const isCorner =
        (x === 0 && y === 0) ||
        (x === 0 && y === lastRow) ||
        (x === lastCol && y === 0) ||
        (x === lastCol && y === lastRow);

      const distance =
        Math.abs(x - stage.start.x) + Math.abs(y - stage.start.y);
      const isFarEnough = distance >= 6;

      if (isPath && !isStart && isOuterWallLine && !isCorner && isFarEnough) {
        if (x === lastCol || y === lastRow) {
          priorityCandidates.push({ x, y });
        } else {
          fallbackCandidates.push({ x, y });
        }
      }
    }
  }

  const finalCandidates =
    priorityCandidates.length > 0 ? priorityCandidates : fallbackCandidates;

  if (finalCandidates.length === 0) {
    return getFallbackGoalPosition(stage);
  }

  const randomIndex = Math.floor(Math.random() * finalCandidates.length);
  return finalCandidates[randomIndex];
}

function getFallbackGoalPosition(stage) {
  const candidates = [];

  for (let y = 0; y < stage.maze.length; y++) {
    for (let x = 0; x < stage.maze[y].length; x++) {
      const isPath = stage.maze[y][x] === 0;
      const isStart = x === stage.start.x && y === stage.start.y;
      const distance =
        Math.abs(x - stage.start.x) + Math.abs(y - stage.start.y);

      if (isPath && !isStart && distance >= 6) {
        candidates.push({ x, y });
      }
    }
  }

  if (candidates.length === 0) {
    return { x: stage.start.x, y: stage.start.y };
  }

  const randomIndex = Math.floor(Math.random() * candidates.length);
  return candidates[randomIndex];
}
function isGoalVisible() {
  const stage = getCurrentStage();

  if (!stage.requiresKey) return true;
  if (!stage.revealGoalWithKey) return true;

  return hasKey;
}

function loadStage(index) {
  const stage = stages[index];
  currentMaze = stage.maze.map((row) => [...row]);
  moveCount = 0;
  visited = createVisitedGrid();
  hasKey = false;

  player.x = stage.start.x;
  player.y = stage.start.y;
  player.renderX = stage.start.x;
  player.renderY = stage.start.y;
  player.bounce = 0;

  if (stage.randomGoal) {
    goalPosition = getRandomGoalPosition(stage);
  } else if (stage.goal) {
    goalPosition = { ...stage.goal };
  } else {
    goalPosition = { x: stage.start.x, y: stage.start.y };
  }

  if (stage.requiresKey && stage.key) {
    keyPosition = { ...stage.key };
  } else {
    keyPosition = null;
  }

  markVisited(player.x, player.y);
  updateUI();
  hideOverlay();
  drawGame();
}

function updateUI() {
  const stage = getCurrentStage();
  const remainingMoves = getRemainingMoves();
  const best = getBestRecord(stage.id);
  const mobileStageEl = document.getElementById("mobileStage");
  const mobileMovesEl = document.getElementById("mobileMoves");
  const mobileRemainingEl = document.getElementById("mobileRemaining");

  stageLabel.textContent = stage.id;
  moveCountEl.textContent = String(moveCount);
  remainingMovesEl.textContent = String(Math.max(remainingMoves, 0));

  sideStageEl.textContent = String(stage.id);
  sideMovesEl.textContent = String(moveCount);
  sideMoveLimitEl.textContent = String(stage.moveLimit);
  sideRemainingEl.textContent = String(Math.max(remainingMoves, 0));

  stageTitleEl.textContent = stage.name;
  stageDescriptionEl.textContent = stage.description;
  progressFillEl.style.width = `${((currentStageIndex + 1) / stages.length) * 100}%`;
  progressTextEl.textContent = `${currentStageIndex + 1} / ${stages.length} Stage`;

  fogStatusEl.textContent = stage.fog ? "안개 시야" : "전체 시야";
  bestRecordLabelEl.textContent =
    best !== null ? `최고기록: ${best}회` : "최고기록: -";

  if (mobileStageEl) mobileStageEl.textContent = String(stage.id);
  if (mobileMovesEl) mobileMovesEl.textContent = String(moveCount);
  if (mobileRemainingEl)
    mobileRemainingEl.textContent = String(Math.max(remainingMoves, 0));
}

function showOverlay({
  tag,
  title,
  text,
  primaryText,
  secondaryText = "다시하기",
  onPrimary,
  onSecondary,
}) {
  overlayTagEl.textContent = tag;
  overlayTitleEl.textContent = title;
  overlayTextEl.textContent = text;
  overlayPrimaryBtn.textContent = primaryText;
  overlaySecondaryBtn.textContent = secondaryText;

  overlayPrimaryBtn.onclick = onPrimary;
  overlaySecondaryBtn.onclick = onSecondary;

  overlayEl.classList.remove("hidden");
}

function hideOverlay() {
  overlayEl.classList.add("hidden");
}

function drawRoundedRect(x, y, size, radius, fillStyle) {
  ctx.fillStyle = fillStyle;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + size - radius, y);
  ctx.quadraticCurveTo(x + size, y, x + size, y + radius);
  ctx.lineTo(x + size, y + size - radius);
  ctx.quadraticCurveTo(x + size, y + size, x + size - radius, y + size);
  ctx.lineTo(x + radius, y + size);
  ctx.quadraticCurveTo(x, y + size, x, y + size - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();
}

function drawFloorTile(gridX, gridY) {
  const px = gridX * tileSize;
  const py = gridY * tileSize;

  drawRoundedRect(
    px + 1,
    py + 1,
    tileSize - 2,
    Math.max(6, tileSize * 0.14),
    "#f7f1e8",
  );

  ctx.fillStyle = "rgba(255,255,255,0.42)";
  ctx.fillRect(px + 4, py + 4, tileSize - 8, Math.max(3, tileSize * 0.08));

  ctx.strokeStyle = "rgba(120, 94, 81, 0.08)";
  ctx.strokeRect(px + 0.5, py + 0.5, tileSize - 1, tileSize - 1);
}

function drawWallTile(gridX, gridY) {
  const px = gridX * tileSize;
  const py = gridY * tileSize;
  const radius = Math.max(6, tileSize * 0.16);

  drawRoundedRect(px + 1, py + 1, tileSize - 2, radius, "#9a7d72");

  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(px + 5, py + 5, tileSize - 10, Math.max(3, tileSize * 0.09));

  ctx.fillStyle = "rgba(90, 65, 56, 0.12)";
  ctx.fillRect(px + 4, py + tileSize * 0.62, tileSize - 8, tileSize * 0.2);
}

function drawGoalTile(gridX, gridY) {
  const px = gridX * tileSize;
  const py = gridY * tileSize;
  const stage = getCurrentStage();

  const isRandomGoalStage = stage.randomGoal === true;
  const pulse = 0.8 + Math.sin(Date.now() * 0.006) * 0.16;

  let fillColor = "#e8b94f";
  let shadowColor = "rgba(232, 185, 79, 0.55)";
  let shadowBlur = 18 * pulse;
  let highlightAlpha = "rgba(255,255,255,0.26)";

  if (isRandomGoalStage) {
    fillColor = "rgba(214, 174, 88, 0.72)";
    shadowColor = "rgba(214, 174, 88, 0.14)";
    shadowBlur = 6 * pulse;
    highlightAlpha = "rgba(255,255,255,0.8)";
  }

  ctx.save();
  ctx.shadowColor = shadowColor;
  ctx.shadowBlur = shadowBlur;
  drawRoundedRect(
    px + 2,
    py + 2,
    tileSize - 4,
    Math.max(6, tileSize * 0.16),
    fillColor,
  );
  ctx.restore();

  ctx.fillStyle = highlightAlpha;
  ctx.fillRect(px + 6, py + 6, tileSize - 12, Math.max(3, tileSize * 0.08));
}

function drawKeyTile(gridX, gridY) {
  const px = gridX * tileSize;
  const py = gridY * tileSize;

  ctx.save();
  ctx.font = `${tileSize * 0.55}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("🔑", px + tileSize / 2, py + tileSize / 2);
  ctx.restore();
}

function drawMaze() {
  if (!currentMaze || currentMaze.length === 0) return;

  for (let y = 0; y < currentMaze.length; y++) {
    if (!currentMaze[y]) continue;

    for (let x = 0; x < currentMaze[y].length; x++) {
      const cell = currentMaze[y][x];

      if (cell === 1) {
        drawWallTile(x, y);
      } else {
        drawFloorTile(x, y);
      }

      if (
        keyPosition &&
        !hasKey &&
        keyPosition.x === x &&
        keyPosition.y === y
      ) {
        drawKeyTile(x, y);
      }

      if (isGoalVisible() && goalPosition.x === x && goalPosition.y === y) {
        drawGoalTile(x, y);
      }
    }
  }
}

function drawPlayer() {
  const px = player.renderX * tileSize;
  const py = player.renderY * tileSize;
  const bounceOffset = Math.sin(player.bounce) * Math.max(2, tileSize * 0.05);

  ctx.save();
  ctx.fillStyle = "rgba(70, 45, 37, 0.18)";
  ctx.beginPath();
  ctx.ellipse(
    px + tileSize / 2,
    py + tileSize * 0.83,
    tileSize * 0.26,
    tileSize * 0.14,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.restore();

  const drawX = px + tileSize * 0.1;
  const drawY = py + tileSize * 0.08 - bounceOffset;
  const size = tileSize * 0.8;

  if (playerImg.complete && playerImg.naturalWidth > 0) {
    ctx.drawImage(playerImg, drawX, drawY, size, size);
  } else {
    ctx.fillStyle = "#f09b5f";
    ctx.beginPath();
    ctx.arc(
      px + tileSize / 2,
      py + tileSize / 2,
      tileSize * 0.28,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
}

function drawFog() {
  const stage = getCurrentStage();
  if (!stage.fog) return;
  if (!currentMaze || currentMaze.length === 0) return;

  for (let y = 0; y < currentMaze.length; y++) {
    if (!currentMaze[y]) continue;

    for (let x = 0; x < currentMaze[y].length; x++) {
      const px = x * tileSize;
      const py = y * tileSize;

      const dx = x - player.x;
      const dy = y - player.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      const isVisible = distance <= stage.visionRadius;
      const wasVisited = visited[y]?.[x];
      const isGoalTile =
        isGoalVisible() && x === goalPosition.x && y === goalPosition.y;

      if (isVisible || isGoalTile) continue;

      if (wasVisited) {
        ctx.fillStyle = "rgba(18, 12, 10, 0.88)";
      } else {
        ctx.fillStyle = "rgba(8, 5, 4, 0.99)";
      }

      ctx.fillRect(px, py, tileSize, tileSize);
    }
  }

  const centerX = (player.renderX + 0.5) * tileSize;
  const centerY = (player.renderY + 0.5) * tileSize;

  const innerRadius = tileSize * 0.9;
  const outerRadius = tileSize * (stage.visionRadius + 0.8);

  const gradient = ctx.createRadialGradient(
    centerX,
    centerY,
    innerRadius,
    centerX,
    centerY,
    outerRadius,
  );

  gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
  gradient.addColorStop(0.55, "rgba(0, 0, 0, 0.15)");
  gradient.addColorStop(0.78, "rgba(0, 0, 0, 0.55)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0.8)");

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(centerX, centerY, outerRadius, 0, Math.PI * 2);
  ctx.fill();
}

function drawBoardFrameGlow() {
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 3;
  ctx.strokeRect(3, 3, canvas.clientWidth - 6, canvas.clientHeight - 6);
  ctx.restore();
}

function drawGame() {
  const displayWidth = canvas.clientWidth || BASE_CANVAS_SIZE;
  const displayHeight = canvas.clientHeight || BASE_CANVAS_SIZE;

  ctx.clearRect(0, 0, displayWidth, displayHeight);
  drawMaze();
  drawPlayer();
  drawFog();
  drawBoardFrameGlow();
}

function animate() {
  const moveSpeed = 0.18;
  const dx = player.x - player.renderX;
  const dy = player.y - player.renderY;

  player.renderX += dx * moveSpeed;
  player.renderY += dy * moveSpeed;

  if (Math.abs(dx) < 0.01) player.renderX = player.x;
  if (Math.abs(dy) < 0.01) player.renderY = player.y;

  const arrived =
    Math.abs(player.renderX - player.x) < 0.001 &&
    Math.abs(player.renderY - player.y) < 0.001;

  if (!arrived) {
    player.bounce += 0.28;
  } else {
    player.renderX = player.x;
    player.renderY = player.y;
    player.bounce *= 0.88;
    if (player.bounce < 0.01) player.bounce = 0;
    isMoving = false;
  }

  drawGame();
  requestAnimationFrame(animate);
}

function canMoveTo(nextX, nextY) {
  if (nextX < 0 || nextX >= GRID_SIZE || nextY < 0 || nextY >= GRID_SIZE)
    return false;
  return currentMaze[nextY][nextX] !== 1;
}

function handleStageClear() {
  const stage = getCurrentStage();
  saveBestRecord(stage.id, moveCount);
  updateUI();
  isLocked = true;

  const isLastStage = currentStageIndex === stages.length - 1;

  if (isLastStage) {
    showOverlay({
      tag: "ALL CLEAR",
      title: "다음 스테이지 2주마다 업데이트 합니다!",
      text: `최종 이동 수는 ${moveCount}회야. 멋지게 끝냈다!`,
      primaryText: "처음부터 다시하기",
      secondaryText: "현재 스테이지 다시",
      onPrimary: () => {
        currentStageIndex = 0;
        isLocked = false;
        loadStage(currentStageIndex);
      },
      onSecondary: () => {
        isLocked = false;
        loadStage(currentStageIndex);
      },
    });
    return;
  }

  showOverlay({
    tag: "STAGE CLEAR",
    title: `${stage.name} 클리어!`,
    text: `이동 수 ${moveCount}회로 성공했어. 다음 스테이지로 넘어가자!`,
    primaryText: "다음 스테이지",
    secondaryText: "현재 스테이지 다시",
    onPrimary: () => {
      currentStageIndex += 1;
      isLocked = false;
      loadStage(currentStageIndex);
    },
    onSecondary: () => {
      isLocked = false;
      loadStage(currentStageIndex);
    },
  });
}

function handleStageFail() {
  isLocked = true;

  showOverlay({
    tag: "FAILED",
    title: "이동 제한 초과!",
    text: "남은 이동 수를 모두 사용했어. 현재 스테이지를 다시 도전해보자.",
    primaryText: "다시 도전하기",
    secondaryText: "화이팅!",
    onPrimary: () => {
      isLocked = false;
      loadStage(currentStageIndex);
    },
    onSecondary: () => {
      isLocked = false;
      hideOverlay();
      loadStage(currentStageIndex);
    },
  });
}

function tryMove(dx, dy) {
  if (isLocked || isMoving) return;

  const nextX = player.x + dx;
  const nextY = player.y + dy;

  if (!canMoveTo(nextX, nextY)) return;

  if (moveCount >= getCurrentStage().moveLimit) {
    handleStageFail();
    return;
  }

  player.x = nextX;
  player.y = nextY;
  moveCount += 1;
  markVisited(player.x, player.y);

  const stage = getCurrentStage();
  let justGotKey = false;

  if (
    stage.requiresKey &&
    !hasKey &&
    keyPosition &&
    player.x === keyPosition.x &&
    player.y === keyPosition.y
  ) {
    hasKey = true;
    keyPosition = null;
    justGotKey = true;
  }

  isMoving = true;
  updateUI();

  if (justGotKey) {
    isLocked = true;

    showOverlay({
      tag: "KEY GET",
      title: "열쇠를 획득했다!",
      text: "숨겨져 있던 출구가 나타났어.",
      primaryText: "계속하기",
      secondaryText: "가자!",
      onPrimary: () => {
        hideOverlay();
        isLocked = false;
      },
      onSecondary: () => {
        hideOverlay();
        isLocked = false;
      },
    });

    return;
  }

  if (
    isGoalVisible() &&
    player.x === goalPosition.x &&
    player.y === goalPosition.y
  ) {
    handleStageClear();
    return;
  }

  if (moveCount >= getCurrentStage().moveLimit) {
    handleStageFail();
  }
}

function handleDirectionInput(direction) {
  if (direction === "up") tryMove(0, -1);
  if (direction === "down") tryMove(0, 1);
  if (direction === "left") tryMove(-1, 0);
  if (direction === "right") tryMove(1, 0);
}

window.addEventListener("keydown", (e) => {
  const blockedKeys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
  if (blockedKeys.includes(e.key)) {
    e.preventDefault();
  }

  if (e.key === "ArrowUp") handleDirectionInput("up");
  if (e.key === "ArrowDown") handleDirectionInput("down");
  if (e.key === "ArrowLeft") handleDirectionInput("left");
  if (e.key === "ArrowRight") handleDirectionInput("right");
});

document.querySelectorAll("[data-dir]").forEach((button) => {
  button.addEventListener("click", () => {
    handleDirectionInput(button.dataset.dir);
  });
});

startBtn.addEventListener("click", () => {
  hideOverlay();
  isLocked = false;
  currentStageIndex = 0;
  loadStage(currentStageIndex);
});

restartBtn.addEventListener("click", () => {
  hideOverlay();
  isLocked = false;
  loadStage(currentStageIndex);
});

updateStageBtn.addEventListener("click", () => {
  const targetStageNumber = 9;

  if (targetStageNumber < 1 || targetStageNumber > stages.length) {
    alert("해당 스테이지는 아직 준비되지 않았어요.");
    return;
  }

  hideOverlay();
  isLocked = false;
  currentStageIndex = targetStageNumber - 1;
  loadStage(currentStageIndex);
});

let resizeTimer = null;

window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    resizeCanvasAndDraw();
  }, 100);
});

function init() {
  loadStage(currentStageIndex);
  resizeCanvasAndDraw();
  isLocked = true;

  showOverlay({
    tag: "READY",
    title: "게임 시작 준비 완료!",
    text: "시작하기 버튼을 눌러 첫 스테이지를 시작하세요.",
    primaryText: "시작하기",
    secondaryText: "화이팅!",
    onPrimary: () => {
      hideOverlay();
      isLocked = false;
      loadStage(currentStageIndex);
    },
    onSecondary: () => {
      hideOverlay();
      isLocked = false;
      loadStage(currentStageIndex);
    },
  });

  animate();
}

playerImg.onload = init;
playerImg.onerror = init;
