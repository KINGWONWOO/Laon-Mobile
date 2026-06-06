-- Allow room leader (not just author) to update (pin/unpin) notices
DROP POLICY IF EXISTS "작성자만 공지 수정" ON public.notices;

CREATE POLICY "작성자 또는 방장이 공지 수정" ON public.notices FOR UPDATE
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.rooms
    WHERE id = room_id AND leader_id = auth.uid()
  )
);
