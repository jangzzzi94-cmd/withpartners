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
    .select("id, email, role, points, nickname, name, birth, suspended, created_at")
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

async function adminListProfiles(){
  const { data, error } = await supabaseClient.rpc('admin_list_profiles');
  if(error){ console.error(error); return []; }
  return data || [];
}

async function requireAdmin(){
  const session = await requireLogin();
  if(!session) return null;
  const profile = await getMyProfile();
  if(!profile || profile.role !== 'admin'){
    window.location.href = 'dashboard.html';
    return null;
  }
  return profile;
}

/* ---- 회원 탈퇴 ---- */
async function deleteMyAccount(){
  const { error } = await supabaseClient.rpc('delete_my_account');
  if(error){ console.error(error); return { ok:false, message:error.message }; }
  try{ await supabaseClient.auth.signOut(); }catch(e){}
  return { ok:true };
}

async function adminDeleteAccount(userId){
  const { error } = await supabaseClient.rpc('admin_delete_account', { p_user_id: userId });
  if(error){ console.error(error); return { ok:false, message:error.message }; }
  return { ok:true };
}

/* ---- 이용 규칙(사용방법) ---- */
async function getSiteRules(){
  const { data, error } = await supabaseClient
    .from('site_rules')
    .select('id, title, content, sort_order, updated_at')
    .order('sort_order', { ascending: true });
  if(error){ console.error(error); return []; }
  return data || [];
}

async function adminSaveSiteRule(id, title, content){
  const { error } = await supabaseClient
    .from('site_rules')
    .update({ title, content, updated_at: new Date().toISOString() })
    .eq('id', id);
  if(error) return { ok:false, message:error.message };
  return { ok:true };
}

async function adminAddSiteRule(title, content, sortOrder){
  const { data, error } = await supabaseClient
    .from('site_rules')
    .insert({ title, content, sort_order: sortOrder })
    .select('id, title, content, sort_order')
    .single();
  if(error) return { ok:false, message:error.message };
  return { ok:true, row:data };
}

async function adminDeleteSiteRule(id){
  const { error } = await supabaseClient.from('site_rules').delete().eq('id', id);
  if(error) return { ok:false, message:error.message };
  return { ok:true };
}

/* ---- 포인트 지급/사용 로그 (관리자 전용 조회) ---- */
async function getPointLogs(limit){
  const { data, error } = await supabaseClient
    .from('point_logs')
    .select('id, user_id, delta, reason, note, actor_id, created_at')
    .order('created_at', { ascending:false })
    .limit(limit || 300);
  if(error){ console.error(error); return []; }
  return data || [];
}

/* ---- 크레딧 단가 수정 (관리자) ---- */
async function adminUpdatePointCost(feature, cost){
  const { error } = await supabaseClient.from('point_costs').update({ cost }).eq('feature', feature);
  if(error) return { ok:false, message:error.message };
  return { ok:true };
}

/* ---- 보장분석표 표지 스타일 ---- */
function loadImageFromFile(file){
  return new Promise(function(resolve, reject){
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = function(){ URL.revokeObjectURL(url); resolve(img); };
    img.onerror = function(){ URL.revokeObjectURL(url); reject(new Error('이미지 파일을 읽을 수 없습니다.')); };
    img.src = url;
  });
}

