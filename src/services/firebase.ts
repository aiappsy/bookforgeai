import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';

// @ts-ignore
import firebaseConfig from '../../firebase-applet-config.json';

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  plan: 'free' | 'pro' | 'agency';
  subscriptionStatus: 'active' | 'canceled' | 'trialing' | 'none';
  monthlyAIWordUsage: number;
  monthlyAIWordLimit: number;
  createdAt: number;
  updatedAt?: number;
}

export const PLAN_LIMITS = {
  free: { name: 'Free Tier', wordLimit: 10000, maxProjects: 2, priceMonthly: 0 },
  pro: { name: 'Pro Publisher', wordLimit: 250000, maxProjects: 9999, priceMonthly: 29 },
  agency: { name: 'Agency Studio', wordLimit: 2000000, maxProjects: 99999, priceMonthly: 79 }
};

export const loginWithGoogle = async (): Promise<User> => {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  await ensureUserProfile(result.user);
  return result.user;
};

export const signUpWithEmail = async (email: string, pass: string, name: string): Promise<User> => {
  const cred = await createUserWithEmailAndPassword(auth, email, pass);
  if (name && cred.user) {
    await updateProfile(cred.user, { displayName: name });
  }
  await ensureUserProfile(cred.user, name);
  return cred.user;
};

export const signInWithEmail = async (email: string, pass: string): Promise<User> => {
  const cred = await signInWithEmailAndPassword(auth, email, pass);
  await ensureUserProfile(cred.user);
  return cred.user;
};

export const resetPassword = async (email: string) => {
  await sendPasswordResetEmail(auth, email);
};

export const logoutUser = async () => {
  await signOut(auth);
};

export const ensureUserProfile = async (user: User, customName?: string): Promise<UserProfile> => {
  const userRef = doc(db, 'users', user.uid, 'settings', 'config');
  try {
    const snap = await getDoc(userRef);
    if (snap.exists() && snap.data()?.profile) {
      return snap.data().profile as UserProfile;
    }
  } catch (err) {
    console.warn("Could not fetch user profile from Firestore:", err);
  }

  const defaultProfile: UserProfile = {
    uid: user.uid,
    email: user.email || '',
    displayName: customName || user.displayName || user.email?.split('@')[0] || 'Author',
    photoURL: user.photoURL || '',
    plan: 'free',
    subscriptionStatus: 'active',
    monthlyAIWordUsage: 0,
    monthlyAIWordLimit: PLAN_LIMITS.free.wordLimit,
    createdAt: Date.now()
  };

  try {
    await setDoc(userRef, { profile: defaultProfile, prompts: {} }, { merge: true });
  } catch (err) {
    console.warn("Could not save initial user profile to Firestore:", err);
  }

  return defaultProfile;
};

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  try {
    const userRef = doc(db, 'users', uid, 'settings', 'config');
    const snap = await getDoc(userRef);
    if (snap.exists() && snap.data()?.profile) {
      return snap.data().profile as UserProfile;
    }
  } catch (err) {
    console.warn("Error getting user profile:", err);
  }
  return null;
};

export const updateUserPlan = async (uid: string, plan: 'free' | 'pro' | 'agency'): Promise<UserProfile> => {
  const wordLimit = PLAN_LIMITS[plan].wordLimit;
  const userRef = doc(db, 'users', uid, 'settings', 'config');
  
  const snap = await getDoc(userRef);
  const existingProfile = snap.exists() && snap.data()?.profile ? snap.data().profile : {};

  const updatedProfile: UserProfile = {
    ...existingProfile,
    uid,
    plan,
    subscriptionStatus: 'active',
    monthlyAIWordLimit: wordLimit,
    updatedAt: Date.now()
  };

  await setDoc(userRef, { profile: updatedProfile }, { merge: true });
  return updatedProfile;
};

export const trackAIWordUsage = async (uid: string, wordCount: number) => {
  if (!uid || wordCount <= 0) return;
  try {
    const userRef = doc(db, 'users', uid, 'settings', 'config');
    await updateDoc(userRef, {
      'profile.monthlyAIWordUsage': increment(wordCount)
    });
  } catch (err) {
    console.warn("Failed to increment AI word usage:", err);
  }
};
