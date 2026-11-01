import fitz
from PIL import Image, ImageDraw, ImageFont
import os

os.makedirs('client/public/images', exist_ok=True)

# 1. Generate 96x96 monochrome badge-96.png
glyph_svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <mask id="cutout">
      <rect width="512" height="512" fill="#fff" />
      <circle cx="353" cy="170" r="12" fill="#000" />
      <circle cx="287" cy="256" r="12" fill="#000" />
      <circle cx="353" cy="342" r="12" fill="#000" />
    </mask>
  </defs>
  <path fill="#ffffff" mask="url(#cutout)" d="M128 155c0-18 15-33 33-33h190c18 0 33 15 33 33v30c0 18-15 33-33 33H161c-18 0-33-15-33-33v-30Zm0 86c0-18 15-33 33-33h124c18 0 33 15 33 33v30c0 18-15 33-33 33H161c-18 0-33-15-33-33v-30Zm0 86c0-18 15-33 33-33h190c18 0 33 15 33 33v30c0 18-15 33-33 33H161c-18 0-33-15-33-33v-30Z"/>
</svg>'''

doc = fitz.open('svg', glyph_svg.encode('utf-8'))
page = doc[0]
pix = page.get_pixmap(matrix=fitz.Matrix(512 / page.rect.width, 512 / page.rect.height), alpha=True)
img = Image.frombytes('RGBA', [pix.width, pix.height], pix.samples)

bbox = img.getbbox()
cropped = img.crop(bbox)

# 96x96 transparent canvas
canvas = Image.new('RGBA', (96, 96), (0, 0, 0, 0))
target_size = 72
ratio = min(target_size / cropped.width, target_size / cropped.height)
new_w = int(cropped.width * ratio)
new_h = int(cropped.height * ratio)
resized = cropped.resize((new_w, new_h), Image.Resampling.LANCZOS)

# Ensure every visible pixel is pure white #FFFFFF with preserved alpha channel
r, g, b, a = resized.split()
white_img = Image.new('RGB', (new_w, new_h), (255, 255, 255))
resized = Image.merge('RGBA', (white_img.split()[0], white_img.split()[1], white_img.split()[2], a))

offset_x = (96 - new_w) // 2
offset_y = (96 - new_h) // 2
canvas.paste(resized, (offset_x, offset_y), resized)

canvas.save('client/public/badge-96.png', format='PNG')
print('Generated client/public/badge-96.png (96x96 monochrome, alpha-only)')

# 2. Generate 1200x600 2:1 branded fallback banner
# Deep tech navy background with subtle gradient and modern typographic brand identity
banner = Image.new('RGB', (1200, 600), (10, 15, 30))
draw = ImageDraw.Draw(banner)

# Soft gradient / glow
for i in range(300):
    alpha = int(25 * (1 - i / 300))
    radius = 350 + i
    draw.ellipse([600 - radius, 300 - radius // 2, 600 + radius, 300 + radius // 2], outline=(20 + i // 10, 40 + i // 8, 90 + i // 4))

# Paste Bytes blue rounded mark
mark_svg = open('client/public/bytes-logo.svg', 'rb').read()
doc_mark = fitz.open('svg', mark_svg)
pix_mark = doc_mark[0].get_pixmap(matrix=fitz.Matrix(160 / doc_mark[0].rect.width, 160 / doc_mark[0].rect.height), alpha=True)
mark_img = Image.frombytes('RGBA', [pix_mark.width, pix_mark.height], pix_mark.samples)
banner.paste(mark_img, (520, 120), mark_img)

# Fallback basic drawing for title & tagline
# We use standard default font or draw clean lines
try:
    font_title = ImageFont.truetype('arial.ttf', 54)
    font_sub = ImageFont.truetype('arial.ttf', 26)
except Exception:
    font_title = ImageFont.load_default()
    font_sub = ImageFont.load_default()

title_text = "AURIKREX BYTES"
sub_text = "Daily High-Signal Tech Briefings · 8:00 AM & 10:00 PM"

# Center title
t_bbox = draw.textbbox((0, 0), title_text, font=font_title)
t_w = t_bbox[2] - t_bbox[0]
draw.text(((1200 - t_w) // 2, 330), title_text, fill=(255, 255, 255), font=font_title)

# Center sub
s_bbox = draw.textbbox((0, 0), sub_text, font=font_sub)
s_w = s_bbox[2] - s_bbox[0]
draw.text(((1200 - s_w) // 2, 410), sub_text, fill=(156, 163, 175), font=font_sub)

banner.save('client/public/images/briefing-banner-2x1.png', format='PNG')
print('Generated client/public/images/briefing-banner-2x1.png (1200x600 2:1)')
