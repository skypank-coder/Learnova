import { db } from "@/lib/firebaseConfig";
import { doc, setDoc, updateDoc, increment, getDoc } from "firebase/firestore";

/**
 * Initializes a new user's statistics in Firestore.
 * @param {string} userId - The unique ID of the user.
 */
export const initializeUserStats = async (userId) => {
  if (!userId) return;
  const statsRef = doc(db, "userStats", userId);
  
  const defaultStats = {
    "Courses Enrolled": 0,
    "Attendance Rate": "0%",
    "Assignments Done": 0,
    "Study Hours": 0,
    lastUpdated: new Date()
  };

  try {
    await setDoc(statsRef, defaultStats);
  } catch (error) {
    console.error("Error initializing stats:", error);
  }
};

/**
 * Increments a specific statistic for a user.
 * @param {string} userId - The unique ID of the user.
 * @param {string} statField - The name of the stat (must match dashboard labels).
 * @param {number} value - The amount to increment (default is 1).
 */
export const updateUserStat = async (userId, statField, value = 1) => {
  if (!userId) return;
  const statsRef = doc(db, "userStats", userId);

  try {
    const statsSnap = await getDoc(statsRef);
    
    if (!statsSnap.exists()) {
      await initializeUserStats(userId);
    }

    await updateDoc(statsRef, {
      [statField]: increment(value),
      lastUpdated: new Date()
    });
  } catch (error) {
    console.error(`Error updating ${statField}:`, error);
  }
};