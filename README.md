# Jim Gym Fitness Progress — v26.5.2

This is a compatibility rebuild of v26.5.1.

## What changed

The public "See how James is doing" feature is now isolated from the core login/cloud-sync path.

If the `publicProgress` Firestore rules are missing or misconfigured:
- normal account login still works
- private workout data still syncs
- the admin can still open and use the app
- only the optional public-progress feature reports an error

The Firestore rules were also rewritten more defensively:
- admin lookup first checks that the admin profile exists
- `get` / `list` permissions are explicit
- normal users remain isolated to their own `users/<uid>` data
- admins retain read-only access to other users
- shared built-in exercise overrides remain admin-write / signed-in-read
- `publicProgress` remains signed-in-read / matching-admin-write

## REQUIRED Firebase step

In Firebase Console:

1. Open **Firestore Database**
2. Open **Rules**
3. Replace the entire rules file with `firestore.rules` from this package
4. Click **Publish**

Then deploy the rest of this package to GitHub Pages.

## Verify the deployed version

The login/splash screen should show:

    v26.5.2

The service worker cache is also versioned as `v26.5.2`.

If an installed iPhone still shows an older version:
1. Open the GitHub Pages URL once in Safari while online.
2. Close the Home Screen app completely.
3. Reopen it.
4. If necessary, remove and re-add the Home Screen app after Safari has loaded the new site once.

## GitHub layout

This remains the flat build: upload every file directly to the repository root.
