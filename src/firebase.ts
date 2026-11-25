import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBXVVJASNhuwQKI2atfYiwDrPU14HkcQ2Y",
  authDomain: "gym-saas-309e3.firebaseapp.com",
  projectId: "gym-saas-309e3",
  storageBucket: "gym-saas-309e3.firebasestorage.app",
  messagingSenderId: "949600422290",
  appId: "1:949600422290:web:6922c0b77632420070194b",
};

const app = initializeApp(firebaseConfig);

// Doosra app: sirf naye user banane ke liye, taaki Super Admin logout na ho
const secondaryApp =
  getApps().find((a) => a.name === "secondary") ??
  initializeApp(firebaseConfig, "secondary");

export const auth = getAuth(app);
export const secondaryAuth = getAuth(secondaryApp);
export const db = getFirestore(app);
