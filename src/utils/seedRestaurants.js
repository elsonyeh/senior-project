import { db } from '../services/legacy-firebase';
import { collection, doc, setDoc } from 'firebase/firestore';
import { restaurantData } from '../data/localRestaurants';

// ⚠️ 確保你已經初始化 Firebase 並有權限寫入
export const seedRestaurants = async () => {
  const ref = collection(db, 'restaurants');

  for (const r of restaurantData) {
    const docRef = doc(ref, r.id);
    await setDoc(docRef, {
      name: r.name,
      type: r.type,
      address: r.address || '高雄市鼓山區',
      tags: r.tags || [],
      location: r.location,
      rating: r.rating || (Math.random() * 2 + 3).toFixed(1)
    });
    console.log(`✅ 已寫入餐廳：${r.name}`);
  }
};
