# 💃 LAON (댄스 팀 협업 플랫폼)

> **"연습 영상 피드백부터 동선 편집, 일정 조율까지 — 댄스 팀을 위한 올인원 협업 앱"**
>
> *React Native + Expo + Supabase를 활용한 크로스플랫폼 모바일 앱 개발 포트폴리오입니다.*

---

## 📋 1. 프로젝트 개요

*   **프로젝트명:** LAON
*   **장르/분류:** 댄스 팀 협업 / 영상 피드백 / 생산성
*   **개발 인원:** 1인 개발 (강원우)
*   **역할:** 기획, UI/UX 디자인, 프론트엔드, 백엔드(Edge Function), DB 설계, 배포까지 **전 과정 단독 수행**
*   **개발 기간:** 2026.03 ~ 2026.05 (약 7주)
*   **플랫폼:** iOS (App Store) · Android (Google Play) — 출시 준비 중
*   **핵심 목표:**
    *   **1인 풀스택 개발 파이프라인 완성:** 기획부터 DB 마이그레이션, Edge Function, 스토어 배포까지 전체 과정을 단독으로 수행하며 모바일 앱 개발 전체 흐름 경험
    *   **Supabase BaaS 심층 활용:** Realtime, RLS, Edge Function(Deno), pg_cron을 결합한 서버리스 백엔드 설계
    *   **React Native Reanimated / Gesture Handler 기반** 고성능 타임라인 에디터 구현 (JS 스레드 분리 / Worklet)
    *   **Claude AI와의 협업 개발:** 아키텍처 설계, 알고리즘 구현, 디버깅 전 과정에서 AI를 개발 파트너로 활용

---

## 🛠️ 2. 사용 기술 (Tech Stack)

### Framework & Language

| 항목 | 기술 |
|------|------|
| 앱 프레임워크 | React Native 0.81 + Expo SDK 54 |
| 언어 | TypeScript 5.9 |
| 라우팅 | Expo Router v6 (파일 기반 라우팅) |
| 상태 관리 | React Context API + TanStack React Query 5 |
| 애니메이션 | React Native Reanimated 4 + Gesture Handler 2 |
| IDE | VS Code |

### Backend & Infrastructure

| 항목 | 기술 |
|------|------|
| BaaS | Supabase (PostgreSQL 15 + Auth + Realtime + Storage) |
| 서버리스 함수 | Supabase Edge Functions (Deno 런타임) |
| 미디어 스토리지 | Cloudflare R2 (S3 호환 API, CDN) |
| 푸시 알림 | Expo Push Notification API |
| 스케줄러 | Supabase pg_cron (마감 30분 전 리마인더) |
| 에러 모니터링 | Sentry for React Native |

### 미디어 & UI

| 항목 | 기술 |
|------|------|
| 영상 재생 | expo-video |
| 오디오 | expo-audio |
| 이미지 | expo-image, expo-image-picker, expo-image-manipulator |
| 문서/파일 | expo-document-picker, expo-file-system, expo-sharing |
| 광고 | react-native-google-mobile-ads (AdMob) |
| 국제화 | 자체 번역 시스템 (7개 언어) |

### 소셜 로그인

| 제공자 | 방식 |
|--------|------|
| Google | OAuth 2.0 PKCE (`expo-auth-session`) |
| Kakao | OAuth 2.0 PKCE (`expo-auth-session`) |
| Apple | Sign in with Apple (`expo-apple-authentication`, iOS 전용) |
| 이메일 | 6자리 인증 코드 + Edge Function 검증 후 회원가입 |

### Generative AI Tools

*   **Claude (Anthropic):** 아키텍처 설계, 코드 생성, 버그 분석, 다국어 번역 전 과정에서 개발 파트너로 활용
*   **Claude Code:** CLI 기반 코드 생성 및 리팩터링 자동화

---

## 🔗 3. 시스템 구성

