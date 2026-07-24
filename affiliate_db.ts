/**
 * Utility for managing Affiliate Dashboard data in IndexedDB.
 */

export interface UserInfo {
  referralCode: string;
  totalReferredUsers: number;
  earnedRewards: number; // in Points or Coins
  emailAlertsEnabled?: boolean;
  alertEmail?: string;
}

export interface ReferredUser {
  id?: number;
  username: string;
  joinDate: string;
  reward: number;
  status: 'Active' | 'Pending' | 'Completed';
  milestone?: string;
  locationName?: string;
  latitude?: number;
  longitude?: number;
}

const DB_NAME = 'AffiliateDB';
const DB_VERSION = 1;

/**
 * Initializes the IndexedDB.
 */
export function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('IndexedDB error:', event);
      reject(request.error);
    };

    request.onsuccess = (event) => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = request.result;
      
      // Create store for user info if not exists
      if (!db.objectStoreNames.contains('user_info')) {
        db.createObjectStore('user_info', { keyPath: 'key' });
      }

      // Create store for referred users if not exists
      if (!db.objectStoreNames.contains('referred_users')) {
        db.createObjectStore('referred_users', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

/**
 * Generates a random referral code.
 */
function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'MAP3D-';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Seeds default data into the database if empty.
 */
export async function seedDefaultData(): Promise<{ userInfo: UserInfo; referredUsers: ReferredUser[] }> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    // Check if user info already exists
    const transaction = db.transaction(['user_info', 'referred_users'], 'readwrite');
    const userInfoStore = transaction.objectStore('user_info');
    const referredUsersStore = transaction.objectStore('referred_users');

    const getRequest = userInfoStore.get('current_user');

    getRequest.onsuccess = () => {
      if (getRequest.result) {
        // Data already exists, fetch referred users as well
        const getAllRequest = referredUsersStore.getAll();
        getAllRequest.onsuccess = () => {
          resolve({
            userInfo: getRequest.result.value,
            referredUsers: getAllRequest.result || [],
          });
        };
        getAllRequest.onerror = () => reject(getAllRequest.error);
      } else {
        // No data, seed default
        const defaultCode = generateReferralCode();
        
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

        const defaultUserInfo: UserInfo = {
          referralCode: defaultCode,
          totalReferredUsers: initialReferred.length,
          earnedRewards: initialReferred.reduce((sum, item) => sum + item.reward, 0),
          emailAlertsEnabled: true,
          alertEmail: 'ngadt@instulink.edu.vn',
        };

        // Save default user info
        userInfoStore.put({ key: 'current_user', value: defaultUserInfo });

        // Save initial referred users
        initialReferred.forEach(user => {
          referredUsersStore.add(user);
        });

        transaction.oncomplete = () => {
          // Re-fetch all referred users to include auto-generated IDs
          const refetchTransaction = db.transaction('referred_users', 'readonly');
          const refetchStore = refetchTransaction.objectStore('referred_users');
          const refetchRequest = refetchStore.getAll();

          refetchRequest.onsuccess = () => {
            resolve({
              userInfo: defaultUserInfo,
              referredUsers: refetchRequest.result || [],
            });
          };
          refetchRequest.onerror = () => reject(refetchRequest.error);
        };

        transaction.onerror = () => {
          reject(transaction.error);
        };
      }
    };

    getRequest.onerror = () => {
      reject(getRequest.error);
    };
  });
}

/**
 * Gets user info.
 */
export async function getUserInfo(): Promise<UserInfo> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('user_info', 'readonly');
    const store = transaction.objectStore('user_info');
    const request = store.get('current_user');

    request.onsuccess = () => {
      if (request.result) {
        resolve(request.result.value);
      } else {
        // Fallback if not found
        const code = generateReferralCode();
        const initialInfo: UserInfo = { referralCode: code, totalReferredUsers: 0, earnedRewards: 0, emailAlertsEnabled: true, alertEmail: 'ngadt@instulink.edu.vn' };
        resolve(initialInfo);
      }
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * Updates user info.
 */
export async function updateUserInfo(info: UserInfo): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('user_info', 'readwrite');
    const store = transaction.objectStore('user_info');
    const request = store.put({ key: 'current_user', value: info });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Gets all referred users.
 */
export async function getReferredUsers(): Promise<ReferredUser[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('referred_users', 'readonly');
    const store = transaction.objectStore('referred_users');
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Adds a new referred user and recalculates statistics automatically.
 */
export async function addReferredUser(user: ReferredUser): Promise<{ userInfo: UserInfo; referredUsers: ReferredUser[] }> {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['user_info', 'referred_users'], 'readwrite');
    const userInfoStore = transaction.objectStore('user_info');
    const referredUsersStore = transaction.objectStore('referred_users');

    // Add user
    referredUsersStore.add(user);

    // Get & update user info
    const getRequest = userInfoStore.get('current_user');
    getRequest.onsuccess = () => {
      const current = getRequest.result ? getRequest.result.value : { referralCode: generateReferralCode(), totalReferredUsers: 0, earnedRewards: 0 };
      
      const updatedUserInfo: UserInfo = {
        ...current,
        totalReferredUsers: current.totalReferredUsers + 1,
        earnedRewards: current.earnedRewards + user.reward,
      };

      userInfoStore.put({ key: 'current_user', value: updatedUserInfo });

      transaction.oncomplete = () => {
        // Transaction complete, return latest state
        Promise.all([getUserInfo(), getReferredUsers()]).then(([info, list]) => {
          resolve({ userInfo: info, referredUsers: list });
        }).catch(reject);
      };
    };

    transaction.onerror = () => reject(transaction.error);
  });
}

/**
 * Resets the IndexedDB to empty state and seeds defaults again.
 */
export async function resetDatabase(): Promise<{ userInfo: UserInfo; referredUsers: ReferredUser[] }> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['user_info', 'referred_users'], 'readwrite');
    transaction.objectStore('user_info').clear();
    transaction.objectStore('referred_users').clear();

    transaction.oncomplete = () => {
      seedDefaultData().then(resolve).catch(reject);
    };
    transaction.onerror = () => reject(transaction.error);
  });
}
