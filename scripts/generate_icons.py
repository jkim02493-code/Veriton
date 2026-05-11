from pathlib import Path

SVG_SOURCE = """
<svg width="128" height="128" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6C3DE8"/>
      <stop offset="100%" style="stop-color:#C84B31"/>
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="28" fill="url(#g)"/>
  <polygon points="24,32 64,102 104,32 91,32 64,90 37,32" fill="white"/>
</svg>
"""

ROOT = Path(__file__).resolve().parents[1]
ICON_DIR = ROOT / "extension" / "icons"
SIZES = (16, 32, 48, 128)


def main() -> None:
    ICON_DIR.mkdir(parents=True, exist_ok=True)
    for size in SIZES:
        output_path = ICON_DIR / f"icon{size}.png"
        try:
            import cairosvg

            cairosvg.svg2png(
                bytestring=SVG_SOURCE.encode("utf-8"),
                write_to=str(output_path),
                output_width=size,
                output_height=size,
            )
        except OSError:
            generate_with_pillow(output_path, size)
        print(f"Generated {output_path.relative_to(ROOT)}")


def generate_with_pillow(output_path: Path, size: int) -> None:
    from PIL import Image, ImageDraw

    purple = (108, 61, 232, 255)
    red = (200, 75, 49, 255)
    gradient = Image.new("RGBA", (size, size))
    pixels = gradient.load()
    for y in range(size):
      for x in range(size):
        t = (x + y) / max((size - 1) * 2, 1)
        pixels[x, y] = tuple(round(purple[index] * (1 - t) + red[index] * t) for index in range(4))

    mask = Image.new("L", (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle((0, 0, size, size), radius=round(size * 28 / 128), fill=255)
    icon = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    icon.paste(gradient, (0, 0), mask)

    scale = size / 128
    points = [(24, 32), (64, 102), (104, 32), (91, 32), (64, 90), (37, 32)]
    scaled_points = [(round(x * scale), round(y * scale)) for x, y in points]
    draw = ImageDraw.Draw(icon)
    draw.polygon(scaled_points, fill=(255, 255, 255, 255))
    icon.save(output_path)


if __name__ == "__main__":
    main()
