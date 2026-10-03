-- database/schema.sql  (traceable to SoT: Data Model)
--
-- Reading Comprehension Screener — backend schema.
-- RLS is enabled on all four tables with no policies; the backend's direct
-- database role bypasses RLS (SoT: Architecture / Data Model).
-- `updated_at` is set by the app on every update (no DB trigger).

create table classrooms (
    id          bigint generated always as identity primary key,
    name        text not null,
    teacher_id  bigint not null,
    created_at  timestamptz not null default now()
);

create table users (
    id                       bigint generated always as identity primary key,
    name                     text not null,
    role                     text not null check (role in ('teacher','learner')),
    learner_reference_number text unique,
    classroom_id             bigint references classrooms(id),
    is_active                boolean not null default true,
    created_at               timestamptz not null default now(),
    updated_at               timestamptz not null default now(),
    constraint learner_needs_lrn
        check (role <> 'learner' or learner_reference_number is not null)
);

-- FK added after both tables exist (classrooms.teacher_id -> users.id)
alter table classrooms
    add constraint classrooms_teacher_fk
    foreign key (teacher_id) references users(id);

-- case-insensitive unique teacher name
create unique index users_teacher_name_uq
    on users (lower(name)) where role = 'teacher';

create table assessments (
    id                 bigint generated always as identity primary key,
    learner_id         bigint not null references users(id),
    classroom_id       bigint not null references classrooms(id),
    access_code        text not null,
    title              text not null,
    category           text not null,
    passage_text       text not null,
    scheduled_for      date not null,
    status             text not null default 'scheduled'
                         check (status in ('scheduled','in_progress','completed')),
    completed_at       timestamptz,
    reading_accuracy   numeric,                       -- reserved Phase 2
    comprehension_score numeric,                      -- 0-100
    diagnosis          text check (diagnosis in
                         ('on_track','decoding_barrier','comprehension_barrier','highest_priority')),
    evaluation         text,                          -- AI summary
    recommendation     text,                          -- AI next step
    evaluated_by       text check (evaluated_by in ('ai','fallback')),
    evaluation_error   text,
    corrections_seen_at timestamptz,
    created_at         timestamptz not null default now(),
    unique (access_code, learner_id)
);

create table answers (
    id              bigint generated always as identity primary key,
    assessment_id   bigint not null references assessments(id) on delete cascade,
    question_text   text not null,
    skill           text not null
                      check (skill in ('literal','inference','vocabulary','sequencing')),
    expected_ideas  text not null,                    -- comma-separated key points
    answer_text     text,
    ai_verdict      text check (ai_verdict in ('correct','partial','missed')),
    evidence        text,
    teacher_override text check (teacher_override in ('correct','partial','missed')),
    overridden_at   timestamptz,
    override_note   text
);

create index assessments_class_code_idx on assessments (classroom_id, access_code);
create index assessments_learner_idx    on assessments (learner_id);
create index answers_assessment_idx     on answers (assessment_id);

-- RLS on, no policies: backend's direct role bypasses it (SoT)
alter table classrooms  enable row level security;
alter table users       enable row level security;
alter table assessments enable row level security;
alter table answers      enable row level security;
