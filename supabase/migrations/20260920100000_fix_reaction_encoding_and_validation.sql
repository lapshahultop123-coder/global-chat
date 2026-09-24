-- Repair all reaction constraints/functions after legacy mojibake in earlier migrations.
-- ASCII-only PostgreSQL Unicode escapes keep this migration encoding-safe.

DO $$ BEGIN
  ALTER TABLE public.message_reactions DROP CONSTRAINT IF EXISTS message_reactions_reaction_check;
  ALTER TABLE public.message_reactions ADD CONSTRAINT message_reactions_reaction_check
    CHECK (reaction IN (U&'\+01F44D',U&'\+002764\+00FE0F',U&'\+01F602',U&'\+01F62E',U&'\+01F622',U&'\+01F621',U&'\+01F389',U&'\+01F64F'));
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.voice_reactions DROP CONSTRAINT IF EXISTS voice_reactions_reaction_check;
  ALTER TABLE public.voice_reactions ADD CONSTRAINT voice_reactions_reaction_check
    CHECK (reaction IN (U&'\+01F44D',U&'\+002764\+00FE0F',U&'\+01F602',U&'\+01F62E',U&'\+01F622',U&'\+01F621',U&'\+01F389',U&'\+01F64F'));
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.private_message_reactions DROP CONSTRAINT IF EXISTS private_message_reactions_reaction_check;
  ALTER TABLE public.private_message_reactions ADD CONSTRAINT private_message_reactions_reaction_check
    CHECK (reaction IN (U&'\+01F44D',U&'\+002764\+00FE0F',U&'\+01F602',U&'\+01F62E',U&'\+01F622',U&'\+01F621',U&'\+01F389',U&'\+01F64F'));
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.private_voice_reactions DROP CONSTRAINT IF EXISTS private_voice_reactions_reaction_check;
  ALTER TABLE public.private_voice_reactions ADD CONSTRAINT private_voice_reactions_reaction_check
    CHECK (reaction IN (U&'\+01F44D',U&'\+002764\+00FE0F',U&'\+01F602',U&'\+01F62E',U&'\+01F622',U&'\+01F621',U&'\+01F389',U&'\+01F64F'));
EXCEPTION WHEN undefined_table THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.toggle_global_reaction(p_user_id uuid,p_message_id uuid,p_reaction text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE exists_now boolean;
BEGIN
  IF p_reaction NOT IN (U&'\+01F44D',U&'\+002764\+00FE0F',U&'\+01F602',U&'\+01F62E',U&'\+01F622',U&'\+01F621',U&'\+01F389',U&'\+01F64F') THEN RAISE EXCEPTION 'invalid_reaction'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.messages WHERE id=p_message_id AND expires_at>now()) THEN RAISE EXCEPTION 'message_expired'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.message_reactions WHERE message_id=p_message_id AND user_id=p_user_id AND reaction=p_reaction) INTO exists_now;
  IF exists_now THEN
    DELETE FROM public.message_reactions WHERE message_id=p_message_id AND user_id=p_user_id AND reaction=p_reaction;
    RETURN false;
  END IF;
  INSERT INTO public.message_reactions(message_id,user_id,reaction) VALUES(p_message_id,p_user_id,p_reaction);
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.toggle_voice_reaction(p_user_id uuid,p_voice_id uuid,p_reaction text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE existed boolean;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF p_reaction NOT IN (U&'\+01F44D',U&'\+002764\+00FE0F',U&'\+01F602',U&'\+01F62E',U&'\+01F622',U&'\+01F621',U&'\+01F389',U&'\+01F64F') THEN RAISE EXCEPTION 'invalid_reaction'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.voice_messages WHERE id=p_voice_id AND expires_at>now()) THEN RAISE EXCEPTION 'voice_not_found'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.voice_reactions WHERE voice_id=p_voice_id AND user_id=p_user_id AND reaction=p_reaction) INTO existed;
  IF existed THEN DELETE FROM public.voice_reactions WHERE voice_id=p_voice_id AND user_id=p_user_id AND reaction=p_reaction; RETURN false; END IF;
  INSERT INTO public.voice_reactions(voice_id,user_id,reaction) VALUES(p_voice_id,p_user_id,p_reaction);
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.toggle_private_message_reaction(p_message_id uuid,p_reaction text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e boolean;
BEGIN
  IF NOT public.is_private_room_member((SELECT room_id FROM public.private_messages WHERE id=p_message_id)) THEN RAISE EXCEPTION 'Not a member'; END IF;
  IF p_reaction NOT IN (U&'\+01F44D',U&'\+002764\+00FE0F',U&'\+01F602',U&'\+01F62E',U&'\+01F622',U&'\+01F621',U&'\+01F389',U&'\+01F64F') THEN RAISE EXCEPTION 'Invalid reaction'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.private_message_reactions WHERE message_id=p_message_id AND user_id=auth.uid() AND reaction=p_reaction) INTO e;
  IF e THEN DELETE FROM public.private_message_reactions WHERE message_id=p_message_id AND user_id=auth.uid() AND reaction=p_reaction; ELSE INSERT INTO public.private_message_reactions VALUES(p_message_id,auth.uid(),p_reaction); END IF;
  RETURN NOT e;
END; $$;

CREATE OR REPLACE FUNCTION public.toggle_private_voice_reaction(p_voice_id uuid,p_reaction text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e boolean;
BEGIN
  IF NOT public.is_private_room_member((SELECT room_id FROM public.private_voice_messages WHERE id=p_voice_id)) THEN RAISE EXCEPTION 'Not a member'; END IF;
  IF p_reaction NOT IN (U&'\+01F44D',U&'\+002764\+00FE0F',U&'\+01F602',U&'\+01F62E',U&'\+01F622',U&'\+01F621',U&'\+01F389',U&'\+01F64F') THEN RAISE EXCEPTION 'Invalid reaction'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.private_voice_reactions WHERE voice_id=p_voice_id AND user_id=auth.uid() AND reaction=p_reaction) INTO e;
  IF e THEN DELETE FROM public.private_voice_reactions WHERE voice_id=p_voice_id AND user_id=auth.uid() AND reaction=p_reaction; ELSE INSERT INTO public.private_voice_reactions VALUES(p_voice_id,auth.uid(),p_reaction); END IF;
  RETURN NOT e;
END; $$;

GRANT EXECUTE ON FUNCTION public.toggle_global_reaction(uuid,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.toggle_voice_reaction(uuid,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.toggle_private_message_reaction(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_private_voice_reaction(uuid,text) TO authenticated;

NOTIFY pgrst, 'reload schema';
