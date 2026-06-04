-- 방 탈퇴(멤버 탈퇴) 시 해당 유저의 모든 데이터를 삭제하는 RPC 함수
create or replace function public.withdraw_from_room(p_room_id uuid, p_user_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 1. 본인 확인 (security definer이지만 로직상 안전장치)
  if auth.uid() <> p_user_id then
    return json_build_object('success', false, 'message', 'Unauthorized');
  end if;

  -- 2. 해당 유저가 이 방에서 작성한 데이터 삭제 (Cascading이 걸려있지 않은 관계들 포함)
  
  -- 2-1. 공지사항 댓글
  delete from public.notice_comments 
  where user_id = p_user_id 
    and notice_id in (select id from public.notices where room_id = p_room_id);

  -- 2-2. 공지사항 (본인이 작성한 것)
  delete from public.notices where room_id = p_room_id and user_id = p_user_id;

  -- 2-3. 영상 피드백 댓글
  delete from public.video_comments 
  where user_id = p_user_id 
    and video_id in (select id from public.videos where room_id = p_room_id);

  -- 2-4. 영상 피드백 (본인이 업로드한 것)
  delete from public.videos where room_id = p_room_id and user_id = p_user_id;

  -- 2-5. 갤러리/아카이브 댓글
  delete from public.gallery_comments 
  where user_id = p_user_id 
    and gallery_item_id in (select id from public.gallery_items where room_id = p_room_id);

  -- 2-6. 갤러리/아카이브 아이템
  delete from public.gallery_items where room_id = p_room_id and user_id = p_user_id;

  -- 2-7. 일정 응답
  delete from public.schedule_responses 
  where user_id = p_user_id 
    and schedule_id in (select id from public.schedules where room_id = p_room_id);

  -- 2-8. 투표 응답
  delete from public.vote_responses 
  where user_id = p_user_id 
    and vote_id in (select id from public.votes where room_id = p_room_id);
    
  -- 2-9. 동선 (Formations)
  delete from public.formations where room_id = p_room_id and user_id = p_user_id;

  -- 2-10. 룸 프로필 (room_profiles)
  delete from public.room_profiles where room_id = p_room_id and user_id = p_user_id;

  -- 3. 최종적으로 멤버십 탈퇴
  delete from public.room_members where room_id = p_room_id and user_id = p_user_id;

  return json_build_object('success', true);
end;
$$;
