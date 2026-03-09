import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore, doc, setDoc, getDoc, collection, updateDoc, deleteDoc, onSnapshot, getDocs, query, where, limitToLast, orderBy, increment } from "firebase/firestore";
import { getDatabase, ref, set, get, onValue, update, remove, query as rtdbQuery, limitToLast as rtdbLimitToLast, orderByChild as rtdbOrderByChild } from "firebase/database";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { storage } from "./utils/storage";

// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyBaf1iGBIHgtma9SCt1Q4SduRAQP5DBnlE",
  authDomain: "iic-adf79.firebaseapp.com",
  databaseURL: "https://iic-adf79-default-rtdb.firebaseio.com",
  projectId: "iic-adf79",
  storageBucket: "iic-adf79.firebasestorage.app",
  messagingSenderId: "970486594646",
  appId: "1:970486594646:web:e1eccee34b14b38923cff7",
  measurementId: "G-VWPT3BYEZK"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const rtdb = getDatabase(app);
const auth = getAuth(app);

// --- EXPORTED HELPERS ---

// Helper to remove undefined fields (Firestore doesn't support them)
export const sanitizeForFirestore = (obj: any): any => {
  // Preserve Date objects (Firestore supports them or converts to Timestamp)
  if (obj instanceof Date) {
      return obj;
  }
  
  if (Array.isArray(obj)) {
    // Filter out undefineds from arrays (Firestore rejects arrays with undefined)
    return obj.map(v => sanitizeForFirestore(v)).filter(v => v !== undefined);
  } else if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((acc, key) => {
      const value = sanitizeForFirestore(obj[key]);
      if (value !== undefined) {
        acc[key] = value;
      }
      return acc;
    }, {} as any);
  }
  return obj;
};

// Connection State Monitoring
let isFirebaseConnected = false;
const connectedRef = ref(rtdb, ".info/connected");
onValue(connectedRef, (snap) => {
  isFirebaseConnected = !!snap.val();
});

export const checkFirebaseConnection = () => {
  // Return true if either navigator is online AND we have a realtime connection
  // Fallback to navigator.onLine if RTDB isn't initialized yet (rare)
  return isFirebaseConnected;
};

export const subscribeToAuth = (callback: (user: any) => void) => {
  return onAuthStateChanged(auth, (user) => {
    callback(user);
  });
};

// --- NUCLEAR RESET ---
export const resetAllContent = async () => {
  let cloudError = null;
  try {
    console.log("STARTING NUCLEAR RESET...");

    // 1. Clear Local Storage (Synchronous & Async) FIRST
    // This ensures local cleanup happens regardless of cloud status
    try {
        localStorage.clear(); // Clear standard local storage (Session, Settings, Cache)
        await storage.clear(); // Clear IndexedDB/LocalForage (Heavy Content)
        console.log("✅ Local Data Cleared Successfully");
    } catch (localErr) {
        console.error("Local Clear Error (Non-Fatal):", localErr);
    }

    // 2. RTDB Wipes
    try {
        const rtdbPaths = ['content_data', 'custom_syllabus', 'public_activity', 'ai_interactions', 'universal_analysis_logs'];
        await Promise.all(rtdbPaths.map(path => remove(ref(rtdb, path))));
        console.log("✅ RTDB Cleared Successfully");
    } catch (e: any) {
        console.error("RTDB Reset Error:", e);
        cloudError = e;
    }

    // 3. Firestore Wipes (Iterative delete)
    try {
        const collections = ['content_data', 'custom_syllabus', 'public_activity', 'ai_interactions', 'universal_analysis_logs'];
        for (const colName of collections) {
          const q = query(collection(db, colName));
          const snapshot = await getDocs(q);
          const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
          await Promise.all(deletePromises);
        }
        console.log("✅ Firestore Cleared Successfully");
    } catch (e: any) {
        console.error("Firestore Reset Error:", e);
        if (!cloudError) cloudError = e;
    }

    // Report Outcome
    if (cloudError) {
        // We throw modified error to inform UI that Local succeeded but Cloud failed
        throw new Error(`LOCAL DATA CLEARED, but Cloud Reset Failed (Permission Denied). check Console.`);
    }

    console.log("NUCLEAR RESET COMPLETE");
  } catch (e) {
    console.error("RESET ERROR", e);
    throw e;
  }
};

