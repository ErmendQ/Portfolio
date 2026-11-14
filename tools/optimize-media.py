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
backdrop.jpg also becomes the sharp page wallpaper: wall-*.webp (see WALL below).
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


def grade(im, sat, hue_deg, bright):
    im = ImageEnhance.Color(im).enhance(sat)
    if hue_deg:
        h, s, v = im.convert('HSV').split()
        h = h.point(lambda x: (x + round(hue_deg * 256 / 360)) % 256)
        im = Image.merge('HSV', (h, s, v)).convert('RGB')
    return ImageEnhance.Brightness(im).enhance(bright)


# The page wallpaper is shown sharp, so it gets its own crops per screen shape:
# name -> (aspect w/h or None for the full frame, horizontal anchor 0..1, widths).
WALL = {
    'wall': (16 / 9, 0.5, (1280, 1920, 2560)),
    'wall-wide': (None, 0.5, (1720, 2560, 3440)),
    'wall-tall': (9 / 16, 0.3, (540, 810)),
}


def wallpaper(flat, src):
    """Sharp, lightly graded crops of backdrop.jpg. Each also gets NAME-frost.webp,
    a small pre-blurred twin that stands in for backdrop blur on phones."""
    for name, (aspect, anchor, widths) in WALL.items():
        outs = [OUT / f'{name}-{w}.webp' for w in widths]
        frost = OUT / f'{name}-frost.webp'
        if all(fresh(o, src) for o in outs + [frost]):
            continue
        im = flat
        if aspect:
            cw = round(flat.height * aspect)
            x0 = round((flat.width - cw) * anchor)
            im = flat.crop((x0, 0, x0 + cw, flat.height))
        im = grade(im, 1.1, -8, 0.96)
        for w, out in zip(widths, outs):
            tw = min(w, im.width)
            im.resize((tw, round(im.height * tw / im.width)), Image.LANCZOS).save(out, 'WEBP', quality=82, method=6)
        fw = 405 if im.width < im.height else 640
        small = im.resize((fw, round(im.height * fw / im.width)), Image.LANCZOS)
        small = small.filter(ImageFilter.GaussianBlur(fw * 0.032))
        grade(small, 1.35, 0, 0.7).save(frost, 'WEBP', quality=70, method=6)


def image(src):
    name = src.stem
    flat = webp_set(Image.open(src), name, src)
    if name == 'backdrop':
        backdrop(flat, name, src, 9, 1.22, -8)
        wallpaper(flat, src)
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
