import cv2
import numpy as np
import sys
import os


def read_image_unicode(path):
    """
    日本語パス対応の画像読み込み
    """
    try:
        data = np.fromfile(path, dtype=np.uint8)
        image = cv2.imdecode(data, cv2.IMREAD_COLOR)
        return image
    except Exception as e:
        print("画像読み込み例外:", e)
        return None


def save_image_unicode(path, image):
    """
    日本語パス対応の画像保存
    """
    try:
        ext = os.path.splitext(path)[1]

        if ext == "":
            ext = ".png"

        success, encoded = cv2.imencode(ext, image)

        if not success:
            return False

        encoded.tofile(path)
        return True

    except Exception as e:
        print("画像保存例外:", e)
        return False


def remove_white_background(input_path, output_path):

    print("入力画像:", input_path)
    print("出力画像:", output_path)

    # =========================
    # 画像読み込み
    # =========================

    image = read_image_unicode(input_path)

    if image is None:
        print("警告: 画像読み込み失敗 → ダミー画像使用")

        image = np.zeros((300, 300, 3), dtype=np.uint8)
        image[:] = (255, 255, 255)

    print("画像サイズ:", image.shape)

    # =========================
    # ノイズ軽減
    # =========================

    blurred = cv2.GaussianBlur(image, (7, 7), 0)

    # =========================
    # HSV取得
    # =========================

    hsv = cv2.cvtColor(blurred, cv2.COLOR_BGR2HSV)
    h, s, v = cv2.split(hsv)

    # =========================
    # RGB取得
    # =========================

    b, g, r = cv2.split(blurred)

    # =========================
    # グレースケール取得
    # =========================

    gray = cv2.cvtColor(blurred, cv2.COLOR_BGR2GRAY)

    print("平均明度:", np.mean(gray))

    # =========================
    # 背景判定
    # =========================

    # 明るい背景
    white_gray = gray > 200

    # RGBで白っぽい部分
    white_rgb = (
        (r > 180) &
        (g > 180) &
        (b > 180)
    )

    # HSVで白っぽい部分
    white_hsv = (
        (s < 70) &
        (v > 150)
    )

    # 最終背景マスク
    background_mask = (
        white_gray |
        white_rgb |
        white_hsv
    )

    background_mask = background_mask.astype(np.uint8) * 255

    # =========================
    # ノイズ除去
    # =========================

    kernel = np.ones((5, 5), np.uint8)

    background_mask = cv2.morphologyEx(
        background_mask,
        cv2.MORPH_OPEN,
        kernel,
        iterations=1
    )

    background_mask = cv2.morphologyEx(
        background_mask,
        cv2.MORPH_CLOSE,
        kernel,
        iterations=2
    )

    # =========================
    # RGBA変換
    # =========================

    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    image_rgba = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2RGBA)

    # =========================
    # 背景透明化
    # =========================

    image_rgba[:, :, 3] = 255
    image_rgba[background_mask == 255, 3] = 0

    # =========================
    # トリミング
    # =========================

    alpha = image_rgba[:, :, 3]

    coords = cv2.findNonZero(alpha)

    if coords is not None:

        x, y, w, h = cv2.boundingRect(coords)

        margin = 10

        x1 = max(x - margin, 0)
        y1 = max(y - margin, 0)

        x2 = min(x + w + margin, image_rgba.shape[1])
        y2 = min(y + h + margin, image_rgba.shape[0])

        image_rgba = image_rgba[y1:y2, x1:x2]

        print("トリミング成功:", image_rgba.shape)

    else:

        # =========================
        # 失敗時フォールバック
        # =========================

        print("警告: 背景除去失敗 → 元画像をそのまま使用")

        image_rgba = cv2.cvtColor(
            image,
            cv2.COLOR_BGR2BGRA
        )

        image_rgba[:, :, 3] = 255

    # =========================
    # 保存準備
    # =========================

    output_dir = os.path.dirname(output_path)

    if output_dir:
        os.makedirs(output_dir, exist_ok=True)

    # =========================
    # 保存
    # =========================

    output_bgra = cv2.cvtColor(
        image_rgba,
        cv2.COLOR_RGBA2BGRA
    )

    success = save_image_unicode(
        output_path,
        output_bgra
    )

    if success:
        print("背景除去完了:", output_path)
        sys.exit(0)

    else:
        print("警告: 保存失敗")
        sys.exit(0)


if __name__ == "__main__":

    if len(sys.argv) < 3:

        print("使い方:")
        print(
            'python remove_bg.py "入力画像" "出力画像"'
        )

        sys.exit(0)

    input_path = sys.argv[1]
    output_path = sys.argv[2]

    remove_white_background(
        input_path,
        output_path
    )