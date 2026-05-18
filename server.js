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

const port = 3000;

const characterHistory = [];
const MAX_CHARACTERS = 30;

// Pythonのパス
const PYTHON_PATH = "C:\\Users\\LoiJ6\\anaconda3\\python.exe";

// 背景除去スクリプトのパス
const REMOVE_BG_SCRIPT = path.join(__dirname, "tools", "remove_bg.py");

// publicフォルダを公開
app.use(express.static("public"));

// uploadsフォルダを用意
const uploadDir = path.join(__dirname, "public", "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// アップロード設定
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueName + ext);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("画像ファイルだけアップロードできます"));
    }
  }
});

// Pythonで背景除去する関数
function removeBackground(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    execFile(
      PYTHON_PATH,
      [REMOVE_BG_SCRIPT, inputPath, outputPath],
      { encoding: "utf8" },
      (error, stdout, stderr) => {
        console.log("Python stdout:", stdout);

        if (stderr) {
          console.log("Python stderr:", stderr);
        }

        if (error) {
          reject(error);
          return;
        }

        if (!fs.existsSync(outputPath)) {
          reject(new Error("背景除去後の画像が作成されていません"));
          return;
        }

        resolve();
      }
    );
  });
}

// 画像アップロードAPI
app.post("/upload", upload.single("characterImage"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "画像ファイルがありません"
    });
  }

  try {
    const originalName = req.file.originalname;

    // アップロードされた元画像の実体パス
    const inputPath = req.file.path;

    // 背景除去後のファイル名
    const parsed = path.parse(req.file.filename);
    const cutFileName = parsed.name + "_cut.png";

    // 背景除去後の実体パス
    const outputPath = path.join(uploadDir, cutFileName);

    console.log("元画像:", inputPath);
    console.log("背景除去後:", outputPath);

    // Pythonで背景除去
    await removeBackground(inputPath, outputPath);

    // ブラウザから見えるパス
    const imagePath = "uploads/" + cutFileName;

    console.log("画像アップロード完了:", imagePath);
    console.log("元ファイル名:", originalName);

    res.json({
      success: true,
      imagePath: imagePath,
      originalName: originalName
    });
  } catch (error) {
    console.error("背景除去エラー:", error);

    res.status(500).json({
      success: false,
      message: "背景除去に失敗しました"
    });
  }
});

// Socket.IO通信
io.on("connection", (socket) => {
  console.log("接続されました:", socket.id);

  // 新しく接続した大画面に、現在のキャラ一覧を送る
  socket.emit("syncCharacters", characterHistory);

  socket.on("addCharacter", (data) => {
    console.log("キャラ追加:", data);

    // サーバー側に履歴として保存
    characterHistory.push(data);

    // 最大数を超えたら古いキャラから消す
    while (characterHistory.length > MAX_CHARACTERS) {
      characterHistory.shift();
    }

    // 接続中の全画面へ送信
    io.emit("newCharacter", data);
  });

  socket.on("resetCharacters", () => {
    console.log("全キャラ削除");

    characterHistory.length = 0;

    io.emit("clearCharacters");
  });
});

server.listen(port, () => {
  console.log(`サーバー起動中: http://localhost:${port}`);
});