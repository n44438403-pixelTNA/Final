# Admin Control Manual & Feature Guide

This document explains the new features added to the **NST AI Assistant** platform and provides instructions for Administrators on how to control and manage them.

## 1. Event Manager (New Tab)
**Location:** Admin Dashboard > **Event Manager** (Calendar Icon)

This centralized hub allows you to manage special events that affect the entire app.

*   **Discount Sale:**
    *   **Function:** Applies a percentage discount (e.g., 20% OFF) to all Store items.
    *   **Control:** Click **"Configure & Start"** to set the discount % and duration. Click **"STOP EVENT"** to instantly end it. The banner in the student store will disappear automatically when the event ends.
*   **Global Free Mode:**
    *   **Function:** Unlocks **ALL** premium content (Notes, Videos, Tests) for **ALL** users for free. Use this for special occasions (e.g., Exam Night).
    *   **Control:** Click **"Start Free Mode"** to activate. A warning will appear. Click **"STOP FREE MODE"** to revert to normal pricing.
*   **Credit Free Event:**
    *   **Function:** Makes all "Credit-based" unlocks free (0 cost), but subscriptions still cost money.
    *   **Control:** Managed similarly to the other events.

---

## 2. Global Watermark Settings
**Location:** Admin Dashboard > **Visibility Control** (Eye Icon)

A secure, static watermark now appears behind all app screens to prevent piracy.

*   **Master Toggle:** Uncheck **"Enable Global Watermark"** to completely hide the logo from the entire app.
*   **Customization:**
    *   **Opacity:** Slider to make the logo faint (0.05) or visible (1.0).
    *   **Size:** Adjust the logo size from 50px to 1000px.
    *   **Position:** Move the logo vertically and horizontally using percentage sliders (e.g., Top 50%, Left 50% = Center).
    *   **User Overlay:** Toggle **"Show User Name Overlay"** to show a faint "Student Name • ID" pattern over the screen for extra security.

---

## 3. Subscription & Streak Logic (Improved)
*   **Smart Priority System:**
    *   If a user has a **Lifetime** subscription and you gift them a **Weekly Ultra** pass, the app now handles this intelligently.
    *   **Rule:** The app grants the **Highest Access Level** (Ultra > Basic). If levels are equal, it keeps the **Longest Duration** (Lifetime > Weekly).
    *   *Result:* Users won't "lose" their Lifetime plan if they get a temporary gift. Once the gift expires, they seamlessly fall back to their Lifetime plan.
*   **Streak System:**
    *   Fixed a bug where streaks stayed at 0.
    *   Logic now uses strict "Date String" comparison to correctly detect consecutive logins.

---

## 4. Daily Routine AI
**Location:** Student Profile & Revision Hub

*   **How it works:**
    *   Every night (or upon first login of the day), the AI scans the student's **Last 10 Test Results**.
    *   **Weakness Detection:** If accuracy in a topic is **< 60%**, the AI assigns a "Deep Dive Revision" task for that topic.
    *   **New Topics:** If no weaknesses are found, it assigns "New Chapter Study".
    *   **Streak Maintenance:** Always includes a "Daily MCQ Challenge" task.
*   **Control:** Admin can reset a user's routine by editing the user, but generally, this is fully automated.

---

## 5. Premium Analysis (New View)
**Location:** Student Dashboard > Analytics > **Premium Analysis**

*   **Tree View:** Students can now see a hierarchical breakdown:
    *   **Topic** (e.g., Science)
        *   **Subtopic/Chapter** (e.g., Chemical Reactions)
            *   **Improvement:** Shows positive (+) or negative (-) growth compared to their first attempt.
            *   **Question Review:** Lists specific questions they got wrong/right.

---

## 6. Granular Redeem Codes
**Location:** Admin Dashboard > Content Manager (Video/Notes/MCQ Tabs)

You can now generate codes for **specific items** instead of just general credits.

*   **How to Create:**
    1.  Go to **Content Manager** (e.g., Video Lectures).
    2.  Find the specific video/chapter you want to give away.
    3.  Click the **Key Icon (🔑)** next to that item.
    4.  Set **Duration** (e.g., 24 Hours) and **Max Uses**.
    5.  **Result:** A code like `VIDEO-XY7Z` is generated. When a student redeems this, *only that specific video* unlocks for the set time.

---

## 7. User Data Download
**Location:** Student Profile > **Download Data**

*   **Format:** Now downloads a professional **HTML Report** instead of a raw JSON text file.
*   **Contents:** Includes Student ID, Class, Subscription Details, Wallet Balance, and a formatted table of Recent Test History. Useful for parents or offline records.

---

## 8. General Improvements
*   **Maintenance Mode:** Now forces a lock screen for everyone (except Admins who enter the bypass code). Admin Dashboard shows the current **Bypass Code** for you to share with specific staff if needed.
*   **Request Content:** Student requests (from the new "Request Content" popup) appear in the **Demands** tab of the Admin Dashboard.
*   **UI Stability:** Fixed buttons extending off-screen. Text now wraps correctly inside buttons.
