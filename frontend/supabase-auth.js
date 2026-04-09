// ─────────────────────────────────────────
// Supabase Auth — Google OAuth
// ─────────────────────────────────────────
// ⚠️ 아래 두 값을 본인 Supabase 프로젝트 값으로 교체하세요.
//    Supabase 대시보드 → Settings → API 에서 확인 가능.
//    anon key는 공개 키라 프론트엔드에 넣어도 안전합니다.
// ─────────────────────────────────────────
const SUPABASE_URL      = 'https://bzentfeysswapuwfordr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6ZW50ZmV5c3N3YXB1d2ZvcmRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NDQwNTMsImV4cCI6MjA5MTIyMDA1M30.f5PNpgLWDWqgJQQaSDRYV9-Igm24PRS3KScacRPJy8E';

// ─── Supabase CDN (번들러 없이 ESM으로 직접 import) ───
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── DOM 요소 ───
const authLoginBtns  = document.getElementById('auth-login-btns');
const btnGoogle      = document.getElementById('btn-google-login');
const btnKakao       = document.getElementById('btn-kakao-login');
const btnLogout      = document.getElementById('btn-logout');
const authUserArea   = document.getElementById('auth-user-area');
const authUserEmail  = document.getElementById('auth-user-email');

// ─── UI 업데이트 ───
function renderAuthUI(session) {
  if (session) {
    // 로그인 상태: 이메일(또는 provider 이름) + 로그아웃
    if (authLoginBtns) authLoginBtns.style.display = 'none';
    if (authUserArea)  authUserArea.style.display  = 'flex';
    if (authUserEmail) {
      const provider = session.user.app_metadata?.provider ?? '';
      const label    = session.user.email
        ?? session.user.user_metadata?.full_name
        ?? (provider ? `${provider} 로그인` : '로그인됨');
      authUserEmail.textContent = label;
    }
  } else {
    // 비로그인 상태: 소셜 로그인 버튼들
    if (authLoginBtns) authLoginBtns.style.display = 'flex';
    if (authUserArea)  authUserArea.style.display  = 'none';
  }
}

// ─── 공통 OAuth 로그인 ───
async function signInWithProvider(provider) {
  const options = {
    redirectTo: window.location.origin + window.location.pathname,
  };
  // Kakao: Supabase가 기본으로 추가하는 scope(account_email, profile_nickname, profile_image)를
  // 빈 문자열로 덮어써서 KOE205 에러 방지. 카카오 콘솔 동의항목과 맞출 것.
  if (provider === 'kakao') options.scopes = '';

  const { error } = await supabase.auth.signInWithOAuth({ provider, options });
  if (error) {
    console.error(`[Supabase] ${provider} 로그인 오류:`, error.message);
    alert('로그인 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.');
  }
}

// ─── 로그아웃 ───
async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) console.error('[Supabase] 로그아웃 오류:', error.message);
  // UI는 onAuthStateChange에서 자동 처리
}

// ─── 세션 초기화 & 상태 감지 ───
async function initAuth() {
  // 새로고침 후에도 localStorage 세션에서 자동 복원
  const { data: { session } } = await supabase.auth.getSession();
  renderAuthUI(session);

  // 이후 로그인/로그아웃 변경 실시간 감지
  supabase.auth.onAuthStateChange((_event, session) => {
    renderAuthUI(session);
  });
}

// ─── 이벤트 바인딩 ───
btnGoogle?.addEventListener('click', () => signInWithProvider('google'));
btnKakao?.addEventListener('click',  () => signInWithProvider('kakao'));
btnLogout?.addEventListener('click', signOut);

// ─── 외부에서 현재 세션/유저 접근 가능하도록 export ───
export { supabase };

// ─── 실행 ───
initAuth();
