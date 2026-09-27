-- Restore the accepted friendship when a user unblocks a friend.
-- block_friend historically removed the friendship row, so unblock must recreate it.
CREATE OR REPLACE FUNCTION public.unblock_friend(p_user_id UUID)
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

    IF EXISTS (
        SELECT 1 FROM public.friend_blocks
        WHERE blocker_id = auth.uid() AND blocked_id = p_user_id
    ) THEN
        INSERT INTO public.friendships (user_a, user_b)
        VALUES (LEAST(auth.uid(), p_user_id), GREATEST(auth.uid(), p_user_id))
        ON CONFLICT (user_a, user_b) DO NOTHING;

        DELETE FROM public.friend_blocks
        WHERE blocker_id = auth.uid() AND blocked_id = p_user_id;
    END IF;

    RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.unblock_friend(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unblock_friend(UUID) TO authenticated;