```
┌─────────────────────────────────────────────┐
│           React Native 앱 (Expo)             │
│                                             │
│  Expo Router (파일 기반 라우팅)               │
│  AppContext + React Query (전역 상태/캐시)    │
│  Services Layer (auth / room / storage)     │
└───────────────────┬─────────────────────────┘
                    │ HTTPS / WebSocket
        ┌───────────┴──────────────┐
        │        Supabase          │
        │  PostgreSQL (RLS 적용)   │
        │  Realtime WebSocket      │
        │  Auth (JWT + PKCE)       │
        │                          │
        │  Edge Functions (Deno)   │
        │  ├ push-notification     │
        │  ├ deadline-reminder     │
        │  ├ verify-and-signup     │
        │  ├ get-r2-upload-url     │
        │  ├ delete-r2-objects     │
        │  ├ delete-account        │
        │  └ send-verification-email│
        └───────────┬──────────────┘
                    │ S3 API
           ┌────────┴────────┐
           │  Cloudflare R2  │
           │  (미디어 CDN)   │
           └─────────────────┘
```

*   **미디어 업로드 흐름:** 앱 → `get-r2-upload-url` Edge Function(Presigned URL 발급) → R2 직접 업로드 → DB에 URL 저장
*   **실시간 동기화:** `supabase.channel('global-sync').on('postgres_changes', ...)` 구독으로 방 멤버 전원 즉시 반영
*   **알림 흐름:** DB 이벤트 발생 → AppContext에서 Edge Function 호출 → Expo Push API → 기기 알림

---

## 🎮 4. 화면 구성 및 핵심 기능 구현

### 4.1 소셜 로그인 — PKCE + Implicit Fallback

**역할:** Google · Kakao · Apple 소셜 계정으로 1-tap 로그인. 딥링크 콜백으로 세션을 안전하게 복구합니다.

**구현 내용:**
- PKCE(Proof Key for Code Exchange) 플로우로 인가 코드 교환
- URL에 `code` 파라미터가 있을 경우 `exchangeCodeForSession` 시도, 실패 시 `access_token` 직접 파싱으로 Implicit 플로우 Fallback
- `expo-web-browser`로 외부 브라우저를 열어 `laondancefeedback://auth/callback` 딥링크로 복귀

<details>
<summary>💻 소셜 로그인 PKCE + Fallback 처리 코드 (authService.ts) — 접기/펼치기</summary>

```typescript
// PKCE 보안을 위해 verifier가 저장될 시간 확보 (AsyncStorage 지연 대응)
await new Promise(resolve => setTimeout(resolve, 500));

const res = await WebBrowser.openAuthSessionAsync(oauthData.url, redirectTo);

if (res.type === 'success' && res.url) {
  // '#' → '?' 치환으로 fragment와 query 모두 URLSearchParams로 파싱
  const urlObj = new URL(res.url.replace('#', '?'));
  const code = urlObj.searchParams.get('code');

  if (code) {
    const { data: sessionData, error: sessionError } =
      await supabase.auth.exchangeCodeForSession(res.url);

    if (!sessionError) {
      return { data: sessionData, error: null };
    }
    // verifier 누락 등으로 실패 시 Implicit Fallback으로 진행
  }

  // Fallback: URL에서 access_token 직접 파싱
  const access_token = urlObj.searchParams.get('access_token');
  const refresh_token = urlObj.searchParams.get('refresh_token');

  if (access_token) {
    const { data, error } = await supabase.auth.setSession({
      access_token,
      refresh_token: refresh_token || '',
    });
    return { data, error };
  }
}
```
</details>

---

### 4.2 영상 피드백 플레이어

**역할:** 연습 영상을 팀원들과 공유하고, 타임스탬프 기반 댓글로 구체적인 피드백을 주고받습니다.

**구현 내용:**
- 재생 속도 0.25×~2× 조절 (핏치 보정 적용)
- 3초 후 자동 숨김 컨트롤 레이어 (탭으로 토글)
- 좌우 반전(Mirror) 모드 — `scaleX(-1)` transform
- 전체화면 · 가로모드 레이아웃 자동 전환 (`expo-screen-orientation`)
- Safe Area Inset 적용으로 노치/홈 인디케이터 겹침 방지
- Cloudflare R2 Presigned URL 직접 업로드 후 DB에 URL 저장

---

### 4.3 동선 에디터 — 음원 파형 분석 (Waveform Analysis)

**역할:** 음원 파일을 불러와 파형을 시각화하고, 댄서들의 대형 배치 타임라인과 동기화합니다.

