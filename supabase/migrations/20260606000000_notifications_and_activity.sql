-- In-app notifications (per user recipient)
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE,
    room_name TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL DEFAULT 'general',
    title TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    target_path TEXT,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
    ON public.notifications FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
    ON public.notifications FOR UPDATE
    USING (auth.uid() = user_id);

-- Any authenticated user can insert (the inserter is the content creator, not the recipient)
CREATE POLICY "Authenticated users can insert notifications"
    ON public.notifications FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
    ON public.notifications(user_id, created_at DESC);

-- Room activity feed (one event per action, visible to all room members)
CREATE TABLE IF NOT EXISTS public.room_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'general',
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    actor_name TEXT NOT NULL DEFAULT '',
    content_title TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.room_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Room members can view activity"
    ON public.room_activity FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.room_members rm
            WHERE rm.room_id = room_activity.room_id
              AND rm.user_id = auth.uid()
        )
    );

CREATE POLICY "Authenticated users can insert activity"
    ON public.room_activity FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_room_activity_room_created
    ON public.room_activity(room_id, created_at DESC);
