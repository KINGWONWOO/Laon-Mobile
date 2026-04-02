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

## Learn more

To learn more about developing your project with Expo, look at the following resources:
...

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
