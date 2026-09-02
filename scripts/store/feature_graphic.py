#!/usr/bin/env python3
# STORE-102 후속(LP-G): Play 스토어 피처 그래픽(1024×500) 생성기.
#
# frame_screenshots.py와 같은 규율을 따른다:
#  ① 색 상수를 여기서 정하지 않는다 — docs/brand/brand-tokens.json(DNC-017 v0.5 단일 소스)에서
#     읽고, 값 파일이 없으면 fail-closed로 멈춘다(옛 상수로 되돌아가지 않는다).
#  ② 문구도 여기서 정하지 않는다 — 앱 이름/카피는 docs/store/play-listing.md §1의 권장 앱 이름
#     한 줄에서 파싱한다(스토어 문안의 단일 소스는 그 문서다. 텍스트 최소화 요건에 맞춰
#     이름 + 부제 두 줄만 그린다).
#  ③ 아이콘은 apps/mobile/assets/icon.png(DSN-053 복원본)에서 읽는다 — 손그림 금지.
#  ④ 산출과 함께 docs/store/assets/graphic-assets-manifest.json의 feature-graphic 항목에
#     계보(생성기·원천·커밋·일자)를 기록한다.
#
# 사용법:
#   FRAME_FONT=<한글 ttf/otf> python3 scripts/store/feature_graphic.py [출력 PNG 경로]
#   (기본 출력: docs/store/assets/play-feature-graphic-1024x500.png)
import datetime
import json
import os
import re
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont

REPO_ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
BRAND_TOKENS_PATH = os.path.join(REPO_ROOT, "docs", "brand", "brand-tokens.json")
PLAY_LISTING_PATH = os.path.join(REPO_ROOT, "docs", "store", "play-listing.md")
ICON_SOURCE_PATH = os.path.join(REPO_ROOT, "apps", "mobile", "assets", "icon.png")
GRAPHIC_MANIFEST_PATH = os.path.join(REPO_ROOT, "docs", "store", "assets", "graphic-assets-manifest.json")
DEFAULT_OUT = os.path.join(REPO_ROOT, "docs", "store", "assets", "play-feature-graphic-1024x500.png")

W, H = 1024, 500


def hex_to_rgb(value, key):
    text = str(value).strip()
    if not text.startswith("#") or len(text) != 7:
        raise SystemExit(f"브랜드 값 파일의 {key}가 #RRGGBB 형식이 아닙니다: {value!r} ({BRAND_TOKENS_PATH})")
    try:
        return tuple(int(text[i : i + 2], 16) for i in range(1, 6, 2))
    except ValueError:
        raise SystemExit(f"브랜드 값 파일의 {key}를 색으로 읽을 수 없습니다: {value!r} ({BRAND_TOKENS_PATH})")


def load_brand():
    # fail-closed: 값 파일이 없거나 필요한 키가 비면 즉시 멈춘다.
    if not os.path.exists(BRAND_TOKENS_PATH):
        raise SystemExit(
            f"브랜드 값 파일을 찾을 수 없습니다: {BRAND_TOKENS_PATH} — "
            "스토어 자산의 색은 DNC-017 v0.5 단일 소스에서만 옵니다."
        )
    with open(BRAND_TOKENS_PATH, encoding="utf-8") as handle:
        tokens = json.load(handle)
    locked = tokens.get("locked") or {}
    derived = tokens.get("derived") or {}
    if not locked.get("primary"):
        raise SystemExit(f"브랜드 값 파일에 locked.primary 값이 없습니다: {BRAND_TOKENS_PATH}")
    if not derived.get("onPrimary"):
        raise SystemExit(f"브랜드 값 파일에 derived.onPrimary 값이 없습니다: {BRAND_TOKENS_PATH}")
    return tokens


def load_copy():
    """play-listing.md §1의 권장 앱 이름 한 줄에서 (이름, 부제)를 읽는다."""
    if not os.path.exists(PLAY_LISTING_PATH):
        raise SystemExit(f"스토어 문안 파일을 찾을 수 없습니다: {PLAY_LISTING_PATH}")
    with open(PLAY_LISTING_PATH, encoding="utf-8") as handle:
        listing = handle.read()
    match = re.search(r"\*\*권장:\*\*\s*`([^`]+)`", listing)
    if not match:
        raise SystemExit(f"{PLAY_LISTING_PATH} §1에서 권장 앱 이름(`**권장:** \\`...\\``)을 찾지 못했습니다.")
    full = match.group(1).strip()
    if " - " in full:
        name, subtitle = full.split(" - ", 1)
    else:
        name, subtitle = full, ""
    return name.strip(), subtitle.strip(), full


