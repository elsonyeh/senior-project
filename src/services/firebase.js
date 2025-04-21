import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAFnM6jwEITNIFgjo6OTFK3gcf1eiBvJR4",
  authDomain: "tastebuddies-demo-2.firebaseapp.com",
  projectId: "tastebuddies-demo-2",
  storageBucket: "tastebuddies-demo-2.firebasestorage.app",
  messagingSenderId: "350257167925",
  appId: "1:350257167925:web:64b8d7d08d16dca6867b7c",
  measurementId: "G-0F5TNENZ6Q"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
