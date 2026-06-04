-- 방 탈퇴(멤버 탈퇴) 시 해당 유저의 모든 데이터를 삭제하는 RPC 함수 (v2: 더 유연한 타입 지원)
create or replace function public.withdraw_from_room(p_room_id text, p_user_id text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_uuid uuid;
  v_user_uuid uuid;
begin
  -- UUID 캐스팅
  v_room_uuid := p_room_id::uuid;
  v_user_uuid := p_user_id::uuid;

  -- 1. 본인 확인
  if auth.uid() <> v_user_uuid then
    return json_build_object('success', false, 'message', 'Unauthorized');
  end if;

  -- 2. 해당 유저가 이 방에서 작성한 데이터 삭제
  
  -- 2-1. 공지사항 댓글
  delete from public.notice_comments 
  where user_id = v_user_uuid 
    and notice_id in (select id from public.notices where room_id = v_room_uuid);

  -- 2-2. 공지사항
  delete from public.notices where room_id = v_room_uuid and user_id = v_user_uuid;

  -- 2-3. 영상 피드백 댓글
  delete from public.video_comments 
  where user_id = v_user_uuid 
    and video_id in (select id from public.videos where room_id = v_room_uuid);

  -- 2-4. 영상 피드백
  delete from public.videos where room_id = v_room_uuid and user_id = v_user_uuid;

  -- 2-5. 갤러리/아카이브 댓글
  delete from public.gallery_comments 
  where user_id = v_user_uuid 
    and gallery_item_id in (select id from public.gallery_items where room_id = v_room_uuid);

  -- 2-6. 갤러리/아카이브 아이템
  delete from public.gallery_items where room_id = v_room_uuid and user_id = v_user_uuid;

  -- 2-7. 일정 응답
  delete from public.schedule_responses 
  where user_id = v_user_uuid 
    and schedule_id in (select id from public.schedules where room_id = v_room_uuid);

  -- 2-8. 투표 응답
  delete from public.vote_responses 
  where user_id = v_user_uuid 
    and vote_id in (select id from public.votes where room_id = v_room_uuid);
    
  -- 2-9. 동선 (Formations) - 테이블 존재 여부 확인 후 삭제
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'formations') then
    execute format('delete from public.formations where room_id = %L and user_id = %L', v_room_uuid, v_user_uuid);
  end if;

  -- 2-10. 룸 프로필 (room_profiles) - 테이블 존재 여부 확인 후 삭제
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'room_profiles') then
    execute format('delete from public.room_profiles where room_id = %L and user_id = %L', v_room_uuid, v_user_uuid);
  end if;

  -- 3. 최종적으로 멤버십 탈퇴
  delete from public.room_members where room_id = v_room_uuid and user_id = v_user_uuid;

  return json_build_object('success', true);
end;
$$;
