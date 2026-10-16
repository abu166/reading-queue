-- Canonical authority is enforced even for direct REST callers. WHATWG parsing runs in clients.
create function public.canonical_http_url(value text) returns boolean language plpgsql immutable as $$
declare authority text; hostname text; port_text text; address inet; path_text text;
begin
 if value is null or length(value)>4096 or value !~ '^https?://[^/@[:space:]?#]+/[^#[:space:]]*$' or position(chr(92) in value)>0 then return false; end if;
 path_text=split_part(substring(value from '^https?://[^/]+(/.*)$'),'?',1);
 if regexp_replace(path_text,'%2e','.','gi') ~ '(^|/)\.\.?(/|$)' then return false; end if;
 authority=split_part(split_part(value,'://',2),'/',1);
 if authority<>lower(authority) then return false; end if;
 if left(authority,1)='[' then
  hostname=substring(authority from '^\[([^]]+)\]');
  if hostname is null or position(':' in hostname)=0 then return false; end if;
  address=hostname::inet;
  if family(address)<>6 or authority !~ '^\[[0-9a-f:]+\](:[0-9]+)?$' then return false; end if;
  port_text=substring(authority from '\]:([0-9]+)$');
 else
  if authority !~ '^[a-z0-9_]([a-z0-9_.-]*[a-z0-9_.])?(:[0-9]+)?$' then return false; end if;
  hostname=split_part(authority,':',1);
  if hostname ~ '^[0-9.]+$' then address=hostname::inet; if host(address)<>hostname then return false; end if; end if;
  port_text=substring(authority from ':([0-9]+)$');
 end if;
 if port_text is not null then
  if port_text::integer not between 0 and 65535 or port_text<>(port_text::integer)::text then return false; end if;
  if (value like 'http://%' and port_text='80') or (value like 'https://%' and port_text='443') then return false; end if;
 end if;
 return true;
exception when others then return false;
end $$;
create function public.url_identity(value text) returns text language plpgsql immutable as $$
declare authority text; literal text;
begin
 authority=split_part(split_part(value,'://',2),'/',1);
 if left(authority,1)='[' then
  literal=substring(authority from '^\[([^]]+)\]');
  return replace(value,'['||literal||']','['||host(literal::inet)||']');
 end if;
 return value;
end $$;
-- All callable operations run as invoker; RLS remains authoritative.
create table public.reading_items (
 id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users on delete cascade,
 url text not null check(length(url)<=4096 and canonical_http_url(url)),
 title text not null check(length(title)<=500), description text not null default '' check(length(description)<=4000),
 source text generated always as (regexp_replace(split_part(split_part(url,'://',2),'/',1),':[0-9]+$','')) stored,
 cover_url text check(cover_url is null or (length(cover_url)<=4096 and canonical_http_url(cover_url))),
 status text not null default 'Unread' check(status in ('Unread','Reading','Finished','Archived')),
 favorite boolean not null default false, created_at timestamptz not null default now(),updated_at timestamptz not null default now(),finished_at timestamptz,
 version integer not null default 1, search_document tsvector not null default ''::tsvector,
 unique(user_id,url),unique(id,user_id),check((status='Finished')=(finished_at is not null))
);
create unique index items_url_identity on public.reading_items(user_id,public.url_identity(url));
create table public.tags(id uuid primary key default gen_random_uuid(),user_id uuid not null default auth.uid() references auth.users on delete cascade,name text not null check(length(trim(name)) between 1 and 40),unique(id,user_id),unique(user_id,name));
create table public.item_tags(item_id uuid not null,tag_id uuid not null,user_id uuid not null default auth.uid(),primary key(item_id,tag_id),foreign key(item_id,user_id) references public.reading_items(id,user_id) on delete cascade,foreign key(tag_id,user_id) references public.tags(id,user_id) on delete cascade);
create table public.item_notes(item_id uuid primary key,user_id uuid not null default auth.uid(),body text not null default '' check(length(body)<=100000),version integer not null default 1,foreign key(item_id,user_id) references public.reading_items(id,user_id) on delete cascade);
alter table public.reading_items enable row level security;
alter table public.tags enable row level security;
alter table public.item_tags enable row level security;
alter table public.item_notes enable row level security;
create policy owner on public.reading_items for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy owner on public.tags for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy owner on public.item_tags for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy owner on public.item_notes for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create index items_saved on public.reading_items(user_id,created_at desc,id);
create index items_updated on public.reading_items(user_id,updated_at desc,id);
create index items_title on public.reading_items(user_id,title,id);
create index items_filters on public.reading_items(user_id,status,source,favorite);
create index items_search on public.reading_items using gin(search_document);
create index tags_items on public.item_tags(user_id,tag_id,item_id);
create function public.item_before_write() returns trigger language plpgsql set search_path=public as $$
begin
 if tg_op='UPDATE' then new.version=old.version+1; if new.updated_at is not distinct from old.updated_at then new.updated_at=now(); end if; end if;
 if new.status='Finished' then new.finished_at=coalesce(new.finished_at,now()); else new.finished_at=null; end if;
 new.search_document=to_tsvector('english',coalesce(new.title,'')||' '||coalesce(new.description,'')||' '||coalesce((select body from item_notes where item_id=new.id),''));
 return new;