**구현 내용:**
- WebView 내 Web Audio API(`AudioContext`)로 오디오 디코딩 후 **DAW 표준 피크 검출(Peak Detection)** 방식으로 파형 데이터 추출
- 초당 20샘플 추출 → 각 블록 내 `Math.max(|L|, |R|)` 값으로 피크 계산 → 최대값으로 정규화
- **30초 단위 타일 분할:** 전체 음원을 30초 청크로 분리, 각 청크를 별도 Canvas(2× DPR)에 렌더링 후 PNG Data URL로 직렬화 → RN `<Image>`로 표시

<details>
<summary>💻 파형 분석 및 고해상도 타일 생성 코드 ([formationId].tsx) — 접기/펼치기</summary>

```javascript
// WebView에 주입되는 오디오 분석 스크립트
audioCtx.decodeAudioData(bytes.buffer, (audioBuffer) => {
  const ch0 = audioBuffer.getChannelData(0);
  const ch1 = audioBuffer.numberOfChannels > 1
    ? audioBuffer.getChannelData(1) : ch0;

  const samplesPerSec = 20; // 초당 20 샘플 (2배 정밀도)
  const totalSamples = Math.floor(audioBuffer.duration * samplesPerSec);
  const blockSize = Math.floor(ch0.length / totalSamples);
  const peaks = [];

  for (let i = 0; i < totalSamples; i++) {
    const start = blockSize * i;
    let peakVal = 0;
    for (let j = 0; j < blockSize; j++) {
      // 스테레오 → 모노: 두 채널의 절댓값 중 최댓값 사용
      const mono = Math.max(
        Math.abs(ch0[start + j] || 0),
        Math.abs(ch1[start + j] || 0)
      );
      if (mono > peakVal) peakVal = mono;
    }
    peaks.push(peakVal);
  }

  const maxPeak = Math.max(...peaks) || 1;
  const normalized = peaks.map(p => p / maxPeak);

  // [Pro Tiling] 30초 단위 Canvas 분할 → 2× DPR 고해상도 렌더링
  for (let s = 0; s < numSegments; s++) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const dpr = 2.0; // 고해상도
    canvas.width  = targetWidth  * dpr;
    canvas.height = targetHeight * dpr;
    ctx.scale(dpr, dpr);

    segmentPeaks.forEach((p, i) => {
      const h = Math.max(2, p * 48);
      const opacity = p > 0.3 ? 0.4 : 0.18;
      ctx.fillStyle = `rgba(${r},${g},${b},${opacity})`;
      ctx.fillRect(i * slotWidth, (targetHeight - h) / 2, 1.2, h);
    });

    tiles.push(canvas.toDataURL('image/png'));
  }
});
```
</details>

---

### 4.4 동선 에디터 — 오디오 자동 압축

**역할:** 2.5 MB를 초과하는 음원 파일을 앱 내에서 자동으로 64 kbps Mono MP3로 압축하여 업로드 비용과 재생 지연을 줄입니다.

**구현 내용:**
- WebView에 `lamejs` 라이브러리를 주입하여 MP3 인코딩 처리
- `ReactNativeWebView.postMessage`로 압축 진행률(0~100%)을 RN 쪽에 실시간 전달
- 완료된 MP3 Data URL을 Base64로 디코딩하여 `expo-file-system`에 저장

<details>
<summary>💻 WebView 기반 오디오 압축 코드 (formation/index.tsx) — 접기/펼치기</summary>

```typescript
const compressAudio = async (uri: string): Promise<string> => {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const compressScript = `
    (async () => {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const audioBuffer = await audioCtx.decodeAudioData(bytes.buffer);

      // 64kbps Mono로 최적화
      const mp3encoder = new lamejs.Mp3Encoder(1, audioBuffer.sampleRate, 64);
      const ch0 = audioBuffer.getChannelData(0);
      const sampleBlockSize = 1152;

      for (let i = 0; i < ch0.length; i += sampleBlockSize) {
        const samples = new Int16Array(sampleBlockSize);
        for (let j = 0; j < sampleBlockSize; j++) {
          if (i + j < ch0.length)
            samples[j] = Math.max(-1, Math.min(1, ch0[i + j])) * 32767;
        }
        const mp3buf = mp3encoder.encodeBuffer(samples);
        if (mp3buf.length > 0) mp3Data.push(mp3buf);

        // 150 블록마다 진행률 전송
        if (i % (sampleBlockSize * 150) === 0) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'COMPRESSION_PROGRESS',
            progress: i / ch0.length,
          }));
        }
      }
      // 결과 전송
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'COMPRESSION_RESULT', data: reader.result
      }));
    })();
  `;

  // 2.5MB 초과 시에만 압축 실행
  if (fInfo.size > 2.5 * 1024 * 1024) {
    webViewRef.current?.injectJavaScript(compressScript);
  }
};
```
</details>

