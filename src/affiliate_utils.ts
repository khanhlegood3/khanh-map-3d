import { LevelMilestone } from './affiliate_types';

export const LEVEL_MILESTONES: LevelMilestone[] = [
  { level: 1, name: 'Novice Nomad', minReferrals: 0, icon: '⛺', nextLevelReferrals: 1 },
  { level: 2, name: 'Globe Trotter', minReferrals: 1, icon: '✈️', nextLevelReferrals: 3 },
  { level: 3, name: 'Route Planner', minReferrals: 3, icon: '🗺️', nextLevelReferrals: 6 },
  { level: 4, name: 'Cartographer', minReferrals: 6, icon: '🧭', nextLevelReferrals: 10 },
  { level: 5, name: 'Master Pathfinder', minReferrals: 10, icon: '👑', nextLevelReferrals: null },
];

export function getLevelForReferrals(count: number): LevelMilestone {
  let currentMilestone = LEVEL_MILESTONES[0];
  for (const milestone of LEVEL_MILESTONES) {
    if (count >= milestone.minReferrals) {
      currentMilestone = milestone;
    }
  }
  return currentMilestone;
}

export function getNextLevelMilestone(currentLevel: number): LevelMilestone | null {
  const next = LEVEL_MILESTONES.find(m => m.level === currentLevel + 1);
  return next || null;
}

export const RECENT_MILESTONES = [
  'Explored Tokyo Tower 🗼',
  'Visited Grand Canyon 🏜️',
  'Reached Paris Louvre 🎨',
  'Created 3 Custom Routes 🗺️',
  'Unlocked Level 2 ✈️',
  'Discovered Venice Canals 🛶',
  'Traveled 2500 km 🛩️',
  'Explored Machu Picchu ⛰️',
  'Viewed Golden Gate Bridge 🌁',
  'Discovered Great Wall 🧱',
  'Explored Diamond Head 🌋',
  'Visited Stonehenge 🗿',
];

export interface LocationDetails {
  locationName: string;
  latitude: number;
  longitude: number;
}

export function getLocationForMilestone(milestone: string): LocationDetails {
  const mapping: { [key: string]: LocationDetails } = {
    'Explored Tokyo Tower 🗼': { locationName: 'Tokyo Tower, Tokyo, Japan', latitude: 35.6586, longitude: 139.7454 },
    'Visited Grand Canyon 🏜️': { locationName: 'Grand Canyon, Arizona', latitude: 36.0544, longitude: -112.1401 },
    'Reached Paris Louvre 🎨': { locationName: 'Paris Louvre, Paris, France', latitude: 48.8606, longitude: 2.3376 },
    'Created 3 Custom Routes 🗺️': { locationName: 'Amsterdam, Netherlands', latitude: 52.3676, longitude: 4.9041 },
    'Unlocked Level 2 ✈️': { locationName: 'London, UK', latitude: 51.5074, longitude: -0.1278 },
    'Discovered Venice Canals 🛶': { locationName: 'Venice, Italy', latitude: 45.4408, longitude: 12.3155 },
    'Traveled 2500 km 🛩️': { locationName: 'Reykjavik, Iceland', latitude: 64.1466, longitude: -21.9426 },
    'Explored Machu Picchu ⛰️': { locationName: 'Machu Picchu, Peru', latitude: -13.1631, longitude: -72.5450 },
    'Viewed Golden Gate Bridge 🌁': { locationName: 'Golden Gate Bridge, San Francisco, CA', latitude: 37.8199, longitude: -122.4783 },
    'Discovered Great Wall 🧱': { locationName: 'Great Wall of China, Beijing, China', latitude: 40.4319, longitude: 116.5704 },
    'Explored Diamond Head 🌋': { locationName: 'Diamond Head, Honolulu, Hawaii', latitude: 21.2618, longitude: -157.8078 },
    'Visited Stonehenge 🗿': { locationName: 'Stonehenge, UK', latitude: 51.1789, longitude: -1.8262 },
  };

  const cleanMilestone = milestone ? milestone.trim() : '';
  if (mapping[cleanMilestone]) {
    return mapping[cleanMilestone];
  }
  return { locationName: 'Unknown', latitude: 0, longitude: 0 };
}
