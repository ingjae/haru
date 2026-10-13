# Haru에 기여하기

작은 변경도 환영합니다. 먼저 관련 이슈를 확인하고, 큰 동작 변경은 이슈에서 사용 상황을 설명해 주세요.

## 개발

macOS, Node.js 20 이상, Xcode Command Line Tools에서 `npm ci` → `npm run demo`로 시작합니다. `npm start`는 실제 Google 연결을 사용할 수 있으며, `npm run demo`는 인증을 읽지 않는 별도 샘플 환경입니다.

```sh
npm test
node --check desktop/main.cjs
node --check desktop/preload.cjs
node --check public/app.js
npm run build:native
```

- 항상 보이는 24px 레일과 클릭 확장을 유지해 주세요.
- 자동 표시가 작업 중인 앱의 포커스를 가져오지 않게 해 주세요.
- 사용자 설정과 안전한 OAuth 저장 방식을 보존해 주세요.
- 네이티브 창 변경은 실제 Mac에서 확인하고, 확인하지 못한 동작은 PR에 적어 주세요.
- 인증 JSON, 토큰, 개인 일정·회의 URL이 포함된 화면이나 로그를 올리지 마세요.

## PR

무엇이 불편했는지, 변경 후 어떻게 동작하는지, 어떤 환경에서 검증했는지를 간단히 적어 주세요. UI 변경에는 샘플 모드 화면을 첨부해 주세요. 실제 계정의 쓰기 테스트와 샘플 테스트를 구분해 주세요.

## 제품 미디어

`docs/assets`의 미디어는 실제 Mac 샘플 화면을 사용합니다. 촬영 과정과 재생성 방법은 [미디어 안내](docs/MEDIA.md)를 참고하세요. 일반 수정에 모든 미디어를 다시 만들 필요는 없습니다.

기여한 코드는 프로젝트의 MIT 라이선스로 제공됩니다.
