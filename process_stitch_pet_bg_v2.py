#!/usr/bin/env python3
"""
改进版：批量去除史迪奇桌宠JPG白色背景 -> 透明PNG
关键改进：
  1) 阈值更激进（220），白色/近白色完全抠除
  2) 采样所有边界像素作为洪水种子，避免孤岛
  3) 使用 scipy.ndimage 进行形态学操作：closing+fill_holes，让抠图更锐利
  4) 对alpha做高斯模糊柔和边缘，再用对比度拉伸强化边缘
  5) 最后再用"硬白"检查：任何距离白色<=235的像素强制归零
"""
from PIL import Image
import numpy as np
from collections import deque
import os, sys

try:
    from scipy import ndimage
    HAS_SCIPY = True
except ImportError:
    HAS_SCIPY = False

ASSETS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "stitch-assets")
FILES = [f"stitch_{i}" for i in range(1, 11)] + ["stitch_wink"]


def remove_white_bg_v2(img: Image.Image) -> Image.Image:
    w, h = img.size
    arr = np.array(img.convert("RGB"), dtype=np.float32)
    # 计算每个像素到纯白(255,255,255)的欧氏距离
    dist = np.sqrt(((arr - 255.0) ** 2).sum(axis=-1))

    # ---- 第1阶段：基于距离的初始alpha ----
    # thr0 以下完全透明（白色），thr1 以上完全不透明
    # 中间线性过渡
    HARD_CUT = 220.0   # <= 此值完全透明
    FULL_KEEP = 270.0  # >= 此值完全不透明
    # 过渡带
    alpha = np.clip(
        (dist - HARD_CUT) * (255.0 / max(1e-6, FULL_KEEP - HARD_CUT)),
        0, 255
    ).astype(np.float32)

    # 先把白色硬切干净
    hard_white_mask = dist < 215.0  # 纯白区域
    alpha[hard_white_mask] = 0

    # ---- 第2阶段：洪水填充，从每条边的所有像素作为种子，把与边连通的近白色区域透明化 ----
    threshold_seed = 230.0  # 作为洪水种子的阈值
    bin_seed = dist < threshold_seed

    visited = np.zeros((h, w), dtype=bool)
    q = deque()

    # 采样所有边界像素
    step = max(1, w // 40)  # 沿边采样间隔
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

    # BFS：任何距离阈值内的白色都会被传播并置零
    while q:
        x, y = q.popleft()
        alpha[y, x] = 0.0
        # 对8邻域进行检查（更平滑的传播）
        for nx, ny in ((x+1, y), (x-1, y), (x, y+1), (x, y-1),
                       (x+1, y+1), (x+1, y-1), (x-1, y+1), (x-1, y-1)):
            if 0 <= nx < w and 0 <= ny < h and not visited[ny, nx] and bin_seed[ny, nx]:
                visited[ny, nx] = True
                q.append((nx, ny))

    # 洪水传播后，再做一次"硬白"扫描：所有距离<225的像素强制透明
    hard_final = dist < 225.0
    alpha[hard_final] = 0

    # ---- 第3阶段：形态学优化 ----
    if HAS_SCIPY:
        # 把低alpha区域（<15）当作"背景"做填充孔，使前景内部的小白点被填充
        bg_mask = alpha < 15.0
        filled = ndimage.binary_fill_holes(~bg_mask)  # 反转：前景=True, 填充小孔
        # 形态学 closing 连接断裂的前景
        struct = ndimage.generate_binary_structure(2, 2)
        closed = ndimage.binary_closing(filled, structure=struct, iterations=2)
        # 把封闭后的"前景"作为最终掩码
        alpha[~closed] = 0  # 不在前景区域的全部透明

        # 对alpha做轻度GaussianBlur 柔和锯齿边缘
        alpha = ndimage.gaussian_filter(alpha, sigma=1.2)

        # 再次对比度拉伸：把低alpha区域压低
        low = alpha < 20.0
        alpha[low] = 0

    # ---- 第4阶段：边界区域的精细过渡 ----
    # 对剩余的alpha做最后的对比度增强
    alpha = np.clip(alpha * 1.15, 0, 255)
    alpha = np.clip(alpha, 0, 255).astype(np.uint8)

    # 最终：把非常低的alpha归零，避免背景残留
    alpha[alpha < 12] = 0

    # ---- 合成RGBA ----
    result = np.zeros((h, w, 4), dtype=np.uint8)
    result[:, :, :3] = np.array(img.convert("RGB"))
    result[:, :, 3] = alpha
    return Image.fromarray(result, mode="RGBA")


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
