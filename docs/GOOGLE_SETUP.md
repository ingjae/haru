# Google Calendar 연결

Haru는 현재 사용자가 준비한 데스크톱 OAuth 클라이언트로 Google에 직접 연결합니다. Chrome의 로그인 상태를 자동으로 재사용하지 않습니다.

## 준비

1. [Google Cloud Console](https://console.cloud.google.com/)에서 사용할 프로젝트를 선택합니다.
2. API 라이브러리에서 **Google Calendar API**를 사용 설정합니다.
3. Google 인증 플랫폼의 브랜딩·대상을 설정합니다. 테스트 모드라면 사용할 계정을 **테스트 사용자**에 추가합니다.
4. 클라이언트 유형을 **데스크톱 앱**으로 생성하고 OAuth JSON을 다운로드합니다.
5. JSON은 저장소 밖에 보관합니다. 앱에서 **⚙ → Google 캘린더 → 연결**로 선택합니다.
6. 시스템 브라우저에서 계정과 Calendar 권한을 확인하고 앱으로 돌아옵니다.

앱은 localhost 콜백과 PKCE로 로그인합니다. `GOOGLE_OAUTH_CREDENTIALS` 환경 변수로 파일 경로를 지정할 수도 있습니다. JSON 내용이나 토큰을 터미널·이슈에 출력할 필요가 없습니다.

## 오류 해결

| 화면·오류 | 확인할 설정 |
| --- | --- |
| JSON 파일 선택만 뜸 | 정상적인 첫 단계입니다. 데스크톱 OAuth JSON이 필요합니다. |
| 웹 애플리케이션용 JSON | 클라이언트 유형을 데스크톱 앱으로 생성해 다시 다운로드합니다. |
| 인증하지 않은 앱 / 403 access_denied | OAuth 대상의 테스트 사용자 목록에 로그인 계정을 추가합니다. |
| 로그인 완료, 일정 조회 403 | 해당 OAuth 프로젝트에서 Calendar API가 활성화됐는지 확인합니다. 조직의 앱 접근 정책도 확인합니다. |
| invalid_grant / 인증 만료 | 앱에서 연결 해제 후 다시 로그인합니다. 테스트 모드의 인증은 만료될 수 있습니다. |
| 브라우저에 응답 완료 문구만 보임 | 앱에서 일정 조회까지 성공했는지 확인합니다. 콜백 응답과 조회 성공은 다릅니다. |

## 캘린더 목록과 Google 할일

기본 연결은 Calendar 일정 권한으로 시작합니다. **⚙ 설정 → 캘린더 목록·Google 할일 권한 연결**에서 추가 로그인을 진행하고, **캘린더 목록 조회**와 **할일 생성·수정·삭제**를 모두 선택합니다. 기존 연결이 있으면 저장된 OAuth 클라이언트를 재사용합니다.

같은 Google Cloud 프로젝트에서 **Google Tasks API**도 활성화해야 합니다. 추가 권한 승인과 API 활성화는 별개입니다. 연결 후 캘린더와 할일 목록을 선택할 수 있습니다. Google 웹에서 보고 있는 계정과 Haru 연결 계정이 같은지 확인하세요.

할일 조회가 403이면 Tasks API 활성화, 추가 권한 선택, 조직 접근 정책을 확인합니다. Linux에서는 잠금 해제된 GNOME Keyring이 필요하며 보호되지 않은 basic_text 저장소는 사용하지 않습니다. [Linux 설치](LINUX.md)

## 연결 해제

앱의 연결 해제는 이 기기의 저장 인증을 삭제합니다. Google 쪽 접근 권한은 [Google 계정 연결 관리](https://myaccount.google.com/connections)에서 별도로 취소할 수 있습니다.

참고: [Google Desktop OAuth](https://developers.google.com/identity/protocols/oauth2/native-app), [Calendar API 빠른 시작](https://developers.google.com/workspace/calendar/api/quickstart/python).

## 인증 만료·취소 후 재로그인

main 개발 버전은 인증 만료 오류 아래 또는 **설정 → 캘린더 → Google 다시 로그인**에서 재연결할 수 있습니다. 기존 OAuth 클라이언트 정보와 기존 Calendar/Tasks 권한을 재사용하므로 JSON을 다시 고를 필요가 없습니다. 기존 연결을 해제하기 전에 재로그인을 먼저 시도하세요.

Google 앱이 외부 사용자용 **Testing** 상태이면 Calendar/Tasks 권한을 가진 갱신 토큰은 7일 뒤 만료될 수 있습니다. 이는 재로그인으로 복구해도 반복될 수 있으며, Google Cloud의 배포 상태를 별도로 검토해야 합니다. 프로젝트 배포 상태 변경은 사용자 승인 후 진행합니다. [Google 공식 문서](https://developers.google.com/identity/protocols/oauth2/#expiration)

## 프로덕션 전환 완료 (2026-10-22)

Haru 홈페이지·개인정보처리방침·약관은 https://ingjae.github.io/haru/ 에 배포했습니다. Google Search Console에서 동일 계정으로 URL 접두어 속성의 HTML 태그 소유권 확인을 완료했으며, 확인 태그는 홈페이지에서 유지해야 합니다. Google OAuth 브랜딩에 홈페이지·privacy.html·terms.html 및 승인된 도메인 ingjae.github.io를 저장했습니다. 앱 이름·지원 이메일·OAuth 클라이언트 및 요청 권한은 유지했습니다.

사용자 승인 후 watt 프로젝트의 watt-app을 Production으로 전환했고 Cloud 화면의 프로덕션 단계를 확인했습니다. 전환 후 기존 Calendar/Tasks 범위로 재로그인하여 실제 일정 3개와 할일 조회를 확인했습니다. Google 앱 검증 심사 완료와는 별개이므로 미검증 앱 경고와 100명 사용자 한도는 남아 있습니다. Testing의 7일 제한이 없어져도 접근 취소·장기 미사용·계정 보안 정책 등 다른 사유로 갱신 토큰이 만료될 수 있으므로 무기한 인증을 보장하지 않습니다. 7일이 지난 뒤의 장기 유지 여부는 아직 실측하지 않았습니다.
