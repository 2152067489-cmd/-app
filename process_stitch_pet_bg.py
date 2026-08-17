#!/usr/bin/env python3
"""批量去除史迪奇桌宠11张JPG图片的白色背景，转透明PNG。"""
from PIL import Image
import numpy as np
import os, sys

ASSETS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "stitch-assets")
FILES = [f"stitch_{i}" for i in range(1, 11)] + ["stitch_wink"]


def remove_white_bg(img: Image.Image, threshold: int = 240) -> Image.Image:
    """漫水填充 + 颜色距离去除白色背景，并做柔和边缘过渡。"""
    img = img.convert("RGBA")
    w, h = img.size
    data = np.array(img)
    rgb = data[:, :, :3].astype(np.int32)

    # 距白色的欧氏距离
    dist = np.sqrt(((rgb - 255) ** 2).sum(axis=-1))
    # alpha: 距离<=thr0 -> 0, 距离>=thr1 -> 255, 中间线性过渡
    thr0, thr1 = threshold - 18, threshold + 40
    alpha = np.clip((dist - thr0) * (255.0 / max(1, (thr1 - thr0))), 0, 255).astype(np.uint8)

    # 从四条边做漫水填充，把与白边连通的区域强制透明
    mask = np.zeros((h + 2, w + 2), dtype=np.uint8)
    seed_pts = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1),
                (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)]
    # PIL自带floodfill太慢，这里基于距离二值化后直接用scipy ndimage未引入，改用简单BFS
    binary_edge = (dist < (threshold - 5)).astype(np.uint8)
    visited = np.zeros_like(binary_edge, dtype=bool)
    from collections import deque
    q = deque()
    for x, y in seed_pts:
        if binary_edge[y, x] == 1 and not visited[y, x]:
            q.append((x, y))
            visited[y, x] = True
    while q:
        x, y = q.popleft()
        alpha[y, x] = 0
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not visited[ny, nx] and binary_edge[ny, nx] == 1:
                visited[ny, nx] = True
                q.append((nx, ny))

    data[:, :, 3] = alpha
    return Image.fromarray(data, mode="RGBA")


def main():
    os.makedirs(ASSETS_DIR, exist_ok=True)
    ok, miss = 0, []
    for name in FILES:
        src = os.path.join(ASSETS_DIR, name + ".jpg")
        dst = os.path.join(ASSETS_DIR, name + ".png")
        if not os.path.exists(src):
            miss.append(src)
            continue
        try:
            with Image.open(src) as im:
                out = remove_white_bg(im)
                out.save(dst, "PNG", optimize=True)
            print(f"OK  {name}: {os.path.basename(src)} -> {os.path.basename(dst)}  ({out.size[0]}x{out.size[1]})")
            ok += 1
        except Exception as e:
            print(f"ERR {name}: {e}", file=sys.stderr)
    print(f"\n完成：成功 {ok} 张，缺失 {len(miss)} 张")
    if miss:
        print("缺失源文件：")
        for p in miss:
            print("  -", p)


if __name__ == "__main__":
    main()