---

### 4.5 동선 에디터 — 댄서 위치 보간 (Formation Interpolation)

**역할:** 타임라인 블록 사이의 GAP 구간에서 댄서들이 끊김 없이 부드럽게 이동하도록 보간합니다.

**구현 내용:**
- Reanimated `useAnimatedReaction`으로 JS 스레드를 차단하지 않고 UI 스레드에서 위치 계산
- 타임라인 블록 간 GAP 구간에 **Ease In-Out (smoothstep)** 공식 적용
- 댄서 좌표 `SharedValue`를 직접 업데이트하여 React 리렌더 없이 60 fps 애니메이션 유지

<details>
<summary>💻 타임라인 보간 코드 ([formationId].tsx) — 접기/펼치기</summary>

```typescript
useAnimatedReaction(
  () => ({ time: currentTimeMs.value, sortedTimeline, mode, scenes }),
  (data) => {
    if (data.mode !== 'place') return;

    // 현재 시간에 해당하는 이전/다음 블록 탐색
    let prevE = null, nextE = null;
    for (const e of data.sortedTimeline) {
      if (e.timestampMillis <= data.time) prevE = e;
      else { nextE = e; break; }
    }

    dancers.forEach(d => {
      const getScenePos = (sId: string) =>
        data.scenes.find(s => s.id === sId)?.positions[d.id] ?? { x: 0.5, y: 0.5 };

      let p = { x: 0.5, y: 0.5 };

      if (prevE) {
        const prevPos = getScenePos(prevE.sceneId);

        if (data.time <= prevE.timestampMillis + prevE.durationMillis) {
          // 블록 내부: 고정 위치
          p = prevPos;
        } else if (nextE) {
          // GAP 구간: Ease In-Out 보간
          const nextPos  = getScenePos(nextE.sceneId);
          const gapStart = prevE.timestampMillis + prevE.durationMillis;
          const gapEnd   = nextE.timestampMillis;
          const t = Math.max(0, Math.min(1, (data.time - gapStart) / (gapEnd - gapStart)));

          // smoothstep (Ease In-Out)
          const ease = t < 0.5
            ? 2 * t * t
            : 1 - Math.pow(-2 * t + 2, 2) / 2;

          p = {
            x: prevPos.x + (nextPos.x - prevPos.x) * ease,
            y: prevPos.y + (nextPos.y - prevPos.y) * ease,
          };
        } else {
          p = prevPos;
        }
      }

      // SharedValue 직접 업데이트 → React 리렌더 없이 UI 스레드에서 처리
      if (dancerPositions[d.id]) dancerPositions[d.id].value = p;
    });
  },
  [mode, sortedTimeline, scenes, dancers],
);
```
</details>

---

### 4.6 실시간 데이터 동기화 (Supabase Realtime)

**역할:** 방 멤버 중 누군가 공지·피드백·투표를 올리면, 다른 멤버들의 화면에 즉시 반영됩니다.

**구현 내용:**
- `AppContext` 마운트 시 `postgres_changes` 이벤트를 구독하여 모든 테이블 변경 감지
- 변경 감지 시 `refreshAllData()` 호출 → TanStack React Query 캐시 무효화 → 화면 자동 갱신

```typescript
// AppContext.tsx
const channel = supabase
  .channel('global-sync')
  .on('postgres_changes', { event: '*', schema: 'public' }, () => {
    refreshAllData();
  })
  .subscribe();

return () => { supabase.removeChannel(channel); };
```

---

### 4.7 일정 조율 — 연속 가능 시간대 랭킹

