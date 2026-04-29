const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, orderBy } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyBtaSjwZY_cQ-YYbF__xGA7YLnLYLEkQvk",
  projectId: "gen-lang-client-0385112011"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, "ai-studio-1fdc8eb6-64dc-46d2-b357-5d0529f00a99");

async function check() {
  try {
    const q = query(
      collection(db, "custom_lessons"),
      orderBy("createdAt", "asc")
    );
    const snap = await getDocs(q);
    console.log("Success! Docs:", snap.size);
  } catch(e) {
    console.error("Error:", e.message);
  }
}
check();