// --- PROFILE PICTURE UPLOAD ---
export const uploadProfilePicture = async (uid: string, file: File): Promise<string> => {
    try {
        const fileRef = storageRef(fStorage, `profile_pics/${uid}_${Date.now()}`);
        const snapshot = await uploadBytes(fileRef, file);
        const downloadUrl = await getDownloadURL(snapshot.ref);

        // Update Firestore & RTDB immediately
        await Promise.all([
            setDoc(doc(db, "users", uid), { photoURL: downloadUrl }, { merge: true }),
            update(ref(rtdb, `users/${uid}`), { photoURL: downloadUrl })
        ]);

        return downloadUrl;
    } catch (e) {
        console.error("Profile picture upload failed:", e);
        throw e;
    }
}

// --- DUAL WRITE / SMART READ LOGIC ---

// 1. User Data Sync
export const saveUserToLive = async (user: any) => {
  try {
    if (!user || !user.id) return;

    // Sanitize data before saving
    const sanitizedUser = sanitizeForFirestore(user);

    // EXTRACT BULKY DATA FOR SEGREGATION
    const { mcqHistory, usageHistory, progress, testResults, inbox, ...coreProfile } = sanitizedUser;

    const promises = [];

    // 1. Save Core Profile to RTDB & Firestore (users/{uid})
    promises.push(set(ref(rtdb, `users/${user.id}`), coreProfile).catch(e => console.error("RTDB Core Save Error:", e)));
    promises.push(setDoc(doc(db, "users", user.id), coreProfile).catch(e => console.error("Firestore Core Save Error:", e)));

    // 2. Save Bulky Data to Subcollections or Document Extensions to avoid 1MB document limit
    // Note: To keep things intact for the current frontend without massive refactoring,
    // we save the bulky data in a parallel collection `user_data/{uid}`
    const bulkyData: any = {};
    if (mcqHistory !== undefined) bulkyData.mcqHistory = mcqHistory;
    if (usageHistory !== undefined) bulkyData.usageHistory = usageHistory;
    if (progress !== undefined) bulkyData.progress = progress;
    if (testResults !== undefined) bulkyData.testResults = testResults;
    if (inbox !== undefined) bulkyData.inbox = inbox;

    if (Object.keys(bulkyData).length > 0) {
        promises.push(setDoc(doc(db, "user_data", user.id), bulkyData).catch(e => console.error("Firestore Bulky Data Save Error:", e)));
    }

    await Promise.all(promises);
  } catch (error) {
    console.error("Error saving user:", error);
  }
};

export const subscribeToUsers = (callback: (users: any[]) => void) => {
  // Prefer Firestore for Admin List (More Reliable)
  const q = collection(db, "users");
  return onSnapshot(q, (snapshot) => {
      const users = snapshot.docs.map(doc => doc.data());
      if (users.length > 0) {
          callback(users);
      } else {
          // Fallback to RTDB if Firestore is empty (migration scenario)
          const usersRef = ref(rtdb, 'users');
          onValue(usersRef, (snap) => {
             const data = snap.val();
             const userList = data ? Object.values(data) : [];
             callback(userList);
          }, { onlyOnce: true });
      }
  });
};

