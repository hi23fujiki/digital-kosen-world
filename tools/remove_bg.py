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

    if not os.path.exists(input_path):
        print("エラー: 入力画像が存在しません")
        sys.exit(1)

    image = read_image_unicode(input_path)

    if image is None:
        print("エラー: 画像を読み込めませんでした")
        sys.exit(1)

    print("画像サイズ:", image.shape)

    # 少しぼかしてノイズを減らす
    blurred = cv2.GaussianBlur(image, (5, 5), 0)

    # HSV色空間に変換
    hsv = cv2.cvtColor(blurred, cv2.COLOR_BGR2HSV)
    h, s, v = cv2.split(hsv)

    # 白っぽい背景を判定
    # 背景が残るなら s < 60, v > 160 などに調整
    # キャラまで消えるなら s < 25, v > 220 などに調整
    background_mask = (s < 45) & (v > 180)
    background_mask = background_mask.astype(np.uint8) * 255

    # ノイズ除去
    kernel = np.ones((3, 3), np.uint8)

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

    # RGBA画像に変換
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    image_rgba = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2RGBA)

    # 背景を透明化
    image_rgba[background_mask == 255, 3] = 0
    image_rgba[background_mask == 0, 3] = 255

    # 透明でない部分だけをトリミング
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
        print("トリミング後サイズ:", image_rgba.shape)
    else:
        print("エラー: キャラ部分が見つかりませんでした")
        sys.exit(1)

    # 出力先フォルダ作成
    output_dir = os.path.dirname(output_path)

    if output_dir:
        os.makedirs(output_dir, exist_ok=True)

    # RGBAからBGRAへ変換して保存
    output_bgra = cv2.cvtColor(image_rgba, cv2.COLOR_RGBA2BGRA)

    success = save_image_unicode(output_path, output_bgra)

    if success:
        print("背景除去完了:", output_path)
        sys.exit(0)
    else:
        print("エラー: 保存に失敗しました")
        sys.exit(1)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("使い方:")
        print('python tools/remove_bg.py "入力画像" "出力画像"')
        print("例:")
        print('python tools/remove_bg.py "public\\uploads\\test.jpg" "public\\uploads\\test_cut.png"')
        sys.exit(1)
    else:
        input_path = sys.argv[1]
        output_path = sys.argv[2]
        remove_white_background(input_path, output_path)