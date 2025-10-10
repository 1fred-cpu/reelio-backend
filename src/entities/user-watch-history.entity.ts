// create table user_watch_history (
//   id uuid primary key default uuid_generate_v4(),
//   user_id uuid references profiles(id) on delete cascade,
//   video_id uuid references videos(id) on delete cascade,
//   progress float default 0.0,
//   last_watched_at timestamptz default now()
// );
