-- ===========================================================================
-- Migration 00012: college year levels
--
-- `education_level` stopped at Grade 12 and jumped straight to 'graduate', so
-- a college student had no level to pick — the classification lived entirely in
-- `college_program` and the year of study was nowhere on record. Add the four
-- undergraduate years.
--
-- The values spell out their own label ('college_1st_year' reads as
-- "College 1st Year" through the initcap/replace used by
-- book_borrowing_history_view and most_active_borrowers), the same trick
-- 'grade_11' already relies on.
--
-- Values are appended after 'graduate' — Postgres cannot insert into the middle
-- of an enum — and nothing sorts on this type, so the order is cosmetic. The
-- app lists levels from EDUCATION_LEVELS in src/lib/constants.ts.
-- ===========================================================================

alter type public.education_level add value if not exists 'college_1st_year';
alter type public.education_level add value if not exists 'college_2nd_year';
alter type public.education_level add value if not exists 'college_3rd_year';
alter type public.education_level add value if not exists 'college_4th_year';

comment on type public.education_level is
  'Kinder through Grade 12, the four college years (college_1st_year .. '
  'college_4th_year) and the graduate school. A college or graduate level is '
  'paired with a college_program; a senior high level is paired with a '
  'senior_high_track.';
