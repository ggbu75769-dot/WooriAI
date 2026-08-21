#!/usr/bin/env python3
# STORE-102: Play 스토어 스크린샷 프레이밍 도구.
# 원본 캡처(임의 해상도)를 1080×1920 프레임(브랜드 코랄 캡션 밴드 + 라운드 스크린샷 + 그림자)으로
# 합성해 Play 요건(최소 320px, 종횡비 최대 1:2)을 항상 충족시킨다.
#
# 사용법:
#   pip install pillow
#   python3 scripts/store/frame_screenshots.py <manifest.json> <출력디렉터리>
#
# manifest.json 형식: [{"name":"home","src":"<캡처 경로>","caption":"오늘 지출이 한눈에"}, ...]
# 한글 폰트: FRAME_FONT env로 ttf/otf 경로 지정 (미지정 시 Noto Sans KR 다운로드 안내 후 종료).
#   예: curl -L -o /tmp/NotoSansKR.otf \
#     "https://github.com/notofonts/noto-cjk/raw/main/Sans/SubsetOTF/KR/NotoSansKR-Bold.otf"
#
# 실기기 캡처 방법(Day 2 QA 중): adb exec-out screencap -p > shot.png
# 주의: 스토어 스크린샷은 반드시 실제 앱 화면(실기기 캡처 또는 앱이 픽셀 단위로 일치
#       증명된 pixel-lock 레퍼런스)만 사용한다 — 와이어프레임/영문 목업 금지.
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

CORAL = (219, 79, 46)
CREAM = (255, 248, 241)
W, H = 1080, 1920


def rounded(im, rad):
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, *im.size], radius=rad, fill=255)
    out = im.convert("RGBA")
    out.putalpha(mask)
    return out


def frame(src_path, caption, font):
    shot = Image.open(src_path).convert("RGB")
    canvas = Image.new("RGB", (W, H), CREAM)
    d = ImageDraw.Draw(canvas)
    d.rectangle([0, 0, W, 320], fill=CORAL)
    tw = d.textlength(caption, font=font)
    d.text(((W - tw) / 2, 120), caption, font=font, fill=CREAM)
    scale = min(1400 / shot.height, 900 / shot.width)
    ns = (int(shot.width * scale), int(shot.height * scale))
    shot_r = rounded(shot.resize(ns, Image.LANCZOS), 36)
    x = (W - ns[0]) // 2
    y = 360
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle(
        [x - 8, y - 8, x + ns[0] + 8, y + ns[1] + 8], radius=42, fill=(0, 0, 0, 70)
    )
    sh = sh.filter(ImageFilter.GaussianBlur(16))
    canvas = Image.alpha_composite(canvas.convert("RGBA"), sh)
    canvas.alpha_composite(shot_r, (x, y))
    return canvas.convert("RGB")


def main():
    if len(sys.argv) != 3:
        print(__doc__ or "usage: frame_screenshots.py <manifest.json> <outdir>")
        sys.exit(1)
    font_path = os.environ.get("FRAME_FONT")
    if not font_path or not os.path.exists(font_path):
        print("FRAME_FONT env로 한글 ttf/otf 폰트 경로를 지정하세요 (헤더의 Noto Sans KR 다운로드 참고)")
        sys.exit(1)
    font = ImageFont.truetype(font_path, 72)
    manifest = json.load(open(sys.argv[1], encoding="utf-8"))
    outdir = sys.argv[2]
    os.makedirs(outdir, exist_ok=True)
    for i, entry in enumerate(manifest, 1):
        out = os.path.join(outdir, f"phone-{i:02d}-{entry['name']}.png")
        frame(entry["src"], entry["caption"], font).save(out)
        print(f"{out} 1080x1920 · {entry['caption']}")


if __name__ == "__main__":
    main()
