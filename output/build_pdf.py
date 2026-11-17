"""Combine slide screenshots in output/slides (named NN.ext) into one 16:9 PDF."""
import os, sys
from PIL import Image
here = os.path.dirname(os.path.abspath(__file__))
src = os.path.join(here, 'slides')
W, H = 1920, 1080
pages = []
for f in sorted(os.listdir(src)):
    im = Image.open(os.path.join(src, f)).convert('RGB')
    bg = Image.new('RGB', (W, H), im.getpixel((5, 5)))
    s = min(W / im.width, H / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    bg.paste(im, ((W - im.width) // 2, (H - im.height) // 2))
    pages.append(bg)
    print(f)
out = os.path.join(here, 'ginza_hachi_proposal.pdf')
pages[0].save(out, save_all=True, append_images=pages[1:], resolution=150)
print(out, len(pages), 'pages')
