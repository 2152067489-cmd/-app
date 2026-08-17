#!/usr/bin/env python3
"""Remove white background from Samoyed dog images and save as transparent PNG."""
from PIL import Image, ImageFilter
import os
import numpy as np

ASSETS_DIR = "/Users/heyilong/Library/Application Support/TRAE SOLO CN/ModularData/ai-agent/work-mode-projects/6a81a4cb997772d8c66401cc/pet-assets"

def remove_white_bg(input_path, output_path):
    img = Image.open(input_path).convert("RGBA")
    data = np.array(img, dtype=np.float64)
    h, w = data.shape[:2]
    
    r, g, b = data[:,:,0], data[:,:,1], data[:,:,2]
    
    # Calculate how "white" each pixel is
    # Distance from pure white (255,255,255) - max of channel differences
    max_diff = np.maximum(255 - r, np.maximum(255 - g, 255 - b))
    
    # Brightness and saturation for detecting shadows
    brightness = (r + g + b) / 3.0
    max_c = np.maximum(np.maximum(r, g), b)
    min_c = np.minimum(np.minimum(r, g), b)
    saturation = np.where(max_c > 5, (max_c - min_c) / max_c, 0)
    
    # Flood fill from edges to find connected background
    from collections import deque
    visited = np.zeros((h, w), dtype=bool)
    bg_mask = np.zeros((h, w), dtype=bool)
    queue = deque()
    
    # Seed from edges: pixels very close to white, or gray shadows near edges
    def is_bg_pixel(y, x):
        md = max_diff[y, x]
        br = brightness[y, x]
        sat = saturation[y, x]
        # Very white pixels
        if md < 8:
            return True
        # Bright gray shadows near white (high brightness, very low saturation)
        if br > 230 and sat < 0.02 and md < 20:
            return True
        # Bottom shadow area (ground shadow)
        if y > h * 0.85 and br > 200 and sat < 0.03 and md < 40:
            return True
        return False
    
    def is_bg_connected(y, x):
        md = max_diff[y, x]
        br = brightness[y, x]
        sat = saturation[y, x]
        if md < 15:
            return True
        if br > 220 and sat < 0.025 and md < 30:
            return True
        if y > h * 0.8 and br > 190 and sat < 0.03 and md < 50:
            return True
        return False
    
    # Add edge seed points
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
    
    # Create soft alpha channel
    # Start with hard mask
    alpha = np.where(bg_mask, 0, 255).astype(np.float64)
    
    # Simple soft edge: dilate bg mask and create gradient
    # Use multiple passes of averaging for smooth edges
    alpha_img = Image.fromarray(alpha.astype(np.uint8), mode='L')
    # Apply slight gaussian blur for soft edges
    alpha_img = alpha_img.filter(ImageFilter.GaussianBlur(radius=1.5))
    alpha = np.array(alpha_img, dtype=np.float64)
    
    # Make sure core foreground is fully opaque
    alpha[~bg_mask & (max_diff > 20)] = 255
    
    # Apply alpha
    result_data = data.copy().astype(np.uint8)
    result_data[:,:,3] = alpha.astype(np.uint8)
    
    result = Image.fromarray(result_data)
    
    # Auto-crop transparent borders to save space
    bbox = result.getbbox()
    if bbox:
        result = result.crop(bbox)
    
    result.save(output_path, "PNG", optimize=True)
    print(f"Saved: {output_path} (size: {result.size})")

# Process all 4 stages
for i in range(4):
    inp = os.path.join(ASSETS_DIR, f"samoyed-stage{i}.jpg")
    out = os.path.join(ASSETS_DIR, f"samoyed-stage{i}.png")
    if os.path.exists(inp):
        remove_white_bg(inp, out)
    else:
        print(f"Missing: {inp}")

print("All done!")