async function fileToPngBlob(file, maxSize){
  const img = await loadImageFromFile(file);
  const w0 = img.naturalWidth, h0 = img.naturalHeight;
  if(!w0 || !h0) throw new Error('이미지 크기를 확인할 수 없습니다.');
  const scale = Math.min(1, (maxSize || 1600) / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * scale));
  const h = Math.max(1, Math.round(h0 * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d').drawImage(img, 0, 0, w, h);
  return new Promise(function(resolve, reject){
    canvas.toBlob(function(blob){
      if(blob) resolve(blob); else reject(new Error('이미지 변환에 실패했습니다.'));
    }, 'image/png');
  });
}

function getCoverImageUrl(path){
  const { data } = supabaseClient.storage.from('cover-images').getPublicUrl(path);
  return data.publicUrl + '?v=' + Math.floor(Date.now() / 1000);
}

async function getCoverStyles(){
  const { data, error } = await supabaseClient
    .from('cover_styles')
    .select('id, name, image_path, name_x_ratio, name_y_ratio, is_default, sort_order, created_at')
    .order('sort_order', { ascending:true })
    .order('created_at', { ascending:true });
  if(error){ console.error(error); return []; }
  return data || [];
}

async function uploadCoverStyleImage(styleId, file){
  const blob = await fileToPngBlob(file, 1600);
  const path = 'styles/' + styleId + '.png';
  const { error } = await supabaseClient.storage
    .from('cover-images')
    .upload(path, blob, { upsert:true, contentType:'image/png' });
  if(error) throw new Error(error.message);
  return path;
}

async function createCoverStyle(name, file, nameXRatio, nameYRatio){
  try{
    const styleId = (crypto.randomUUID ? crypto.randomUUID() : (Date.now() + '-' + Math.random().toString(16).slice(2)));
    const path = await uploadCoverStyleImage(styleId, file);
    const { data: existing } = await supabaseClient.from('cover_styles').select('id');
    const isFirst = !existing || existing.length === 0;
    const { error } = await supabaseClient.from('cover_styles').insert({
      id: styleId, name, image_path: path,
      name_x_ratio: nameXRatio, name_y_ratio: nameYRatio, is_default: isFirst,
    });
    if(error) return { ok:false, message:error.message };
    return { ok:true, id: styleId };
  }catch(err){
    return { ok:false, message: err.message };
  }
}

async function updateCoverStyle(styleId, changes){
  const { error } = await supabaseClient.from('cover_styles').update(changes).eq('id', styleId);
  if(error) return { ok:false, message:error.message };
  return { ok:true };
}

async function deleteCoverStyle(styleId){
  await supabaseClient.storage.from('cover-images').remove(['styles/' + styleId + '.png']);
  const { error } = await supabaseClient.from('cover_styles').delete().eq('id', styleId);
  if(error) return { ok:false, message:error.message };
  return { ok:true };
}

async function setDefaultCoverStyle(styleId){
  const { error } = await supabaseClient.rpc('set_default_cover_style', { p_style_id: styleId });
  if(error) return { ok:false, message:error.message };
  return { ok:true };
}

async function getMyEffectiveCoverStyle(profile){
  if(profile && profile.cover_style_id){
    const { data, error } = await supabaseClient
      .from('cover_styles')
      .select('id, name, image_path, name_x_ratio, name_y_ratio, is_default')
      .eq('id', profile.cover_style_id)
      .maybeSingle();
    if(!error && data) return data;
  }
  const { data, error } = await supabaseClient
    .from('cover_styles')
    .select('id, name, image_path, name_x_ratio, name_y_ratio, is_default')
    .eq('is_default', true)
    .maybeSingle();
  if(error){ console.error(error); return null; }
  return data || null;
}

async function updateMyCoverStyle(styleId){
  const { error } = await supabaseClient.rpc('update_my_cover_style', { p_style_id: styleId });
  if(error) return { ok:false, message:error.message };
  return { ok:true };
}

async function updateMyCoverPosition(x, y){
  const { error } = await supabaseClient.rpc('update_my_cover_position', { p_x: x, p_y: y });
  if(error) return { ok:false, message:error.message };
  return { ok:true };
}

async function updateMyPassword(newPassword){
  const { error } = await supabaseClient.auth.updateUser({ password: newPassword });
  if(error) return { ok:false, message:error.message };
  return { ok:true };
}

async function getFeatureGuide(feature){
  const { data, error } = await supabaseClient
    .from('feature_guides')
    .select('content')
    .eq('feature', feature)
    .maybeSingle();
  if(error){ console.error(error); return ''; }
  return data ? data.content : '';
}

async function adminSaveFeatureGuide(feature, content){
  const { error } = await supabaseClient
    .from('feature_guides')
    .upsert({ feature, content, updated_at: new Date().toISOString() });
  if(error) return { ok:false, message:error.message };
  return { ok:true };
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
