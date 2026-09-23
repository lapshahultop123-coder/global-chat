-- Increase only the PRIVATE voice bucket limit as a safety margin.
-- Public chat storage is intentionally unchanged.
update storage.buckets
set file_size_limit = 2097152
where id = 'private-voice-messages';

