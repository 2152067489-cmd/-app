#!/usr/bin/env python3
"""Remove white background from all 10 Stitch pose images and save as transparent PNG."""
from PIL import Image, ImageFilter
import os
import numpy as np

STITCH_DIR = "/Users/heyilong/Library/Application Support/TRAE SOLO CN/ModularData/ai-agent/work-mode-projects/6a81a4cb997772d8c66401cc/stitch-assets"

STITCH_FILES = [
    ("stitch-pose-01-waving.jpg", "stitch-pose-01-waving.png"),
    ("stitch-pose-02-running.jpg", "stitch-pose-02-running.png"),
    ("stitch-pose-03-sitting-curious.jpg", "stitch-pose-03-sitting-curious.png"),
    ("stitch-pose-04-rolling-lazy.jpg", "stitch-pose-04-rolling-lazy.png"),
    ("stitch-pose-05-hands-on-cheeks.jpg", "stitch-pose-05-hands-on-cheeks.png"),
    ("stitch-pose-06-hands-on-hips-proud.jpg", "stitch-pose-06-hands-on-hips-proud.png"),
    ("stitch-pose-07-arms-crossed-angry.jpg", "stitch-pose-07-arms-crossed-angry.png"),
    ("stitch-pose-08-spinning-dancing.jpg", "stitch-pose-08-spinning-dancing.png"),
    ("stitch-pose-09-thinking-chin-rest.jpg", "stitch-pose-09-thinking-chin-rest.png"),
    ("stitch-pose-10-finger-heart-cute.jpg", "stitch-pose-10-finger-heart-cute.png"),
]

def remove_white_bg(input_path, output_path):
    img = Image.open(input_path).convert("RGBA")
    data = np.array(img, dtype=np.float64)
    h, w = data.shape[:2]
    
    r, g, b = data[:,:,0], data[:,:,1], data[:,:,2]
    
    # Calculate how "white" each pixel is
    max_diff = np.maximum(255 - r, np.maximum(255 - g, 255 - b))
    
    brightness = (r + g + b) / 3.0
    max_c = np.maximum(np.maximum(r, g), b)
    min_c = np.minimum(np.minimum(r, g), b)
    saturation = np.where(max_c > 5, (max_c - min_c) / max_c, 0)
    
    # Flood fill from edges to find connected background
    from collections import deque
    visited = np.zeros((h, w), dtype=bool)
    bg_mask = np.zeros((h, w), dtype=bool)
    queue = deque()
    
    def is_bg_pixel(y, x):
        md = max_diff[y, x]
        br = brightness[y, x]
        sat = saturation[y, x]
        # Very white pixels (stricter for seeds)
        if md < 10:
            return True
        # Bright near-white with very low saturation
        if br > 235 and sat < 0.03 and md < 25:
            return True
        return False
    
    def is_bg_connected(y, x):
        md = max_diff[y, x]
        br = brightness[y, x]
        sat = saturation[y, x]
        if md < 18:
            return True
        if br > 225 and sat < 0.04 and md < 35:
            return True
        if br > 200 and sat < 0.05 and md < 55:
            return True
        return False
    
    # Add edge seed points - all 4 edges
    for x in range(w):
        for y in [0, h-1]:
            if is_bg_pixel(y, x) and not visited[y, x]:
                queue.append((y, x))
                visited[y, x] = True
    for y in range(h):
        for x in [0, w-1]:
            if is_bg_pixel(y, x) and not visited[y, x]:
                queue.append((y, x))
                visited[y, x] = True
    
    # Also seed from a few interior points near edges to catch shadow regions
    for y_off in [h//8, h//4, 3*h//4, 7*h//8]:
        for x_off in [w//16, 15*w//16]:
            if is_bg_pixel(y_off, x_off) and not visited[y_off, x_off]:
                queue.append((y_off, x_off))
                visited[y_off, x_off] = True
    
    # BFS flood fill
    while queue:
        y, x = queue.popleft()
        bg_mask[y, x] = True
        for dy, dx in [(-1,0),(1,0),(0,-1),(0,1)]:
            ny, nx = y+dy, x+dx
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx]:
                if is_bg_connected(ny, nx):
                    visited[ny, nx] = True
                    queue.append((ny, nx))
    
    # Create alpha channel with soft edges
    alpha = np.where(bg_mask, 0, 255).astype(np.float64)
    
    alpha_img = Image.fromarray(alpha.astype(np.uint8), mode='L')
    alpha_img = alpha_img.filter(ImageFilter.GaussianBlur(radius=1.2))
    alpha = np.array(alpha_img, dtype=np.float64)
    
    # Ensure core foreground is fully opaque (stitch blue pixels)
    # Stitch is blue, so low red, medium-high green/blue -> check for non-white pixels
    alpha[(max_diff > 25)] = 255
    
    # Apply alpha
    result_data = data.copy().astype(np.uint8)
    result_data[:,:,3] = alpha.astype(np.uint8)
    
    result = Image.fromarray(result_data)
    
    # Auto-crop transparent borders
    bbox = result.getbbox()
    if bbox:
        result = result.crop(bbox)
    
    result.save(output_path, "PNG", optimize=True)
    size_kb = os.path.getsize(output_path) / 1024
    print(f"OK: {os.path.basename(input_path)} -> {os.path.basename(output_path)}  dims:{result.size}  {size_kb:.0f}KB")

# Process all 10 poses
success = 0
for jpg_name, png_name in STITCH_FILES:
    inp = os.path.join(STITCH_DIR, jpg_name)
    out = os.path.join(STITCH_DIR, png_name)
    if os.path.exists(inp):
        try:
            remove_white_bg(inp, out)
            success += 1
        except Exception as e:
            print(f"FAIL: {jpg_name}: {e}")
    else:
        print(f"MISSING: {inp}")

print(f"\nAll done! Processed {success}/10 stitch poses.")
