#!/usr/bin/env python3
# STORE-102: Play 스토어 스크린샷 프레이밍 도구.
# 원본 캡처(임의 해상도)를 1080×1920 프레임(브랜드 코랄 캡션 밴드 + 라운드 스크린샷 + 그림자)으로
# 합성해 Play 요건(최소 320px, 종횡비 최대 1:2)을 항상 충족시킨다.
#
# 사용법:
#   pip install pillow
#   python3 scripts/store/frame_screenshots.py <manifest.json> <출력디렉터리>
#
# manifest.json 형식:
#   [{"name":"home","src":"<캡처 경로>","caption":"오늘 지출이 한눈에",
#     "capturedFrom":{"lineage":"DSN-053+","build":"...","commit":"...","capturedAt":"YYYY-MM-DD"}}, ...]
# 한글 폰트: FRAME_FONT env로 ttf/otf 경로 지정 (미지정 시 Noto Sans KR 다운로드 안내 후 종료).
#   예: curl -L -o /tmp/NotoSansKR.otf \
#     "https://github.com/notofonts/noto-cjk/raw/main/Sans/SubsetOTF/KR/NotoSansKR-Bold.otf"
#
# 실기기 캡처 방법(Day 2 QA 중): adb exec-out screencap -p > shot.png
# 주의: 스토어 스크린샷은 반드시 실제 앱 화면(실기기 캡처 또는 앱이 픽셀 단위로 일치
#       증명된 pixel-lock 레퍼런스)만 사용한다 — 와이어프레임/영문 목업 금지.
#
# 라운드 73 트랙 B(GAP-073 #2)가 둘을 바꿨다:
#  ① 색 상수를 여기서 정하지 않는다 — docs/brand/brand-tokens.json(DNC-017 v0.5 단일 소스)에서 읽는다.
#     종전에는 CORAL=#DB4F2E · CREAM=#FFF8F1이 상수로 박혀 있었고, 그 둘 다 승인 팔레트가 아니었다
#     (#DB4F2E는 어느 시점의 토큰도 아니고, #FFF8F1은 v0.5가 걷어낸 이전 배경이다).
#  ② 캡처의 출처(어느 빌드/커밋에서 나왔는가)를 매니페스트가 지고, 이 도구가 그것을 묻는다.
#     승인 계보(DSN-053, 2026-08-27) 이전 캡처로는 스토어 자산을 만들지 않는다 —
#     그렇게 만든 이미지는 "지금 앱이 아닌 것"을 한 장 더 늘릴 뿐이다.
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

REPO_ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
BRAND_TOKENS_PATH = os.path.join(REPO_ROOT, "docs", "brand", "brand-tokens.json")

# 승인 계보 선언값. 매니페스트의 각 행이 이 중 하나를 반드시 적는다(빈 칸 = 미선언 = 거부).
LINEAGE_APPROVED = "DSN-053+"
LINEAGE_PRE_APPROVAL = "pre-DSN-053"
LINEAGES = (LINEAGE_APPROVED, LINEAGE_PRE_APPROVAL)
# 승인 계보 이전 캡처로도 굳이 합성해야 할 때(예: 프레임 코드 자체를 눈으로 확인) 켜는 명시 opt-out.
ALLOW_PRE_APPROVAL_ENV = "ALLOW_PRE_DSN053_CAPTURES"


def hex_to_rgb(value, key):
    text = str(value).strip()
    if not text.startswith("#") or len(text) != 7:
        raise SystemExit(f"브랜드 값 파일의 {key}가 #RRGGBB 형식이 아닙니다: {value!r} ({BRAND_TOKENS_PATH})")
    try:
        return tuple(int(text[i : i + 2], 16) for i in range(1, 6, 2))
    except ValueError:
        raise SystemExit(f"브랜드 값 파일의 {key}를 색으로 읽을 수 없습니다: {value!r} ({BRAND_TOKENS_PATH})")


def load_brand_colors():
    # fail-closed: 값 파일이 없거나 잠긴 키가 비면 옛 상수로 조용히 되돌아가지 않고 즉시 멈춘다.
    if not os.path.exists(BRAND_TOKENS_PATH):
        raise SystemExit(
            f"브랜드 값 파일을 찾을 수 없습니다: {BRAND_TOKENS_PATH} — "
            "스토어 자산의 색은 DNC-017 v0.5 단일 소스에서만 옵니다."
        )
    with open(BRAND_TOKENS_PATH, encoding="utf-8") as handle:
        tokens = json.load(handle)
    locked = tokens.get("locked") or {}
    missing = [key for key in ("primary", "background") if not locked.get(key)]
    if missing:
        raise SystemExit(
            f"브랜드 값 파일에 locked.{'·locked.'.join(missing)} 값이 없습니다: {BRAND_TOKENS_PATH}"
        )
    return hex_to_rgb(locked["primary"], "locked.primary"), hex_to_rgb(locked["background"], "locked.background")


CORAL, CREAM = load_brand_colors()
W, H = 1080, 1920


def rounded(im, rad):
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, *im.size], radius=rad, fill=255)
    out = im.convert("RGBA")
    out.putalpha(mask)
    return out


