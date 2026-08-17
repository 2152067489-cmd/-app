#!/usr/bin/env python3
"""批量去除签到相关图片的白色背景，转透明PNG。"""
from PIL import Image
import numpy as np
from collections import deque
import os, sys

try:
    from scipy import ndimage
    HAS_SCIPY = True
except ImportError:
    HAS_SCIPY = False

ASSETS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sign-assets")
# 处理跳舞动画帧
DANCE_FILES = [f"stitch_dance_{i}" for i in range(1, 6)]
# 处理签到史迪奇
SIGN_FILES = ["stitch_sign"]
# 处理勋章图片
MEDAL_FILES = [f"medal_{i}" for i in range(1, 11)]

ALL_FILES = DANCE_FILES + SIGN_FILES + MEDAL_FILES


def remove_white_bg_v2(img: Image.Image) -> Image.Image:
    w, h = img.size
    arr = np.array(img.convert("RGB"), dtype=np.float32)
    dist = np.sqrt(((arr - 255.0) ** 2).sum(axis=-1))

    HARD_CUT = 220.0
    FULL_KEEP = 270.0
    alpha = np.clip(
        (dist - HARD_CUT) * (255.0 / max(1e-6, FULL_KEEP - HARD_CUT)),
        0, 255
    ).astype(np.float32)

    hard_white_mask = dist < 215.0
    alpha[hard_white_mask] = 0

    threshold_seed = 230.0
    bin_seed = dist < threshold_seed
    visited = np.zeros((h, w), dtype=bool)
    q = deque()

    step = max(1, w // 40)
    for x in range(0, w, step):
        if bin_seed[0, x]:
            q.append((x, 0)); visited[0, x] = True
        if bin_seed[h - 1, x]:
            q.append((x, h - 1)); visited[h - 1, x] = True
    for y in range(0, h, step):
        if bin_seed[y, 0]:
            q.append((0, y)); visited[y, 0] = True
        if bin_seed[y, w - 1]:
            q.append((w - 1, y)); visited[y, w - 1] = True

    while q:
        x, y = q.popleft()
        alpha[y, x] = 0.0
        for nx, ny in ((x+1, y), (x-1, y), (x, y+1), (x, y-1),
                       (x+1, y+1), (x+1, y-1), (x-1, y+1), (x-1, y-1)):
            if 0 <= nx < w and 0 <= ny < h and not visited[ny, nx] and bin_seed[ny, nx]:
                visited[ny, nx] = True
                q.append((nx, ny))

    hard_final = dist < 225.0
    alpha[hard_final] = 0

    if HAS_SCIPY:
        bg_mask = alpha < 15.0
        filled = ndimage.binary_fill_holes(~bg_mask)
        struct = ndimage.generate_binary_structure(2, 2)
        closed = ndimage.binary_closing(filled, structure=struct, iterations=2)
        alpha[~closed] = 0
        alpha = ndimage.gaussian_filter(alpha, sigma=1.2)
        low = alpha < 20.0
        alpha[low] = 0

    alpha = np.clip(alpha * 1.15, 0, 255)
    alpha = np.clip(alpha, 0, 255).astype(np.uint8)
    alpha[alpha < 12] = 0

    result = np.zeros((h, w, 4), dtype=np.uint8)
    result[:, :, :3] = np.array(img.convert("RGB"))
    result[:, :, 3] = alpha
    return Image.fromarray(result, mode="RGBA")


def main():
    os.makedirs(ASSETS_DIR, exist_ok=True)
    ok, miss = 0, []
    for name in ALL_FILES:
        src = os.path.join(ASSETS_DIR, name + ".jpg")
        dst = os.path.join(ASSETS_DIR, name + ".png")
        if not os.path.exists(src):
            miss.append(src)
            continue
        try:
            with Image.open(src) as im:
                out = remove_white_bg_v2(im)
                out.save(dst, "PNG", optimize=True)
            print(f"OK  {name}: {os.path.basename(src)} -> {os.path.basename(dst)}  ({out.size[0]}x{out.size[1]})")
            ok += 1
        except Exception as e:
            import traceback; traceback.print_exc()
            print(f"ERR {name}: {e}", file=sys.stderr)
    print(f"\n完成：成功 {ok} 张，缺失 {len(miss)} 张")
    if miss:
        print("缺失源文件：")
        for p in miss:
            print("  -", p)


if __name__ == "__main__":
    main()
