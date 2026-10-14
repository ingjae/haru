# Haru에 기여하기

작은 변경도 환영합니다. 먼저 관련 이슈를 확인하고, 큰 동작 변경은 이슈에서 사용 상황을 설명해 주세요.

## 개발

Node.js 20 이상이 필요합니다. macOS에서는 Xcode Command Line Tools, Ubuntu에서는 [Linux 런타임 의존성](docs/LINUX.md)을 준비합니다.

```sh
git clone https://github.com/ingjae/haru.git
cd haru
npm ci
npm run demo
```

`npm start`는 macOS Swift 도우미를 먼저 빌드하며 Linux에서는 이 단계를 건너뜁니다. `npm start`는 실제 Google 연결을 사용할 수 있으며, `npm run demo`는 인증을 읽지 않는 별도 샘플 환경입니다.

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

## 실행과 패키징

| 명령 | 용도 |
| --- | --- |
| `npm start` | 실제 Google 연결과 사용자 설정으로 실행 |
| `npm run demo` | 별도 임시 설정과 샘플 일정, Google 연결 차단 |
| `npm run web` | 브라우저 샘플 UI, 데스크톱 기능 제외 |
| `npm test` | 날짜·일정/할일 payload·표시 필터·API 경로·창 동작 모델 검증 |
| `npm run package:mac` | Mac DMG 빌드 |
| `npm run package:linux -- --publish never` | Linux x86_64 AppImage 빌드 |

[Linux AppImage 워크플로](.github/workflows/linux-appimage.yml)는 Ubuntu 24.04에서 빌드하고 Xvfb 샘플 실행을 검증한 뒤 지정한 기존 릴리즈에 파일을 추가합니다. 같은 파일 이름이 이미 존재하면 업로드를 덮어쓰지 않습니다.

## PR

무엇이 불편했는지, 변경 후 어떻게 동작하는지, 어떤 환경에서 검증했는지를 간단히 적어 주세요. UI 변경에는 샘플 모드 화면을 첨부해 주세요. 실제 계정의 쓰기 테스트와 샘플 테스트를 구분해 주세요.

## 제품 미디어

`docs/assets`의 미디어는 실제 Mac 샘플 화면을 사용합니다. 촬영 과정과 재생성 방법은 [미디어 안내](docs/MEDIA.md)를 참고하세요. 일반 수정에 모든 미디어를 다시 만들 필요는 없습니다.

기여한 코드는 프로젝트의 MIT 라이선스로 제공됩니다.
