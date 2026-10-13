# 보안 제보

초기 개발 단계이므로 보안 수정은 최신 main을 기준으로 처리합니다. 안정적인 대응 시간이나 장기 지원은 아직 약속하지 않습니다.

공개 이슈에 인증 JSON, 토큰, client secret, 개인 일정 또는 회의 URL을 첨부하지 마세요. [GitHub 비공개 보안 제보](https://github.com/ingjae/haru/security/advisories/new)를 사용할 수 있다면 그 경로로 재현 조건과 영향을 보내 주세요. 비공개 제보 기능이 보이지 않으면 비밀정보 없이 공개 이슈로 비공개 연락 경로를 요청해 주세요.

이미 비밀정보가 공개됐다면 앱 연결을 해제하고 Google 계정에서 앱 접근을 취소하세요. OAuth 클라이언트 정보가 노출된 경우 Google Cloud에서 해당 자격 증명을 정리하세요.

Haru의 OAuth 데이터는 local userData의 safeStorage 암호화 파일에 보관됩니다. 이 암호화는 잠금 해제된 기기의 악성 소프트웨어나 전체 계정 침해까지 보호하지 않습니다.
