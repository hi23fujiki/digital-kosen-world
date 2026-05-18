console.log("screen.js が読み込まれました");

const socket = io();

const canvas = document.getElementById("world");
const ctx = canvas.getContext("2d");

const fullscreenButton = document.getElementById("fullscreenButton");
const screenWrapper = document.querySelector(".screen-wrapper");

if (fullscreenButton) {
  fullscreenButton.addEventListener("click", async () => {
    try {
      if (screenWrapper.requestFullscreen) {
        await screenWrapper.requestFullscreen();
      } else if (screenWrapper.webkitRequestFullscreen) {
        await screenWrapper.webkitRequestFullscreen();
      }

      document.body.classList.add("fullscreen-active");
    } catch (error) {
      console.error("全画面表示に失敗しました:", error);
    }
  });
}

document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement) {
    document.body.classList.remove("fullscreen-active");
  }
});

const characters = [];

// 最大表示数
const MAX_CHARACTERS = 30;

// 画像最大サイズ
const CHARACTER_MAX_SIZE = 120;

socket.on("connect", () => {
  console.log("大画面がサーバーに接続しました:", socket.id);
});

socket.on("syncCharacters", (list) => {
  console.log("現在のキャラ一覧を同期:", list);

  characters.length = 0;

  list.forEach((data) => {
    addCharacterToScreen(data);
  });
});

socket.on("newCharacter", (data) => {
  console.log("大画面で受信:", data);
  addCharacterToScreen(data);
});

function addCharacterToScreen(data) {
  const position = getStartPosition(data.schoolName);
  const target = getRandomTarget();

  const character = {
    name: data.name || "キャラ",
    schoolName: data.schoolName || "",
    motion: data.motion || "random",
    image: null,
    imagePath: data.image,
    color: data.color || "red",

    x: position.x,
    y: position.y,
    baseY: position.y,

    targetX: target.x,
    targetY: target.y,

    speed: Math.random() * 1.2 + 0.8,

    angle: 0,
    time: 0,

    changeTargetAt: Date.now() + Math.random() * 4000 + 3000,

    imageLoaded: false
  };

  const img = new Image();

  img.onload = () => {
    console.log("画像読み込み成功:", data.image);
    character.imageLoaded = true;
  };

  img.onerror = () => {
    console.log("画像読み込み失敗:", data.image);
  };

  img.src = data.image;
  character.image = img;

  characters.push(character);

  while (characters.length > MAX_CHARACTERS) {
    characters.shift();
  }
}

socket.on("clearCharacters", () => {
  console.log("大画面のキャラを全削除");
  characters.length = 0;
});

// 最初の出現位置だけ高専ごとに分ける
function getStartPosition(schoolName) {
  let x;

  if (schoolName === "熊本高専") {
    // 左側：熊本高専エリアから登場
    x = Math.random() * 260 + 100;
  } else if (schoolName === "茨城高専") {
    // 右側：茨城高専エリアから登場
    x = Math.random() * 260 + 540;
  } else {
    // 中央付近
    x = Math.random() * 300 + 300;
  }

  const y = Math.random() * 230 + 170;

  return { x, y };
}

// 次の目的地は画面全体からランダムに選ぶ
function getRandomTarget() {
  const x = Math.random() * 760 + 70;
  const y = Math.random() * 250 + 160;

  return { x, y };
}

// キャラをランダムな目的地に向かって動かす
function updateRandomMove(chara) {
  const dx = chara.targetX - chara.x;
  const dy = chara.targetY - chara.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance > 1) {
    chara.x += (dx / distance) * chara.speed;
    chara.y += (dy / distance) * chara.speed;
  }

  const now = Date.now();

  // 目的地に近づいたら、または一定時間経ったら新しい目的地へ
  if (distance < 20 || now > chara.changeTargetAt) {
    const nextTarget = getRandomTarget();

    chara.targetX = nextTarget.x;
    chara.targetY = nextTarget.y;
    chara.changeTargetAt = now + Math.random() * 4000 + 3000;
    chara.speed = Math.random() * 1.2 + 0.8;
  }

  // 画面外に出ないようにする
  chara.x = Math.max(60, Math.min(canvas.width - 60, chara.x));
  chara.y = Math.max(130, Math.min(canvas.height - 90, chara.y));
}

