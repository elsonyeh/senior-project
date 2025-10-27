import React, { useState, useEffect, useRef } from 'react';
import { IoClose, IoLocationOutline, IoStar, IoStarOutline, IoStarHalf, IoNavigateOutline } from 'react-icons/io5';
import RestaurantReviews from './RestaurantReviews';
import './RestaurantDetailModal.css';

export default function RestaurantDetailModal({ restaurant, user, onClose }) {
  const [ratingData, setRatingData] = useState(null);
  const reviewsSectionRef = useRef(null);

  if (!restaurant) return null;

  // Modal 打開時立即隱藏 navbar，關閉時恢復
  useEffect(() => {
    console.log('RestaurantDetailModal mounted, hiding navbar');

    // 使用 setTimeout 確保 DOM 已完全渲染
    const timer = setTimeout(() => {
      const hideEvent = new CustomEvent('modalNavChange', {
        detail: { isVisible: false }
      });
      window.dispatchEvent(hideEvent);
      console.log('Dispatched modalNavChange with isVisible: false');
    }, 0);

    // 監聽滾動到評論區的事件
    const handleScrollToReviews = () => {
      const reviewsSection = reviewsSectionRef.current;
      if (!reviewsSection) return;

      const modalElement = reviewsSection.closest('.restaurant-detail-modal');
      if (modalElement) {
        modalElement.scrollTo({
          top: reviewsSection.offsetTop - 20,
          behavior: 'smooth'
        });
      }
    };

    window.addEventListener('scrollToReviews', handleScrollToReviews);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('scrollToReviews', handleScrollToReviews);

      console.log('RestaurantDetailModal unmounting, showing navbar');
      // 組件卸載時恢復 navbar
      const showEvent = new CustomEvent('modalNavChange', {
        detail: { isVisible: true }
      });
      window.dispatchEvent(showEvent);
      console.log('Dispatched modalNavChange with isVisible: true');
    };
  }, []);

  const handleNavigate = () => {
    const query = encodeURIComponent(restaurant.address || restaurant.name);
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${query}`,
      "_blank"
    );
  };

  const handleRatingLoad = (data) => {
    setRatingData(data);
  };

  const renderStars = (rating) => {
    const fullStars = Math.floor(rating);
    const hasHalfStar = (rating % 1) >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

    return (
      <div className="stars">
        {/* Full stars */}
        {[...Array(fullStars)].map((_, i) => (
          <span key={`full-${i}`} className="filled">
            <IoStar />
          </span>
        ))}
        {/* Half star */}
        {hasHalfStar && (
          <span key="half" className="filled">
            <IoStarHalf />
          </span>
        )}
        {/* Empty stars */}
        {[...Array(emptyStars)].map((_, i) => (
          <span key={`empty-${i}`} className="empty">
            <IoStarOutline />
          </span>
        ))}
      </div>
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

        {/* 餐廳資訊 + 評分摘要 */}
        <div className="restaurant-info">
          <h2 className="restaurant-name">{restaurant.name}</h2>

          {restaurant.address && (
            <div className="restaurant-address">
              <IoLocationOutline />
              <span>{restaurant.address}</span>
            </div>
          )}

          {/* 評分摘要 */}
          {ratingData && (
            <div className="rating-summary-in-info">
              <div className="rating-score">
                <div className="score-number">{ratingData.combinedRating.toFixed(1)}</div>
                <div className="rating-stars-large">
                  {renderStars(ratingData.combinedRating)}
                </div>
              </div>
              <div className="rating-count-text">
                {ratingData.tastebuddiesRatingCount > 0
                  ? `${ratingData.tastebuddiesRatingCount} 則評論`
                  : '尚無評論'}
              </div>
            </div>
          )}

          <button className="navigate-btn" onClick={handleNavigate}>
            <IoNavigateOutline />
            前往餐廳
          </button>
        </div>

        {/* 評論區 */}
        <div className="reviews-section" ref={reviewsSectionRef}>
          <RestaurantReviews
            restaurantId={restaurant.place_id || restaurant.id}
            user={user}
            onRatingLoad={handleRatingLoad}
            showRatingSummary={false}
          />
        </div>
      </div>
    </div>
  );
}
