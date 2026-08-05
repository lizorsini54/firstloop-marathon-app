-- Fixture for the `migration-over-data` CI job.
--
-- Deliberately raw SQL rather than `db:seed`. At the point this runs, the
-- database is at the *base* branch's schema while the checked-out Prisma client
-- is the *pull request's* — so the seed script, which writes through that
-- client, could not be trusted to produce old-schema rows. Raw SQL has no such
-- coupling.
--
-- It touches only columns that have existed since the init migration, one row
-- per table, with a real foreign-key chain: User -> TrainingPlan ->
-- PlannedWorkout -> SessionLog. The point is not realistic volume, it is that
-- every table a migration might alter has at least one row in it, and that the
-- relationships between them are intact.
--
-- Keep it minimal. Anything added here has to stay valid against every future
-- base schema, so the less it asserts about shape, the longer it survives.

INSERT INTO "User" ("id", "clerkId", "email", "updatedAt")
VALUES ('mig_user', 'clerk_migration_fixture', 'migration-fixture@example.com', NOW());

INSERT INTO "TrainingPlan" ("id", "userId", "raceDate", "startDate", "config", "updatedAt")
VALUES (
  'mig_plan',
  'mig_user',
  NOW() + INTERVAL '180 days',
  NOW(),
  '{"runningDaysPerWeek": 3, "strengthMode": "custom"}'::jsonb,
  NOW()
);

INSERT INTO "PlannedWorkout" ("id", "planId", "weekNumber", "day", "type", "prescription", "updatedAt")
VALUES
  ('mig_workout_run', 'mig_plan', 1, 'SUNDAY', 'RUN', '{"distanceMiles": 8, "quality": "long"}'::jsonb, NOW()),
  ('mig_workout_lift', 'mig_plan', 1, 'THURSDAY', 'LIFT', '{"displayName": "Lift session", "exercises": []}'::jsonb, NOW());

-- One linked and one freeform, because the link is what adherence is computed
-- from and a migration that breaks it would otherwise pass unnoticed.
INSERT INTO "SessionLog" ("id", "userId", "plannedWorkoutId", "date", "type", "distanceMiles", "durationMin", "rpe", "updatedAt")
VALUES ('mig_log_linked', 'mig_user', 'mig_workout_run', NOW(), 'RUN', 8.2, 78, 7, NOW());

INSERT INTO "SessionLog" ("id", "userId", "date", "type", "durationMin", "rpe", "updatedAt")
VALUES ('mig_log_freeform', 'mig_user', NOW(), 'LIFT', 45, 6, NOW());