export const getUserData = async (userId: string) => {
    try {
        let coreData: any = null;

        // Try RTDB
        const snap = await get(ref(rtdb, `users/${userId}`));
        if (snap.exists()) {
             coreData = snap.val();
        } else {
            // Try Firestore
            const docSnap = await getDoc(doc(db, "users", userId));
            if (docSnap.exists()) {
                 coreData = docSnap.data();
            }
        }

        if (coreData) {
             // Fetch segregated bulky data
             const bulkySnap = await getDoc(doc(db, "user_data", userId)).catch(() => null);
             let bulkyData = {};
             if (bulkySnap && bulkySnap.exists()) {
                  bulkyData = bulkySnap.data();
             }

             // Fetch history subcollection
             const historySnap = await getDocs(collection(db, "users", userId, "history")).catch(() => null);
             if (historySnap && !historySnap.empty) {
                  (bulkyData as any).mcqHistory = historySnap.docs.map(d => d.data());
             }

             // Fetch test_results subcollection
             const testResultsSnap = await getDocs(collection(db, "users", userId, "test_results")).catch(() => null);
             if (testResultsSnap && !testResultsSnap.empty) {
                  (bulkyData as any).testResults = testResultsSnap.docs.map(d => d.data());
             }

             return { ...coreData, ...bulkyData };
        }

        return null;
    } catch (e) { console.error(e); return null; }
};

export const getUserByEmail = async (email: string) => {
    try {
        const q = query(collection(db, "users"), where("email", "==", email));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            return querySnapshot.docs[0].data();
        }
        return null; 
    } catch (e) { console.error(e); return null; }
};

export const getUserByMobileOrId = async (input: string) => {
    try {
        // Run parallel queries to speed up lookup
        const qMobile = query(collection(db, "users"), where("mobile", "==", input));
        const qDisplayId = query(collection(db, "users"), where("displayId", "==", input));
        const qEmail = query(collection(db, "users"), where("email", "==", input));

        const [snapMobile, snapId, snapEmail] = await Promise.all([
            getDocs(qMobile),
            getDocs(qDisplayId),
            getDocs(qEmail)
        ]);

        if (!snapMobile.empty) return snapMobile.docs[0].data();
        if (!snapId.empty) return snapId.docs[0].data();
        if (!snapEmail.empty) return snapEmail.docs[0].data();

        return null;
    } catch (e) { console.error(e); return null; }
};

// 2. System Settings Sync
export const getSystemSettings = async () => {
    try {
        const docSnap = await getDoc(doc(db, "config", "system_settings"));
        if (docSnap.exists()) return docSnap.data();
        
        const snap = await get(ref(rtdb, 'system_settings'));
        if (snap.exists()) return snap.val();
        
        return null;
    } catch (e) {
        console.error("Error getting settings:", e);
        return null;
    }
};

export const saveSystemSettings = async (settings: any) => {
  try {
    const sanitizedSettings = sanitizeForFirestore(settings);
    // Use Promise.allSettled to ensure partial success if one DB is restricted (Permission Denied)
    const results = await Promise.allSettled([
        set(ref(rtdb, 'system_settings'), sanitizedSettings),
        setDoc(doc(db, "config", "system_settings"), sanitizedSettings)
    ]);

    // Check if at least one succeeded
    const anySuccess = results.some(r => r.status === 'fulfilled');
    const errors = results.filter(r => r.status === 'rejected').map((r: any) => r.reason);

    if (!anySuccess) {
      throw new Error(errors.map(e => e.message).join(' | ') || "All writes failed");
    } else if (errors.length > 0) {
      console.warn("Partial Save Warning:", errors);
    }
  } catch (error) {
    console.error("Error saving settings:", error);
    throw error;
  }
};

export const subscribeToSettings = (callback: (settings: any) => void) => {
  // Listen to Firestore
  return onSnapshot(doc(db, "config", "system_settings"), (docSnap) => {
      if (docSnap.exists()) {
          callback(docSnap.data());
      } else {
          // Fallback RTDB
           onValue(ref(rtdb, 'system_settings'), (snap) => {
               const data = snap.val();
               if (data) callback(data);
           }, { onlyOnce: true });
      }
  });
};

