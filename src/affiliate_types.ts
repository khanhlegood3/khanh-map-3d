export interface UserInfo {
  referralCode: string;
  totalReferredUsers: number;
  earnedRewards: number;
  emailAlertsEnabled?: boolean;
  alertEmail?: string;
}

export interface ReferredUser {
  username: string;
  city?: string;
  joinDate: string;
  reward: number;
  status: 'Active' | 'Pending' | 'Completed';
  milestone?: string;
  locationName?: string;
  latitude?: number;
  longitude?: number;
}

export interface ChartDataPoint {
  date: Date;
  dateStr: string;
  rewards: number;
}

export interface LevelMilestone {
  level: number;
  name: string;
  minReferrals: number;
  icon: string;
  nextLevelReferrals: number | null;
}
