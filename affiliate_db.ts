import { db, auth } from './firebase_init';
import { 
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, writeBatch
} from 'firebase/firestore';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export interface UserInfo {
  referralCode: string;
  totalReferredUsers: number;
  earnedRewards: number; // in Points or Coins
  emailAlertsEnabled?: boolean;
  alertEmail?: string;
}

export interface ReferredUser {
  id?: string | number;
  username: string;
  joinDate: string;
  reward: number;
  status: 'Active' | 'Pending' | 'Completed';
  milestone?: string;
  locationName?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
}

function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'MAP3D-';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function getUserInfo(): Promise<UserInfo> {
  if (!auth.currentUser) {
    return { referralCode: 'GUEST', totalReferredUsers: 0, earnedRewards: 0, emailAlertsEnabled: false, alertEmail: '' };
  }
  const path = `users/${auth.currentUser.uid}`;
  try {
    const docRef = doc(db, 'users', auth.currentUser.uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as UserInfo;
    } else {
      const code = generateReferralCode();
      const initialInfo: UserInfo = { referralCode: code, totalReferredUsers: 0, earnedRewards: 0, emailAlertsEnabled: true, alertEmail: auth.currentUser.email || '' };
      await setDoc(docRef, initialInfo);
      return initialInfo;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    throw error;
  }
}

export async function updateUserInfo(info: UserInfo): Promise<void> {
  if (!auth.currentUser) return;
  const path = `users/${auth.currentUser.uid}`;
  try {
    const docRef = doc(db, 'users', auth.currentUser.uid);
    await setDoc(docRef, info);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function getReferredUsers(): Promise<ReferredUser[]> {
  if (!auth.currentUser) return [];
  const path = `users/${auth.currentUser.uid}/referred_users`;
  try {
    const colRef = collection(db, 'users', auth.currentUser.uid, 'referred_users');
    const snapshot = await getDocs(colRef);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ReferredUser));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    throw error;
  }
}

export async function addReferredUser(user: ReferredUser): Promise<{ userInfo: UserInfo; referredUsers: ReferredUser[] }> {
  if (!auth.currentUser) throw new Error("Must be logged in");
  
  const userInfo = await getUserInfo();
  
  const path = `users/${auth.currentUser.uid}/referred_users`;
  
  try {
    const batch = writeBatch(db);
    
    // Add referred user
    const colRef = collection(db, 'users', auth.currentUser.uid, 'referred_users');
    const newDocRef = doc(colRef);
    const { id, ...dataToSave } = user;
    batch.set(newDocRef, dataToSave);
    
    // Update user info
    const updatedUserInfo: UserInfo = {
      ...userInfo,
      totalReferredUsers: userInfo.totalReferredUsers + 1,
      earnedRewards: userInfo.earnedRewards + user.reward,
    };
    
    const userDocRef = doc(db, 'users', auth.currentUser.uid);
    batch.set(userDocRef, updatedUserInfo);
    
    await batch.commit();
    
    const referredUsers = await getReferredUsers();
    return { userInfo: updatedUserInfo, referredUsers };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

export async function seedDefaultData(): Promise<{ userInfo: UserInfo; referredUsers: ReferredUser[] }> {
  if (!auth.currentUser) return { userInfo: { referralCode: 'GUEST', totalReferredUsers: 0, earnedRewards: 0 }, referredUsers: [] };
  
  const info = await getUserInfo();
  const existingUsers = await getReferredUsers();
  
  if (existingUsers.length > 0) {
    return { userInfo: info, referredUsers: existingUsers };
  }
  
  const initialReferred: ReferredUser[] = [
    {
      username: 'Emily_Voyager',
      joinDate: '2026-06-25 10:12',
      reward: 50,
      status: 'Active',
      milestone: 'Reached Paris Louvre 🎨',
      locationName: 'Paris, France',
      latitude: 48.8566,
      longitude: 2.3522,
    },
    {
      username: 'David_Hiker',
      joinDate: '2026-07-02 14:22',
      reward: 100,
      status: 'Active',
      milestone: 'Visited Grand Canyon 🏜️',
      locationName: 'Grand Canyon, Arizona',
      latitude: 36.0544,
      longitude: -112.1401,
    },
    {
      username: 'Elena_Cyclist',
      joinDate: '2026-07-08 08:30',
      reward: 20,
      status: 'Active',
      milestone: 'Created 3 Custom Routes 🗺️',
      locationName: 'Amsterdam, Netherlands',
      latitude: 52.3676,
      longitude: 4.9041,
    },
    {
      username: 'Alex_Explorer',
      joinDate: '2026-07-15 14:32',
      reward: 50,
      status: 'Active',
      milestone: 'Explored Tokyo Tower 🗼',
      locationName: 'Tokyo, Japan',
      latitude: 35.6762,
      longitude: 139.6503,
    },
    {
      username: 'Sofia_Mapfan',
      joinDate: '2026-07-18 09:15',
      reward: 50,
      status: 'Active',
      milestone: 'Created 5 Custom Routes 🗺️',
      locationName: 'San Francisco, California',
      latitude: 37.7749,
      longitude: -122.4194,
    },
    {
      username: 'Marcus_Globetrotter',
      joinDate: '2026-07-19 01:45',
      reward: 20,
      status: 'Pending',
      milestone: 'Account Created ⛺',
      locationName: 'Sydney, Australia',
      latitude: -33.8688,
      longitude: 151.2093,
    }
  ];
  
  let currentRewards = info.earnedRewards;
  let currentUsers = info.totalReferredUsers;
  
  const batch = writeBatch(db);
  const colRef = collection(db, 'users', auth.currentUser.uid, 'referred_users');
  
  for (const user of initialReferred) {
    const newDocRef = doc(colRef);
    const { id, ...dataToSave } = user;
    batch.set(newDocRef, dataToSave);
    currentRewards += user.reward;
    currentUsers++;
  }
  
  const updatedUserInfo: UserInfo = {
    ...info,
    totalReferredUsers: currentUsers,
    earnedRewards: currentRewards,
  };
  
  const userDocRef = doc(db, 'users', auth.currentUser.uid);
  batch.set(userDocRef, updatedUserInfo);
  
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${auth.currentUser.uid}/referred_users`);
  }
  
  return { userInfo: updatedUserInfo, referredUsers: await getReferredUsers() };
}

export async function resetDatabase(): Promise<{ userInfo: UserInfo; referredUsers: ReferredUser[] }> {
  if (!auth.currentUser) return { userInfo: { referralCode: 'GUEST', totalReferredUsers: 0, earnedRewards: 0 }, referredUsers: [] };
  
  // Clear referred users
  const colRef = collection(db, 'users', auth.currentUser.uid, 'referred_users');
  const snapshot = await getDocs(colRef);
  const batch = writeBatch(db);
  snapshot.docs.forEach(docSnap => {
    batch.delete(docSnap.ref);
  });
  
  // Reset user info
  const initialInfo: UserInfo = { 
    referralCode: generateReferralCode(), 
    totalReferredUsers: 0, 
    earnedRewards: 0, 
    emailAlertsEnabled: true, 
    alertEmail: auth.currentUser.email || '' 
  };
  
  const userDocRef = doc(db, 'users', auth.currentUser.uid);
  batch.set(userDocRef, initialInfo);
  
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${auth.currentUser.uid}/referred_users`);
  }
  
  return seedDefaultData();
}
