> Edited for use in IDX on 07/
09/12

# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

#### Android

Android previews are defined as a `workspace.onStart` hook and started as a vscode task when the workspace is opened/started.

Note, if you can't find the task, either:
- Rebuild the environment (using command palette: `IDX: Rebuild Environment`), or
- Run `npm run android -- --tunnel` command manually run android and see the output in your terminal. The device should pick up this new command and switch to start displaying the output from it.

In the output of this command/task, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You'll also find options to open the app's developer menu, reload the app, and more.

#### Web

Web previews will be started and managred automatically. Use the toolbar to manually refresh.

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## ✅ 최신 업데이트 내역 (Latest Updates)

### 1. 동선 관리 시스템 고도화 (Formation Editor)
*   **정사각형 그리드 시스템**: 격자 설정(가로/세로 개수)에 따라 스테이지 크기가 유동적으로 변하며, 항상 완벽한 정사각형 비율을 유지하여 정밀한 대형 설계가 가능합니다.
*   **확대/축소 및 자유 이동 (Zoom & Pan)**: 스테이지 우측 상단 줌 조절 버튼(50%~300%)을 통해 무대를 세밀하게 살피거나 전체를 조감할 수 있습니다. 줌 상태에서도 상하좌우 자유로운 스크롤이 가능합니다.
*   **정밀 자석 스냅 (Enhanced Snapping)**: 격자의 교차점뿐만 아니라 **격자 칸의 정중앙(Midpoint)**에도 댄서가 자석처럼 달라붙도록 로직을 개선하여 배치 자유도를 2배로 높였습니다.
*   **사용자 가이드 모달**: '사용방법' 버튼을 통해 댄서 관리부터 내보내기까지의 과정을 단계별(이미지/텍스트)로 안내하는 가이드를 제공합니다. 모달 오픈 시 항상 1페이지부터 시작하도록 설계되었습니다.
*   **무대 방향 직관화**: AUDIENCE(관객석)와 BACKSTAGE(무대 뒤) 라벨이 무대 앞 방향 설정에 따라 동적으로 위치를 바꿉니다.

### 2. UI/UX 및 레이아웃 최적화
*   **풀스크린 룸 UI**: 방 내부 화면에서 불필요한 상단 탭 헤더를 제거하여 더 넓고 몰입감 있는 화면을 제공합니다.
*   **커스텀 헤더 시스템**: 영상 피드백, 사진 아카이브 등 각 주요 화면에 기기별 세이프 에리어(Safe Area) 패딩이 적용된 커스텀 헤더와 뒤로가기 버튼을 추가하여 사용성을 높였습니다.
*   **애니메이션 안정성**: Reanimated SharedValue 초기화 및 렌더링 로직을 최적화하여 댄서 이동 시 발생하던 위치 튐 현상이나 이동 불가 버그를 해결했습니다.

### 3. 데이터 및 인프라
*   **로컬 저장소 점검**: `AsyncStorage`를 통한 동선 데이터(`local_formations`)의 안정적인 저장 및 불러오기 기능을 확인했습니다.

---

## 🛠️ 개발 단계 트러블슈팅 가이드

현재 프로젝트 개발 과정에서 발생한 주요 이슈와 임시 해결 방법(Workarounds)입니다.

### 1. Supabase Edge Function: `Invalid JWT` 에러 (401 Unauthorized)
Edge Function 호출 시 클라이언트의 인증 토큰(JWT)이 원격 서버의 보안 정책과 맞지 않아 발생합니다. 특히 로컬 개발 환경과 원격 서버 환경이 섞여 있을 때 자주 발생합니다.

*   **임시 해결 방법 (JWT 검증 비활성화)**:
    개발 중에는 보안 검증을 건너뛰고 기능 테스트를 우선하기 위해 아래 명령어로 함수를 다시 배포하세요.
    ```bash
    npx supabase functions deploy get-r2-upload-url --no-verify-jwt
    ```
*   **근본 해결 방법**: 
    1. 앱에서 로그아웃 후 다시 로그인하여 새로운 세션 토큰을 발급받습니다.
    2. 에뮬레이터에서 앱을 삭제 후 재설치하여 기존의 잘못된 토큰 정보를 제거합니다.
    3. `lib/supabase.ts`의 `EXPO_PUBLIC_SUPABASE_ANON_KEY`가 원격 프로젝트의 대시보드와 일치하는지 확인합니다.

### 2. Cloudflare R2 업로드 진단
파일 업로드(`storageService.ts`) 과정에서 발생하는 문제는 콘솔 로그의 **[Storage] Auth Diagnosis** 섹션을 확인하세요.

*   `hasSession`: 세션 존재 여부 (false면 로그인 필요)
*   `expiresAt`: 토큰 만료 시간 (과거 시간일 경우 재로그인 필요)
*   `Project URL`: 현재 요청을 보내는 Supabase 서버 주소

### 3. 로컬 Docker 및 환경 설정
IDX 환경에서 `npx supabase stop/start` 시 Docker daemon 연결 에러가 날 수 있습니다. 이 경우 IDX 서비스 탭에서 Docker 서비스가 실행 중인지 확인하거나, IDE를 새로고침하세요.

---

## 🚀 배포 전 필수 보안 점검 목록 (Production Checklist)

현재 개발 효율을 위해 적용된 임시 조치들입니다. **실제 서비스 배포 전 반드시 아래 항목들을 다시 점검하고 원상복구해야 합니다.**

### 1. Edge Function JWT 검증 활성화
*   **현재**: 테스트 편의를 위해 `verify_jwt = false` 또는 `--no-verify-jwt`로 배포됨.
*   **조치**: `supabase/config.toml`에서 `verify_jwt = true`로 변경하고, 모든 함수를 다시 배포하여 비로그인 사용자의 접근을 차단하세요.

### 2. CORS 정책 제한 (Access-Control-Allow-Origin)
*   **현재**: 모든 도메인(`*`)의 요청을 허용 중.
*   **조치**: `index.ts`의 헤더 설정에서 `*` 대신 실제 서비스할 앱의 도메인 또는 허용된 출처로 범위를 좁히세요.

### 3. 상세 에러 로그 및 진단 코드 제거
*   **현재**: `storageService.ts`와 Edge Function에서 상세한 세션 정보 및 에러 객체를 JSON으로 출력 중.
*   **조치**: 운영 환경에서 민감한 정보(토큰 정보 등)가 로그에 남지 않도록 콘솔 로그를 제거하거나 로거(Logger) 수준을 조정하세요.

### 4. 환경 변수(Secrets) 보안 강화
*   **현재**: `.env` 파일과 로컬 시크릿에 의존 중.
*   **조치**: R2 Access Key 등 민감한 정보는 Supabase Vault 또는 `supabase secrets set`을 통해 원격 서버에만 안전하게 저장하세요.

### 5. R2 버킷 권한 및 CORS 재설정
*   **현재**: 개발 중 자유로운 업로드를 위해 버킷 정책이 다소 유연할 수 있음.
*   **조치**: Cloudflare R2 대시보드에서 CORS 설정을 확인하고, 실제 필요한 메서드(PUT, GET 등)와 도메인만 허용하도록 고정하세요.

---

## Learn more

To learn more about developing your project with Expo, look at the following resources:
...

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
