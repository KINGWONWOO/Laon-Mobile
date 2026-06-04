-- 방 입장 처리를 위한 RPC 함수
-- RLS를 우회하여 패스코드를 확인하고 멤버십을 추가합니다.
create or replace function public.join_room_with_passcode(p_room_id uuid, p_passcode text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room record;
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return json_build_object('success', false, 'message', 'Authentication required');
  end if;

  -- 1. 방 존재 및 패스코드 확인
  select * into v_room from public.rooms where id = p_room_id and passcode = p_passcode;
  
  if not found then
    return json_build_object('success', false, 'message', 'Invalid ID or passcode');
  end if;

  -- 2. 멤버십 추가 (이미 있으면 무시)
  insert into public.room_members (room_id, user_id)
  values (p_room_id, v_user_id)
  on conflict (room_id, user_id) do nothing;

  -- 3. 성공 응답 (방 정보 포함)
  return json_build_object(
    'success', true, 
    'room', json_build_object(
      'id', v_room.id,
      'name', v_room.name,
      'passcode', v_room.passcode,
      'image_uri', v_room.image_uri,
      'leader_id', v_room.leader_id,
      'created_at', v_room.created_at
    )
  );
end;
$$;
