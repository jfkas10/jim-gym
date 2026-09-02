# Jim Gym Fitness Progress — v26.5.3

This build fixes the v26.5/v26.5.2 startup failure caused by a missing JavaScript import.

## Root cause

`auth.js` called:

    loadPublishedAdminProgress

and:

    publishAdminProgressSnapshot

but those functions were not imported from `sync.js`.

That caused:

    ReferenceError: loadPublishedAdminProgress is not defined

during authenticated startup. Because the exception occurred inside `showAuthenticatedApp()`, the app displayed the generic cloud-data error even though Firebase Authentication and the Firestore rules were not necessarily the problem.

## Fix

v26.5.3 imports all shared/public progress functions explicitly from `sync.js`.

The v26.5.2 defensive behavior is retained:
- private login/cloud sync can succeed even if optional public-progress publishing fails
- public James-progress publishing reports its own error
- normal users remain isolated to their own Firestore data

## Firebase rules

Use the included `firestore.rules`. They are unchanged in principle from the hardened v26.5.2 rules.

Publish them at:

    Firebase Console > Firestore Database > Rules

## Deploy

Upload all files directly to the flat GitHub Pages repository root.

The splash screen and service worker both identify this build as:

    v26.5.3
