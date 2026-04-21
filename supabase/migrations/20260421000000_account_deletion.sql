-- RPC to allow users to delete their own accounts
CREATE OR REPLACE FUNCTION delete_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. Delete profiles (foreign keys will handle other data if ON DELETE CASCADE is set)
  DELETE FROM public.profiles WHERE id = current_user_id;

  -- 2. Delete the user from auth.users
  -- NOTE: This requires the function to be owned by a superuser or have enough bypass permissions.
  -- In Supabase, SECURITY DEFINER functions run with the privileges of the creator.
  DELETE FROM auth.users WHERE id = current_user_id;
END;
$$;
