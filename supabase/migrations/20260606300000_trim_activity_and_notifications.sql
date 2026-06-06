-- Trim room_activity to 30 most recent entries per room after each insert
CREATE OR REPLACE FUNCTION public.trim_room_activity()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.room_activity
  WHERE room_id = NEW.room_id
    AND id NOT IN (
      SELECT id FROM public.room_activity
      WHERE room_id = NEW.room_id
      ORDER BY created_at DESC
      LIMIT 30
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_trim_room_activity ON public.room_activity;
CREATE TRIGGER trg_trim_room_activity
  AFTER INSERT ON public.room_activity
  FOR EACH ROW EXECUTE FUNCTION public.trim_room_activity();

-- Trim notifications to 30 most recent entries per user after each insert
CREATE OR REPLACE FUNCTION public.trim_notifications()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.notifications
  WHERE user_id = NEW.user_id
    AND id NOT IN (
      SELECT id FROM public.notifications
      WHERE user_id = NEW.user_id
      ORDER BY created_at DESC
      LIMIT 30
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_trim_notifications ON public.notifications;
CREATE TRIGGER trg_trim_notifications
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.trim_notifications();
