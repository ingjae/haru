# Ubuntu 24.04 AppImage

v0.0.3에 Linux x86_64용 AppImage를 추가합니다. Ubuntu 24.04 GitHub 러너에서 빌드하고 Xvfb 가상 디스플레이에서 패키지의 샘플 일정·할일 생성과 완료 표시를 검사합니다. 실제 Ubuntu 데스크톱의 Google OAuth·Wayland·다중 모니터 동작은 별도 확인이 필요합니다.

릴리즈에서 `Haru-0.0.3-x86_64.AppImage`와 `SHA256SUMS-linux.txt`를 내려받으세요.

```sh
sudo apt install libfuse2t64 gnome-keyring libsecret-1-0
sha256sum -c SHA256SUMS-linux.txt
chmod +x Haru-0.0.3-x86_64.AppImage
./Haru-0.0.3-x86_64.AppImage
```

샘플로 살펴보려면 `./Haru-0.0.3-x86_64.AppImage --demo`를 사용합니다. Google 계정은 Linux에서 별도로 연결합니다. 잠금 해제된 GNOME Keyring이 필요하며 암호화 저장소가 없는 경우 연결을 거부합니다.

왼쪽/오른쪽 레일, 위쪽 패널, 일반 창과 일정·할일 기능을 포함합니다. macOS의 긴 시스템 메뉴바 타임라인·손쉬운 사용 기반 다른 앱 창 조정은 제공하지 않습니다. Linux의 클릭 확장은 포커스를 얻어 바깥 클릭 시 blur로 접히며, 자동 알림 표시는 포커스를 요청하지 않습니다. 트레이 지원은 데스크톱 환경에 따릅니다.

Wayland에서는 앱의 화면 위치 지정·항상 위 요청이 제한될 수 있으므로 화면 가장자리 배치에는 로그인 화면에서 **Ubuntu on Xorg** 세션을 선택하는 것을 권장합니다.

Ubuntu 24.04의 AppArmor 정책으로 Chromium sandbox가 거부되면 시스템 보호를 끄거나 `--no-sandbox`로 실행하지 마세요. 설치 경로를 지정한 AppArmor 정책 또는 관리자가 설치한 sandbox helper가 필요할 수 있습니다. 데스크톱 실행 환경에 따라 추가 설정이 필요하며 CI의 가상 디스플레이 검증이 이 동작을 보장하지는 않습니다.

빌드:

```sh
npm ci
npm test
npm run package:linux -- --publish never
```

GitHub Actions의 **Linux AppImage** 워크플로를 main에서 실행하면 기존 릴리즈에 AppImage와 Linux 체크섬을 추가합니다. 기존 Mac DMG와 태그는 변경하지 않습니다. Linux 보완 소스는 v0.0.3 태그 이후 main 커밋에서 빌드됩니다.
