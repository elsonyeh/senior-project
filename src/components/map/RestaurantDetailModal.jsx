import React from 'react';
import { IoClose, IoLocationOutline, IoStarOutline, IoNavigateOutline } from 'react-icons/io5';
import RestaurantReviews from './RestaurantReviews';
import './RestaurantDetailModal.css';

export default function RestaurantDetailModal({ restaurant, user, onClose }) {
  if (!restaurant) return null;

  const handleNavigate = () => {
    const query = encodeURIComponent(restaurant.address || restaurant.name);
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${query}`,
      "_blank"
    );
  };

  return (
    <div className="restaurant-detail-modal-overlay" onClick={onClose}>
      <div className="restaurant-detail-modal" onClick={(e) => e.stopPropagation()}>
        {/* 關閉按鈕 */}
        <button className="close-btn" onClick={onClose}>
          <IoClose />
        </button>

        {/* 餐廳圖片 */}
        {restaurant.photo && (
          <div className="restaurant-image">
            <img src={restaurant.photo} alt={restaurant.name} />
          </div>
        )}

        {/* 餐廳資訊 */}
        <div className="restaurant-info">
          <h2 className="restaurant-name">{restaurant.name}</h2>

          {restaurant.address && (
            <div className="restaurant-address">
              <IoLocationOutline />
              <span>{restaurant.address}</span>
            </div>
          )}

          {restaurant.rating && (
            <div className="restaurant-rating">
              <IoStarOutline />
              <span>{restaurant.rating}</span>
            </div>
          )}

          <button className="navigate-btn" onClick={handleNavigate}>
            <IoNavigateOutline />
            前往餐廳
          </button>
        </div>

        {/* 評論區 */}
        <div className="reviews-section">
          <RestaurantReviews
            restaurantId={restaurant.place_id || restaurant.id}
            user={user}
          />
        </div>
      </div>
    </div>
  );
}
