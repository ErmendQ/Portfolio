"""Builds web-ready copies of the media in assets/ into assets/web/.

    py tools/optimize-media.py

Run it after adding or replacing a file in assets/. Originals are never touched;
outputs newer than their source are skipped. Needs ffmpeg on PATH and Pillow.

For every video NAME.mp4 (MP4 or an OBS .mkv renamed to .mp4):
    NAME-720.mp4   H.264 720p30, faststart  - inline players, phones
    NAME-1080.mp4  H.264 1080p60, faststart - desktop "big screen"
    NAME-{400,800,1600}.webp                - poster frame
For every image NAME.png / NAME.jpg:
    NAME-{400,800,1600}.webp  (never upscaled past the source width)
    NAME-bg.webp              pre-blurred backdrop, so the page needs no CSS blur
"""
import shutil, subprocess, sys
from io import BytesIO
from pathlib import Path
from PIL import Image, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC, OUT = ROOT / 'assets', ROOT / 'assets' / 'web'
SKIP = {'reference-ios26-glass.png', 'portrait-web.jpg'}
# Captured too dark; bakes in the brightness(1.5) boost the old page applied with a CSS filter.
BRIGHT = {'sys02-scare.mp4', 'sys02-stalker.mp4'}
WIDTHS = (400, 800, 1600)
BG_W = 640

FFMPEG = shutil.which('ffmpeg')


def fresh(out, src):
    return out.exists() and out.stat().st_mtime >= src.stat().st_mtime


def ff(*args):
    subprocess.run([FFMPEG, '-hide_banner', '-loglevel', 'error', '-y', *args], check=True)


def webp_set(img, name, src):
    img = img.convert('RGBA')
    flat = Image.new('RGB', img.size, (10, 15, 13))
    flat.paste(img, mask=img.getchannel('A'))
    for w in WIDTHS:
        out = OUT / f'{name}-{w}.webp'
        if fresh(out, src):
            continue
        tw = min(w, flat.width)
        flat.resize((tw, round(flat.height * tw / flat.width)), Image.LANCZOS).save(out, 'WEBP', quality=80, method=6)
    return flat


def backdrop(flat, name, src, blur_px, sat, hue_deg=0):
    """Mirrors the old CSS `filter: blur() saturate() hue-rotate() brightness(.62)`,
    with the blur radius scaled from a ~1440px wide viewport down to BG_W."""
    out = OUT / f'{name}-bg.webp'
    if fresh(out, src):
        return
    im = flat.resize((BG_W, round(flat.height * BG_W / flat.width)), Image.LANCZOS)
    im = im.filter(ImageFilter.GaussianBlur(blur_px * BG_W / 1440))
    im = ImageEnhance.Color(im).enhance(sat)
    if hue_deg:
        h, s, v = im.convert('HSV').split()
        h = h.point(lambda x: (x + round(hue_deg * 256 / 360)) % 256)
        im = Image.merge('HSV', (h, s, v)).convert('RGB')
    ImageEnhance.Brightness(im).enhance(0.62).save(out, 'WEBP', quality=72, method=6)


def image(src):
    name = src.stem
    flat = webp_set(Image.open(src), name, src)
    if name == 'backdrop':
        backdrop(flat, name, src, 9, 1.22, -8)
    else:
        backdrop(flat, name, src, 11, 1.15)


def video(src):
    name = src.stem
    boost = 'colorchannelmixer=rr=1.5:gg=1.5:bb=1.5,eq=contrast=1.04:saturation=1.06,' if src.name in BRIGHT else ''
    common = ['-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
              '-c:a', 'aac', '-ac', '2']
    hd = OUT / f'{name}-1080.mp4'
    if not fresh(hd, src):
        ff('-i', str(src), '-vf', boost + "scale=-2:'min(1080,ih)'", '-preset', 'medium', '-crf', '23',
           '-b:a', '128k', *common, str(hd))
    sd = OUT / f'{name}-720.mp4'
    if not fresh(sd, src):
        ff('-i', str(src), '-vf', boost + "scale=-2:'min(720,ih)',fps=30", '-preset', 'slow', '-crf', '27',
           '-b:a', '96k', *common, str(sd))
    if not fresh(OUT / f'{name}-400.webp', src):
        # Poster from the processed copy so it matches what plays (brightness boost included).
        png = subprocess.run([FFMPEG, '-hide_banner', '-loglevel', 'error', '-ss', '1', '-i', str(hd),
                              '-frames:v', '1', '-f', 'image2pipe', '-c:v', 'png', '-'],
                             check=True, capture_output=True).stdout
        webp_set(Image.open(BytesIO(png)), name, src)


def main():
    if not FFMPEG:
        sys.exit('ffmpeg not found on PATH')
    OUT.mkdir(exist_ok=True)
    only = set(sys.argv[1:])
    for src in sorted(SRC.iterdir()):
        if src.name in SKIP or (only and src.name not in only):
            continue
        ext = src.suffix.lower()
        if ext in ('.png', '.jpg', '.jpeg'):
            print('image', src.name); image(src)
        elif ext == '.mp4':
            print('video', src.name); video(src)


if __name__ == '__main__':
    main()