**역할:** 모든 멤버가 가능하다고 응답한 날짜들 중 연속으로 이어지는 구간을 자동으로 계산하여 최적 일정을 제안합니다.

**구현 내용:**
- 각 날짜 옵션의 응답자 수 집계 → 전원 참여 가능 날짜 필터링
- 연속 날짜 그룹화 알고리즘으로 최장 연속 구간 순 정렬
- 히트맵 색상으로 참여율 시각화

---

### 4.8 멤버십 & 쿠폰 시스템

**역할:** 동선 에디터 등 Pro 기능에 대한 구독 관리 및 쿠폰 코드 활성화를 제공합니다.

**구현 내용:**
- Supabase `coupons` 테이블에서 쿠폰 코드 유효성 검증 (`maybeSingle()`로 null-safe 처리)
- `subscriptions` 테이블에 `upsert`로 Pro 상태 저장
- `checkProAccess()` 함수로 각 화면 진입 시 권한 체크 및 멤버십 화면으로 유도

---

## 📚 5. 기술 문서

### 5.1 인증 아키텍처

*   **이메일 인증 플로우:** 앱 → `send-verification-email` Edge Function → 6자리 코드 발송 → `verify-and-signup` Edge Function에서 검증 + 계정 생성 (클라이언트가 직접 Supabase Auth에 접근하지 않음)
*   **소셜 로그인 PKCE 플로우:** `expo-auth-session` → 외부 브라우저 → 제공자 로그인 → `laondancefeedback://auth/callback` 딥링크 복귀 → PKCE 코드 교환 or Implicit Fallback
*   **세션 복구:** 앱 실행 시 `supabase.auth.getSession()`으로 로컬 저장 세션 복원. `onAuthStateChange` 리스너로 토큰 갱신 자동 처리

### 5.2 미디어 스토리지 전략

*   **Presigned URL 방식:** 클라이언트가 직접 R2에 접근하지 않고, Edge Function에서 서명된 URL을 발급받아 대용량 파일을 안전하게 업로드
*   **오디오 캐싱:** 파형 분석 시 원격 음원을 `FileSystem.cacheDirectory`에 URL 해시 기반 파일명으로 저장 → 재진입 시 재다운로드 없이 캐시 사용
*   **오디오 자동 압축:** 2.5 MB 초과 파일은 WebView 내 `lamejs`로 64 kbps Mono MP3 변환 후 업로드

### 5.3 성능 최적화

*   **JS 스레드 분리:** Formation 에디터의 댄서 위치 계산은 `useAnimatedReaction` + `SharedValue`로 UI 스레드에서 처리하여 JS 스레드 과부하 방지
*   **파형 타일링:** 전체 음원을 하나의 캔버스로 렌더링하지 않고 30초 단위로 분할, `<Image>` 컴포넌트로 필요한 영역만 표시 (메모리 절약)
*   **재생 엔진 스로틀링:** `currentTimeMs` SharedValue 업데이트를 16ms(60fps) 단위로 throttle하여 Reanimated Worklet 과부하 방지
*   **React.memo + useMemo:** `WaveformTile`, `TimeMarker`, `DancerNode` 등 빈번히 리렌더되는 컴포넌트 전체에 메모이제이션 적용

### 5.4 DB 설계 (주요 테이블)

| 테이블 | 역할 |
|--------|------|
| `profiles` | 사용자 기본 정보, 푸시 토큰, 구독 상태 |
| `rooms` | 방 정보, 멤버 ID 배열, 방장 ID |
| `room_profiles` | 방별 독립 닉네임·아바타 |
| `video_feedbacks` | 피드백 영상 URL, 안무 영상 URL |
| `video_comments` | 타임스탬프 포함 댓글·대댓글 |
| `formations` | 동선 타이틀, 오디오 URL, 편집 데이터(JSON) |
| `schedules` | 일정 조율 옵션·응답 |
| `votes` | 투표 질문·옵션·응답, 익명 여부 |
| `notices` | 공지 제목·내용·이미지 URL 배열 |
| `gallery` | 아카이브 사진·영상 |
| `subscriptions` | Pro 구독 상태, 만료일 |
| `coupons` | 쿠폰 코드, 사용 여부 |
| `developer_feedback` | 앱 내 개발자 피드백 제출 |
| `content_reports` | 콘텐츠 신고 |

