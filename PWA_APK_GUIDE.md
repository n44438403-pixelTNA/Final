# How to Create a PWA APK and Configure Google Auth

You want to convert your PWA into an Android APK, hide the URL bar (like Vercel), and ensure Google Sign-In works correctly. Here is the step-by-step roadmap.

I have already written the code to turn your website into a PWA (manifest, icons, service worker are added).

Here is what you need to do next:

---

## 🚀 Step 1: Deploy Your App
Your app **must** be deployed online (e.g., on Vercel, Netlify, or Firebase Hosting) and have a valid HTTPS link (e.g., `https://your-app-name.vercel.app`).
**Do not use a `localhost` link.**

---

## 📱 Step 2: Convert PWA to APK (Hiding the URL bar)

To make your PWA look like a real app without showing the Vercel/browser URL bar, you must use a **Trusted Web Activity (TWA)** wrapper.

**Option A: The Easiest Way (PWABuilder)**
1. Go to [PWABuilder.com](https://www.pwabuilder.com/).
2. Enter your live Vercel URL (e.g., `https://your-app-name.vercel.app`).
3. PWABuilder will scan your site (it will pass because I just added the PWA code).
4. Click **"Package for Android"**.
5. It will generate an APK and an AAB (for the Google Play Store).
6. **Important:** When you download the package, PWABuilder will provide an **assetlinks.json** snippet.
7. You must copy that snippet and place it in your app at `public/.well-known/assetlinks.json` and redeploy. This "Trusted Web Activity" verification is what **hides the URL bar** completely.

**Option B: Bubblewrap (Advanced / CLI)**
If you want to do it locally on your computer:
1. Install Node.js.
2. Run: `npm i -g @google/bubblewrap`
3. Run: `bubblewrap init --manifest https://your-app-name.vercel.app/manifest.webmanifest`
4. Follow the prompts, then run `bubblewrap build` to get your APK.

---

## 🔐 Step 3: Fixing Google Auth in the APK

When you convert a PWA to an APK, Google Sign-In usually breaks because the APK has a different "signature" than your website.

To fix this, you must tell Firebase that your Android APK is allowed to use Google Sign-In.

**1. Get your APK's SHA-1 Fingerprint:**
*   If you used PWABuilder, the SHA-1 key is provided in the zip file they give you (often in a `readme.txt` or under their Android package settings).
*   If you upload to Google Play, Google Play Console gives you the "App Signing SHA-1" under **Setup > App Integrity**.

**2. Add Android App to Firebase:**
1. Open your [Firebase Console](https://console.firebase.google.com/).
2. Go to your Project settings (the gear icon).
3. Under "Your apps", click **Add App** and choose the **Android icon**.
4. Enter your Android package name (e.g., `com.ideal.classes`). *You chose this name when using PWABuilder or Bubblewrap.*
5. **CRITICAL:** Paste the **SHA-1 certificate fingerprint** you got in step 1.
6. Register the app.

**3. Update Google Auth in Firebase:**
1. In Firebase, go to **Authentication > Sign-in method > Google**.
2. Make sure it is enabled.
3. Because you added the Android App with the SHA-1 key, Firebase will automatically generate a new OAuth client ID that allows your APK to authenticate.

---

### Summary of What I (Jules) Did:
1. Added `vite-plugin-pwa` to your build system.
2. Created standard PWA icons from your uploaded image (`icon-192x192.png`, `icon-512x512.png`, `apple-touch-icon.png`, `favicon.ico`).
3. Set up the `manifest.webmanifest` with your app's name, colors, and standalone display mode.
4. Set up an offline Service Worker (`sw.js`) that caches fonts, scripts, and CSS.

### What You Need To Do:
1. Push this code and let it deploy to Vercel.
2. Go to PWABuilder.com and generate the APK.
3. Put the `assetlinks.json` from PWABuilder into the `public/.well-known/` folder and push again (to hide the URL bar).
4. Put your APK's SHA-1 key into Firebase Android settings (to fix Google Login).