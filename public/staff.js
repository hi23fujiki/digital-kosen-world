console.log("staff.js が読み込まれました");

const socket = io();

let characterNumber = 0;

// 背景除去後の画像情報を保存しておく
let processedImagePath = "";
let originalFileName = "";

socket.on("connect", () => {
  console.log("受付画面がサーバーに接続しました:", socket.id);
});

const imageInput = document.getElementById("imageFile");
const imagePreview = document.getElementById("imagePreview");
const noPreviewText = document.getElementById("noPreviewText");
const statusMessage = document.getElementById("statusMessage");

// 画像が選ばれたら、自動でアップロード＆背景除去してプレビュー表示
if (imageInput) {
  imageInput.addEventListener("change", async () => {
    const file = imageInput.files[0];

    if (!file) {
      clearPreview();
      processedImagePath = "";
      originalFileName = "";
      setStatus("画像が選択されていません", "normal");
      disableMotionButtons(true);
      return;
    }

    await uploadAndPreview(file);
  });
}

// 画像アップロード → 背景除去 → プレビュー表示
async function uploadAndPreview(file) {
  const formData = new FormData();
  formData.append("characterImage", file);

  try {
    processedImagePath = "";
    originalFileName = "";

    clearPreview();
    disableMotionButtons(true);
    setStatus("背景除去中です...", "loading");

    const response = await fetch("/upload", {
      method: "POST",
      body: formData
    });

    const result = await response.json();

    if (!result.success) {
      setStatus("背景除去に失敗しました。画像を撮り直してください。", "error");
      alert("背景除去に失敗しました。画像を撮り直してください。");
      return;
    }

    processedImagePath = result.imagePath;
    originalFileName = result.originalName;

    console.log("背景除去後画像:", processedImagePath);
    console.log("元ファイル名:", originalFileName);

    imagePreview.src = processedImagePath + "?t=" + Date.now();
    imagePreview.style.display = "block";
    noPreviewText.style.display = "none";

    setStatus("プレビューを確認してください。問題なければ動きを選んで送信できます。", "success");
    disableMotionButtons(false);
  } catch (error) {
    console.error("背景除去エラー:", error);
    setStatus("背景除去中にエラーが起きました。画像を撮り直してください。", "error");
    alert("背景除去中にエラーが起きました。画像を撮り直してください。");
    disableMotionButtons(true);
  }
}

// プレビューを消す
function clearPreview() {
  if (imagePreview) {
    imagePreview.src = "";
    imagePreview.style.display = "none";
  }

  if (noPreviewText) {
    noPreviewText.style.display = "block";
  }
}

// 状態表示を変更
function setStatus(message, type) {
  if (!statusMessage) {
    return;
  }

  statusMessage.textContent = message;

  statusMessage.classList.remove(
    "status-normal",
    "status-loading",
    "status-success",
    "status-error"
  );

  if (type === "loading") {
    statusMessage.classList.add("status-loading");
  } else if (type === "success") {
    statusMessage.classList.add("status-success");
  } else if (type === "error") {
    statusMessage.classList.add("status-error");
  } else {
    statusMessage.classList.add("status-normal");
  }
}

// 動きボタンだけ有効・無効を切り替える
function disableMotionButtons(disabled) {
  const buttons = document.querySelectorAll(".motion-button");

  buttons.forEach((button) => {
    button.disabled = disabled;
  });
}

// 全ボタンの有効・無効を切り替える
function disableAllButtons(disabled) {
  const buttons = document.querySelectorAll("button");

  buttons.forEach((button) => {
    button.disabled = disabled;
  });
}

// 動きを選んで大画面へ送信
function sendCharacter(motion) {
  console.log("動き送信:", motion);

  if (!processedImagePath) {
    alert("先に画像を選んで、背景除去後プレビューを確認してください。");
    setStatus("先に画像を選んでください", "error");
    return;
  }

  const nameInput = document.getElementById("characterName");
  const schoolSelect = document.getElementById("schoolName");
  const imageInput = document.getElementById("imageFile");

  characterNumber++;

  const inputName = nameInput.value.trim();
  const characterName = inputName || `キャラ${characterNumber}`;
  const schoolName = schoolSelect ? schoolSelect.value : "";

  const data = {
    name: characterName,
    schoolName: schoolName,
    motion: motion,
    image: processedImagePath,
    fileName: originalFileName,
    color: randomColor()
  };

  console.log("受付から送信:", data);

  socket.emit("addCharacter", data);

  alert(`${data.name} を送信しました！`);

  // 送信完了後、次の来場者用にフォームをリセット
  resetFormAfterSend();

  setStatus("送信完了。次の画像を選んでください。", "success");
}

// 送信完了後の受付画面リセット
function resetFormAfterSend() {
  const nameInput = document.getElementById("characterName");
  const imageInput = document.getElementById("imageFile");

  if (nameInput) {
    nameInput.value = "";
  }

  if (imageInput) {
    imageInput.value = "";
  }

  processedImagePath = "";
  originalFileName = "";

  clearPreview();
  disableMotionButtons(true);
}

// 大画面の全キャラ削除
function resetCharacters() {
  const result = confirm("大画面のキャラクターをすべて消しますか？");

  if (result) {
    console.log("リセット送信");
    socket.emit("resetCharacters");
    setStatus("全キャラ削除を送信しました", "success");
  }
}

// ランダム色
function randomColor() {
  const colors = ["red", "blue", "green", "orange", "purple", "pink"];
  const index = Math.floor(Math.random() * colors.length);
  return colors[index];
}

// 最初は動きボタンを無効化
disableMotionButtons(true);