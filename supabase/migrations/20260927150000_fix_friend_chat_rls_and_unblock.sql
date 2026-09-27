-- Repair friend chat permissions and preserve accepted relationships through block/unblock.
-- friend_message_hidden uses upsert(), which requires UPDATE privilege as well as INSERT.

ALTER TABLE public.friend_message_hidden ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS friend_hidden_own ON public.friend_message_hidden;
CREATE POLICY friend_hidden_own
ON public.friend_message_hidden
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.friend_message_hidden TO authenticated;

-- Keep the existing friendship requirement, but also recognize accepted requests
-- as a recovery path for relationships removed by the historical block function.
DROP POLICY IF EXISTS friend_messages_read_friends ON public.friend_messages;
CREATE POLICY friend_messages_read_friends
ON public.friend_messages
FOR SELECT TO authenticated
USING (
  (sender_id = auth.uid() OR recipient_id = auth.uid())
  AND NOT EXISTS (
    SELECT 1 FROM public.friend_blocks b
    WHERE (b.blocker_id = sender_id AND b.blocked_id = recipient_id)
       OR (b.blocker_id = recipient_id AND b.blocked_id = sender_id)
  )
  AND (
    EXISTS (
      SELECT 1 FROM public.friendships f
      WHERE f.user_a = LEAST(sender_id, recipient_id)
        AND f.user_b = GREATEST(sender_id, recipient_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.friend_requests r
      WHERE r.status = 'accepted'
        AND r.sender_id = LEAST(sender_id, recipient_id)
        AND r.recipient_id = GREATEST(sender_id, recipient_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.friend_requests r
      WHERE r.status = 'accepted'
        AND r.sender_id = GREATEST(sender_id, recipient_id)
        AND r.recipient_id = LEAST(sender_id, recipient_id)
    )
  )
);

DROP POLICY IF EXISTS friend_messages_insert_friends ON public.friend_messages;
CREATE POLICY friend_messages_insert_friends
ON public.friend_messages
FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND NOT EXISTS (
    SELECT 1 FROM public.friend_blocks b
    WHERE (b.blocker_id = sender_id AND b.blocked_id = recipient_id)
       OR (b.blocker_id = recipient_id AND b.blocked_id = sender_id)
  )
  AND (
    EXISTS (
      SELECT 1 FROM public.friendships f
      WHERE f.user_a = LEAST(sender_id, recipient_id)
        AND f.user_b = GREATEST(sender_id, recipient_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.friend_requests r
      WHERE r.status = 'accepted'
        AND r.sender_id = LEAST(sender_id, recipient_id)
        AND r.recipient_id = GREATEST(sender_id, recipient_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.friend_requests r
      WHERE r.status = 'accepted'
        AND r.sender_id = GREATEST(sender_id, recipient_id)
        AND r.recipient_id = LEAST(sender_id, recipient_id)
    )
  )
);
GRANT SELECT, INSERT, DELETE ON public.friend_messages TO authenticated;

-- Do not delete the accepted friendship when blocking; the block itself prevents
-- messaging. This keeps the relationship available when the user unblocks.
CREATE OR REPLACE FUNCTION public.block_friend(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR p_user_id IS NULL OR p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Invalid user';
  END IF;
  INSERT INTO public.friend_blocks (blocker_id, blocked_id)
  VALUES (auth.uid(), p_user_id)
  ON CONFLICT DO NOTHING;
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
  IF auth.uid() IS NULL OR p_user_id IS NULL OR p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Invalid user';
  END IF;

  DELETE FROM public.friend_blocks
  WHERE blocker_id = auth.uid() AND blocked_id = p_user_id;

  -- Restore only a relationship that was previously accepted. This also repairs
  -- accounts where an older unblock already removed the block but not the friendship.
  IF EXISTS (
    SELECT 1 FROM public.friend_requests r
    WHERE r.status = 'accepted'
      AND ((r.sender_id = auth.uid() AND r.recipient_id = p_user_id)
        OR (r.sender_id = p_user_id AND r.recipient_id = auth.uid()))
  ) THEN
    INSERT INTO public.friendships (user_a, user_b)
    VALUES (LEAST(auth.uid(), p_user_id), GREATEST(auth.uid(), p_user_id))
    ON CONFLICT (user_a, user_b) DO NOTHING;
  END IF;
  RETURN TRUE;
END;
$$;
REVOKE ALL ON FUNCTION public.block_friend(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.unblock_friend(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.block_friend(UUID), public.unblock_friend(UUID) TO authenticated;

-- Explicitly ensure friend voice policies also permit recovered accepted links.
DROP POLICY IF EXISTS friend_voice_select_pair ON public.friend_voice_messages;
CREATE POLICY friend_voice_select_pair
ON public.friend_voice_messages
FOR SELECT TO authenticated
USING (
  (sender_id = auth.uid() OR recipient_id = auth.uid())
  AND NOT EXISTS (
    SELECT 1 FROM public.friend_blocks b
    WHERE (b.blocker_id = sender_id AND b.blocked_id = recipient_id)
       OR (b.blocker_id = recipient_id AND b.blocked_id = sender_id)
  )
  AND (
    EXISTS (SELECT 1 FROM public.friendships f
      WHERE f.user_a = LEAST(sender_id, recipient_id)
        AND f.user_b = GREATEST(sender_id, recipient_id))
    OR EXISTS (SELECT 1 FROM public.friend_requests r
      WHERE r.status = 'accepted'
        AND ((r.sender_id = sender_id AND r.recipient_id = recipient_id)
          OR (r.sender_id = recipient_id AND r.recipient_id = sender_id)))
  )
);
DROP POLICY IF EXISTS friend_voice_insert_pair ON public.friend_voice_messages;
CREATE POLICY friend_voice_insert_pair
ON public.friend_voice_messages
FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND NOT EXISTS (
    SELECT 1 FROM public.friend_blocks b
    WHERE (b.blocker_id = sender_id AND b.blocked_id = recipient_id)
       OR (b.blocker_id = recipient_id AND b.blocked_id = sender_id)
  )
  AND (
    EXISTS (SELECT 1 FROM public.friendships f
      WHERE f.user_a = LEAST(sender_id, recipient_id)
        AND f.user_b = GREATEST(sender_id, recipient_id))
    OR EXISTS (SELECT 1 FROM public.friend_requests r
      WHERE r.status = 'accepted'
        AND ((r.sender_id = sender_id AND r.recipient_id = recipient_id)
          OR (r.sender_id = recipient_id AND r.recipient_id = sender_id)))
  )
);
GRANT SELECT, INSERT, DELETE ON public.friend_voice_messages TO authenticated;


CREATE OR REPLACE FUNCTION public.delete_friend(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR p_user_id IS NULL OR p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Invalid user';
  END IF;
  DELETE FROM public.friendships
  WHERE user_a = LEAST(auth.uid(), p_user_id)
    AND user_b = GREATEST(auth.uid(), p_user_id);
  UPDATE public.friend_requests
  SET status = 'cancelled', responded_at = now()
  WHERE status = 'accepted'
    AND ((sender_id = auth.uid() AND recipient_id = p_user_id)
      OR (sender_id = p_user_id AND recipient_id = auth.uid()));
  RETURN TRUE;
END;
$$;
REVOKE ALL ON FUNCTION public.delete_friend(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_friend(UUID) TO authenticated;
