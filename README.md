# Jim Gym Fitness Progress — v26.5.1


v26.5 adds native calendar/date selection and a read-only public view of James's workout progress.

## Native calendar UI

Workout Logging now uses the browser/iPhone native date picker instead of requiring MM/DD/YYYY typing.

- Workout date: native calendar
- Cycling commute date: already uses the native date picker
- Workout Tracking specific-month selection: continues using the native month picker

Stored workout dates remain MM/DD/YYYY internally for compatibility with all existing logs.

## "See how James is doing"

Workout Tracking now includes:

    See how James is doing

Any signed-in user can open a read-only copy of the administrator's workout-tracking data.

In this view users can:
- Browse James's muscle groups and exercises
- View strength charts
- View cycling charts
- View PRs
- Change tracking time ranges
- Zoom/pan charts
- Tap points for log details

They cannot:
- Delete James's logs
- Edit James's logs
- Modify James's exercises through the public tracking view

Tap:

    Back to my progress

to return to the signed-in user's own tracking data.

## Privacy model

v26.5 does NOT expose the administrator's full private Firestore account tree.

Instead, when an admin opens the app, the app publishes only tracking-related keys into:

    publicProgress/<admin UID>/appData/

Published keys are limited to:
- workoutSetLogs:*
- cyclingActivityLogs
- fitnessTrackerCustomExercises

Normal users can read this public-progress collection, but cannot write to it.

The admin's private settings, account data, and other Firestore records remain protected by the existing per-user rules.

## REQUIRED: publish Firestore rules

Firebase Console:

    Firestore Database > Rules

Replace the current rules with the included v26.5 `firestore.rules` and click Publish.

The new rules add read-only access for signed-in users to `publicProgress`.

Only the authenticated administrator can write their own public-progress data.

## First publication

After deploying v26.5:

1. Sign into the admin/James account while online.
2. Leave the app open until cloud sync reports ready.
3. The app will publish the existing tracking snapshot.
4. Other users can then use "See how James is doing."

Existing and future workout logs are mirrored automatically after that.

## GitHub Pages

This package keeps the flat GitHub repository structure used by the existing deployment.

Upload all files directly into the repository root.

The service-worker version is bumped to v26.5.0 so installed iPhones receive the update.


## v26.5.1 bugfix

- Fixed iPhone/Safari native date and month fields overflowing their cards or rendering blank.
- Native calendar/month pickers remain enabled.
- Date/month inputs are now explicitly constrained to their parent width and use iOS-safe sizing.
- The authentication/splash screen now shows the exact app version (`v26.5.1`).
- Service-worker cache version was bumped to `v26.5.1` so installed Home Screen apps can verify the update.