---

## 📂 6. 프로젝트 구조

```
laon-dance-feedback/
├── app/                        # Expo Router 파일 기반 라우팅
│   ├── _layout.tsx             # 루트 레이아웃 (인증 게이트)
│   ├── index.tsx               # 로그인 화면
│   ├── register.tsx            # 회원가입
│   ├── subscription.tsx        # 멤버십 화면
│   ├── auth/callback.tsx       # 소셜 로그인 딥링크 콜백
│   ├── legal/                  # 개인정보처리방침 · 이용약관
│   └── room/[id]/              # 방 내부 화면 (동적 라우트)
│       ├── index.tsx           # 피드백 영상 목록
│       ├── feedback.tsx        # 피드백 플레이어
│       ├── archive.tsx         # 아카이브 (SNS형 갤러리)
│       ├── notices.tsx         # 공지사항 목록
│       ├── notice/[noticeId].tsx
│       ├── schedule.tsx        # 일정 조율
│       ├── vote.tsx            # 투표
│       └── formation/          # 동선 에디터
│           ├── index.tsx       # 동선 목록 + 오디오 압축
│           └── [formationId].tsx # 에디터 본체 (타임라인, 파형, PiP)
├── context/
│   └── AppContext.tsx          # 전역 상태 (사용자, 방, 콘텐츠, 구독)
├── services/                  # API 레이어
│   ├── authService.ts          # 인증 (이메일, 소셜, Apple)
│   ├── roomService.ts
│   ├── storageService.ts       # Cloudflare R2 업로드
│   ├── contentService.ts
│   ├── NotificationService.ts  # 푸시 알림
│   └── SoundService.ts
├── supabase/
│   ├── migrations/             # DB 마이그레이션 20건
│   └── functions/              # Edge Functions (Deno)
│       ├── push-notification/
│       ├── deadline-reminder/
│       ├── verify-and-signup/
│       ├── get-r2-upload-url/
│       ├── delete-r2-objects/
│       ├── delete-account/
│       └── send-verification-email/
├── constants/
│   ├── translations.ts         # 7개 언어 번역 사전
│   └── theme.ts                # 4종 테마 (Light · Dark · 커스텀 2종)
├── components/
│   └── ui/                    # 공통 UI 컴포넌트
├── types/                     # TypeScript 타입 정의
└── docs/                      # 개인정보처리방침 · 이용약관 HTML
```

---

## 🤖 7. AI 활용 (Claude와의 협업 개발)

본 프로젝트는 **Claude (Anthropic)** 를 개발 전 과정의 핵심 파트너로 활용하였습니다.

### 7.1 아키텍처 설계

*   Supabase + Cloudflare R2 조합의 적합성 검토, Edge Function 분리 전략, AppContext 설계 등 핵심 의사결정에 Claude와 함께 여러 아키텍처 옵션을 비교·검토
*   인증 플로우 설계 시 PKCE 표준과 Implicit Fallback의 필요성, AsyncStorage 지연 이슈에 대한 해결책(500ms 딜레이) 도출

### 7.2 알고리즘 구현

| 알고리즘 | AI와의 협업 내용 |
|----------|----------------|
| 음원 파형 분석 | RMS dBFS vs. DAW 피크 검출 방식의 시각적 차이 분석 후 피크 방식 채택 |
| 고해상도 타일링 | Canvas 단일 렌더 vs. 타일 분할의 메모리 트레이드오프 설계 |
| 오디오 자동 압축 | WebView 내 lamejs 인코딩 파이프라인 설계 및 postMessage 프로토콜 정의 |
| Formation 보간 | Ease In-Out(smoothstep) 수식 검토 및 Worklet 내 적용 방식 결정 |
| 연속 시간대 랭킹 | 일정 응답 배열에서 연속 가능 슬롯 추출 알고리즘 설계 |

### 7.3 디버깅

*   Rules of Hooks 위반 (조건부 Hook 호출) 원인 분석 및 리팩터링
*   소셜 로그인 무한 로딩 — PKCE verifier가 AsyncStorage에 저장되기 전에 exchange가 호출되는 타이밍 이슈 식별
*   PiP 재생 동기화 — `seekTo` 호출 시점과 `onProgressUpdate` 이벤트 순서 불일치로 인한 UI 떨림 원인 분석

