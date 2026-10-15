# Haru 설치

[최신 릴리즈](https://github.com/ingjae/haru/releases/latest)에서 플랫폼에 맞는 파일과 체크섬을 내려받습니다. Google OAuth JSON은 배포 파일에 포함되어 있지 않습니다.

## macOS · Apple Silicon

1. `Haru-0.0.5-arm64.dmg`와 `SHA256SUMS.txt`를 같은 폴더에 내려받습니다.
2. 터미널에서 다운로드 폴더로 이동해 무결성을 확인합니다.

   ```sh
   shasum -a 256 -c SHA256SUMS.txt
   ```

3. DMG를 열고 **Haru를 Applications로 옮긴 뒤 실행**합니다.
4. [Google 연결](GOOGLE_SETUP.md)을 진행합니다. 연결 전에는 샘플 일정이 표시됩니다.

현재 Mac 배포는 Apple Silicon arm64 전용이며 서명·공증하지 않은 개발 패키지입니다. macOS가 실행을 제한할 수 있습니다. Intel Mac 패키지, 자동 업데이트, 로그인 시 자동 실행은 아직 제공하지 않습니다.

## Ubuntu 24.04 · x86_64

`Haru-0.0.5-x86_64.AppImage`와 `SHA256SUMS-linux.txt`를 받습니다. FUSE·한글 글꼴·GNOME Keyring 및 sandbox 설정은 [Linux 설치 안내](LINUX.md)를 따르세요.

macOS 메뉴바 타임라인과 다른 앱의 창 배치 보정은 Linux에서 지원하지 않습니다. 실제 GNOME/Wayland의 화면 배치와 Google OAuth는 별도 검증이 필요합니다.

## 설치 후

- [Google 계정 연결·오류 해결](GOOGLE_SETUP.md)
- [일정·할일·표시 설정](USAGE.md)
- [소스로 실행·빌드](../CONTRIBUTING.md#개발)
