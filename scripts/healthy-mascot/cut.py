"""Cut the mascot out of the generated clip, frame by frame.

g/NNN.png (frames of clip.mp4) -> cut/NNN.png (RGBA, same size).
Ground is near-white with a lilac floor shadow; he has white gloves, a white
face and pale shoes, so a plain brightness key would eat him. Instead: flood
in from the frame border through ground-like and shadow-like pixels only, keep
the one connected piece that holds his navy body, then trim the floor strip.
"""
from PIL import Image, ImageDraw, ImageFilter
import numpy as np, glob, os, sys
H_FALLBACK = 10**6

def cut(path):
    im = Image.open(path).convert('RGB')
    a = np.asarray(im).astype(np.int16)
    r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    mn = a.min(axis=2); mx = a.max(axis=2)
    ground = (mn > 222) & ((mx - mn) < 14)
    # lilac / blue-violet floor shadow: light, blue above green
    shadow = (mn > 120) & (b >= g + 4) & (b >= r - 6) & ((mx - mn) < 110)
    # Shadow only counts down at floor level. His face panel is a bluish white
    # too, and it is open to the ground on one side: let shadow-coloured pixels
    # pass up there and the flood walks straight into his face.
    nv = (mn < 70) & (b > r + 15)
    nvy = np.nonzero(nv.any(axis=1))[0]
    floor_top = (nvy.max() - 40) if len(nvy) else H_FALLBACK
    rows_all = np.arange(a.shape[0])[:, None]
    passable = ground | (shadow & (rows_all >= floor_top))
    m = Image.fromarray((passable * 255).astype(np.uint8)).copy()
    W, H = m.size
    for x in range(0, W, 6):
        for y in (0, H - 1):
            if m.getpixel((x, y)) == 255: ImageDraw.floodfill(m, (x, y), 128)
    for y in range(0, H, 6):
        for x in (0, W - 1):
            if m.getpixel((x, y)) == 255: ImageDraw.floodfill(m, (x, y), 128)
    alpha = np.where(np.asarray(m) == 128, 0, 255).astype(np.uint8)
    # the piece holding the navy body
    navy = (mn < 70) & (b > r + 15) & (alpha > 0)
    ys, xs = np.nonzero(navy)
    if len(ys) == 0:
        return im, Image.fromarray(np.zeros_like(alpha))
    k = np.argsort(ys)[len(ys) // 2]
    seed = (int(xs[k]), int(ys[k]))
    def keep_main(al):
        mm = Image.fromarray(al).copy(); ImageDraw.floodfill(mm, seed, 200)
        return np.where(np.asarray(mm) == 200, 255, 0).astype(np.uint8)
    alpha = keep_main(alpha)
    # soles: darkest pixels at the bottom of the figure
    fy, fx = np.nonzero(alpha)
    bottom = fy.max()
    dark = (mn < 105) & (alpha > 0)
    dark[: bottom - 40] = False
    dy, dx = np.nonzero(dark)
    if len(dy):
        sole = dy.max(); xl, xr = dx.min(), dx.max()
        rows = np.arange(H)[:, None]; cols = np.arange(W)[None, :]
        alpha[sole + 1:] = 0
        # Floor level, either side of the shoes: nothing of him is out here
        # except, in some poses, a hanging glove, which is pink where the
        # floor and its shadow are white or lilac.
        glove = r > b + 8
        alpha[(rows >= sole - 46) & ((cols < xl - 3) | (cols > xr + 3))] = 0
        alpha[(rows >= sole - 110) & ((cols < xl - 3) | (cols > xr + 3)) & (~glove) & (mn > 120)] = 0
        solecol = dark[max(sole - 10, 0): sole + 1].any(axis=0)[None, :]
        alpha[(rows >= sole - 70) & (cols >= xl) & (cols <= xr) & (~solecol) & (mn > 110)] = 0
        # Ground showing between his legs, above the shoes: on each row, the
        # light pixels lying between the outermost navy leg pixels.
        for y in range(max(sole - 80, 0), sole - 30):
            legs = np.nonzero(nv[y] & (alpha[y] > 0))[0]
            if len(legs) > 1:
                x0, x1 = legs.min(), legs.max()
                row = alpha[y, x0:x1 + 1]
                row[(mn[y, x0:x1 + 1] > 150) & ((mx - mn)[y, x0:x1 + 1] < 40)] = 0
        alpha = keep_main(alpha)
        # Second pass: the floor is gone, so ground that was walled in behind
        # it (between his legs) can now be reached from outside.
        m2 = Image.fromarray((((alpha == 0) | passable) * 255).astype(np.uint8)).copy()
        for x in range(0, W, 6):
            for y in (0, H - 1):
                if m2.getpixel((x, y)) == 255: ImageDraw.floodfill(m2, (x, y), 128)
        alpha = np.where(np.asarray(m2) == 128, 0, alpha).astype(np.uint8)
        alpha = keep_main(alpha)
    A = Image.fromarray(alpha).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    return im, A

if __name__ == '__main__':
    os.makedirs('cut', exist_ok=True)
    fs = sorted(glob.glob('g/*.png'))
    stats = []
    for i, f in enumerate(fs):
        im, A = cut(f)
        r = im.convert('RGBA'); r.putalpha(A); r.save('cut/%03d.png' % i)
        bb = A.point(lambda v: 255 if v > 40 else 0).getbbox()
        stats.append(bb)
    open('stats.txt', 'w').write('\n'.join(str(s) for s in stats))
    bb = [s for s in stats if s]
    print(len(fs), 'union', min(s[0] for s in bb), min(s[1] for s in bb), max(s[2] for s in bb), max(s[3] for s in bb))
    print('bottoms', [s[3] for s in stats[:40]])
    print('lefts min', min(s[0] for s in bb), 'rights max', max(s[2] for s in bb), 'tops min', min(s[1] for s in bb))
