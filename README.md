# Jim Gym Fitness Progress — v26.7.1

v26.7.1 is a small release-preparation update. Backup downloads are now prefixed with the account display name, including the selected user's name when an administrator is working in full-user-editor mode. For example:

    jane-smith-jim-gym-backup-2026-10-11.json

The backup JSON also includes an `owner` metadata object with the UID, display name, and email address when available. Restore compatibility is unchanged because older restore code ignores additional metadata.

v26.7 makes workout history canonical across Logging and Tracking, adds full admin user-management mode, and changes every progress chart to straight measured-point segments.

## Before deployment

v26.6 is the production checkpoint. Before testing v26.7 with an important account, use **Settings → Data Safety → Export Backup** in v26.6 and keep the JSON file outside the app.

Publish the included `firestore.rules` before using the new admin editor. The rules allow an authenticated admin to write another user's `appData`; normal users remain restricted to their own profile and app data.

## Architecture

- `index.html`, `styles.css`, `auth.css`: flat GitHub Pages UI.
- `storage.js`: user-prefixed LocalStorage, memory-only guest storage, and cloud-write adapter.
- `workout-history.js`: canonical strength-history service shared by Logging and Tracking.
- `app-core.js`: splits, workout logging, tracking/charts, cycling, backups, gyms, migrations, and settings.
- `firebase.js`, `sync.js`, `auth.js`: Firebase Authentication, Firestore merge/sync, account lifecycle, and admin-managed-user sessions.
- `admin.js`: admin user browser and entry into the full user editor.
- `service-worker.js`: offline application shell and runtime CDN cache.
- `firestore.rules`: owner isolation plus explicit administrator access.

Firestore stores user application values as string documents under:

    users/<uid>/appData/<encoded-storage-key>

The browser cache uses the same logical keys under a UID-prefixed LocalStorage namespace. On sign-in, workout and cycling arrays are loss-aversely merged by log identity; structured split, exercise, and gym arrays merge by ID. Guest mode uses memory only and never reads or writes Firestore or LocalStorage workout data.

## Canonical workout history

Older versions used multiple physical `workoutSetLogs:<exercise-id>` keys for exercises whose IDs changed. v26.6 copied known aliases at startup, but Logging still read one key while Tracking merged aliases independently. A missing or newly discovered alias could therefore appear in a graph but not as Logging's previous workout or PR.

v26.7 routes all self-history reads through `workout-history.js`:

- Logging PR, previous workout, and current-date sets use the canonical history service.
- Tracking uses the same canonical history service rather than a separate alias merge.
- New logs are written only to the current canonical exercise key.
- Known aliases and records whose embedded `performedExerciseId` identifies the canonical exercise are merged and deduplicated.
- Migration copies recoverable history into the canonical key and is safe to run repeatedly.
- **Legacy workout keys are never deleted by migration.**
- Deletions create canonical tombstones, so a deliberately deleted set is not resurrected from a preserved legacy key.

This keeps one canonical API/view without risking the original historical records. Backup export includes canonical data, preserved legacy keys, and tombstones.

## Admin user editor

Administrators can open **Admin**, select a user, and choose **Open Full User Editor**. The app reloads into a clearly marked admin-managed session for that UID. In this mode the normal Split Manager, Workout Logging, Workout Tracking, backups, exercise library, gyms, and settings operate on the selected user's isolated storage and Firestore data.

Workout Tracking log details now include **Edit Log** for strength sets, in addition to deletion. The editor supports date, reps/duration, load, side, and variation fields when applicable. The sticky banner's **Return to my data** button exits managed mode. Account deletion is disabled while managing another user.

The managed-user selection is held in `sessionStorage` and is honored only after Firestore confirms that the signed-in account has `role: "admin"`. Firestore rules are the final authorization boundary.

## Progress graphs

Strength and cycling Chart.js datasets use `tension: 0`, so measured points are connected by straight line segments. No spline interpolation is used.

## Existing v26.6 behavior retained

- Email/password authentication and account-scoped storage
- loss-averse local/cloud synchronization
- guest sessions
- built-in and custom split management/import/export
- ChatGPT-friendly split TXT export
- strength and cycling logging/tracking
- backup export and restore
- exercise library and shared admin overrides
- personal/global gyms and equipment compatibility reference
- James public read-only progress
- offline service-worker shell

## Data safety and compatibility

The backup schema is `26.7.1`; restore remains tolerant of older version-independent backup values. Pre-account LocalStorage migration is unchanged. Side-specific exercise migration remains idempotent. Canonical workout migration does not rely on a one-time cloud flag and does not delete legacy data.

## Deployment

This remains a flat GitHub Pages build. Upload every file in the ZIP directly to the repository root, then publish `firestore.rules` in Firebase Console → Firestore Database → Rules.

The splash badge and service-worker cache are `v26.7.1`. Open the deployed URL once while online so installed Home Screen apps can receive the new service worker and cache `workout-history.js`.

## Verification performed for this build

- JavaScript syntax checks for every `.js` file
- canonical migration from alias-only history
- canonical + legacy deduplication
- Logging-style previous-workout and PR lookup from migrated history
- preservation of the original legacy key
- idempotent repeated migration
- deletion tombstone behavior with preserved legacy data
- straight-line chart configuration checks
- flat ZIP root/content verification
