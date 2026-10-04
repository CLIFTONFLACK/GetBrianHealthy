"""cut/NNN.png -> the three files the site ships, written to out/.

hero-burst.webp        entrance: hop, land, first waves. Plays once.
hero-wave.webp         the wave, looping for ever. Starts where the entrance ends.
hero-burst-still.webp  standing pose, for reduced motion and fallbacks.

Run by hand, from a working folder outside the repo, after cut.py:

    ffmpeg -i clip.mp4 g/%03d.png
    python cut.py        # g/ -> cut/
    python build.py      # cut/ -> out/

then copy out/*.webp into public/healthy/mascot/.

The crop box and the frame ranges below belong to the one clip this was
written for. A new clip needs new numbers: find the union of the figure's
bounds for BOX, the touchdown frame for `air`, and a pair of matching wave
frames for LOOP_A / LOOP_B.

It prints the entrance's running time. ENTRANCE_MS and LANDING_MS in
src/app/hero-mascot.tsx must be set to what it prints; a test holds
ENTRANCE_MS to the file.
"""
from PIL import Image
import glob, os

BOX = (300, 96, 878, 646)   # union of frames 8+, 6px margin, soles on the bottom edge
HEIGHT = 320
LOOP_A, LOOP_B = 69, 86     # frame 86 matches frame 69: the loop is 69..85
STILL = 120                 # standing, hand down
OUT = 'out'


def main():
    files = sorted(glob.glob('cut/*.png'))
    width = round((BOX[2] - BOX[0]) * HEIGHT / (BOX[3] - BOX[1]))
    frames = [Image.open(f).crop(BOX).resize((width, HEIGHT), Image.LANCZOS) for f in files]

    air = list(range(8, 14))            # airborne, held twice as long: the flight across the hero
    land = list(range(14, 20))
    # Every other frame at double the time. Ends on 68, whose 84ms covers the
    # skipped 69, which is the loop's first frame.
    rest = list(range(20, LOOP_A, 2))
    order = air + land + rest
    times = [84] * len(air) + [42] * len(land) + [84] * len(rest)

    os.makedirs(OUT, exist_ok=True)
    entrance = [frames[i] for i in order]
    entrance[0].save(OUT + '/hero-burst.webp', save_all=True, append_images=entrance[1:],
                     duration=times, loop=1, quality=62, method=4)
    loop = [frames[i] for i in range(LOOP_A, LOOP_B)]
    loop[0].save(OUT + '/hero-wave.webp', save_all=True, append_images=loop[1:],
                 duration=42, loop=0, quality=62, method=4)
    frames[STILL].save(OUT + '/hero-burst-still.webp', quality=86, method=6)

    print('canvas', width, HEIGHT)
    print('LANDING_MS', sum(times[:len(air)]), 'ENTRANCE_MS', sum(times))
    print('entrance frames', len(order), 'loop frames', len(loop), 'loop ms', 42 * len(loop))
    for name in ('hero-burst.webp', 'hero-wave.webp', 'hero-burst-still.webp'):
        print(name, os.path.getsize(OUT + '/' + name))

    # Nothing shipped may touch the left, right or top of the canvas: that is
    # a hand or a head cut off. The repo's test checks the same on the files.
    touching = []
    for i in order + list(range(LOOP_A, LOOP_B)) + [STILL]:
        px = frames[i].split()[3].load()
        if (any(px[0, y] > 40 or px[width - 1, y] > 40 for y in range(HEIGHT))
                or any(px[x, 0] > 40 for x in range(width))):
            touching.append(i)
    print('frames touching left/right/top edge:', touching)
    if touching:
        raise SystemExit('cut-off frames: widen BOX or regenerate the clip with more margin')


if __name__ == '__main__':
    main()
