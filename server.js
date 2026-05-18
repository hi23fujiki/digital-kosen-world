const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const port = process.env.PORT || 3000;

// =======================
// public フォルダ公開
// =======================
app.use(express.static("public"));

// =======================
// uploads フォルダ準備
// =======================
const uploadDir = path.join(__dirname, "public", "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// =======================
// multer 設定
// =======================
const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, uploadDir);
  },
  filename(req, file, cb) {
    const unique =
      Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  fileFilter(req, file, cb) {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("画像ファイルのみアップロード可能"));
    }
  }
});

// =======================
// Node.js 背景除去（白背景）
// =======================
async function removeWhiteBackgroundNode(inputPath, outputPath) {
  const image = sharp(inputPath);

  const { data, info } = await image
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const threshold = 240; // 白判定（調整可）
  const channels = info.channels; // RGBA = 4

  for (let i = 0; i < data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // 白っぽいところを透明化
    if (r > threshold && g > threshold && b > threshold) {
      data[i + 3] = 0;
    }
  }

  await sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels
    }
  })
    .png()
    .toFile(outputPath);
}

// =======================
// 背景除去ラッパー（失敗しても止めない）
// =======================
async function removeBackground(inputPath, outputPath) {
  try {
    await removeWhiteBackgroundNode(inputPath, outputPath);
  } catch (err) {
    console.error("背景除去失敗 → 元画像を使用", err);
    // 展示向け：失敗しても必ず画像を返す
    fs.copyFileSync(inputPath, outputPath);
  }
}

// =======================
// 画像アップロード API
// =======================
app.post(
  "/upload",
  upload.single("characterImage"),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "画像がありません"
      });
    }

    try {
      const originalName = req.file.originalname;
      const inputPath = req.file.path;

      const parsed = path.parse(req.file.filename);
      const cutFileName = parsed.name + "_cut.png";
      const outputPath = path.join(uploadDir, cutFileName);

      console.log("元画像:", inputPath);
      console.log("背景除去後:", outputPath);

      await removeBackground(inputPath, outputPath);

      res.json({
        success: true,
        imagePath: "uploads/" + cutFileName,
        originalName
      });

    } catch (err) {
      console.error("アップロード処理エラー:", err);

      res.status(500).json({
        success: false,
        message: "処理に失敗しました"
      });
    }
  }
);

// =======================
// Socket.IO
// =======================
const characterHistory = [];
const MAX_CHARACTERS = 30;

io.on("connection", (socket) => {
  console.log("接続:", socket.id);

  // 既存キャラ同期
  socket.emit("syncCharacters", characterHistory);

  socket.on("addCharacter", (data) => {
    characterHistory.push(data);

    while (characterHistory.length > MAX_CHARACTERS) {
      characterHistory.shift();
    }

    io.emit("newCharacter", data);
  });

  socket.on("resetCharacters", () => {
    characterHistory.length = 0;
    io.emit("clearCharacters");
  });
});

// =======================
// サーバー起動
// =======================
server.listen(port, () => {
  console.log(`サーバー起動中: http://localhost:${port}`);
});