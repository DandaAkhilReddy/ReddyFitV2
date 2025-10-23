// Import the functions you need from the SDKs you need
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";
import "firebase/compat/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAi7Hx7f_XxF7GiZUIiEp-KsgKEyijH3M4",
  authDomain: "reddyfitagent.firebaseapp.com",
  projectId: "reddyfitagent",
  storageBucket: "reddyfitagent.firebasestorage.app",
  messagingSenderId: "508141093989",
  appId: "1:508141093989:web:7a96f70d3a7f89b2ecf28c",
  measurementId: "G-982KRQ6Q9L"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);

// Export auth and other services
export const auth = firebase.auth();
export const db = firebase.firestore();
export const storage = firebase.storage();