def frame(src_path, caption, font):
    shot = Image.open(src_path).convert("RGB")
    # 4차 리뷰 F4: 극단 종횡비/극소 원본은 리사이즈가 0px로 붕괴하거나 스토어에서 반려된다 —
    # traceback 대신 한국어 에러로 즉시 중단.
    if shot.width < 8 or shot.height < 8 or shot.width > 3 * shot.height or shot.height > 3 * shot.width:
        raise SystemExit(
            f"원본 스크린샷 크기/종횡비가 비정상입니다: {src_path} ({shot.width}x{shot.height}) — "
            "실기기 세로 캡처(예: 1080x1920)를 사용하세요."
        )
    canvas = Image.new("RGB", (W, H), CREAM)
    d = ImageDraw.Draw(canvas)
    d.rectangle([0, 0, W, 320], fill=CORAL)
    tw = d.textlength(caption, font=font)
    d.text(((W - tw) / 2, 120), caption, font=font, fill=CREAM)
    scale = min(1400 / shot.height, 900 / shot.width)
    # max(1, ...): int 절삭으로 0이 되어 Pillow가 알 수 없는 에러를 내는 것 방지 (4차 리뷰 F4).
    ns = (max(1, int(shot.width * scale)), max(1, int(shot.height * scale)))
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


def check_capture_lineage(index, entry, allow_pre_approval):
    """캡처의 출처 선언을 읽는다. 미선언이면 거부하고, 승인 계보 이전이면 명시 opt-out에서만 통과한다."""
    provenance = entry.get("capturedFrom")
    if not isinstance(provenance, dict) or not str(provenance.get("lineage") or "").strip():
        raise SystemExit(
            f"manifest {index}번째 항목에 캡처 출처가 없습니다: capturedFrom.lineage "
            f"(값: {LINEAGE_APPROVED} 또는 {LINEAGE_PRE_APPROVAL}) — "
            "어느 빌드에서 나온 캡처인지 모르는 채로 스토어 자산을 만들지 않습니다."
        )
    lineage = str(provenance["lineage"]).strip()
    if lineage not in LINEAGES:
        raise SystemExit(
            f"manifest {index}번째 항목의 capturedFrom.lineage 값을 모릅니다: {lineage!r} "
            f"(쓸 수 있는 값: {', '.join(LINEAGES)})"
        )
    if lineage == LINEAGE_APPROVED:
        blank = [key for key in ("build", "commit") if not str(provenance.get(key) or "").strip()]
        if blank:
            raise SystemExit(
                f"manifest {index}번째 항목이 {LINEAGE_APPROVED}라고 적었는데 "
                f"capturedFrom.{'·capturedFrom.'.join(blank)}이 비어 있습니다 — "
                "승인 계보라고 말하려면 어느 빌드/커밋인지도 함께 적습니다."
            )
        return
    if not allow_pre_approval:
        raise SystemExit(
            f"manifest {index}번째 항목은 승인 계보(DSN-053, 2026-08-27) 이전 캡처입니다"
            f"({provenance.get('capturedAt') or '캡처 일자 미상'}) — 재캡처 전에는 스토어 자산을 만들지 않습니다. "
            "재캡처 절차는 docs/store/play-listing.md §6, 제출 차단 판정은 docs/store/submission-checklist.md §0입니다. "
            f"프레임 코드 확인 등으로 굳이 합성하려면 {ALLOW_PRE_APPROVAL_ENV}=1을 명시하세요."
        )
    print(
        f"[{ALLOW_PRE_APPROVAL_ENV}=1] manifest {index}번째 항목은 승인 계보 이전 캡처입니다 — "
        "이 산출물은 지금의 앱이 아니므로 스토어에 올리지 마세요."
    )


def main():
    if len(sys.argv) != 3:
        print(__doc__ or "usage: frame_screenshots.py <manifest.json> <outdir>")
        sys.exit(1)
    manifest = json.load(open(sys.argv[1], encoding="utf-8"))
    outdir = sys.argv[2]
    allow_pre_approval = os.environ.get(ALLOW_PRE_APPROVAL_ENV) == "1"

    # 라운드 73 후속(적대적 리뷰 ⑫): **계보 검사를 폰트 요구보다 먼저** 한다.
    # 종전 순서에서는 FRAME_FONT가 없으면 폰트 안내로 먼저 죽어서, 구세대 캡처로 자산을 만들려던
    # 사람은 "왜 막혔는가"를 끝내 듣지 못했다 — 폰트를 구해 온 뒤에야 진짜 이유를 만났다.
    # 거부 사유(승인 계보 이전 · 출처 미선언)는 폰트가 없어도 그대로 나와야 하는 사실이다.
    for i, entry in enumerate(manifest, 1):
        # 4차 리뷰 F4: 필수 키 누락 시 bare KeyError traceback 대신 한국어 에러.
        missing = [key for key in ("name", "src", "caption") if key not in entry]
        if missing:
            raise SystemExit(
                f"manifest {i}번째 항목에 필수 키가 없습니다: {', '.join(missing)} "
                "(형식: [{\"name\":..., \"src\":..., \"caption\":...}, ...])"
            )
        check_capture_lineage(i, entry, allow_pre_approval)

    font_path = os.environ.get("FRAME_FONT")
    if not font_path or not os.path.exists(font_path):
        print("FRAME_FONT env로 한글 ttf/otf 폰트 경로를 지정하세요 (헤더의 Noto Sans KR 다운로드 참고)")
        sys.exit(1)
    font = ImageFont.truetype(font_path, 72)
    os.makedirs(outdir, exist_ok=True)
    for i, entry in enumerate(manifest, 1):
        out = os.path.join(outdir, f"phone-{i:02d}-{entry['name']}.png")
        frame(entry["src"], entry["caption"], font).save(out)
        print(f"{out} 1080x1920 · {entry['caption']}")


if __name__ == "__main__":
    main()
