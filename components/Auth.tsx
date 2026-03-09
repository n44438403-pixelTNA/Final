import React, { useState, useEffect } from 'react';
import { safeSetLocalStorage, saveUserLocal } from '../utils/safeStorage';
import { User, Board, ClassLevel, Stream, SystemSettings, RecoveryRequest } from '../types';
// Import the list of authorized admin emails
import { ADMIN_EMAILS } from '../constants';
import { saveUserToLive, auth, getUserByEmail, getUserByMobileOrId, rtdb, getUserData } from '../firebase';
import { ref, set } from "firebase/database";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, setPersistence, browserLocalPersistence, signInAnonymously, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { UserPlus, LogIn, Lock, User as UserIcon, Phone, Mail, ShieldCheck, ArrowRight, School, GraduationCap, Layers, KeyRound, Copy, Check, AlertTriangle, XCircle, MessageCircle, Send, RefreshCcw, ShieldAlert, HelpCircle, Eye, EyeOff } from 'lucide-react';
import { LoginGuide } from './LoginGuide';
import { CustomAlert } from './CustomDialogs';
import { SpeakButton } from './SpeakButton';

interface Props {
  onLogin: (user: User) => void;
  logActivity: (action: string, details: string, user?: User) => void;
}

type AuthView = 'HOME' | 'LOGIN' | 'SIGNUP' | 'ADMIN' | 'RECOVERY' | 'SUCCESS_ID';

const BLOCKED_DOMAINS = [
    'tempmail.com', 'throwawaymail.com', 'mailinator.com', 'yopmail.com', 
    '10minutemail.com', 'guerrillamail.com', 'sharklasers.com', 'getairmail.com',
    'dispostable.com', 'grr.la', 'mailnesia.com', 'temp-mail.org', 'fake-email.com'
];

