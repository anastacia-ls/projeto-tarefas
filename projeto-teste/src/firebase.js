import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";
 
const firebaseConfig = {
    apiKey: "AIzaSyAlH5jlObDOmBdLePG40Uc7f152vVXJa7A",
    authDomain: "o-meu-projeto-5b5f1.firebaseapp.com",
    projectId: "o-meu-projeto-5b5f1",
    storageBucket: "o-meu-projeto-5b5f1.firebasestorage.app",
    messagingSenderId: "287314310426",
    appId: "1:287314310426:web:5c3edc85c78d6f5d97a8a3",
    measurementId: "G-JZPL9MJX7N"
};
 
const app       = initializeApp(firebaseConfig);
const auth      = getAuth(app);
const db        = getFirestore(app);
const analytics = getAnalytics(app);
 
export { auth, db, analytics };