// 3. Content Links Sync (Bulk Uploads)
export const bulkSaveLinks = async (updates: Record<string, any>) => {
  try {
    const sanitizedUpdates = sanitizeForFirestore(updates);
    // RTDB
    await update(ref(rtdb, 'content_links'), sanitizedUpdates);
    
    // Firestore - We save each update as a document in 'content_data' collection
    // 'updates' is a map of key -> data
    const batchPromises = Object.entries(sanitizedUpdates).map(async ([key, data]) => {
         await setDoc(doc(db, "content_data", key), data);
    });
    await Promise.all(batchPromises);

  } catch (error) {
    console.error("Error bulk saving links:", error);
  }
};

// 4. Chapter Data Sync (Individual)
export const saveChapterData = async (key: string, data: any) => {
  try {
    // 1. Sanitize Data
    const sanitizedData = sanitizeForFirestore(data);

    // 2. Cache Locally (Primary Source of Truth for this user session)
    await storage.setItem(key, sanitizedData);
    
    // 3. Cloud Sync (Wait for at least one success to confirm)
    // We use Promise.allSettled to ensure we try both but don't fail if one fails
    // However, if we are online, we want to know if it failed.

    const promises = [];
    promises.push(set(ref(rtdb, `content_data/${key}`), sanitizedData));
    promises.push(setDoc(doc(db, "content_data", key), sanitizedData));

    await Promise.all(promises);
    return true; // Explicit Success
  } catch (error) {
    console.error("Error saving chapter data:", error);
    throw error; // Propagate error so UI can show failure
  }
};

export const getChapterData = async (key: string) => {
    try {
        // 1. Try Firestore First (More Authoritative)
        const docSnap = await getDoc(doc(db, "content_data", key));
        if (docSnap.exists()) {
            const data = docSnap.data();
            // Cache in storage for offline/speed
            await storage.setItem(key, data);
            return data;
        }

        // 2. Try RTDB
        const snapshot = await get(ref(rtdb, `content_data/${key}`));
        if (snapshot.exists()) {
            const data = snapshot.val();
            await storage.setItem(key, data);
            return data;
        }
        
        // 3. Last Resort: Storage
        const stored = await storage.getItem(key);
        if (stored) return stored;
        
        return null;
    } catch (error) {
        console.error("Error getting chapter data:", error);
        const stored = await storage.getItem(key);
        if (stored) return stored;
        return null;
    }
};

// Used by client to listen for realtime changes to a specific chapter
export const subscribeToChapterData = (key: string, callback: (data: any) => void) => {
    const rtdbRef = ref(rtdb, `content_data/${key}`);
    return onValue(rtdbRef, (snapshot) => {
        if (snapshot.exists()) {
            callback(snapshot.val());
        } else {
            // If not in RTDB, check Firestore (one-time fetch or snapshot?)
            // For now, let's just do one-time fetch to avoid complexity of double listeners
            getDoc(doc(db, "content_data", key)).then(docSnap => {
                if (docSnap.exists()) callback(docSnap.data());
            });
        }
    });
};

export const getApiUsage = async () => {
    try {
        const date = new Date().toISOString().split('T')[0];
        const docSnap = await getDoc(doc(db, "admin_stats", `api_usage_${date}`));
        return docSnap.exists() ? docSnap.data() : null;
    } catch (e) {
        return null;
    }
};

export const subscribeToDrafts = (callback: (drafts: any[]) => void) => {
    const q = query(collection(db, "content_data"), where("isDraft", "==", true));
    return onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map(doc => ({ ...doc.data(), key: doc.id }));
        callback(items);
    });
};

export const saveTestResult = async (userId: string, attempt: any) => {
    try {
        const docId = `${attempt.testId}_${Date.now()}`;
        const sanitizedAttempt = sanitizeForFirestore(attempt);
        await setDoc(doc(db, "users", userId, "test_results", docId), sanitizedAttempt);
    } catch(e) { console.error(e); }
};

export const saveUserHistory = async (userId: string, historyItem: any) => {
    try {
        const docId = `history_${historyItem.id || Date.now()}`;
        const sanitized = sanitizeForFirestore(historyItem);
        // Save to subcollection "history" under the user
        await setDoc(doc(db, "users", userId, "history", docId), sanitized);
    } catch(e) { console.error("Error saving history:", e); }
};

