// ─────────────────────────────────────────
// Supabase Auth — Google OAuth
// ─────────────────────────────────────────
// ⚠️ 아래 두 값을 본인 Supabase 프로젝트 값으로 교체하세요.
//    Supabase 대시보드 → Settings → API 에서 확인 가능.
//    anon key는 공개 키라 프론트엔드에 넣어도 안전합니다.
// ─────────────────────────────────────────
const SUPABASE_URL      = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

// ─── Supabase CDN (번들러 없이 ESM으로 직접 import) ───
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── DOM 요소 ───
const authBar        = document.getElementById('auth-bar');
const btnGoogle      = document.getElementById('btn-google-login');
const btnLogout      = document.getElementById('btn-logout');
const authUserArea   = document.getElementById('auth-user-area');
const authUserEmail  = document.getElementById('auth-user-email');

// ─── UI 업데이트 ───
function renderAuthUI(session) {
  if (!authBar) return;
  if (session) {
    // 로그인 상태: 이메일 + 로그아웃 버튼
    btnGoogle.style.display    = 'none';
    authUserArea.style.display = 'flex';
    authUserEmail.textContent  = session.user.email ?? session.user.user_metadata?.full_name ?? '로그인됨';
  } else {
    // 비로그인 상태: Google 로그인 버튼
    btnGoogle.style.display    = 'flex';
    authUserArea.style.display = 'none';
  }
}

// ─── Google 로그인 ───
async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      // 로그인 후 현재 페이지로 돌아옴 (prod/dev 모두 자동 처리)
      redirectTo: window.location.origin + window.location.pathname,
    },
  });
  if (error) {
    console.error('[Supabase] Google 로그인 오류:', error.message);
    alert('로그인 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.');
  }
}

// ─── 로그아웃 ───
async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) console.error('[Supabase] 로그아웃 오류:', error.message);
  // 로그아웃 후 UI는 onAuthStateChange에서 자동 처리
}

// ─── 세션 초기화 & 상태 감지 ───
async function initAuth() {
  // 현재 세션 확인 (새로고침 후에도 localStorage에서 복원됨)
  const { data: { session } } = await supabase.auth.getSession();
  renderAuthUI(session);

  // 이후 변경(로그인/로그아웃)을 실시간 감지
  supabase.auth.onAuthStateChange((_event, session) => {
    renderAuthUI(session);
  });
}

// ─── 이벤트 바인딩 ───
btnGoogle?.addEventListener('click', signInWithGoogle);
btnLogout?.addEventListener('click', signOut);

// ─── 외부에서 현재 세션/유저 접근 가능하도록 export ───
export { supabase };

// ─── 실행 ───
initAuth();
