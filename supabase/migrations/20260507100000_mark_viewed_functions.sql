CREATE OR REPLACE FUNCTION mark_vote_viewed(p_vote_id uuid, p_user_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE votes SET viewed_by = array_append(viewed_by, p_user_id)
  WHERE id = p_vote_id AND NOT (p_user_id = ANY(viewed_by));
$$;

CREATE OR REPLACE FUNCTION mark_schedule_viewed(p_schedule_id uuid, p_user_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE schedules SET viewed_by = array_append(viewed_by, p_user_id)
  WHERE id = p_schedule_id AND NOT (p_user_id = ANY(viewed_by));
$$;