function updateCharacter(chara) {
  chara.time += 0.05;

  // 基本は全キャラがランダム移動する
  updateRandomMove(chara);

  // 選んだ動きごとに追加演出をつける
  if (chara.motion === "jump") {
    // ゆっくり上下に弾む
    chara.y += Math.sin(chara.time * 1.4) * 1.8;
  }

  if (chara.motion === "spin") {
    // ゆっくり回転
    chara.angle += 0.02;
  }

  if (chara.motion === "bounce") {
    // 少し左右に揺れる
    chara.x += Math.sin(chara.time * 2.0) * 1.4;
  }

  if (chara.motion === "float") {
    // ふわふわ浮く
    chara.y += Math.sin(chara.time * 1.0) * 1.5;
    chara.x += Math.cos(chara.time * 0.8) * 0.8;
  }
}

function drawCharacterImage(chara) {
  if (chara.imageLoaded) {
    const imgW = chara.image.width;
    const imgH = chara.image.height;

    const scale = Math.min(
      CHARACTER_MAX_SIZE / imgW,
      CHARACTER_MAX_SIZE / imgH
    );

    const drawW = imgW * scale;
    const drawH = imgH * scale;

    ctx.drawImage(
      chara.image,
      -drawW / 2,
      -drawH / 2,
      drawW,
      drawH
    );
  } else {
    // 画像読み込み中・失敗時の代替表示
    ctx.fillStyle = chara.color;
    ctx.beginPath();
    ctx.arc(0, 0, 40, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "black";
    ctx.lineWidth = 3;
    ctx.stroke();
  }
}

function drawCharacterText(chara) {
  ctx.fillStyle = "black";
  ctx.textAlign = "center";

  // キャラ名
  ctx.font = "16px sans-serif";
  ctx.fillText(chara.name, 0, 78);

  // 高専名
  if (chara.schoolName) {
    ctx.font = "13px sans-serif";
    ctx.fillText(chara.schoolName, 0, 96);
  }
}

function drawCharacter(chara) {
  ctx.save();

  ctx.translate(chara.x, chara.y);
  ctx.rotate(chara.angle);

  drawCharacterImage(chara);
  drawCharacterText(chara);

  ctx.restore();
}

function drawBackground() {
  // 空
  const skyGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  skyGradient.addColorStop(0, "#dff6ff");
  skyGradient.addColorStop(1, "#f7fbff");
  ctx.fillStyle = skyGradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 左：熊本高専エリア
  ctx.fillStyle = "#dff5df";
  ctx.fillRect(0, 120, canvas.width / 2, canvas.height - 120);

  // 右：茨城高専エリア
  ctx.fillStyle = "#dceeff";
  ctx.fillRect(canvas.width / 2, 120, canvas.width / 2, canvas.height - 120);

  // 中央の明るい接続エリア
  const centerGradient = ctx.createLinearGradient(
    canvas.width / 2 - 120,
    0,
    canvas.width / 2 + 120,
    0
  );

  centerGradient.addColorStop(0, "rgba(255, 255, 255, 0)");
  centerGradient.addColorStop(0.5, "rgba(255, 255, 255, 0.75)");
  centerGradient.addColorStop(1, "rgba(255, 255, 255, 0)");

  ctx.fillStyle = centerGradient;
  ctx.fillRect(canvas.width / 2 - 130, 100, 260, canvas.height - 100);

  // 地面
  ctx.fillStyle = "#cfeecf";
  ctx.fillRect(0, canvas.height - 75, canvas.width / 2, 75);

  ctx.fillStyle = "#cfe4f5";
  ctx.fillRect(canvas.width / 2, canvas.height - 75, canvas.width / 2, 75);

  drawKumamotoMountains();
  drawIbarakiCity();
  drawConnectBridge();
  drawCloud(120, 90, 0.9);
  drawCloud(760, 80, 0.8);
  drawAreaLabels();
}

function drawKumamotoMountains() {
  ctx.fillStyle = "#3e9b5f";
  ctx.beginPath();
  ctx.moveTo(0, canvas.height - 75);
  ctx.lineTo(70, 330);
  ctx.quadraticCurveTo(130, 250, 190, 330);
  ctx.quadraticCurveTo(240, 270, 330, canvas.height - 75);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#2f7f4f";
  ctx.beginPath();
  ctx.moveTo(80, canvas.height - 75);
  ctx.lineTo(180, 300);
  ctx.quadraticCurveTo(250, 220, 360, canvas.height - 75);
  ctx.closePath();
  ctx.fill();
}

function drawIbarakiCity() {
  const baseY = canvas.height - 75;

  ctx.fillStyle = "#2f6f8f";

  // ビル
  ctx.fillRect(650, baseY - 110, 55, 110);
  ctx.fillRect(720, baseY - 80, 45, 80);
  ctx.fillRect(790, baseY - 130, 28, 130);

  // ドーム
  ctx.beginPath();
  ctx.arc(840, baseY, 45, Math.PI, 0);
  ctx.fill();

  // ロケット風
  ctx.fillStyle = "#245b78";
  ctx.beginPath();
  ctx.moveTo(760, baseY);
  ctx.lineTo(790, baseY - 150);
  ctx.lineTo(820, baseY);
  ctx.closePath();
  ctx.fill();

  // 風車
  ctx.strokeStyle = "#245b78";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(865, baseY);
  ctx.lineTo(865, baseY - 90);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(865, baseY - 90);
  ctx.lineTo(835, baseY - 115);
  ctx.moveTo(865, baseY - 90);
  ctx.lineTo(895, baseY - 115);
  ctx.moveTo(865, baseY - 90);
  ctx.lineTo(865, baseY - 50);
  ctx.stroke();
}

function drawConnectBridge() {
  const centerX = canvas.width / 2;
  const baseY = canvas.height - 75;

  // 虹色の橋
  const bridgeColors = [
    "rgba(255, 100, 120, 0.65)",
    "rgba(255, 190, 80, 0.65)",
    "rgba(255, 230, 90, 0.65)",
    "rgba(100, 210, 130, 0.65)",
    "rgba(80, 180, 255, 0.65)"
  ];

  for (let i = 0; i < bridgeColors.length; i++) {
    ctx.strokeStyle = bridgeColors[i];
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.arc(
      centerX,
      baseY + 120,
      190 - i * 22,
      Math.PI,
      0
    );
    ctx.stroke();
  }

  // 中央ゲート
  ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
  ctx.lineWidth = 18;
  ctx.beginPath();
  ctx.arc(centerX, baseY - 5, 70, Math.PI, 0);
  ctx.stroke();

  // CONNECT文字
  ctx.font = "bold 38px sans-serif";
  ctx.textAlign = "center";

  ctx.lineWidth = 6;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
  ctx.strokeText("CONNECT", centerX, 155);

  ctx.fillStyle = "rgba(30, 90, 130, 0.98)";
  ctx.fillText("CONNECT", centerX, 155);
}

function drawCloud(x, y, scale) {
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";

  ctx.beginPath();
  ctx.arc(x, y, 28 * scale, 0, Math.PI * 2);
  ctx.arc(x + 35 * scale, y - 15 * scale, 38 * scale, 0, Math.PI * 2);
  ctx.arc(x + 75 * scale, y, 30 * scale, 0, Math.PI * 2);
  ctx.fill();
}

function drawAreaLabels() {
  ctx.textAlign = "center";

  // 熊本ラベル
  ctx.fillStyle = "rgba(0, 110, 60, 0.9)";
  ctx.fillRect(45, canvas.height - 132, 250, 46);

  ctx.fillStyle = "white";
  ctx.font = "bold 26px sans-serif";
  ctx.fillText("熊本高専エリア", 170, canvas.height - 101);

  // 茨城ラベル
  ctx.fillStyle = "rgba(0, 90, 140, 0.9)";
  ctx.fillRect(canvas.width - 295, canvas.height - 132, 250, 46);

  ctx.fillStyle = "white";
  ctx.font = "bold 26px sans-serif";
  ctx.fillText("茨城高専エリア", canvas.width - 170, canvas.height - 101);
}

function drawTitle() {
  ctx.fillStyle = "#222";
  ctx.font = "bold 28px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(
    "描いて動かす！みんなのデジタル高専ワールド",
    canvas.width / 2,
    40
  );
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawBackground();
  drawTitle();

  for (const chara of characters) {
    updateCharacter(chara);
    drawCharacter(chara);
  }

  requestAnimationFrame(draw);
}

draw();