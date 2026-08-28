# Jim Gym Fitness Progress — v26.4

v26.4 adds exercise-library management, better phone-friendly time entry, treadmill logging, and personal records.

## New features

### Exercise library management
Settings now contains **Manage Workouts**.

Normal users can:
- Edit their custom exercises
- Change name and muscle group
- Toggle loading, duration, Left/Right logging, and assistance
- Edit variations
- Delete custom exercises

Historical logs are preserved when a custom exercise is deleted.

Administrators can additionally edit the shared built-in exercise definitions. Built-in edits are stored in Firestore under:

    sharedExerciseOverrides/<exercise-id>

and are loaded by all signed-in users.

Admins can also reset an edited built-in exercise to the app default.

### Lateral raises
The built-in Lateral Raises exercise now logs Left and Right separately.

For existing lateral-raise logs that do not contain a side, v26.4 automatically migrates each workout date using:

    Set 1 = Left
    Set 2 = Right
    Set 3 = Left
    Set 4 = Right
    ...

The same migration is applied if a previously non-sided exercise is changed to Left/Right in the exercise editor.

### Treadmill
Treadmill logging now includes:
- Minutes
- Seconds
- Incline percentage

Stored treadmill durations display as MM:SS.

### Cycling time on iPhone
Cycling commute time now uses separate **Minutes** and **Seconds** number fields, so the iPhone numeric keypad works without requiring a colon key.

The saved/logged value is still stored as MM:SS.

### Personal records
Strength exercises now calculate a PR.

Weighted exercise:

    PR score = loading × reps

Assisted/bodyweight exercise:

    PR score = (body weight - assistance weight) × reps

A negative assistance value represents added weight, so:

    body weight - (-added weight)

correctly increases effective resistance.

Timed exercises:

    PR = maximum duration

Workout Logging displays:
- Personal record
- Most recent set from the most recent previous workout date

Workout Tracking also displays the exercise PR.

### Firestore rules
v26.4 adds a shared exercise override collection.

You MUST publish the included `firestore.rules` before administrators can edit built-in exercises.

The rules allow:
- All signed-in users to read shared built-in exercise overrides
- Only admins to create/update/delete them
- Existing per-user privacy rules remain in place

## Deployment

This is the **flat GitHub Pages build**. Upload every file directly into the repository root, matching the structure used by your current `jim-gym` repository.

After deployment, the v26.4 service-worker cache name is new, so installed iPhones should pick up the update. If an iPhone still shows the previous version, fully close the Home Screen app and reopen it while online.

For desktop debugging, a hard refresh or service-worker unregister may be useful.
