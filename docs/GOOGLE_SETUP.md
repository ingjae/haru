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

처음에는 기본 캘린더의 오늘 일정만 표시합니다. 다른 캘린더의 일정이 없다면 실패가 아니라 현재 지원 범위일 수 있습니다.

## 연결 해제

앱의 연결 해제는 이 Mac의 저장 인증을 삭제합니다. Google 쪽 접근 권한은 [Google 계정 연결 관리](https://myaccount.google.com/connections)에서 별도로 취소할 수 있습니다.

참고: [Google Desktop OAuth](https://developers.google.com/identity/protocols/oauth2/native-app), [Calendar API 빠른 시작](https://developers.google.com/workspace/calendar/api/quickstart/python).
