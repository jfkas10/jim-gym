# Jim Gym Fitness Progress — v26.6

v26.6 focuses on data consistency/safety and adds guest sessions, text split export, and gym/equipment management.

## 1. Historical workout log consistency

Older app versions sometimes stored the same exercise under different storage IDs. Workout Tracking already knew how to graph those aliases together, but Workout Logging could look only at the current ID when calculating:

- Personal record
- Previous workout
- Sets already logged for that exercise

That is why historical data could appear on a graph but not in the logger.

v26.6 fixes this with a canonical-log migration.

On startup, the app:
1. Reads all known historical aliases for each exercise.
2. Copies/deduplicates those logs into the current canonical exercise ID.
3. Preserves the original alias storage instead of deleting it.
4. Infers old variation names where possible.
5. Keeps new logs on the canonical ID going forward.

The migration is idempotent and runs safely on every startup rather than trusting a one-time cloud flag.

Workout Tracking also deduplicates the canonical + legacy copies, so the migration does not create double points on charts.

## 2. Loss-averse Firebase synchronization

v26.6 no longer blindly treats the cloud snapshot as authoritative when both local and cloud workout history exist.

For:
- `workoutSetLogs:*`
- cycling logs

local and cloud arrays are merged by log identity before the app opens. This helps protect workout sets that may have been cached locally while a device briefly had no connection.

Custom splits, custom exercises, and personal gyms are also merged by ID where possible.

## 3. On-demand backups

Settings > Data Safety now includes:

- **Export Backup**
- **Restore Backup**

The backup is a JSON snapshot of the signed-in user's complete app storage, including workout logs, cycling history, custom splits/exercises, settings, personal gyms, and other user-scoped app state.

Backup files include:
- format identifier
- schema version
- export timestamp
- all user-scoped app storage values

Restoring replaces the current account/session state and, for signed-in accounts, replaces the Firestore app-data snapshot as well.

Keep periodic backup files somewhere outside the app (Files, iCloud Drive, Google Drive, etc.) if you want an additional safety net.

## 4. Guest sessions

The login screen now includes:

    Continue as Guest

Guest mode:
- requires no Firebase account
- supports logging and tracking during the current session
- can create temporary splits/exercises/gyms
- uses memory-only storage
- never writes guest workout data to LocalStorage or Firestore
- clears all guest data when the session ends/reloads

This is meant only for trying the app.

## 5. ChatGPT-friendly split export

Split Manager now has:

    Export ChatGPT TXT

and each split in Manage Splits also has a `TXT` export button.

The generated `.txt` file uses a Markdown-compatible table:

    | Day | Section | Exercise | Prescription | Variations / Notes |

This can be pasted directly into ChatGPT for routine analysis.

JSON split import/export remains available for app-to-app backups/sharing.

## 6. Gyms and equipment

Settings now includes **Gym & Equipment Library**.

### Personal gyms
Any normal signed-in user or guest can:
- add a gym
- name it
- check available equipment
- add custom equipment that is not in the built-in list
- edit/delete personal gyms

Signed-in personal gyms are synced through the user's existing Firestore app data.

### Global gyms
Admins can:
- save a gym as global
- edit global gyms
- delete global gyms

All signed-in users can see global gyms.

### Global equipment
Admins can edit the shared equipment list from Settings.

The initial built-in list is:

- squat rack
- smith machine
- barbell bench
- assisted pull-up/dip machine
- shoulder press
- chest press
- pec deck
- cable machine
- dumbbell rack
- preacher bench
- cable lat pulldown
- standing calf raise
- ab crunch machine
- seated curl
- leg extension
- horizontal leg press
- glute drive
- hip abduction/adduction
- roman chair
- hyperextension bench
- back extension machine
- seated calf raise
- chest-supported row
- cable row
- treadmill
- deadlift platform
- preacher curl machine
- hack squat
- inclined leg press
- lat pulldown machine

### Workout Logging compatibility check
After selecting a workout day, Workout Logging now displays a Gym Compatibility reference card.

Choose one of your personal/global gyms to see its available equipment before starting the workout.

The app deliberately does **not** automatically declare a workout compatible/incompatible. The equipment list is shown as a reference so the user can decide whether the gym has appropriate equipment or substitutes.

## REQUIRED FIREBASE STEP

v26.6 adds two shared Firestore areas:

    globalFitnessConfig
    globalGyms

Publish the included `firestore.rules`:

1. Firebase Console
2. Firestore Database
3. Rules
4. Replace the existing rules with this build's `firestore.rules`
5. Click **Publish**

The rules keep:
- private user app data owner-write
- admin read access to user data
- shared exercise overrides admin-write
- James public progress signed-in-read / admin-write
- global gym/equipment data signed-in-read / admin-write

Guest mode does not use Firestore.

## Deployment

This remains the flat GitHub Pages build.

Upload every file directly to the repository root.

The splash screen shows:

    v26.6

and the service-worker cache is:

    v26.6.0

Open the GitHub Pages URL once in Safari while online after deployment so installed iPhone Home Screen apps can pick up the new service worker.
