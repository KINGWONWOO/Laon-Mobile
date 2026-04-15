> Edited for use in IDX on 07/09/12

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

### 1. 푸시 알림 및 스케줄러 시스템 통합
*   **전체 알림**: 공지사항, 투표, 일정, 피드백 영상, 아카이브 업로드 시 방 멤버 전원에게 실시간 푸시 알림을 발송합니다.
*   **댓글 알림**: 게시글에 댓글이나 대댓글이 달릴 경우 원본 게시자에게 알림을 보냅니다.
*   **30분 전 미참여자 리마인드**: 일정 투표나 일반 투표 마감 30분 전에 아직 참여하지 않은 멤버에게만 자동으로 리마인드 알림을 보냅니다.
*   **알림 제어 UI**: 일정 및 투표 생성 시 알림 발송 여부를 선택할 수 있는 토글과 마감 기한 설정 UI를 추가했습니다.

### 2. 동선 관리 시스템 고도화 (Formation Editor)
*   **타임라인 시각화 및 자동 배치**: 대형 배치 시 **3초 유지 블록**이 생성되며, 블록 간 **2초의 자동 간격(GAP)**을 유지합니다.
*   **X자 트랜지션 시각화**: 대형 블록 사이의 이동 구간에 시각적인 트랜지션 애니메이션을 추가했습니다.
*   **부드러운 보간 이동**: In-Out Quad 보간법을 적용하여 끊김 없는 이동을 지원합니다.
*   **실시간 타임라인 스크러빙**: 재생 바 드래그 시 댄서 위치가 실시간으로 반영됩니다.

### 3. UI/UX 및 레이아웃 최적화
*   **풀스크린 룸 UI**: 방 내부 화면에서 탭 헤더를 제거하여 몰입감을 높였습니다.
*   **커스텀 헤더**: 세이프 에리어(Safe Area)가 적용된 커스텀 헤더를 모든 주요 화면에 도입했습니다.

---

## 🛠️ 개발 단계 트러블슈팅 가이드

현재 프로젝트 개발 과정에서 발생한 주요 이슈와 임시 해결 방법입니다.

### 1. Supabase Edge Function: `Invalid JWT` 에러
*   **해결**: `npx supabase functions deploy <name> --no-verify-jwt` 명령어로 재배포하거나, 앱에서 로그아웃 후 다시 로그인하세요.

### 2. Cloudflare R2 업로드 진단
*   **해결**: 콘솔 로그의 **[Storage] Auth Diagnosis** 섹션을 통해 세션 및 프로젝트 URL 설정을 확인하세요.

---

## 🚀 배포 전 필수 보안 점검 목록 (Production Checklist)

**실제 서비스 배포 전 반드시 아래 항목들을 다시 점검하고 원상복구해야 합니다.**

### 1. Edge Function JWT 검증 활성화
*   `supabase/config.toml`에서 `verify_jwt = true`로 변경하고 재배포하세요.

### 2. CORS 정책 제한
*   `Access-Control-Allow-Origin`을 모든 도메인(`*`)에서 실제 서비스 도메인으로 축소하세요.

### 3. 푸시 알림 제한 (Expo Go Restriction)
*   **현재**: 개발 편의를 위해 `NotificationService.ts`에서 Expo Go 제한을 풀어둔 상태입니다.
*   **조치**: 실제 앱 배포 시에는 토큰 체계 혼선을 방지하기 위해 `registerForPushNotificationsAsync` 함수에서 `isExpoGo`일 경우 실행을 중단하도록 다시 제한을 거는 것을 권장합니다.

### 4. 환경 변수(Secrets) 보안 강화
*   R2 Access Key 등은 반드시 Supabase Vault나 `supabase secrets set`을 통해 관리하세요.

---

## Learn more

Look at [Expo documentation](https://docs.expo.dev/) for more details.