end $$;
create trigger item_write before insert or update on public.reading_items for each row execute function public.item_before_write();
create function public.note_after_write() returns trigger language plpgsql set search_path=public as $$
begin update reading_items set updated_at=now() where id=coalesce(new.item_id,old.item_id); return null; end $$;
create trigger note_write after insert or update or delete on public.item_notes for each row execute function public.note_after_write();
-- A version trigger also protects direct REST writes: clients must supply the old version.
create function public.note_before_write() returns trigger language plpgsql set search_path=public as $$
begin if tg_op='UPDATE' then if new.version<>old.version+1 then raise exception 'Note conflict' using errcode='40001'; end if; new.version=old.version+1; end if; return new; end $$;
create trigger note_version before update on public.item_notes for each row execute function public.note_before_write();
create function public.item_json(i reading_items) returns jsonb language sql stable set search_path=public as $$
 select (to_jsonb(i)-'search_document'-'user_id')||jsonb_build_object('tags',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'name',t.name) order by t.name) from tags t join item_tags it on it.tag_id=t.id where it.item_id=i.id),'[]'::jsonb)) $$;
create function public.list_tags() returns jsonb language sql stable set search_path=public as $$select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name) order by name),'[]') from tags$$;
create function public.list_items(q text default '',state text default null,tag_id uuid default null,host text default null,starred boolean default false,ordering text default 'newest',page integer default 0) returns jsonb language sql stable set search_path=public as $$
 select coalesce(jsonb_agg(item_json(s)),'[]') from (
 select i.* from reading_items i where (q='' or search_document @@ websearch_to_tsquery('english',left(q,500))) and (state is null or status=state) and (host is null or source=host) and (not starred or favorite) and (tag_id is null or exists(select 1 from item_tags it where it.item_id=i.id and it.tag_id=list_items.tag_id))
 order by case when ordering='title' then title end asc,case when ordering='oldest' then created_at end asc,case when ordering='updated' then updated_at end desc,case when ordering='newest' then created_at end desc,id
 limit 24 offset least(greatest(page,0),10000)*24) s $$;
create function public.get_item(target uuid) returns jsonb language sql stable set search_path=public as $$select item_json(i) from reading_items i where id=target$$;
create function public.get_note(target uuid) returns jsonb language sql stable set search_path=public as $$select jsonb_build_object('body',body,'version',version) from item_notes where item_id=target$$;
create function public.save_note(target uuid,content text,expected integer) returns jsonb language plpgsql set search_path=public as $$
declare result jsonb; begin
 -- Serialize note and metadata writes in the same lock order to prevent lost search updates.
 perform 1 from reading_items where id=target for update;
 update item_notes set body=content,version=expected+1 where item_id=target and version=expected returning jsonb_build_object('body',body,'version',version) into result;
 if result is null then raise exception 'Note conflict' using errcode='40001'; end if; return result; end $$;
