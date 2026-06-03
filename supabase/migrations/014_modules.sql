-- 014 — Card modules: a typed, ordered repertoire replacing the
-- separate custom_fields + roadmap surfaces.
--
-- Each element in `modules` is a typed object:
--   { type: "brief",     text: "..." }
--   { type: "roadmap",   steps: ["..."] }
--   { type: "checklist", items: ["..."] }
--   { type: "bring",     items: ["..."] }
--   { type: "kv",        entries: [{ key: "...", value: "..." }] }
--
-- Idempotent — safe to re-run. Existing roadmap + custom_fields are lifted
-- into the new column so what's already displayed survives. The old
-- columns stay in place for now as a rollback safety net; a later
-- cleanup migration will drop them once all module types are live.

alter table cards
  add column if not exists modules jsonb not null default '[]'::jsonb;

update cards
   set modules =
       (case
          when jsonb_typeof(roadmap) = 'array' and jsonb_array_length(roadmap) > 0 then
            jsonb_build_array(jsonb_build_object('type', 'roadmap', 'steps', roadmap))
          else '[]'::jsonb
        end)
     || (case
          when jsonb_typeof(custom_fields) = 'object'
               and custom_fields <> '{}'::jsonb then
            jsonb_build_array(jsonb_build_object(
              'type', 'kv',
              'entries', (
                select coalesce(
                  jsonb_agg(jsonb_build_object('key', key, 'value', value)),
                  '[]'::jsonb
                )
                  from jsonb_each_text(custom_fields)
              )
            ))
          else '[]'::jsonb
        end)
 where modules = '[]'::jsonb
   and (
        (jsonb_typeof(roadmap) = 'array' and jsonb_array_length(roadmap) > 0)
     or (jsonb_typeof(custom_fields) = 'object'
         and custom_fields <> '{}'::jsonb)
   );
