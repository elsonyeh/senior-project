import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { IoStar, IoStarOutline, IoStarHalf, IoTrash, IoRestaurantOutline, IoNavigateOutline } from 'react-icons/io5';
import { restaurantReviewService } from '../../services/restaurantService';
import ConfirmDialog from '../common/ConfirmDialog';
import './MyReviews.css';

export default function MyReviews({ user, onReviewsCountChange }) {
  const navigate = useNavigate();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedReviews, setExpandedReviews] = useState(new Set());
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [reviewToDelete, setReviewToDelete] = useState(null);

  const MAX_PREVIEW_LENGTH = 100;

  useEffect(() => {
    if (user) {
      loadReviews();
    }
  }, [user]);

  // 通知父組件評論數變化
  useEffect(() => {
    if (onReviewsCountChange) {
      onReviewsCountChange(reviews.length);
    }
  }, [reviews.length, onReviewsCountChange]);

  const loadReviews = async () => {
    setLoading(true);
    const result = await restaurantReviewService.getUserReviews(user.id);
    if (result.success) {
      setReviews(result.reviews);
    }
    setLoading(false);
  };

  const handleDeleteClick = (reviewId) => {
    setReviewToDelete(reviewId);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!reviewToDelete) return;

    const result = await restaurantReviewService.deleteReview(reviewToDelete);
    if (result.success) {
      await loadReviews();
    } else {
      alert(result.error || '刪除失敗');
    }

    setDeleteConfirmOpen(false);
    setReviewToDelete(null);
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmOpen(false);
    setReviewToDelete(null);
  };

  const toggleExpanded = (reviewId) => {
    const newExpanded = new Set(expandedReviews);
    if (newExpanded.has(reviewId)) {
      newExpanded.delete(reviewId);
    } else {
      newExpanded.add(reviewId);
    }
    setExpandedReviews(newExpanded);
  };

  const shouldShowMoreButton = (text) => {
    return text && text.length > MAX_PREVIEW_LENGTH;
  };

  const getDisplayText = (review) => {
    if (!review.comment) return '';
    if (expandedReviews.has(review.id)) {
      return review.comment;
    }
    if (review.comment.length > MAX_PREVIEW_LENGTH) {
      return review.comment.substring(0, MAX_PREVIEW_LENGTH) + '...';
    }
    return review.comment;
  };

  const navigateToRestaurant = (restaurant) => {
    if (!restaurant) return;
    // 導航到地圖頁面並傳遞餐廳資料
    navigate('/map', {
      state: {
        selectedRestaurant: restaurant,
        openDetailModal: true
      }
    });
  };

  const renderStars = (rating, interactive = false, onRatingChange = null) => {
    // For interactive mode (user rating input), keep integer ratings
    if (interactive) {
      return (
        <div className={`stars ${interactive ? 'interactive' : ''}`}>
          {[1, 2, 3, 4, 5].map((star) => (
            <span
              key={star}
              onClick={() => interactive && onRatingChange && onRatingChange(star)}
              className={star <= rating ? 'filled' : 'empty'}
            >
              {star <= rating ? <IoStar /> : <IoStarOutline />}
            </span>
          ))}
        </div>
      );
    }

    // For display mode, support half stars
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

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="my-reviews-loading">
        <div className="loading-spinner"></div>
        <p>載入評論中...</p>
      </div>
    );
  }

  return (
    <div className="my-reviews-container">
      <div className="reviews-list">
        {reviews.length === 0 ? (
          <div className="no-reviews">
            <IoRestaurantOutline className="no-reviews-icon" />
            <h3>還沒有評論</h3>
            <p>開始探索餐廳並留下您的評論吧！</p>
          </div>
        ) : (
          reviews.map((review) => (
            <div key={review.id} className="review-card">
              <div className="card-header">
                <div className="restaurant-name">
                  <IoRestaurantOutline />
                  {review.restaurants?.name || '未知餐廳'}
                </div>
                <button
                  className="delete-btn"
                  onClick={() => handleDeleteClick(review.id)}
                  title="刪除"
                >
                  <IoTrash />
                </button>
                <button
                  className="navigate-btn"
                  onClick={() => navigateToRestaurant(review.restaurants)}
                  title="前往餐廳"
                >
                  <IoNavigateOutline />
                </button>
              </div>

              <div className="card-content">
                <div className="review-rating-section">
                  <div className="my-rating">
                    <span className="rating-label">我的評分</span>
                    {renderStars(review.rating)}
                    <span className="rating-number">{review.rating}.0</span>
                  </div>
                </div>

                {review.comment && (
                  <div className="review-comment-section">
                    <div className="review-comment">{getDisplayText(review)}</div>
                    {shouldShowMoreButton(review.comment) && (
                      <button
                        className="show-more-btn"
                        onClick={() => toggleExpanded(review.id)}
                      >
                        {expandedReviews.has(review.id) ? '顯示較少內容' : '顯示完整內容'}
                      </button>
                    )}
                  </div>
                )}

                <div className="review-meta">
                  <span className="review-date">{formatDate(review.created_at)}</span>
                  {review.updated_at !== review.created_at && (
                    <span className="updated-badge">已編輯</span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 刪除確認對話框 */}
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title="刪除評論"
        message="確定要刪除這則評論嗎？此操作無法復原。"
        confirmText="刪除"
        cancelText="取消"
        type="danger"
      />
    </div>
  );
}