def git_commit():
    try:
        return (
            subprocess.run(
                ["git", "rev-parse", "--short", "HEAD"], cwd=REPO_ROOT, capture_output=True, text=True, check=True
            ).stdout.strip()
        )
    except Exception:
        return os.environ.get("SOURCE_COMMIT", "unknown")


def rounded(im, rad):
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, *im.size], radius=rad, fill=255)
    out = im.convert("RGBA")
    out.putalpha(mask)
    return out


def main():
    out_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_OUT
    if len(sys.argv) > 2:
        print("usage: feature_graphic.py [출력 PNG 경로]")
        sys.exit(1)

    tokens = load_brand()
    primary = hex_to_rgb(tokens["locked"]["primary"], "locked.primary")
    on_primary = hex_to_rgb(tokens["derived"]["onPrimary"], "derived.onPrimary")
    name, subtitle, full_name = load_copy()

    font_path = os.environ.get("FRAME_FONT")
    if not font_path or not os.path.exists(font_path):
        print("FRAME_FONT env로 한글 ttf/otf 폰트 경로를 지정하세요 (frame_screenshots.py 헤더의 Noto Sans KR 다운로드 참고)")
        sys.exit(1)
    if not os.path.exists(ICON_SOURCE_PATH):
        raise SystemExit(f"앱 아이콘 원본을 찾을 수 없습니다: {ICON_SOURCE_PATH}")

    canvas = Image.new("RGB", (W, H), primary)

    # 왼쪽: 앱 아이콘(DSN-053 복원본) 라운드 타일.
    icon_size = 300
    icon = Image.open(ICON_SOURCE_PATH).convert("RGBA").resize((icon_size, icon_size), Image.LANCZOS)
    icon = rounded(icon, 64)
    canvas_rgba = canvas.convert("RGBA")
    canvas_rgba.alpha_composite(icon, (96, (H - icon_size) // 2))
    canvas = canvas_rgba.convert("RGB")

    # 오른쪽: 앱 이름 + 부제(텍스트 최소화 — 두 줄만).
    d = ImageDraw.Draw(canvas)
    name_font = ImageFont.truetype(font_path, 108)
    sub_font = ImageFont.truetype(font_path, 44)
    text_x = 96 + icon_size + 72
    name_box = d.textbbox((0, 0), name, font=name_font)
    sub_box = d.textbbox((0, 0), subtitle, font=sub_font) if subtitle else (0, 0, 0, 0)
    name_h = name_box[3] - name_box[1]
    sub_h = sub_box[3] - sub_box[1]
    gap = 36 if subtitle else 0
    top = (H - (name_h + gap + sub_h)) // 2 - name_box[1]
    d.text((text_x, top), name, font=name_font, fill=on_primary)
    if subtitle:
        d.text((text_x, top + name_box[1] + name_h + gap - sub_box[1]), subtitle, font=sub_font, fill=on_primary)

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    canvas.save(out_path)
    print(f"{out_path} {W}x{H} · {full_name}")

    # 계보 기록: graphic-assets-manifest.json의 feature-graphic 항목을 갱신한다.
    manifest = {}
    if os.path.exists(GRAPHIC_MANIFEST_PATH):
        with open(GRAPHIC_MANIFEST_PATH, encoding="utf-8") as handle:
            manifest = json.load(handle)
    manifest["feature-graphic"] = {
        "file": os.path.relpath(out_path, REPO_ROOT),
        "size": f"{W}x{H}",
        "generator": "scripts/store/feature_graphic.py",
        "brandTokens": {
            "path": "docs/brand/brand-tokens.json",
            "version": tokens.get("version", ""),
            "background": tokens["locked"]["primary"],
            "text": tokens["derived"]["onPrimary"],
        },
        "iconSource": "apps/mobile/assets/icon.png",
        "textSource": "docs/store/play-listing.md §1 권장 앱 이름",
        "text": full_name,
        "commit": git_commit(),
        "generatedAt": datetime.date.today().isoformat(),
    }
    with open(GRAPHIC_MANIFEST_PATH, "w", encoding="utf-8") as handle:
        json.dump(manifest, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    print(f"{GRAPHIC_MANIFEST_PATH} feature-graphic 계보 기록")


if __name__ == "__main__":
    main()
