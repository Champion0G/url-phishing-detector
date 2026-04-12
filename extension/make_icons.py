#!/usr/bin/env python3
"""Resize generated icons and place them in the extension/icons directory."""
import os
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow"])
    from PIL import Image

SIZES = [16, 48, 128]

ICONS = {
    "safe": r"C:\Users\ayush\.gemini\antigravity\brain\743964c1-2094-4064-a478-361dac36762f\icon_safe_1775984282373.png",
    "danger": r"C:\Users\ayush\.gemini\antigravity\brain\743964c1-2094-4064-a478-361dac36762f\icon_danger_1775984299972.png",
    "checking": r"C:\Users\ayush\.gemini\antigravity\brain\743964c1-2094-4064-a478-361dac36762f\icon_checking_1775984321616.png",
}

out_dir = Path(r"C:\Users\ayush\.gemini\antigravity\scratch\extension\icons")
out_dir.mkdir(parents=True, exist_ok=True)

for state, src_path in ICONS.items():
    img = Image.open(src_path).convert("RGBA")
    for size in SIZES:
        resized = img.resize((size, size), Image.LANCZOS)
        out_path = out_dir / f"icon-{state}-{size}.png"
        resized.save(str(out_path), "PNG")
        print(f"Saved: {out_path}")

print("\nAll icons resized and saved to extension/icons/")
