#!/usr/bin/env python3
"""
Render each ICFES question as the image the student would see on paper.

The figures in these booklets are vector art, not embedded rasters — `pdfimages`
on the Matemáticas booklet returns 65 images whose largest is 85x29 pixels, all
of them decoration. The diagrams, tables and typeset equations only exist as
drawing instructions, so the only way to capture them is to render the page and
cut out the question.

`pdftotext -bbox` gives the exact position of every word, including each
"Pregunta N" heading. That is the cut line: a question runs from its own heading
to the next one, and across a page break when it has to.

Output: one PNG per question, plus an index mapping question number to file.

    python3 icfes-crop-questions.py <pdf> <outdir>
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

from PIL import Image

DPI = 150
PT_TO_PX = DPI / 72

# Margins trimmed off every crop, in points. The booklets print a running header
# and a footer with the page number on each page; neither belongs to a question.
LEFT_MARGIN_PT = 48
RIGHT_MARGIN_PT = 34
# Measured, not guessed: on these booklets ink runs to 776pt of a 792pt page, so
# content and the footer decoration overlap. Cutting at 86pt lost the last option
# of any question that reached the bottom of a page. Losing an option is far worse
# than leaving a decorative stripe in the image, so the trim is conservative.
FOOTER_PT = 30
HEADER_PT = 46

WORD_RE = re.compile(
    r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)</word>'
)
PAGE_RE = re.compile(r'<page width="([\d.]+)" height="([\d.]+)">')


def cut_points(pdf: Path) -> tuple[list[dict], dict[int, float]]:
    """
    Every place a crop must start or stop.

    Two kinds: a `Pregunta N` heading, and the `RESPONDA LAS PREGUNTAS…` banner
    that introduces a shared stimulus. Both matter. Cutting only at questions let
    question 3 run past the page break and swallow the next group's banner and
    its whole table.
    """
    xml = subprocess.run(
        ["pdftotext", "-bbox", str(pdf), "-"],
        capture_output=True, text=True, check=True,
    ).stdout

    points: list[dict] = []
    footers: dict[int, float] = {}
    for page_index, chunk in enumerate(xml.split("<page ")[1:], start=1):
        words = [
            {"y": float(m.group(2)), "text": m.group(5)}
            for m in WORD_RE.finditer(chunk)
        ]
        for i, word in enumerate(words):
            if word["text"] == "Pregunta":
                # The number is the next word; a bare "Pregunta" in prose has none.
                if i + 1 < len(words) and words[i + 1]["text"].isdigit():
                    points.append({
                        "kind": "question",
                        "number": int(words[i + 1]["text"]),
                        "page": page_index,
                        "y": word["y"],
                    })
            elif re.fullmatch(r"[A-H]\.", word["text"]) and word["y"] > 100:
                # The first option marks where the stem ends. The crop must stop
                # there: an image that contains the options gives the student
                # something to read but nothing to click, and duplicating them as
                # buttons underneath reads as a mistake.
                points.append({
                    "kind": "option",
                    "label": word["text"][0],
                    "page": page_index,
                    "y": word["y"],
                })
            elif word["text"] == "RESPONDA":
                # "RESPONDA LAS PREGUNTAS 4 A 6" / "RESPONDA LA PREGUNTA 6".
                numbers = [w["text"] for w in words[i : i + 8] if w["text"].isdigit()]
                if numbers:
                    points.append({
                        "kind": "group",
                        "first": int(numbers[0]),
                        "last": int(numbers[-1]) if len(numbers) > 1 else int(numbers[0]),
                        "page": page_index,
                        "y": word["y"],
                    })

        # The running footer always carries "Saber", and its position is the
        # true bottom of the content on that page. Using it beats any fixed
        # margin: too generous a margin ate the last option of a question that
        # reached the page bottom, too small a one left the decorative band in.
        for word in words:
            if word["text"].startswith("Saber") and word["y"] > 600:
                footers[page_index] = min(footers.get(page_index, 1e9), word["y"])

    points.sort(key=lambda p: (p["page"], p["y"]))

    # Keep only the first option after each question or group banner; the others
    # would chop the stem at every choice.
    trimmed: list[dict] = []
    seen_option_since_cut = True
    for point in points:
        if point["kind"] == "option":
            if seen_option_since_cut:
                continue
            seen_option_since_cut = True
        else:
            seen_option_since_cut = False
        trimmed.append(point)

    return trimmed, footers


def render_page(pdf: Path, page: int, cache: dict[int, Image.Image]) -> Image.Image:
    if page in cache:
        return cache[page]
    out = Path("/tmp") / f"_icfes_p{page}"
    subprocess.run(
        ["pdftocairo", "-png", "-r", str(DPI), "-f", str(page), "-l", str(page),
         "-singlefile", str(pdf), str(out)],
        check=True, capture_output=True,
    )
    image = Image.open(f"{out}.png").convert("RGB")
    cache[page] = image
    return image


def crop_question(
    pdf: Path,
    current: dict,
    following: dict | None,
    cache: dict[int, Image.Image],
    footers: dict[int, float],
) -> Image.Image:
    """
    Cut one question out of the rendered pages.

    A question that starts near the bottom of a page continues on the next one,
    so the slice is stitched from however many pages it spans. Cropping only the
    first page is how a question loses its own options.
    """
    first = render_page(pdf, current["page"], cache)
    left = int(LEFT_MARGIN_PT * PT_TO_PX)
    right = first.width - int(RIGHT_MARGIN_PT * PT_TO_PX)
    top = max(0, int(current["y"] * PT_TO_PX) - 10)

    same_page = following is not None and following["page"] == current["page"]

    if same_page:
        bottom = int(following["y"] * PT_TO_PX) - 6
        return first.crop((left, top, right, max(bottom, top + 40)))

    # Runs to the end of this page, and onto the next ones until the following
    # question's heading (or the end of the document).
    def content_bottom(page: int, image: Image.Image) -> int:
        marker = footers.get(page)
        if marker is not None:
            return int((marker - 6) * PT_TO_PX)
        return image.height - int(FOOTER_PT * PT_TO_PX)

    slices = [first.crop((left, top, right, content_bottom(current["page"], first)))]

    last_page = following["page"] if following is not None else current["page"]
    for page in range(current["page"] + 1, last_page + 1):
        try:
            image = render_page(pdf, page, cache)
        except subprocess.CalledProcessError:
            break
        page_top = int(HEADER_PT * PT_TO_PX)
        page_bottom = (
            int(following["y"] * PT_TO_PX) - 6
            if following is not None and page == following["page"]
            else content_bottom(page, image)
        )
        if page_bottom - page_top < 40:
            continue
        slices.append(image.crop((left, page_top, right, page_bottom)))

    width = max(s.width for s in slices)
    stitched = Image.new("RGB", (width, sum(s.height for s in slices)), "white")
    offset = 0
    for piece in slices:
        stitched.paste(piece, (0, offset))
        offset += piece.height
    return stitched


def trim_whitespace(image: Image.Image) -> Image.Image:
    """Drop the blank run a question leaves below its last option."""
    grey = image.convert("L")
    mask = grey.point(lambda value: 0 if value > 244 else 255, "1")
    box = mask.getbbox()
    if box is None:
        return image
    pad = 12
    return image.crop((
        0,
        max(0, box[1] - pad),
        image.width,
        min(image.height, box[3] + pad),
    ))


def main() -> int:
    if len(sys.argv) < 3:
        print(__doc__)
        return 2
    pdf, outdir = Path(sys.argv[1]), Path(sys.argv[2])
    outdir.mkdir(parents=True, exist_ok=True)

    points, footers = cut_points(pdf)
    if not points:
        print(json.dumps({"pdf": pdf.name, "questions": [], "groups": []}))
        return 0

    cache: dict[int, Image.Image] = {}
    questions, groups = [], []

    for i, current in enumerate(points):
        if current["kind"] == "option":
            continue
        following = points[i + 1] if i + 1 < len(points) else None
        image = trim_whitespace(crop_question(pdf, current, following, cache, footers))
        # A slice this short caught a stray heading, not real content.
        if image.height < 110:
            continue

        if current["kind"] == "question":
            name = f"{pdf.stem}-q{current['number']:03d}.png"
            record = {"number": current["number"], "file": name}
            target = questions
        else:
            # The stimulus is what sits between the banner and the first
            # question of the run — the table or passage the group shares.
            name = f"{pdf.stem}-g{current['first']:03d}-{current['last']:03d}.png"
            record = {"first": current["first"], "last": current["last"], "file": name}
            target = groups

        image.save(outdir / name, optimize=True)
        record.update({"width": image.width, "height": image.height})
        target.append(record)

    print(json.dumps({"pdf": pdf.name, "questions": questions, "groups": groups}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
