import React, { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const storage = getStorage();

const geocodeAddress = async (address) => {
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=AIzaSyAPYhzKbFIebkI2fsOxBSIBiUmki8R1C-Y`
  );
  const data = await response.json();
  if (data.status === 'OK') {
    const { lat, lng } = data.results[0].geometry.location;
    return { lat, lng };
  } else {
    throw new Error('Geocoding failed: ' + data.status);
  }
};

export default function AdminPage() {
  const [restaurants, setRestaurants] = useState([]);
  const [newRestaurant, setNewRestaurant] = useState({
    name: '', type: '', address: '', tags: '', lat: 0, lng: 0,
    priceRange: '', rating: 4.0, suggestedPeople: '1~4', isSpicy: false
  });

  const fetchRestaurants = async () => {
    const snapshot = await getDocs(collection(db, 'restaurants'));
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setRestaurants(data);
  };

  useEffect(() => {
    fetchRestaurants();
  }, []);

  const handleAdd = async () => {
    if (!newRestaurant.name) return;
    let latlng = { lat: parseFloat(newRestaurant.lat), lng: parseFloat(newRestaurant.lng) };
    if (!latlng.lat || !latlng.lng) {
      try {
        latlng = await geocodeAddress(newRestaurant.address);
      } catch (err) {
        alert('地址轉換失敗：' + err.message);
        return;
      }
    }
    await addDoc(collection(db, 'restaurants'), {
      ...newRestaurant,
      tags: newRestaurant.tags.split(',').map(t => t.trim()),
      location: latlng
    });
    setNewRestaurant({
      name: '', type: '', address: '', tags: '', lat: 0, lng: 0,
      priceRange: '', rating: 4.0, suggestedPeople: '1~4', isSpicy: false
    });
    fetchRestaurants();
  };

  const handleDelete = async (id) => {
    await deleteDoc(doc(db, 'restaurants', id));
    fetchRestaurants();
  };

  const handleUpdate = async (id, field, value) => {
    const ref = doc(db, 'restaurants', id);
    const updateValue = field === 'tags'
      ? value.split(',').map(t => t.trim())
      : field === 'lat' || field === 'lng'
        ? parseFloat(value)
        : field === 'isSpicy'
          ? Boolean(value)
          : value;
    await updateDoc(ref, field === 'lat' || field === 'lng'
      ? { location: { ...restaurants.find(r => r.id === id).location, [field]: updateValue } }
      : { [field]: updateValue });
    fetchRestaurants();
  };

  const handleUploadImage = async (id, file) => {
    const storageRef = ref(storage, `restaurant_images/${id}`);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    await updateDoc(doc(db, 'restaurants', id), { photoURL: url });
    fetchRestaurants();
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif', backgroundColor: '#f9f9f9' }}>
      <h1 style={{ color: '#333' }}>📋 餐廳管理頁面 (含地理編碼)</h1>

      <div style={{ backgroundColor: '#fff', padding: '1rem', borderRadius: '8px', boxShadow: '0 2px 6px rgba(0,0,0,0.1)' }}>
        <h3>➕ 新增餐廳</h3>
        <input placeholder="名稱" value={newRestaurant.name} onChange={(e) => setNewRestaurant({ ...newRestaurant, name: e.target.value })} />
        <input placeholder="類型" value={newRestaurant.type} onChange={(e) => setNewRestaurant({ ...newRestaurant, type: e.target.value })} />
        <input placeholder="地址" value={newRestaurant.address} onChange={(e) => setNewRestaurant({ ...newRestaurant, address: e.target.value })} />
        <input placeholder="標籤（逗號分隔）" value={newRestaurant.tags} onChange={(e) => setNewRestaurant({ ...newRestaurant, tags: e.target.value })} />
        <input placeholder="緯度（可選）" value={newRestaurant.lat} onChange={(e) => setNewRestaurant({ ...newRestaurant, lat: e.target.value })} />
        <input placeholder="經度（可選）" value={newRestaurant.lng} onChange={(e) => setNewRestaurant({ ...newRestaurant, lng: e.target.value })} />
        <input placeholder="價格區間（$、$$、$$$）" value={newRestaurant.priceRange} onChange={(e) => setNewRestaurant({ ...newRestaurant, priceRange: e.target.value })} />
        <input placeholder="星等（1~5）" type="number" step="0.1" value={newRestaurant.rating} onChange={(e) => setNewRestaurant({ ...newRestaurant, rating: parseFloat(e.target.value) })} />
        <select value={newRestaurant.suggestedPeople} onChange={(e) => setNewRestaurant({ ...newRestaurant, suggestedPeople: e.target.value })}>
          <option value="1~4">1~4 人</option>
          <option value="5~8">5~8 人</option>
          <option value="8以上">8 人以上</option>
          <option value="1~8">1~8 人</option>
        </select>
        <label>
          辣嗎？
          <input type="checkbox" checked={newRestaurant.isSpicy} onChange={(e) => setNewRestaurant({ ...newRestaurant, isSpicy: e.target.checked })} />
        </label>
        <button style={{ marginTop: '1rem' }} onClick={handleAdd}>新增</button>
      </div>

      <h3 style={{ marginTop: '2rem' }}>📂 所有餐廳</h3>
      <table border="1" cellPadding="6" style={{ width: '100%', marginTop: '1rem', backgroundColor: '#fff', borderCollapse: 'collapse' }}>
        <thead style={{ backgroundColor: '#efefef' }}>
          <tr>
            <th>圖片</th>
            <th>名稱</th>
            <th>類型</th>
            <th>地址</th>
            <th>標籤</th>
            <th>緯度</th>
            <th>經度</th>
            <th>價格</th>
            <th>星等</th>
            <th>人數</th>
            <th>辣</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {restaurants.map(r => (
            <tr key={r.id}>
              <td>
                {r.photoURL ? <img src={r.photoURL} alt="餐廳圖" width="60" /> : "無"}
                <input type="file" accept="image/*" onChange={(e) => handleUploadImage(r.id, e.target.files[0])} />
              </td>
              <td><input value={r.name} onChange={(e) => handleUpdate(r.id, 'name', e.target.value)} /></td>
              <td><input value={r.type} onChange={(e) => handleUpdate(r.id, 'type', e.target.value)} /></td>
              <td><input value={r.address || ''} onChange={(e) => handleUpdate(r.id, 'address', e.target.value)} /></td>
              <td><input value={r.tags?.join(', ') || ''} onChange={(e) => handleUpdate(r.id, 'tags', e.target.value)} /></td>
              <td><input value={r.location?.lat || 0} onChange={(e) => handleUpdate(r.id, 'lat', e.target.value)} /></td>
              <td><input value={r.location?.lng || 0} onChange={(e) => handleUpdate(r.id, 'lng', e.target.value)} /></td>
              <td><input value={r.priceRange || ''} onChange={(e) => handleUpdate(r.id, 'priceRange', e.target.value)} /></td>
              <td><input type="number" step="0.1" value={r.rating || 0} onChange={(e) => handleUpdate(r.id, 'rating', e.target.value)} /></td>
              <td>
                <select value={r.suggestedPeople} onChange={(e) => handleUpdate(r.id, 'suggestedPeople', e.target.value)}>
                  <option value="1~4">1~4 人</option>
                  <option value="5~8">5~8 人</option>
                  <option value="8以上">8 人以上</option>
                  <option value="1~8">1~8 人</option>
                </select>
              </td>
              <td>
                <input type="checkbox" checked={r.isSpicy || false} onChange={(e) => handleUpdate(r.id, 'isSpicy', e.target.checked)} />
              </td>
              <td><button onClick={() => handleDelete(r.id)}>🗑️ 刪除</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
