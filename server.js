const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { execFile } = require("child_process");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const port = process.env.PORT || 3000;

// =======================
// Python 実行パス（重要）
// =======================
const pythonPath =
  process.platform === "win32"
    ? "python"
    : "python3";

// =======================
// 背景除去スクリプト
// =======================
const REMOVE_BG_SCRIPT = path.join(__dirname, "tools", "remove_bg.py");

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
      cb(new Error("画像ファイルのみ対応"));
    }
  }
});

// =======================
// Python 背景除去処理
// =======================
function removeBackground(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    execFile(
      pythonPath,                       // ← ★ここ重要
      [REMOVE_BG_SCRIPT, inputPath, outputPath],
      { encoding: "utf8" },
      (error, stdout, stderr) => {
        console.log("Python stdout:\n", stdout);

        if (stderr) {
          console.log("Python stderr:\n", stderr);
        }

        if (error) {
          reject(error);
          return;
        }

        if (!fs.existsSync(outputPath)) {
          reject(
            new Error("背景除去後の画像が生成されていません")
          );
          return;
        }

        resolve();
      }
    );
  });
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
      console.error("背景除去エラー:", err);

      res.status(500).json({
        success: false,
        message: "背景除去に失敗しました"
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