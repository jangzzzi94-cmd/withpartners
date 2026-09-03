// ⚠️ 아래 두 값을 새로 만든 Supabase 프로젝트 값으로 교체하세요.
// Supabase 대시보드 > Project Settings > API 에서 확인 가능합니다.
const SUPABASE_URL = "https://qfojyatehzgmwasccpub.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_-tJjxiwEzKFENFKrqcM0nA_Nzlopgqf";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function requireLogin(){
  const { data: { session } } = await supabaseClient.auth.getSession();
  if(!session){
    window.location.href = "login.html";
    return null;
  }
  const { data: profile } = await supabaseClient
    .from("profiles")
    .select("status")
    .eq("id", session.user.id)
    .single();
  if(profile && profile.status === "suspended"){
    await supabaseClient.auth.signOut();
    window.location.href = "login.html?suspended=1";
    return null;
  }
  return session;
}

async function logout(){
  await supabaseClient.auth.signOut();
  window.location.href = "login.html";
}

async function getMyProfile(){
  const { data: { session } } = await supabaseClient.auth.getSession();
  if(!session) return null;
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id, email, role, points, nickname, suspended, created_at")
    .eq("id", session.user.id)
    .single();
  if(error){
    console.error(error);
    return null;
  }
  return data;
}

async function getPointCosts(){
  const defaults = { history: 1, coverage: 3, family_coverage: 1 };
  const { data, error } = await supabaseClient.from("point_costs").select("feature, cost");
  if(error || !data){
    console.error(error);
    return defaults;
  }
  const map = Object.assign({}, defaults);
  data.forEach(function(r){ map[r.feature] = r.cost; });
  return map;
}

async function spendPoints(feature){
  const { data, error } = await supabaseClient.rpc("spend_points", { p_feature: feature });
  if(error){
    console.error(error);
    return false;
  }
  return data === true;
}

// ── 관리자 전용 함수 (admin.html에서만 사용) ──

async function adminListProfiles(){
  const { data, error } = await supabaseClient.rpc("admin_list_profiles");
  if(error){
    console.error(error);
    return [];
  }
  return data || [];
}

// amount는 양수(지급)/음수(차감) 둘 다 가능
async function adminAddPoints(userId, amount, note){
  const { data, error } = await supabaseClient.rpc("admin_add_points", {
    p_user_id: userId, p_amount: amount, p_note: note || null,
  });
  if(error) return { ok:false, message: error.message };
  return { ok:true, points: data };
}

async function adminSetStatus(userId, status){
  const { data, error } = await supabaseClient.rpc("admin_set_status", {
    p_user_id: userId, p_status: status,
  });
  if(error) return { ok:false, message: error.message };
  return { ok:true };
}