### 7.4 기타

*   7개 언어(한·영·일·중·스페인·인도네시아·태국) 번역문 초안 생성 및 문화적 맥락 교정
*   Google Play 정책 준수 개인정보처리방침·이용약관 초안 작성
*   `supabase/migrations/*.sql` 테이블 스키마 설계 보조

---

## 🐛 8. 트러블슈팅

### 이슈 1: 소셜 로그인 무한 로딩 (PKCE verifier 타이밍)
*   **문제:** 카카오·구글 로그인 시 콜백 URL을 받았음에도 세션이 생성되지 않고 로딩이 멈추는 현상이 특정 기기에서 재현됨
*   **원인:** PKCE flow에서 `code_verifier`가 `expo-auth-session`에 의해 `AsyncStorage`에 저장되기 **전에** 브라우저가 열려 인가 코드를 받아오는 경우, `exchangeCodeForSession` 호출 시 verifier가 없어 교환 실패
*   **해결:** `openAuthSessionAsync` 호출 직전에 500ms 딜레이를 추가하여 verifier 저장 완료를 보장. 교환 실패 시 URL fragment에서 `access_token`을 직접 파싱하는 **Implicit Fallback** 로직 추가로 이중 보호

### 이슈 2: Android에서 오디오 파형 분석 실패
*   **문제:** iOS에서는 정상 작동하는 파형 분석이 Android에서 간헐적으로 빈 파형이 반환되는 문제
*   **원인:** Android `expo-file-system`에서 `readAsStringAsync`가 대용량 파일을 청크 단위로 읽어 Base64 인코딩이 잘리는 경우 발생. `AudioContext.decodeAudioData`가 불완전한 바이너리를 거부
*   **해결:** `getInfoAsync`로 파일 크기를 먼저 확인 후 20MB 초과 시 분석 스킵. 파일 전체를 한 번에 읽도록 강제하고, `catch` 블록에서 조용히 빈 배열 반환으로 앱 크래시 방지

### 이슈 3: Formation 에디터 JS 스레드 과부하 (Jitter)
*   **문제:** 재생 중 댄서 노드가 끊겨 보이거나 타임라인 스크러빙 시 UI가 버벅이는 현상
*   **원인:** `currentTimeMs` SharedValue를 매 프레임 업데이트하면서 `useAnimatedReaction` 내부의 댄서 위치 계산이 과다하게 실행, JS 스레드 큐 적체 발생
*   **해결:** 재생 엔진의 타임스탬프 업데이트를 16ms(60fps) 단위로 throttle. `useAnimatedReaction`을 Worklet으로 전환하여 UI 스레드에서 독립 실행. `React.memo`로 `DancerNode` 리렌더 최소화

### 이슈 4: PiP(Picture-in-Picture) 재생 동기화 오류
*   **문제:** 동선 에디터 PiP 영상의 재생 위치가 음원 타임라인과 어긋나는 현상. 특히 seek 후 영상이 이전 위치에서 재생되거나 일시정지 후 재개 시 오프셋 발생
*   **원인:** `expo-video`의 `onProgressUpdate` 이벤트 발생 시점과 `seekTo` 완료 시점이 비동기로 어긋나 `syncOffset` 계산에 오류 누적
*   **해결:** seek 요청 후 일정 시간 동안 `onProgressUpdate`에서 수신되는 값을 무시하는 `lastSeekTimeRef` 타임스탬프 기반 필터 추가. seek 완료 후 `syncOffset` 재계산

### 이슈 5: Rules of Hooks 위반 (조건부 렌더링)
*   **문제:** Formation 에디터 화면에서 특정 조건 분기 후 Hook을 호출하는 패턴으로 인해 "Rendered fewer hooks than expected" 런타임 에러 발생
*   **원인:** `if (condition) return null;` 이후에 `useState`, `useSharedValue` 등의 Hook이 위치하여 조건에 따라 Hook 호출 수가 달라짐
*   **해결:** 모든 Hook 호출을 조건 분기 이전으로 이동. Early return은 모든 Hook 정의 후에만 사용. `dancerPositions` 상태를 배열에서 `Record<string, SharedValue>` 객체로 리팩터링하여 길이 변화로 인한 Hook 순서 불일치 제거