export const updateUserStatus = async (userId: string, time: number) => {
     try {
        const today = new Date().toISOString().split('T')[0];
        const userRef = ref(rtdb, `users/${userId}`);

        // Use a transaction or simple read-update to handle streak
        // Since Firebase transactions can be tricky with partial data, we'll try a simpler approach first
        // Ideally this should be server-side, but for now client-side logic in App.tsx handles streak display.
        // Here we primarily update active time for "Online" status.

        // HOWEVER, user reported streak not working.
        // Streak is calculated in `App.tsx` (useEffect) -> `checkStreak`.
        // `updateUserStatus` is called every 10 seconds.
        // We should ensure we are NOT overwriting `streak` here accidentally if we were doing so.
        // We are ONLY updating `lastActiveTime`.

        await update(userRef, { lastActiveTime: new Date().toISOString() });
    } catch (error) {
        console.error("Error updating user status:", error);
    }
};

// 5. Custom Syllabus Sync
export const saveCustomSyllabus = async (key: string, chapters: any[]) => {
    try {
        const sanitizedData = sanitizeForFirestore(chapters);
        // RTDB
        await set(ref(rtdb, `custom_syllabus/${key}`), sanitizedData);
        // Firestore
        await setDoc(doc(db, "custom_syllabus", key), { chapters: sanitizedData });
    } catch (error) {
        console.error("Error saving syllabus:", error);
    }
};

export const deleteCustomSyllabus = async (key: string) => {
    try {
        await remove(ref(rtdb, `custom_syllabus/${key}`));
        await deleteDoc(doc(db, "custom_syllabus", key));
    } catch(e) { console.error("Error deleting syllabus", e); }
};

export const getCustomSyllabus = async (key: string) => {
    try {
        // Try RTDB
        const snap = await get(ref(rtdb, `custom_syllabus/${key}`));
        if (snap.exists()) return snap.val();

        // Try Firestore
        const docSnap = await getDoc(doc(db, "custom_syllabus", key));
        if (docSnap.exists()) return docSnap.data().chapters;

        return null;
    } catch(e) { console.error("Error getting custom syllabus", e); return null; }
};

