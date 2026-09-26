-- Stage 3: direct friend chat actions, per-user hiding, blocking and unfriend.

ALTER TABLE public.friend_messages
ADD COLUMN IF NOT EXISTS reply_to UUID
REFERENCES public.friend_messages(id) ON DELETE SET NULL;

ALTER TABLE public.friend_voice_messages
ADD COLUMN IF NOT EXISTS reply_to UUID
REFERENCES public.friend_messages(id) ON DELETE SET NULL;


CREATE TABLE IF NOT EXISTS public.friend_message_reactions (
    message_id UUID NOT NULL,
    message_kind TEXT NOT NULL
        CHECK (message_kind IN ('text', 'voice')),
    user_id UUID NOT NULL
        REFERENCES auth.users(id) ON DELETE CASCADE,
    reaction TEXT NOT NULL
        CHECK (reaction IN ('👍', '❤️', '😂', '😮', '😢', '🙏')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (message_id, message_kind, user_id)
);

ALTER TABLE public.friend_message_reactions
ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS friend_reactions_read
ON public.friend_message_reactions;

CREATE POLICY friend_reactions_read
ON public.friend_message_reactions
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.friend_messages m
        WHERE m.id = message_id
          AND message_kind = 'text'
          AND (m.sender_id = auth.uid() OR m.recipient_id = auth.uid())
    )
    OR
    EXISTS (
        SELECT 1
        FROM public.friend_voice_messages v
        WHERE v.id = message_id
          AND message_kind = 'voice'
          AND (v.sender_id = auth.uid() OR v.recipient_id = auth.uid())
    )
);

DROP POLICY IF EXISTS friend_reactions_insert
ON public.friend_message_reactions;

CREATE POLICY friend_reactions_insert
ON public.friend_message_reactions
FOR INSERT TO authenticated
WITH CHECK (
    user_id = auth.uid()
    AND (
        (
            message_kind = 'text'
            AND EXISTS (
                SELECT 1
                FROM public.friend_messages m
                WHERE m.id = message_id
                  AND (m.sender_id = auth.uid() OR m.recipient_id = auth.uid())
            )
        )
        OR
        (
            message_kind = 'voice'
            AND EXISTS (
                SELECT 1
                FROM public.friend_voice_messages v
                WHERE v.id = message_id
                  AND (v.sender_id = auth.uid() OR v.recipient_id = auth.uid())
            )
        )
    )
);

DROP POLICY IF EXISTS friend_reactions_update
ON public.friend_message_reactions;

CREATE POLICY friend_reactions_update
ON public.friend_message_reactions
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS friend_reactions_delete
ON public.friend_message_reactions;

CREATE POLICY friend_reactions_delete
ON public.friend_message_reactions
FOR DELETE TO authenticated
USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.friend_message_reactions
TO authenticated;


CREATE TABLE IF NOT EXISTS public.friend_message_hidden (
    user_id UUID NOT NULL
        REFERENCES auth.users(id) ON DELETE CASCADE,
    message_id UUID NOT NULL,
    message_kind TEXT NOT NULL
        CHECK (message_kind IN ('text', 'voice')),
    hidden_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, message_id, message_kind)
);

ALTER TABLE public.friend_message_hidden
ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS friend_hidden_own
ON public.friend_message_hidden;

CREATE POLICY friend_hidden_own
ON public.friend_message_hidden
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, DELETE
ON public.friend_message_hidden
TO authenticated;


-- Deleting for everyone is restricted to the sender.
-- RLS still checks the friend pair and block state.

DROP POLICY IF EXISTS friend_messages_delete_sender
ON public.friend_messages;

CREATE POLICY friend_messages_delete_sender
ON public.friend_messages
FOR DELETE TO authenticated
USING (sender_id = auth.uid());

GRANT DELETE ON public.friend_messages TO authenticated;


DROP POLICY IF EXISTS friend_voice_delete_sender
ON public.friend_voice_messages;

CREATE POLICY friend_voice_delete_sender
ON public.friend_voice_messages
FOR DELETE TO authenticated
USING (sender_id = auth.uid());

GRANT DELETE ON public.friend_voice_messages TO authenticated;


CREATE OR REPLACE FUNCTION public.block_friend(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL
       OR p_user_id IS NULL
       OR p_user_id = auth.uid() THEN
        RAISE EXCEPTION 'Invalid user';
    END IF;

    INSERT INTO public.friend_blocks (blocker_id, blocked_id)
    VALUES (auth.uid(), p_user_id)
    ON CONFLICT DO NOTHING;

    DELETE FROM public.friendships
    WHERE user_a = LEAST(auth.uid(), p_user_id)
      AND user_b = GREATEST(auth.uid(), p_user_id);

    RETURN TRUE;
END;
$$;


CREATE OR REPLACE FUNCTION public.unblock_friend(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Sign in required';
    END IF;

    DELETE FROM public.friend_blocks
    WHERE blocker_id = auth.uid()
      AND blocked_id = p_user_id;

    RETURN TRUE;
END;
$$;


CREATE OR REPLACE FUNCTION public.delete_friend(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL
       OR p_user_id IS NULL
       OR p_user_id = auth.uid() THEN
        RAISE EXCEPTION 'Invalid user';
    END IF;

    DELETE FROM public.friendships
    WHERE user_a = LEAST(auth.uid(), p_user_id)
      AND user_b = GREATEST(auth.uid(), p_user_id);

    RETURN TRUE;
END;
$$;


REVOKE ALL ON FUNCTION public.block_friend(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.unblock_friend(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_friend(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.block_friend(UUID),
    public.unblock_friend(UUID),
    public.delete_friend(UUID)
TO authenticated;


-- Public chat voice reply columns

ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS reply_to_voice_id UUID;

ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS reply_to_preview TEXT;

ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS reply_to_name TEXT;