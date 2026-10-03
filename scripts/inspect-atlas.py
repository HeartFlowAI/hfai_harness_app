"""Read-only atlas inspection: report opaque connected components; never edits artwork."""
from collections import deque
from PIL import Image
import sys
im = Image.open(sys.argv[1] if len(sys.argv)>1 else 'src/assets/aurora/activity-atlas.png').convert('RGBA')
w, h = im.size
alpha = im.getchannel('A')
mask = bytearray(1 if a > 170 else 0 for a in alpha.tobytes())
components = []
for start in range(w * h):
    if not mask[start]:
        continue
    mask[start] = 0
    queue = deque([start])
    count = 0
    left = right = start % w
    top = bottom = start // w
    while queue:
        i = queue.popleft()
        x, y = i % w, i // w
        count += 1
        left, right = min(left, x), max(right, x)
        top, bottom = min(top, y), max(bottom, y)
        neighbors = []
        if x: neighbors.append(i - 1)
        if x + 1 < w: neighbors.append(i + 1)
        if y: neighbors.append(i - w)
        if y + 1 < h: neighbors.append(i + w)
        for n in neighbors:
            if mask[n]:
                mask[n] = 0
                queue.append(n)
    if count > 3000:
        components.append({'pixels': count, 'rect': [left, top, right - left + 1, bottom - top + 1]})
print(components)