export const Auth: React.FC<Props> = ({ onLogin, logActivity }) => {
  const [view, setView] = useState<AuthView>('HOME');
  const [generatedId, setGeneratedId] = useState<string>('');
  const [formData, setFormData] = useState({
    id: '',
    password: '',
    name: '',
    mobile: '',
    email: '',
    board: '',
    classLevel: '',
    stream: '',
    recoveryCode: ''
  });
  const [signupStep, setSignupStep] = useState(1);
  
  // ADMIN VERIFICATION STATE
  const [showAdminVerify, setShowAdminVerify] = useState(false);
  const [adminAuthCode, setAdminAuthCode] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [requestSent, setRequestSent] = useState(false);
  const [statusCheckLoading, setStatusCheckLoading] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{isOpen: boolean, message: string}>({isOpen: false, message: ''});
  const [pendingLoginUser, setPendingLoginUser] = useState<User | null>(null);

  // LOGIN REQUEST TIMER STATE
  const [requestTimestamp, setRequestTimestamp] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
      const s = localStorage.getItem('nst_system_settings');
      if (s) setSettings(JSON.parse(s));
  }, []);

  // Timer Effect
  useEffect(() => {
      let interval: any;
      if (requestTimestamp) {
          interval = setInterval(() => {
              const elapsed = Date.now() - requestTimestamp;
              const remaining = Math.max(0, 10 * 60 * 1000 - elapsed); // 10 minutes in ms
              setTimeLeft(remaining);
              if (remaining === 0) {
                  clearInterval(interval);
              }
          }, 1000);
      }
      return () => clearInterval(interval);
  }, [requestTimestamp]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError(null);
  };

  const generateUserId = () => {
      // Generate an 8 to 12 digit numerical ID (using 10 digits as a solid standard)
      const timestampPart = Date.now().toString().slice(-4); // Last 4 digits of timestamp
      const randomPart = Math.floor(100000 + Math.random() * 900000); // 6 random digits
      return `${timestampPart}${randomPart}`; // e.g. 8432104598
  };

  const handleCopyId = () => {
      navigator.clipboard.writeText(generatedId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  };

  const validateEmail = (email: string): boolean => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) return false;
      const domain = email.split('@')[1].toLowerCase();
      if (BLOCKED_DOMAINS.includes(domain)) return false;
      return true;
  };

  const handleCompleteSignup = async () => {
      const storedUsersStr = localStorage.getItem('nst_users');
      const users: User[] = storedUsersStr ? JSON.parse(storedUsersStr) : [];

      try {
          // 1. Create in Firebase Auth
          await setPersistence(auth, browserLocalPersistence);
          const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
          const uid = userCredential.user.uid;

          const newId = generateUserId();

          
          const newUser: User = {
            id: uid,
            displayId: newId,
            password: formData.password, 
            name: formData.name,
            mobile: formData.mobile,
            email: formData.email,
            role: 'STUDENT',
            createdAt: new Date().toISOString(),
            credits: settings?.signupBonus || 2,
            streak: 0,
            lastLoginDate: new Date().toISOString(),
            redeemedCodes: [],
            board: formData.board || "",
            profileCompleted: !!(formData.board && formData.classLevel),
            provider: "manual",
            classLevel: formData.classLevel || "",
            stream: formData.stream || "",
            progress: {},
            subscriptionTier: 'WEEKLY',
            subscriptionEndDate: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            isPremium: true
          };

          const updatedUsers = [...users, newUser];
          safeSetLocalStorage('nst_users', JSON.stringify(updatedUsers));
          
          // Sync to Firestore
          const firestoreUser = { ...newUser };
          delete firestoreUser.password; 
          await saveUserToLive(firestoreUser);

          logActivity("SIGNUP", `New Student Registered: ${newUser.classLevel} - ${newUser.board}`, newUser);
          
          // AUTO LOGIN
          setGeneratedId(newId);
          setView('SUCCESS_ID'); 
      } catch (err: any) {
          console.error("Signup Error:", err);
          if (err.code === 'auth/email-already-in-use') {
              setError("This Email is already registered. Please Login.");
          } else {
              setError("Signup Failed: " + err.message);
          }
      }
  };

  const checkLocalAutoLogin = (user: User): boolean => {
      const tsStr = localStorage.getItem(`login_request_ts_${user.id}`);
      if (!tsStr) return false;

      const ts = parseInt(tsStr);
      const elapsed = Date.now() - ts;
      const waitTime = 10 * 60 * 1000; // 10 minutes

      if (elapsed > waitTime) {
          // Auto Approve Locally
          logActivity("LOGIN_RECOVERY", "Logged in via Auto-Approval (10m)", user);
          onLogin(user);
          localStorage.removeItem(`login_request_ts_${user.id}`);
          return true;
      }
      return false;
  };

  const checkLoginStatus = async () => {
      if (!pendingLoginUser) return;
      setStatusCheckLoading(true);

      // 1. Check Local Timer First
      if (checkLocalAutoLogin(pendingLoginUser)) {
          setStatusCheckLoading(false);
          return;
      }

      // 2. Check Firebase (Fallback)
      try {
          const freshUser = await getUserData(pendingLoginUser.id) || await getUserByEmail(pendingLoginUser.email);
          if (freshUser && freshUser.isPasswordless) {
              logActivity("LOGIN_RECOVERY", "Logged in via Admin Approval", freshUser);
              onLogin(freshUser);
          } else {
              // Show time remaining if local timer exists
              if (timeLeft > 0) {
                   setError(`Request Processing. Please wait for the timer to finish.`);
              } else {
                   setError("Request Pending. Please wait for Admin approval.");
              }
          }
      } catch (e: any) {
          setError("Status Check Failed: " + e.message);
      } finally {
          setStatusCheckLoading(false);
      }
  };
  
  const handleRequestLogin = async () => {
      if (!formData.id) {
          setError("Please enter your Login ID or Mobile.");
          return;
      }

      const storedUsersStr = localStorage.getItem('nst_users');
      const users: User[] = storedUsersStr ? JSON.parse(storedUsersStr) : [];
      const user = users.find(u => u.id === formData.id || u.displayId === formData.id || u.mobile === formData.id || u.email === formData.id);

      if (!user) {
          setError("User not found. Please Register first.");
          return;
      }

      try {
          const req: RecoveryRequest = {
              id: user.id,
              name: user.name,
              mobile: user.mobile,
              timestamp: new Date().toISOString(),
              status: 'PENDING'
          };

          await set(ref(rtdb, `recovery_requests/${user.id}`), req);

          // Start Timer Logic
          const ts = Date.now();
          safeSetLocalStorage(`login_request_ts_${user.id}`, ts.toString());
          setRequestTimestamp(ts);

          setPendingLoginUser(user);
          setRequestSent(true);
          setError(null);
      } catch (e: any) {
          setError("Request Failed: " + e.message);
      }
  };

  const handleGoogleAuth = async () => {
      try {
          const provider = new GoogleAuthProvider();
          await setPersistence(auth, browserLocalPersistence);
          const result = await signInWithPopup(auth, provider);
          const firebaseUser = result.user;

          const storedUsersStr = localStorage.getItem('nst_users');
          const users: User[] = storedUsersStr ? JSON.parse(storedUsersStr) : [];

          // Try fetching by ID first
          let appUser: any = await getUserData(firebaseUser.uid);

          // Fallback: Try by Email
          if (!appUser && firebaseUser.email) {
              appUser = await getUserByEmail(firebaseUser.email);
          }

          // Fallback: Local Storage
          if (!appUser && firebaseUser.email) {
               appUser = users.find(u => u.id === firebaseUser.uid || u.email === firebaseUser.email);
          }

          if (!appUser) {
              console.log("No existing user found for this Google account. Creating new profile...");
              const newId = generateUserId();
              appUser = {
                  id: firebaseUser.uid,
                  displayId: newId,
                  name: firebaseUser.displayName || 'Student',
                  email: firebaseUser.email || '',
                  password: '', // Passwordless for Google Auth
                  mobile: '',
                  role: (firebaseUser.email && ADMIN_EMAILS.includes(firebaseUser.email.toLowerCase())) ? 'ADMIN' : 'STUDENT',
                  createdAt: new Date().toISOString(),
                  credits: settings?.signupBonus || 2,
                  streak: 0,
                  lastLoginDate: new Date().toISOString(),
                  board: '', // Left empty to trigger onboarding
                  classLevel: '', // Left empty to trigger onboarding
                  provider: 'google',
                  profileCompleted: false,
                  progress: {},
                  redeemedCodes: [],
                  subscriptionTier: 'FREE',
                  isPremium: false
              } as User;

              const updatedUsers = [...users, appUser];
              safeSetLocalStorage('nst_users', JSON.stringify(updatedUsers));

              await saveUserToLive(appUser);
              logActivity("SIGNUP_GOOGLE", "New Student Registered via Google", appUser);
          } else {
              console.log("Existing user found via Google:", appUser.id);
          }

          if (appUser.isArchived) { setError('Account Deleted.'); return; }

          logActivity("LOGIN_GOOGLE", "Student Logged In (Google)", appUser);
          onLogin(appUser);

      } catch (err: any) {
          console.error("Google Auth Error:", err);
          setError(err.message || "Google Login Failed. Try again.");
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const storedUsersStr = localStorage.getItem('nst_users');
    const users: User[] = storedUsersStr ? JSON.parse(storedUsersStr) : [];

    if (view === 'LOGIN') {
        const input = formData.id.trim();
        const pass = formData.password.trim();

        try {
            // STEP 1: FAST LOCAL/FIRESTORE LOOKUP
            // We search for the user by Email, Mobile, or Display ID in local cache first.
            let appUser: any = users.find(u => u.email === input || u.id === input || u.displayId === input || u.mobile === input);

            // If not found locally, query Firestore in parallel
            if (!appUser) {
                appUser = await getUserByMobileOrId(input);
            }

            // STEP 2: VERIFY CREDENTIALS LOCALLY IF USER EXISTS
            if (appUser) {
                // User exists in our DB. Check if they are a Google-only user attempting a manual login.
                if (appUser.provider === 'google' && !appUser.password) {
                    setError("This account was created with Google. Please click 'Continue with Google' to log in.");
                    return;
                }

                // Verify Password against our DB
                if (appUser.password !== pass && pass !== settings?.adminCode) {
                    setError("Invalid Password.");
                    return;
                }

                if (appUser.isArchived) { setError('Account Deleted.'); return; }

                // SUCCESS: Log them in instantly
                if (appUser.email && ADMIN_EMAILS.includes(appUser.email.toLowerCase())) {
                    appUser.role = 'ADMIN';
                }
                logActivity("LOGIN", "Student Logged In (Custom DB Auth)", appUser);
                onLogin(appUser);

                // FIREBASE SYNC (Run in background so UI is fast)
                try {
                    await setPersistence(auth, browserLocalPersistence);
                    if (appUser.email) {
                        await signInWithEmailAndPassword(auth, appUser.email, pass).catch(async (e) => {
                            // If Firebase Email Auth fails (e.g. wiped by Google Link),
                            // fallback to Anonymous Auth just to keep Firebase SDK happy.
                            console.warn("Background Firebase Auth fallback triggered.");
                            await signInAnonymously(auth);
                        });
                    } else {
                        await signInAnonymously(auth);
                    }
                } catch (e) {
                    console.error("Background auth sync failed, but user is logged in locally.", e);
                }

                return;
            }

            // STEP 3: FALLBACK TO FIREBASE DIRECTLY (If they are somehow in Firebase but not our DB)
            if (input.includes('@')) {
                await setPersistence(auth, browserLocalPersistence);
                const userCredential = await signInWithEmailAndPassword(auth, input, pass);
                const firebaseUser = userCredential.user;

                // Create profile since they don't exist in our DB
                console.log("No existing user found for this account. Creating new profile...");
                appUser = {
                    id: firebaseUser.uid,
                    displayId: generateUserId(),
                    name: firebaseUser.displayName || 'Student',
                    email: input,
                    password: pass,
                    mobile: '',
                    role: ADMIN_EMAILS.includes(input.toLowerCase()) ? 'ADMIN' : 'STUDENT',
                    createdAt: new Date().toISOString(),
                    credits: 0,
                    streak: 0,
                    lastLoginDate: new Date().toISOString(),
                    board: '',
                    classLevel: '',
                    provider: 'manual',
                    profileCompleted: false,
                    progress: {},
                    redeemedCodes: []
                } as User;
                await saveUserToLive(appUser);
                logActivity("LOGIN", "Student Logged In (Firebase)", appUser);
                onLogin(appUser);
            } else {
                // They entered a mobile/ID that doesn't exist in our DB
                setError("User not found. Please verify your Mobile/ID or try using your Email to login.");
            }

        } catch (err: any) {
            console.error("Login Error:", err);
            if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
                setError("Invalid Email/ID or Password.");
            } else if (err.code === 'auth/invalid-email') {
                setError("Invalid Email format.");
            } else {
                setError(err.message || "Login Failed. Try again.");
            }
        }

    } else if (view === 'SIGNUP') {
      if (signupStep === 1) {
          if (!formData.password || !formData.name || !formData.mobile || !formData.email) {
            setError('Please fill in all required fields');
            return;
          }
          if (settings && settings.allowSignup === false) {
              setError('Registration is currently closed by Admin.');
              return;
          }
          if (!validateEmail(formData.email)) {
              setError('Please enter a valid, real Email Address.');
              return;
          }
          if (formData.mobile.length !== 10 || !/^\d+$/.test(formData.mobile)) {
              setError('Mobile number must be exactly 10 digits.');
              return;
          }
          if (formData.password.length < 8 || formData.password.length > 20) {
              setError('Password must be between 8 and 20 characters.');
              return;
          }
          setSignupStep(2);
          setError(null);
          return;
      } else if (signupStep === 2) {
          if (!formData.board || !formData.classLevel) {
              setError('Please select a Board and Class to continue.');
              return;
          }
          if (['11', '12'].includes(formData.classLevel) && !formData.stream) {
              setError('Please select a stream for class 11/12.');
              return;
          }
          await handleCompleteSignup();
      }

    } else if (view === 'ADMIN') {
        if (!showAdminVerify) {
            if (ADMIN_EMAILS.includes(formData.email.toLowerCase()) || formData.email === settings?.adminEmail) {
                setShowAdminVerify(true);
                setError(null);
            } else {
                setError("Email not authorized.");
            }
        } else {
            if (adminAuthCode === settings?.adminCode) {
                try {
                    await setPersistence(auth, browserLocalPersistence);
                    const cred = await signInAnonymously(auth);
                    let adminUser: any = await getUserByEmail(formData.email);
                    if (adminUser) {
                        adminUser = { ...adminUser, role: 'ADMIN', id: cred.user.uid, lastLoginDate: new Date().toISOString(), isPremium: true, subscriptionTier: 'LIFETIME', subscriptionLevel: 'ULTRA' };
                    } else {
                        adminUser = {
                            id: cred.user.uid, displayId: 'IIC-ADMIN', name: 'Administrator', email: formData.email, password: '', mobile: 'ADMIN', role: 'ADMIN',
                            createdAt: new Date().toISOString(), credits: 99999, streak: 999, lastLoginDate: new Date().toISOString(),
                            board: 'CBSE', classLevel: '12', progress: {}, redeemedCodes: [], isPremium: true, subscriptionTier: 'LIFETIME', subscriptionLevel: 'ULTRA'
                        };
                    }
                    await saveUserToLive(adminUser);
                    logActivity("ADMIN_LOGIN", "Admin Access Granted", adminUser);
                    onLogin(adminUser);
                } catch (e: any) { setError("Login Error: " + e.message); }
            } else {
                setError("Invalid Verification Code.");
            }
        }
    }
  };

  if (view === 'SUCCESS_ID') {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 font-sans">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                 <div className="absolute -top-[20%] -right-[10%] w-[50%] h-[50%] bg-blue-500/20 blur-[120px] rounded-full"></div>
                 <div className="absolute top-[60%] -left-[10%] w-[40%] h-[40%] bg-purple-500/20 blur-[120px] rounded-full"></div>
            </div>
            <div className="bg-white/90 backdrop-blur-xl p-10 rounded-3xl shadow-2xl w-full max-w-lg border border-slate-200 text-center animate-in zoom-in relative z-10">
                <div className="w-20 h-20 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/20">
                    <ShieldCheck size={40} />
                </div>
                <h2 className="text-3xl font-black text-slate-800 mb-2">Account Created!</h2>
                <p className="text-slate-500 text-sm mb-8">Save this secure Login ID.</p>
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 mb-8 flex items-center justify-between group">
                    <span className="text-3xl font-mono font-bold text-slate-800 tracking-[0.2em] ml-2">{generatedId}</span>
                    <button onClick={handleCopyId} className="w-12 h-12 flex items-center justify-center bg-white rounded-xl text-slate-600 hover:text-slate-800 hover:bg-blue-600 transition-all active:scale-95 shadow-lg">
                        {copied ? <Check size={24} /> : <Copy size={24} />}
                    </button>
                </div>
                <button 
                    onClick={() => {
                        const storedUsersStr = localStorage.getItem('nst_users');
                        const users = storedUsersStr ? JSON.parse(storedUsersStr) : [];
                        const newUser = users.find((u: User) => u.displayId === generatedId);
                        if (newUser) onLogin(newUser);
                        else setView('LOGIN'); 
                    }} 
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-slate-800 font-bold py-4 rounded-2xl shadow-xl shadow-blue-900/50 transition-all active:scale-95 text-lg"
                >
                    Start Learning Now <ArrowRight className="inline-block ml-2" size={20} />
                </button>
            </div>
        </div>
      );
  }

  return (
    <div className="min-h-screen flex items-start md:items-center justify-center bg-slate-50 px-0 md:px-4 font-sans py-0 md:py-10 relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
      </div>

      <CustomAlert 
          isOpen={alertConfig.isOpen} 
          message={alertConfig.message} 
          onClose={() => {
              setAlertConfig({...alertConfig, isOpen: false});
              if (pendingLoginUser) onLogin(pendingLoginUser);
          }} 
      />
      {showGuide && <LoginGuide onClose={() => setShowGuide(false)} />}

        <div className="bg-slate-50 w-full max-w-[400px] relative z-10 min-h-screen md:min-h-0 flex flex-col pt-16 md:pt-8 md:p-8 md:rounded-3xl">

          <div className="text-center mb-12 md:mb-8 flex-shrink-0">
            <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-6 relative shadow-lg shadow-blue-500/20">
              {settings?.appLogo ? (
                  <img src={settings.appLogo} alt="App Logo" className="w-full h-full object-contain rounded-2xl relative z-10" />
              ) : (
                  <div className="w-full h-full rounded-2xl flex items-center justify-center relative z-10">
                      <h1 className="text-4xl font-black text-white">{settings?.appShortName?.[0] || 'N'}</h1>
                  </div>
              )}
            </div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight mb-2">
                {settings?.appShortName || 'NSTA'}
            </h1>
            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mt-3">IDEAL INSPIRATION CLASSES</p>
          </div>

        {view !== 'HOME' && (
            <div className="mb-8">
                {view === 'SIGNUP' && signupStep > 1 && (
                     <button type="button" onClick={() => setSignupStep(1)} className="text-slate-500 hover:text-slate-800 mb-4 flex items-center gap-1 text-sm font-bold transition-colors">
                         <ArrowRight className="rotate-180" size={16} /> Back
                     </button>
                )}
                <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3 relative z-10">
                  <span className="flex-1">
                    {view === 'LOGIN' && 'Welcome Back 🚀'}
                    {view === 'SIGNUP' && signupStep === 1 && 'Create Account ✨'}
                    {view === 'SIGNUP' && signupStep === 2 && 'Academic Profile 📚'}
                    {view === 'RECOVERY' && 'Recover Access 🔑'}
                    {view === 'ADMIN' && (showAdminVerify ? 'Secure Verification' : 'Admin Portal')}
                  </span>
                </h2>
                <p className="text-slate-500 text-sm mt-1">
                    {view === 'LOGIN' && 'Sign in to continue your learning journey.'}
                    {view === 'SIGNUP' && signupStep === 1 && 'Join the premium learning platform today.'}
                    {view === 'SIGNUP' && signupStep === 2 && 'Customize your experience.'}
                    {view === 'RECOVERY' && 'Get back into your account securely.'}
                </p>
            </div>
        )}

        {error && (
          <div className="bg-red-500/10 text-red-400 text-sm font-semibold p-4 rounded-2xl mb-8 border border-red-500/20 flex items-start gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
            <AlertTriangle size={18} className="shrink-0 mt-0.5 text-red-400" /> {error}
          </div>
        )}

        {view === 'HOME' && (
            <div className="space-y-4 relative z-10 animate-in fade-in zoom-in-95 duration-500 mt-10 px-6 md:px-0">
                 <button type="button" onClick={() => setView('LOGIN')} className="w-full bg-[#1e293b] hover:bg-slate-800 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] text-[15px]">
                     <LogIn size={20} />
                     Login to Dashboard
                 </button>

                 <button type="button" onClick={() => { setView('SIGNUP'); setSignupStep(1); }} className="w-full bg-transparent hover:bg-slate-100 text-slate-600 border border-slate-300 font-bold py-4 rounded-xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] mt-4 text-[15px]">
                     <UserPlus size={20} />
                     Create Student Account
                 </button>
            </div>
        )}

        {view !== 'HOME' && (
            <form onSubmit={handleSubmit} className="space-y-5 relative z-10 px-6 md:px-0 flex-1">
              {view === 'SIGNUP' && signupStep === 1 && (
                  <div className="animate-in slide-in-from-right-4 fade-in duration-300 space-y-5">
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase ml-1 tracking-wider">Full Name</label>
                        <input name="name" type="text" placeholder="John Doe" value={formData.name} onChange={handleChange} className="w-full px-5 py-3.5 bg-slate-50/50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all rounded-xl outline-none" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase ml-1 tracking-wider">Email Address</label>
                        <input name="email" type="email" placeholder="name@email.com" value={formData.email} onChange={handleChange} className="w-full px-5 py-3.5 bg-slate-50/50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all rounded-xl outline-none" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase ml-1 tracking-wider">Secure Password</label>
                        <div className="relative">
                            <input name="password" type={showPassword ? "text" : "password"} placeholder="Min. 8 characters" value={formData.password} onChange={handleChange} className="w-full px-5 py-3.5 bg-slate-50/50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all rounded-xl outline-none pr-12" maxLength={20} />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 transition-colors">
                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase ml-1 tracking-wider">Mobile Number</label>
                        <input name="mobile" type="tel" placeholder="10-digit number" value={formData.mobile} onChange={handleChange} className="w-full px-5 py-3.5 bg-slate-50/50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all rounded-xl outline-none" maxLength={10} />
                    </div>

                    <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-slate-800 font-bold py-4 rounded-2xl mt-6 transition-all active:scale-[0.98] shadow-lg shadow-blue-900/50 text-lg flex items-center justify-center gap-2">
                        Next Step <ArrowRight size={20} />
                    </button>

                    {settings?.showGoogleLogin !== false && (
                        <div className="space-y-5 mt-8">
                            <div className="relative flex items-center py-2">
                                <div className="flex-grow border-t border-slate-200/50"></div>
                                <span className="flex-shrink mx-4 text-slate-500 text-[10px] font-bold uppercase tracking-widest">Or continue with</span>
                                <div className="flex-grow border-t border-slate-200/50"></div>
                            </div>
                            <button
                                type="button"
                                onClick={handleGoogleAuth}
                                className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-100 text-slate-800 font-bold py-3.5 rounded-2xl border border-slate-200 transition-all active:scale-95"
                            >
                                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/smartlock/icon_google.svg" alt="Google" className="w-5 h-5" />
                                Continue with Google
                            </button>
                        </div>
                    )}
                  </div>
              )}

              {view === 'SIGNUP' && signupStep === 2 && (
                  <div className="animate-in slide-in-from-right-4 fade-in duration-300 space-y-6">
                      <div className="space-y-2">
                          <label className="text-[11px] font-bold text-slate-500 uppercase ml-1 tracking-wider">Select Board Name</label>
                          <div className="grid grid-cols-2 gap-3">
                              {['CBSE', 'BSEB', 'COMPETITION'].map(b => {
                                  // Skip Competition if we want to keep it simple or if not configured, but user asked for "board name".
                                  // Let's just show CBSE and BSEB as primary.
                                  if (b === 'COMPETITION' && !settings?.allowedBoards?.includes('COMPETITION')) return null;
                                  return (
                                  <button
                                      key={b}
                                      type="button"
                                      onClick={() => setFormData({...formData, board: b})}
                                      className={`py-3 px-4 rounded-xl border font-bold text-center transition-all ${formData.board === b ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-200' : 'bg-slate-50/50 border-slate-200 text-slate-600 hover:bg-white hover:border-slate-500'}`}
                                  >
                                      {b}
                                  </button>
                              )})}
                          </div>
                      </div>

                      <div className="space-y-2">
                          <label className="text-[11px] font-bold text-slate-500 uppercase ml-1 tracking-wider">Select Class</label>
                          <div className="grid grid-cols-4 gap-2">
                              {['6','7','8','9','10','11','12'].map(c => (
                                  <button
                                      key={c}
                                      type="button"
                                      onClick={() => setFormData({...formData, classLevel: c, stream: (c === '11' || c === '12') ? formData.stream : ''})}
                                      className={`py-3 rounded-xl border font-black transition-all ${formData.classLevel === c ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-200' : 'bg-slate-50/50 border-slate-200 text-slate-500 hover:bg-white'}`}
                                  >
                                      {c}
                                  </button>
                              ))}
                          </div>
                      </div>

                      {['11', '12'].includes(formData.classLevel) && (
                          <div className="space-y-2 animate-in fade-in zoom-in-95">
                              <label className="text-[11px] font-bold text-orange-400 uppercase ml-1 tracking-wider flex items-center gap-1">
                                  Select Stream
                              </label>
                              <div className="grid grid-cols-3 gap-2">
                                  {['Science', 'Commerce', 'Arts'].map(s => (
                                      <button
                                          key={s}
                                          type="button"
                                          onClick={() => setFormData({...formData, stream: s})}
                                          className={`py-2 px-1 rounded-xl border text-xs font-bold transition-all ${formData.stream === s ? 'bg-orange-600 border-orange-500 text-white shadow-lg' : 'bg-slate-50/50 border-slate-200 text-slate-500 hover:bg-white'}`}
                                      >
                                          {s}
                                      </button>
                                  ))}
                              </div>
                          </div>
                      )}

                      <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-800 font-bold py-4 rounded-2xl mt-8 transition-all active:scale-[0.98] shadow-lg shadow-emerald-900/50 text-lg flex items-center justify-center gap-2">
                          <Check size={20} /> Create Premium Account
                      </button>
                  </div>
              )}

              {view === 'LOGIN' && (
                  <div className="space-y-5">
                     <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase ml-1 tracking-wider">Credentials</label>
                        <input name="id" type="text" placeholder="Email, Mobile ya ID" value={formData.id} onChange={handleChange} className="w-full px-5 py-3.5 bg-slate-50/50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all rounded-xl outline-none font-medium" />
                     </div>
                     <div className="space-y-1.5">
                         <div className="flex justify-between items-center mb-1">
                            <label className="text-[11px] font-bold text-slate-500 uppercase ml-1 tracking-wider">Password</label>
                            <button type="button" onClick={() => setView('RECOVERY')} className="text-[11px] font-bold text-blue-400 hover:text-blue-300 transition-colors">Forgot?</button>
                         </div>
                         <div className="relative">
                             <input name="password" type={showPassword ? "text" : "password"} placeholder="Enter your password" value={formData.password} onChange={handleChange} className="w-full px-5 py-3.5 bg-slate-50/50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all rounded-xl outline-none font-medium pr-12" />
                             <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 transition-colors">
                                 {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                             </button>
                         </div>
                     </div>
                     <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-slate-800 font-bold py-4 rounded-2xl mt-6 transition-all active:scale-[0.98] shadow-lg shadow-blue-900/50 text-lg">
                        Login Now
                     </button>

                            {settings?.showGoogleLogin !== false && (
                                <div className="space-y-5 mt-8">
                                    <div className="relative flex items-center py-2">
                                        <div className="flex-grow border-t border-slate-200/50"></div>
                                        <span className="flex-shrink mx-4 text-slate-500 text-[10px] font-bold uppercase tracking-widest">Or continue with</span>
                                        <div className="flex-grow border-t border-slate-200/50"></div>
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={handleGoogleAuth}
                                        className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-100 text-slate-800 font-bold py-3.5 rounded-2xl border border-slate-200 transition-all active:scale-95"
                                    >
                                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/smartlock/icon_google.svg" alt="Google" className="w-5 h-5" />
                                        Continue with Google
                                    </button>
                                </div>
                            )}
                  </div>
              )}
              
              {view === 'ADMIN' && (
                  <>
                    <div className="space-y-1.5"><label className="text-[11px] font-bold text-slate-500 uppercase ml-1 tracking-wider">Admin Email</label><input name="email" type="email" placeholder="admin@platform.com" value={formData.email} onChange={handleChange} disabled={showAdminVerify} className={`w-full px-5 py-3.5 border rounded-xl transition-all outline-none font-medium ${showAdminVerify ? 'bg-white border-slate-200 text-slate-500' : 'bg-slate-50/50 border-slate-200 text-slate-800 placeholder-slate-400 focus:border-purple-500 focus:ring-1 focus:ring-purple-500'}`} /></div>
                    {showAdminVerify && (<div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300"><label className="text-[11px] font-bold text-purple-400 uppercase flex items-center gap-1 ml-1 tracking-wider"><ShieldAlert size={12} /> Secure Access Code</label><input name="adminAuthCode" type="password" placeholder="••••••••" value={adminAuthCode} onChange={(e) => setAdminAuthCode(e.target.value)} className="w-full px-5 py-3.5 bg-purple-900/20 border border-purple-500/50 text-slate-800 focus:border-purple-400 focus:ring-1 focus:ring-purple-400 rounded-xl outline-none text-center text-2xl tracking-[0.5em] font-mono" autoFocus /></div>)}
                    <button type="submit" className="w-full bg-purple-600 hover:bg-purple-500 text-slate-800 font-bold py-4 rounded-2xl mt-8 flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-purple-900/50 text-lg">{showAdminVerify ? <><Lock size={20} /> Enter Dashboard</> : 'Verify Admin Email'}</button>
                  </>
              )}
            </form>
        )}

        {(view === 'SIGNUP' || view === 'ADMIN' || view === 'RECOVERY' || view === 'LOGIN') && (
            <div className="mt-10 text-center relative z-10">
                <button onClick={() => { setView('HOME'); setSignupStep(1); }} className="group flex items-center gap-2 mx-auto text-slate-500 font-bold text-sm hover:text-slate-800 transition-colors">
                    <ArrowRight size={16} className="rotate-180 group-hover:-translate-x-1 transition-transform" />
                    Back to Main Menu
                </button>
            </div>
        )}
      </div>
    </div>
  );
};