create function public.save_item(payload jsonb,tag_ids uuid[] default '{}',expected integer default null) returns uuid language plpgsql set search_path=public as $$
declare target uuid; begin
 if cardinality(tag_ids)>50 then raise exception 'Too many tags'; end if;
 if payload->>'id' is null then
 insert into reading_items(url,title,description,cover_url,status,favorite) values(payload->>'url',payload->>'title',coalesce(payload->>'description',''),payload->>'cover_url',coalesce(payload->>'status','Unread'),coalesce((payload->>'favorite')::boolean,false)) returning id into target;
 insert into item_notes(item_id) values(target);
 else
 target=(payload->>'id')::uuid;
 update reading_items set url=payload->>'url',title=payload->>'title',description=payload->>'description',cover_url=payload->>'cover_url',status=payload->>'status',favorite=(payload->>'favorite')::boolean where id=target and version=expected;
 if not found then raise exception 'Item conflict' using errcode='40001'; end if;
 end if;
 delete from item_tags where item_id=target;
 insert into item_tags(item_id,tag_id) select target,unnest(tag_ids);
 return target; end $$;
create function public.find_duplicate(target_url text) returns uuid language sql stable set search_path=public as $$select id from reading_items where url_identity(url)=url_identity(target_url) limit 1$$;
create function public.delete_item(target uuid) returns void language sql set search_path=public as $$delete from reading_items where id=target$$;
create function public.save_tag(label text,target uuid default null) returns void language plpgsql set search_path=public as $$begin if target is null then insert into tags(name) values(trim(label)); else update tags set name=trim(label) where id=target; end if; end$$;
create function public.delete_tag(target uuid) returns void language sql set search_path=public as $$delete from tags where id=target$$;
create function public.export_library() returns jsonb language plpgsql stable set search_path=public as $$
declare result jsonb; begin
 if (select count(*) from reading_items)>1000 or (select count(*) from tags)>1000 then raise exception 'Export exceeds record limit' using errcode='54000'; end if;
 result=jsonb_build_object('version',1,'exported_at',now(),'tags',coalesce((select jsonb_agg(name) from tags),'[]'),'items',coalesce((select jsonb_agg(jsonb_build_object('url',i.url,'title',i.title,'description',i.description,'cover_url',i.cover_url,'status',i.status,'favorite',i.favorite,'created_at',i.created_at,'updated_at',i.updated_at,'finished_at',i.finished_at,'tags',coalesce((select jsonb_agg(t.name) from tags t join item_tags it on it.tag_id=t.id where it.item_id=i.id),'[]'),'note',coalesce(n.body,''))) from reading_items i left join item_notes n on n.item_id=i.id),'[]'));
 if octet_length(result::text)>5242880 then raise exception 'Export exceeds size limit' using errcode='54000'; end if;
 return result;
