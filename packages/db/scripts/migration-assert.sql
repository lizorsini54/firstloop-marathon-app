-- Asserts the `migration-over-data` fixture survived the branch's migrations.
--
-- A PL/pgSQL block rather than a SELECT with a CASE, because the obvious
-- `ELSE (SELECT 1/0)` trick does not work: that subquery becomes an InitPlan
-- and Postgres evaluates it independently of which CASE branch is taken, so the
-- check failed even when every condition held. (A trivial `WHEN 1=1` version
-- *does* work, because the whole expression gets constant-folded away — which
-- is exactly why it is a misleading thing to test against.)
--
-- RAISE also reports what actually broke, which division by zero cannot.

DO $$
DECLARE
  users int;
  plans int;
  workouts int;
  logs int;
  linked text;
BEGIN
  SELECT count(*) INTO users FROM "User" WHERE id = 'mig_user';
  SELECT count(*) INTO plans FROM "TrainingPlan" WHERE id = 'mig_plan';
  SELECT count(*) INTO workouts FROM "PlannedWorkout" WHERE "planId" = 'mig_plan';
  SELECT count(*) INTO logs FROM "SessionLog" WHERE "userId" = 'mig_user';
  SELECT "plannedWorkoutId" INTO linked FROM "SessionLog" WHERE id = 'mig_log_linked';

  IF users <> 1
     OR plans <> 1
     OR workouts <> 2
     OR logs <> 2
     -- IS DISTINCT FROM, not <>: a migration that nulls the link would make
     -- `<>` evaluate to NULL rather than true, and the check would pass.
     OR linked IS DISTINCT FROM 'mig_workout_run'
  THEN
    RAISE EXCEPTION
      'fixture did not survive the migration: users=% plans=% workouts=% logs=% linked=%',
      users, plans, workouts, logs, linked;
  END IF;

  RAISE NOTICE
    'fixture intact: users=% plans=% workouts=% logs=% linked=%',
    users, plans, workouts, logs, linked;
END $$;
