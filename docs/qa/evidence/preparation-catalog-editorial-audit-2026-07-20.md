# Preparation catalog editorial audit — 2026-07-20

## Decision

- Catalog size: 409 canonical entries. Existing 408 identifiers stay stable; `R4-C09-018` adds `역류방지쿠션` with aliases `역방쿠` and `역류 방지 쿠션`.
- Ranking is necessity- and safety-adjusted. Public web evidence is used as a popularity proxy only; it is not represented as verified domestic sales volume.
- Every canonical entry exposes `editorialPriority`, `displayOrder`, `personalizedDiscovery`, lifecycle priority, context rules, evidence class, and review date in `packages/domain/src/release4-catalog.ts`.
- Plans, forms, records, files, checklists, and similar non-product entries remain searchable for existing user history but use `optional`, zero lifecycle priority, and are excluded from unplanned personalized discovery.
- Offer, sponsor, affiliate, commission, and price fields are not ranking inputs.
- Machine-readable item-by-item audit version: `preparation-necessity-v2-2026-07-20`. It contains all 409 item codes, judgement, applicable contexts, source IDs/URLs/types, check date, and confidence.

## Evidence classes

| Class | Use |
| --- | --- |
| `official_checklist_and_popularity_proxy` | Core items supported by an institutional checklist and the purchase-mention proxy |
| `official_checklist` | Common care equipment supported by institutional preparation lists |
| `safety_guidance` | Sleep, car-seat, or other safety-sensitive items whose placement must be bounded by safety guidance |
| `catalog_editorial` | Long-tail products and records reviewed for taxonomy placement without a sales-volume claim |

## Sources

1. 대학내일20대연구소, 육아용품 구매 관련 온라인 언급 분석: <https://www.20slab.org/Archives/GetFileStream/38640>
2. 육아정책연구소, KICCE 육아물가지수 연구 IV: <https://repo.kicce.re.kr/bitstream/2019.oak/799/2/KICCE%20%EC%9C%A1%EC%95%84%EB%AC%BC%EA%B0%80%EC%A7%80%EC%88%98%20%EC%97%B0%EA%B5%AC%28%E2%85%A3%29.pdf>
3. 충북대학교병원 고위험산모신생아 통합치료센터, 육아용품 준비 안내: <https://www.cbrh.or.kr/upload/faq/1766130175789_272.pdf>
4. U.S. Consumer Product Safety Commission, Safe Sleep: <https://www.cpsc.gov/SafeSleep>

All four sources were checked on 2026-07-20. The hospital checklist explicitly includes crib/mattress/sheet, stroller, car seat, carrier, bath supplies, thermometer, newborn diapers, clothing, bottle and feeding equipment. KICCE provides representative childcare-item and household purchase-pattern evidence. The 20slab material identifies stroller as the most-mentioned item in its analyzed purchase-post corpus and also highlights car seats, bottles, diapers, and formula; this remains a mention proxy, not a sales count. CPSC says an infant sleep space should contain only a fitted sheet and warns against pillows and sleep positioners.

## Safety boundary for reflux cushions

`역류방지쿠션` is retained only as a conditional, professional-review item. It has zero personalized priority and is never promoted as a sleep recommendation. Its safety note instructs users to keep pillows and cushions out of infant sleep spaces and does not claim diagnosis, treatment, or efficacy.

## Default newborn ordering contract

The leading editorial sequence is: `신생아 기저귀`, `신생아 침대`, `단단한 아기 매트리스`, `고정형 매트리스 시트`, `아기 체온계`, `신생아 아기띠`, `신생아 욕조`, `후드형 아기 타월`, `신생아 배냇저고리`, `신생아 유모차`, `젖병`, `신생아용 카시트`.

Feeding and transport contexts adjust this sequence: formula or mixed feeding promotes bottle equipment; `car_primary` promotes car seats; `no_car` and `public_transport_primary` promote carriers and portable strollers. User-set due dates and existing plans always take precedence.
