import os
from PIL import Image, ImageDraw

def create_icon(size):
    # Brand colors: Dark slate background with vibrant brand lime/emerald seo-studio
    img = Image.new("RGBA", (size, size), (15, 23, 42, 255)) # slate-900
    draw = ImageDraw.Draw(img)
    
    # Outer rounded rect border or circle
    margin = max(1, int(size * 0.08))
    center = size / 2
    r_outer = (size - 2 * margin) / 2
    
    # Draw glowing accent circle
    draw.ellipse(
        [center - r_outer, center - r_outer, center + r_outer, center + r_outer],
        fill=(30, 41, 59, 255), # slate-800
        outline=(16, 185, 129, 255), # emerald-500
        width=max(1, int(size * 0.06))
    )
    
    # Inner vibrant brand badge
    r_inner = r_outer * 0.65
    draw.ellipse(
        [center - r_inner, center - r_inner, center + r_inner, center + r_inner],
        fill=(16, 185, 129, 255) # emerald-500
    )
    
    # Center dot / radar aperture
    r_center = r_inner * 0.4
    draw.ellipse(
        [center - r_center, center - r_center, center + r_center, center + r_center],
        fill=(255, 255, 255, 255) # white
    )
    
    return img

os.makedirs("chrome-extension/public/icons", exist_ok=True)
for s in [16, 32, 48, 128]:
    icon = create_icon(s)
    icon.save(f"chrome-extension/public/icons/icon{s}.png")
    print(f"Generated chrome-extension/public/icons/icon{s}.png")