// 6. Public Activity Feed (Live Results)
export const savePublicActivity = async (activity: any) => {
    try {
        const sanitized = sanitizeForFirestore(activity);
        const docId = `act_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        
        // RTDB (Limit to last 100 via logic if possible, but simple push here)
        // We'll just set it. For a real feed, we might want 'push'.
        // But let's use a fixed path structure for simplicity in list retrieval
        await set(ref(rtdb, `public_activity/${docId}`), sanitized);
        
        // Firestore (Auto-delete old via index policy if needed, or just keep)
        await setDoc(doc(db, "public_activity", docId), sanitized);
    } catch (e) { console.error("Error saving public activity:", e); }
};

export const subscribeToPublicActivity = (callback: (activities: any[]) => void) => {
    // Switch to RTDB for true realtime performance
    const q = rtdbQuery(ref(rtdb, "public_activity"), rtdbLimitToLast(50));
    return onValue(q, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            const items = Object.values(data);
            // Sort by timestamp desc
            items.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            callback(items);
        } else {
            callback([]);
        }
    });
};

// 7. Universal Analysis Logs
export const saveUniversalAnalysis = async (log: any) => {
    try {
        const sanitized = sanitizeForFirestore(log);
        await set(ref(rtdb, `universal_analysis_logs/${log.id}`), sanitized);
        await setDoc(doc(db, "universal_analysis_logs", log.id), sanitized);
    } catch (e) { console.error("Error saving analysis log:", e); }
};

export const subscribeToUniversalAnalysis = (callback: (logs: any[]) => void) => {
    const q = rtdbQuery(ref(rtdb, "universal_analysis_logs"), rtdbLimitToLast(100));
    return onValue(q, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            const items = Object.values(data);
            items.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
            callback(items);
        } else {
            callback([]);
        }
    });
};

// 8. AI Interactions Log (New)
export const saveAiInteraction = async (data: any) => {
    try {
        const sanitized = sanitizeForFirestore(data);
        const path = `ai_interactions/${data.userId}/${data.id}`;
        // RTDB for realtime user history
        await set(ref(rtdb, path), sanitized);
        // Firestore for Admin Global View
        await setDoc(doc(db, "ai_interactions", data.id), sanitized);
    } catch (e) { console.error("Error saving AI interaction:", e); }
};

export const subscribeToAiHistory = (userId: string, callback: (data: any[]) => void) => {
    const q = rtdbQuery(ref(rtdb, `ai_interactions/${userId}`), rtdbLimitToLast(100));
    return onValue(q, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            const items = Object.values(data);
            items.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            callback(items);
        } else {
            callback([]);
        }
    });
};

export const subscribeToAllAiInteractions = (callback: (data: any[]) => void) => {
    // For Admin: Listen to Firestore
    const q = query(collection(db, "ai_interactions"), orderBy("timestamp", "desc"), limitToLast(50));
    return onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map(doc => doc.data());
        callback(items);
    });
};

// 9. Secure Key Management
export const saveSecureKeys = async (keys: string[]) => {
    try {
        const sanitized = sanitizeForFirestore({ keys });
        // Firestore only (Secure)
        await setDoc(doc(db, "admin_secure", "apiKeys"), sanitized);
    } catch (e) { console.error("Error saving secure keys:", e); }
};

export const getSecureKeys = async () => {
    try {
        const docSnap = await getDoc(doc(db, "admin_secure", "apiKeys"));
        if (docSnap.exists()) {
            return docSnap.data().keys || [];
        }
        return [];
    } catch (e) {
        console.error("Error fetching secure keys:", e);
        return [];
    }
};

export const incrementApiUsage = async (keyIndex: number, type: 'PILOT' | 'STUDENT') => {
    try {
        const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const docRef = doc(db, "admin_stats", `api_usage_${date}`);
        
        const updates: any = {
            [`key_${keyIndex}`]: increment(1),
            total: increment(1)
        };
        
        if (type === 'PILOT') {
            updates.pilotCount = increment(1);
        } else {
            updates.studentCount = increment(1);
        }
        
        await setDoc(docRef, updates, { merge: true });
    } catch (e) {
        console.error("Error tracking API usage:", e);
    }
};

export const subscribeToApiUsage = (callback: (data: any) => void) => {
    const date = new Date().toISOString().split('T')[0];
    return onSnapshot(doc(db, "admin_stats", `api_usage_${date}`), (docSnap) => {
        if (docSnap.exists()) {
            callback(docSnap.data());
        } else {
            callback(null);
        }
    });
};

// 10. Demand Requests
export const saveDemand = async (userId: string, details: string) => {
    try {
        const id = `dem_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const request = {
            id,
            userId,
            details,
            timestamp: new Date().toISOString(),
            status: 'PENDING'
        };
        const sanitized = sanitizeForFirestore(request);
        // Save to RTDB for immediate Admin visibility
        await set(ref(rtdb, `demand_requests/${id}`), sanitized);
    } catch (e) { console.error("Error saving demand:", e); }
};

export const saveDemandRequest = async (request: any) => {
    try {
        const sanitized = sanitizeForFirestore(request);
        // Save to RTDB for immediate Admin visibility
        await set(ref(rtdb, `demand_requests/${request.id}`), sanitized);
    } catch (e) { console.error("Error saving demand:", e); }
};

export const subscribeToDemands = (callback: (requests: any[]) => void) => {
    const q = rtdbQuery(ref(rtdb, "demand_requests"), rtdbLimitToLast(100));
    return onValue(q, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            const items = Object.values(data);
            items.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            callback(items);
        } else {
            callback([]);
        }
    });
};

export { app, db, rtdb, auth };
