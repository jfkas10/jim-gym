# Fitness Progress Tracker v26.3

v26.3 turns the Firebase fitness tracker into an installable Progressive Web App (PWA), with special support for iPhone Home Screen installation.

## New in v26.3

- Web App Manifest
- iPhone Home Screen icon
- Standalone/full-screen display mode
- iPhone safe-area support
- Service worker for the application shell
- Runtime caching of Chart.js/Firebase JavaScript libraries after first successful online load
- Offline status banner
- In-app iPhone installation instructions
- Existing Firebase Authentication, Firestore sync, and Admin dashboard remain intact

## Important: iPhone installation requires HTTPS

`http://localhost:8000` is fine for development on your computer, but your girlfriend cannot install that local address on her iPhone.

Deploy this project to an HTTPS host. GitHub Pages is suitable and free.

## Deploy with GitHub Pages

1. Create or open the GitHub repository you want to use.
2. Upload **the contents of this v26.3 folder** to the repository root:
   - `index.html`
   - `manifest.webmanifest`
   - `service-worker.js`
   - `firestore.rules`
   - `css/`
   - `js/`
   - `assets/`
3. Commit and push the files.
4. On GitHub:
   - Repository > Settings > Pages
   - Under Build and deployment, select **Deploy from a branch**
   - Branch: `main`
   - Folder: `/ (root)`
   - Save
5. GitHub will provide an HTTPS URL such as:

       https://YOUR-NAME.github.io/YOUR-REPOSITORY/

## REQUIRED Firebase setting for GitHub Pages

In Firebase Console:

Authentication > Settings > Authorized domains

Add:

    YOUR-NAME.github.io

Do not add the repository path. Firebase authorization is domain-based.

Your existing v26.2 Firestore rules remain valid for v26.3.

## Install on your iPhone

1. Open the GitHub Pages URL in **Safari**.
2. Sign in once while online.
3. Tap Safari's **Share** button.
4. Scroll down and tap **Add to Home Screen**.
5. Leave the name as **Jim Gym** and tap **Add**.
6. Launch Jim Gym from the new Home Screen icon.

## Install on your girlfriend's iPhone

Send her the same GitHub Pages URL.

She should:

1. Open it in Safari.
2. Register/sign in with **her own Firebase account**.
3. Tap Share > Add to Home Screen > Add.
4. Open the Jim Gym Home Screen app.

Her Firebase UID keeps her workout history separate from yours.

## Offline behavior

The PWA application shell is cached after an online visit. Workout data also continues to use the user-specific local cache.

Important limitations:
- A first-ever launch needs internet access.
- Signing into an account that has never authenticated on that device needs internet access.
- Firestore synchronization resumes when the device has a connection.
- Firebase Authentication/Firestore network requests are deliberately not stored in the service-worker cache.

## Updating the installed app

When a new version is deployed to GitHub Pages, the service worker checks for updated files. Safari may briefly use the previous cached shell; reopening the Home Screen app normally loads the updated version.

## Development

For local testing:

    python -m http.server 8000

Open:

    http://localhost:8000

## Firebase

Keep the current v26.2/v26.3 Firestore rules published. The admin dashboard remains read-only for other users.


## Flat GitHub layout
This package is patched so every file can live directly in the repository root. Do not create css/js/assets folders for this build.
