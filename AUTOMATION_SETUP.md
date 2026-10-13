# Jim Gym Spark-safe release setup

The release workflow deliberately stays compatible with Firebase's no-cost Spark plan. GitHub Pages is not deployed unless the person starting the release confirms that local per-user backups have been exported and the matching Firestore Rules have been published manually.

## Required GitHub configuration

1. Set **Settings → Pages → Source** to **GitHub Actions**.
2. No Google Cloud billing account, storage bucket, service account, secret, or repository variable is required.

The workflow supports Jim Gym's existing flat repository layout. It stages only the 19 public application files, so workflow scripts and repository metadata are not included in the deployed site or release ZIP.

## Manual safety checklist before each release

1. In Jim Gym, open **Admin**, select each user, choose **Open Full User Editor**, then use **Settings → Data Safety → Export Backup**.
2. Confirm every expected user has a separate owner-prefixed JSON file and store those files outside the GitHub repository.
3. In Firebase Console, open **Firestore Database → Rules**, paste the release's `site/firestore.rules`, publish it, and confirm the publish time.
4. Only then authorize the release. Codex publishes the tested `main` commit with the `[release-confirmed]` marker, which starts the workflow automatically. Ordinary commits without that marker cannot deploy. As a manual fallback, open GitHub **Actions → Release Jim Gym → Run workflow** and check both required confirmation boxes.

## First proof run

Run the workflow after completing the manual safety checklist. Confirm in order:

1. Verification and migration tests pass.
2. GitHub Pages serves v26.7.1.
3. The workflow artifact contains a flat v26.7.1 ZIP.
4. A signed-in account and an admin-managed account both export owner-prefixed backup filenames.

Do not begin the new codename-based release series until all four checks pass.