end$$;
create function public.import_library(payload jsonb,mode text default 'skip') returns jsonb language plpgsql set search_path=public as $$
declare r jsonb; label text; target uuid; tid uuid; made integer=0; changed integer=0; skipped integer=0; existed boolean; begin
 if auth.uid() is null or mode not in ('skip','update') or coalesce(payload->>'version','')<>'1' or coalesce(jsonb_typeof(payload->'items'),'')<>'array' or coalesce(jsonb_typeof(payload->'tags'),'')<>'array' or octet_length(payload::text)>5242880 or jsonb_array_length(payload->'items')>1000 or jsonb_array_length(payload->'tags')>1000 then raise exception 'Invalid backup'; end if;
 -- One transaction. Any malformed record rolls the entire import back.
 if exists(select 1 from jsonb_array_elements(payload->'tags') v where jsonb_typeof(v)<>'string' or length(trim(v#>>'{}')) not between 1 and 40) then raise exception 'Invalid tags'; end if;
 for label in select jsonb_array_elements_text(payload->'tags') loop insert into tags(name) values(label) on conflict(user_id,name) do nothing; end loop;
 for r in select jsonb_array_elements(payload->'items') loop
 if jsonb_typeof(r)<>'object' or not (r ?& array['url','title','description','cover_url','status','favorite','created_at','updated_at','finished_at','tags','note'])
 or jsonb_typeof(r->'url')<>'string' or not canonical_http_url(r->>'url')
 or jsonb_typeof(r->'title')<>'string' or length(r->>'title')>500
 or jsonb_typeof(r->'description')<>'string' or length(r->>'description')>4000
 or jsonb_typeof(r->'note')<>'string' or length(r->>'note')>100000
 or (r->'cover_url'<>'null'::jsonb and (jsonb_typeof(r->'cover_url')<>'string' or not canonical_http_url(r->>'cover_url')))
 or coalesce(r->>'status','') not in ('Unread','Reading','Finished','Archived') or jsonb_typeof(r->'favorite')<>'boolean'
 or jsonb_typeof(r->'created_at')<>'string' or jsonb_typeof(r->'updated_at')<>'string'
 or ((r->>'status'='Finished')<>(r->'finished_at'<>'null'::jsonb))
 then raise exception 'Invalid record'; end if;
 perform (r->>'created_at')::timestamptz,(r->>'updated_at')::timestamptz,(r->>'finished_at')::timestamptz;
 if jsonb_typeof(r->'tags')<>'array' or jsonb_array_length(r->'tags')>50 or r->>'note' is null or length(r->>'note')>100000 or r->>'title' is null or r->>'description' is null or r->>'favorite' is null or r->>'created_at' is null or r->>'updated_at' is null then raise exception 'Invalid record'; end if;
 if exists(select 1 from jsonb_array_elements(r->'tags') v where jsonb_typeof(v)<>'string' or length(trim(v#>>'{}')) not between 1 and 40) then raise exception 'Invalid tags'; end if;
 select id into target from reading_items where url_identity(url)=url_identity(r->>'url') for update; existed=found;
 if existed and mode='skip' then skipped=skipped+1; continue; end if;
 if existed then
 update reading_items set title=r->>'title',description=r->>'description',cover_url=r->>'cover_url',status=r->>'status',favorite=(r->>'favorite')::boolean,finished_at=(r->>'finished_at')::timestamptz where id=target; changed=changed+1;
 else
 insert into reading_items(url,title,description,cover_url,status,favorite,created_at,updated_at,finished_at) values(r->>'url',r->>'title',r->>'description',r->>'cover_url',r->>'status',(r->>'favorite')::boolean,(r->>'created_at')::timestamptz,(r->>'updated_at')::timestamptz,(r->>'finished_at')::timestamptz) returning id into target; made=made+1;
 end if;
 insert into item_notes(item_id,body) values(target,r->>'note') on conflict(item_id) do update set body=excluded.body,version=item_notes.version+1;
 delete from item_tags where item_id=target;
 for label in select jsonb_array_elements_text(r->'tags') loop
 insert into tags(name) values(label) on conflict(user_id,name) do update set name=excluded.name returning id into tid;
 insert into item_tags(item_id,tag_id) values(target,tid) on conflict do nothing;
 end loop;
 update reading_items set updated_at=(r->>'updated_at')::timestamptz where id=target;
 end loop;
 return jsonb_build_object('created',made,'updated',changed,'skipped',skipped,'invalid',0); end$$;
-- No anonymous access; invoker functions cannot bypass ownership.
revoke all on all tables in schema public from anon;
revoke execute on all functions in schema public from public,anon;
grant execute on all functions in schema public to authenticated;
grant select,insert,update,delete on public.reading_items,public.tags,public.item_tags,public.item_notes to authenticated;
