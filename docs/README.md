# STAGE 문서 인덱스

STAGE(디지털 매거진 + 블로그 + 도슨트 AI) 프로젝트의 문서 지도입니다.
아키텍처·명령어·환경변수 등 **코드 작업 규약**은 리포지토리 루트 [`CLAUDE.md`](../CLAUDE.md)를 정본으로 따릅니다.

## 정본(canonical) 문서

| 문서 | 위상 | 내용 |
|------|------|------|
| [requirements.md](./requirements.md) | 정본 (무엇을/왜) | 요구사항명세서(SRS). 현재 코드 기준 현황 포함 |
| [roadmap.md](./roadmap.md) | living (순서/상태) | 작업 순서·진행 현황. 완료 시 상태·커밋 해시 갱신 |
| [account-permissions.md](./account-permissions.md) | 사양/결정 | 계정·권한(role 단일축 + 기사별 기고자 토큰) 사양 |
| [design/v2/](./design/v2/README.md) | 디자인 정본 | UI/UX·디자인 토큰·화면 명세(v2). 공개 UI는 v2를 따름 |
| [test-cases.md](./test-cases.md) | 참고 | 기능별 테스트 케이스 |

## 활성 기획 문서 (design/)

`docs/design/` 아래 v2 외 문서는 진행 중인 이니셔티브의 계획서입니다.

- [design/magazine-article-integration.md](./design/magazine-article-integration.md) — 매거진·기사 통합
- [design/article-magazine-merge.md](./design/article-magazine-merge.md) — 도메인 원칙(Article = 단일 원천)
- [design/ai-maestro-rag-plan.md](./design/ai-maestro-rag-plan.md) — 마에스트로(도슨트) RAG 개선 계획
- [design/v2/editor-canvafy/](./design/v2/) · [design/v2/magazine-renewal/](./design/v2/) — 에디터·매거진 리뉴얼 명세

## Untracked (커밋하지 않음)

- [HANDOFF.md](./HANDOFF.md) — 기기·세션 간 인수인계 메모. **의도적으로 git 미추적** 유지.

## 레거시 (아카이브)

정본에서 대체된 옛 문서는 리포지토리 밖 `ref/legacy/`에 보존합니다(참고용, git 미추적).

- `ref/legacy/STAGE_Development_VERSION_20260309.md` — 초기 개발 명세(Sanity/Strapi/Meilisearch 전제, 현 스택과 불일치)
- `ref/legacy/digital_magazine_mvp_requirements_admin_public_responsive.md` — 초기 MVP 요구서
- `ref/legacy/design-v1/` — 디자인 명세 v1 (v2로 대체됨)
