#!/usr/bin/env python3
"""Generate the X Keyboard Shortcut Remover extension icons with Pillow."""

from pathlib import Path

from PIL import Image, ImageDraw


OUTPUT_DIR = Path(__file__).resolve().parent
ICON_SIZES = (16, 48, 128)
SUPERSAMPLE = 4

BACKGROUND = "#0F1419"
BACKGROUND_OUTLINE = "#38444D"
KEY_SHADOW = "#050709"
KEY_FILL = "#F7F9F9"
KEY_OUTLINE = "#FFFFFF"
X_COLOR = "#0F1419"
DISABLED_COLOR = "#FF5964"


def px(value: float, scale: int) -> int:
    """Convert logical icon coordinates to the supersampled canvas."""

    return round(value * scale)


def box(values: tuple[float, float, float, float], scale: int) -> tuple[int, int, int, int]:
    return tuple(px(value, scale) for value in values)  # type: ignore[return-value]


def rounded_line(
    draw: ImageDraw.ImageDraw,
    start: tuple[float, float],
    end: tuple[float, float],
    fill: str,
    width: float,
    scale: int,
) -> None:
    """Draw a line with round caps for a consistent mark at every size."""

    start_px = (px(start[0], scale), px(start[1], scale))
    end_px = (px(end[0], scale), px(end[1], scale))
    width_px = max(1, px(width, scale))
    radius = width_px / 2

    draw.line([start_px, end_px], fill=fill, width=width_px)
    for point in (start_px, end_px):
        draw.ellipse(
            [
                round(point[0] - radius),
                round(point[1] - radius),
                round(point[0] + radius),
                round(point[1] + radius),
            ],
            fill=fill,
        )


def make_icon(size: int) -> Image.Image:
    """Render one icon at high resolution and downsample it for clean edges."""

    scale = SUPERSAMPLE
    canvas_size = size * scale
    image = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    # Dark X-inspired tile with transparent rounded corners.
    draw.rounded_rectangle(
        box((0, 0, size - 1 / scale, size - 1 / scale), scale),
        radius=px(size * 0.22, scale),
        fill=BACKGROUND,
        outline=BACKGROUND_OUTLINE,
        width=max(1, px(0.7, scale)),
    )

    # A light keycap makes the keyboard meaning survive at 16px.
    draw.rounded_rectangle(
        box((size * 0.205, size * 0.215, size * 0.795, size * 0.805), scale),
        radius=px(size * 0.095, scale),
        fill=KEY_SHADOW,
    )
    draw.rounded_rectangle(
        box((size * 0.185, size * 0.175, size * 0.775, size * 0.765), scale),
        radius=px(size * 0.095, scale),
        fill=KEY_FILL,
        outline=KEY_OUTLINE,
        width=max(1, px(0.55, scale)),
    )

    # The key itself carries an X, while the slash communicates disabled.
    rounded_line(
        draw,
        (size * 0.345, size * 0.335),
        (size * 0.615, size * 0.605),
        X_COLOR,
        size * 0.105,
        scale,
    )
    rounded_line(
        draw,
        (size * 0.615, size * 0.335),
        (size * 0.345, size * 0.605),
        X_COLOR,
        size * 0.105,
        scale,
    )

    # A dark under-stroke keeps the accent legible over both the key and X.
    rounded_line(
        draw,
        (size * 0.205, size * 0.795),
        (size * 0.795, size * 0.205),
        BACKGROUND,
        size * 0.19,
        scale,
    )
    rounded_line(
        draw,
        (size * 0.205, size * 0.795),
        (size * 0.795, size * 0.205),
        DISABLED_COLOR,
        size * 0.115,
        scale,
    )

    return image.resize((size, size), Image.Resampling.LANCZOS)


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for size in ICON_SIZES:
        output_path = OUTPUT_DIR / f"icon{size}.png"
        make_icon(size).save(output_path, format="PNG", optimize=True)
        print(f"generated {output_path}")


if __name__ == "__main__":
    main()
