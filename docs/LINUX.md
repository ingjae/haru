# Ubuntu 24.04 AppImage

v0.0.5에 Linux x86_64용 AppImage를 추가합니다. Ubuntu 24.04 GitHub 러너에서 빌드하고 Xvfb 가상 디스플레이에서 패키지의 샘플 일정·할일 생성과 완료 표시를 검사합니다. 실제 Ubuntu 데스크톱의 Google OAuth·Wayland·다중 모니터 동작은 별도 확인이 필요합니다.

릴리즈에서 `Haru-0.0.5-x86_64.AppImage`와 `SHA256SUMS-linux.txt`를 내려받으세요.

```sh
sudo apt install libfuse2t64 gnome-keyring libsecret-1-0 fonts-noto-cjk
sha256sum -c SHA256SUMS-linux.txt
chmod +x Haru-0.0.5-x86_64.AppImage
./Haru-0.0.5-x86_64.AppImage
```

샘플로 살펴보려면 `./Haru-0.0.5-x86_64.AppImage --demo`를 사용합니다. Google 계정은 Linux에서 별도로 연결합니다. 한글 글꼴은 fonts-noto-cjk를 사용합니다. 잠금 해제된 GNOME Keyring이 필요하며 암호화 저장소가 없는 경우 연결을 거부합니다.

왼쪽/오른쪽 레일, 위쪽 패널, 일반 창과 일정·할일 기능을 포함합니다. macOS의 긴 시스템 메뉴바 타임라인·손쉬운 사용 기반 다른 앱 창 조정은 제공하지 않습니다. Linux의 클릭 확장은 포커스를 얻어 바깥 클릭 시 blur로 접히며, 자동 알림 표시는 포커스를 요청하지 않습니다. 트레이 지원은 데스크톱 환경에 따릅니다.

Wayland에서는 앱의 화면 위치 지정·항상 위 요청이 제한될 수 있으므로 화면 가장자리 배치에는 로그인 화면에서 **Ubuntu on Xorg** 세션을 선택하는 것을 권장합니다.

Ubuntu 24.04의 AppArmor 정책으로 Chromium sandbox가 거부되면 시스템 보호를 끄거나 `--no-sandbox`로 실행하지 마세요. 관리자가 설치한 sandbox helper가 필요할 수 있습니다. 이 경우 다음처럼 검증한 AppImage를 고정 경로에 설치할 수 있습니다. 설치 전 체크섬을 먼저 확인하세요.

```sh
./Haru-0.0.5-x86_64.AppImage --appimage-extract
sudo install -d -m 755 /opt/haru-0.0.5
sudo cp -a squashfs-root/. /opt/haru-0.0.5/
sudo chown -R root:root /opt/haru-0.0.5
sudo chmod -R go-w /opt/haru-0.0.5
sudo chmod 4755 /opt/haru-0.0.5/chrome-sandbox
/opt/haru-0.0.5/haru
```

이 설치는 Chromium의 SUID sandbox helper를 root 소유로 구성합니다. CI도 AppImage를 추출한 후 이 helper 방식으로 실행했고, Chromium sandbox를 비활성화하지 않았습니다. 설치 디렉터리를 일반 사용자에게 쓰기 가능하게 변경하지 마세요. [Ubuntu 24.04의 user namespace 정책](https://documentation.ubuntu.com/release-notes/24.04/)과 [Electron Linux 저장소 설명](https://www.electronjs.org/docs/latest/api/safe-storage)을 참고하세요.

데스크톱 실행 환경에 따라 추가 설정이 필요하며 CI의 가상 디스플레이 검증이 이 동작을 보장하지는 않습니다.

빌드:

```sh
npm ci
npm test
npm run package:linux -- --publish never
```

GitHub Actions의 **Linux AppImage** 워크플로는 기본적으로 설치 파일·체크섬을 빌드 아티팩트로 준비합니다. 기존 릴리즈에 업로드하려면 upload_release를 켭니다. v0.0.5의 Mac·Linux 설치 파일은 동일한 제품 소스 284badb에서 빌드했습니다.