### 이슈 7: Android 푸시 알림 미수신 (다중 원인)

*   **문제:** 앱 빌드 후 푸시 알림이 전혀 수신되지 않음. Expo Push API 응답은 `status: "ok"`임에도 기기에 알림이 오지 않음
*   **원인 및 해결 (발견 순서):**
    1. **`userId` 누락 버그:** `AppContext.tsx`에서 `registerForPushNotificationsAsync()`를 인자 없이 호출하여 `userId = undefined`로 실행됨 → Supabase `profiles` 테이블 업데이트 조건이 `WHERE id = undefined`가 되어 push_token이 영원히 저장되지 않음. `registerForPushNotificationsAsync(currentUser.id)`로 수정
    2. **`expo-notifications` 플러그인 누락:** `app.json` plugins 배열에 `expo-notifications`가 없어 EAS 빌드 시 Android `build.gradle`에 Firebase 초기화 코드가 삽입되지 않음 → `Default FirebaseApp is not initialized` 에러. `app.json`에 플러그인 추가 후 재빌드
    3. **`service_role` 권한 없음:** Edge Function에서 service role 키로 `profiles` 테이블 조회 시 `permission denied (42501)` 에러. `GRANT SELECT ON public.profiles TO service_role;` 마이그레이션으로 해결
    4. **Android `channelId` 미지정:** Android 8+ 에서 알림 메시지에 `channelId`가 없으면 시스템이 알림을 무음으로 드랍. Expo Push 메시지에 `channelId: 'default'` 추가
    5. **Firebase 프로젝트 불일치:** `google-services.json`의 `project_id`와 EAS에 등록한 FCM V1 서비스 계정 키의 프로젝트가 달라 FCM이 토큰을 인식하지 못함. 동일한 Firebase 프로젝트의 서비스 계정 키로 교체 후 정상 수신

### 이슈 6: Cloudflare R2 업로드 순서 오류 (공지 이미지)
*   **문제:** 공지사항에 이미지를 첨부하면 DB에 저장된 URL이 실제 R2에 없는 경우 발생 (이미지가 표시되지 않음)
*   **원인:** R2 업로드와 DB `INSERT`가 병렬로 실행되어 업로드가 완료되기 전에 DB에 임시 로컬 URI가 저장되는 경우 존재
*   **해결:** `await storageService.uploadToR2()` 완료 후 반환된 CDN URL을 DB에 저장하도록 순서 보장. 업로드 실패 시 DB 저장 자체를 취소하는 에러 처리 추가

---

## 🚀 9. 출시 계획

| 항목 | 내용 |
|------|------|
| **플랫폼** | iOS (App Store) · Android (Google Play) |
| **현재 상태** | 최종 QA 및 스토어 심사 준비 중 |
| **타겟 사용자** | 댄스 동아리 · 아이돌 지망생 팀 · 댄스 스쿨 · 커버 댄스 팀 |
| **수익 모델** | Freemium (무료 기본 / Pro 구독) + AdMob 광고 |
| **지원 언어** | 한국어 · 영어 · 일본어 · 중국어 · 스페인어 · 인도네시아어 · 태국어 |

### 출시 전 체크리스트

- [x] Supabase RLS (Row Level Security) 정책 전 테이블 적용
- [x] Edge Function JWT 검증 활성화 (`verify_jwt = true`)
- [x] Cloudflare R2 CORS 정책 서비스 도메인으로 제한
- [x] Sentry 에러 모니터링 연동
- [x] 개인정보처리방침 · 이용약관 GitHub Pages 게시
- [x] 환경 변수 Supabase Vault 관리 (R2 Access Key 등)
- [ ] App Store Connect 바이너리 제출
- [ ] Google Play Console 제출
- [ ] 인앱 결제 (IAP) 연동

---

## 📞 Contact

*   **개발자:** 강원우 (KANGWONWOO)
*   **이메일:** king_wonwoo@naver.com
*   **GitHub:** [@KINGWONWOO](https://github.com/KINGWONWOO)

---

*MIT License © 2026 KANGWONWOO*
