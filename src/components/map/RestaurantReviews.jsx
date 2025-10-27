import React, { useState, useEffect } from 'react';
import { IoStar, IoStarOutline, IoStarHalf, IoTrash, IoSend } from 'react-icons/io5';
import { restaurantReviewService } from '../../services/restaurantService';
import ConfirmDialog from '../common/ConfirmDialog';
import './RestaurantReviews.css';

export default function RestaurantReviews({ restaurantId, user, onRatingLoad, showRatingSummary = false }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [expandedReviews, setExpandedReviews] = useState(new Set());
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [reviewToDelete, setReviewToDelete] = useState(null);
  const [userHasReviewed, setUserHasReviewed] = useState(false);
  const [ratingData, setRatingData] = useState({
    googleRating: 0,
    googleRatingCount: 0,
    tastebuddiesRating: 0,
    tastebuddiesRatingCount: 0,
    combinedRating: 0
  });

  const MAX_PREVIEW_LENGTH = 100; // 預覽前100字

  useEffect(() => {
    loadReviews();
    loadRating();
  }, [restaurantId]);

  const loadReviews = async () => {
    setLoading(true);
    const result = await restaurantReviewService.getReviews(restaurantId);
    if (result.success) {
      setReviews(result.reviews);

      // 檢查當前用戶是否已經評論過
      if (user) {
        const hasReviewed = result.reviews.some(review => review.user_id === user.id);
        setUserHasReviewed(hasReviewed);
      }
    }
    setLoading(false);
  };

  const loadRating = async () => {
    const result = await restaurantReviewService.getRestaurantRating(restaurantId);
    if (result.success) {
      const data = {
        googleRating: result.googleRating,
        googleRatingCount: result.googleRatingCount,
        tastebuddiesRating: result.tastebuddiesRating,
        tastebuddiesRatingCount: result.tastebuddiesRatingCount,
        combinedRating: result.combinedRating
      };
      setRatingData(data);

      // 通知父組件評分資料已載入
      if (onRatingLoad) {
        onRatingLoad(data);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      alert('請先登入才能留言');
      return;
    }

    if (userHasReviewed) {
      alert('您已經評論過這間餐廳了！每間餐廳只能留一則評論。');
      return;
    }

    if (!comment.trim()) {
      alert('請輸入評論內容');
      return;
    }

    setSubmitting(true);
    const result = await restaurantReviewService.addReview(restaurantId, rating, comment);

    if (result.success) {
      setComment('');
      setRating(5);
      await loadReviews();
      await loadRating();
    } else {
      alert(result.error || '操作失敗');
    }

    setSubmitting(false);
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
      await loadRating();
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
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '0分鐘前';
    if (diffMins < 60) return `${diffMins}分鐘前`;
    if (diffHours < 24) return `${diffHours}小時前`;
    if (diffDays < 7) return `${diffDays}天前`;

    return date.toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="restaurant-reviews">
      {/* Google Maps 風格的評分摘要 - 僅在 showRatingSummary 為 true 時顯示 */}
      {showRatingSummary && (
        <div className="rating-summary-gmaps">
          <div className="rating-score">
            <div className="score-number">{ratingData.combinedRating.toFixed(1)}</div>
            <div className="rating-stars-large">
              {renderStars(ratingData.combinedRating)}
            </div>
            <div className="rating-count-text">
              {ratingData.tastebuddiesRatingCount > 0
                ? `${ratingData.tastebuddiesRatingCount} 則評論`
                : '尚無評論'}
            </div>
          </div>
        </div>
      )}

      {/* 新增評論表單 */}
      {user && (
        userHasReviewed ? (
          <div className="already-reviewed-notice">
            <div className="notice-icon">✓</div>
            <div className="notice-content">
              <h4>您已評論過這間餐廳</h4>
              <p>每間餐廳只能留一則評論，您可以在下方查看或刪除您的評論。</p>
            </div>
          </div>
        ) : (
          <form className="review-form" onSubmit={handleSubmit}>
            <div className="form-header">
              <h4>撰寫評論</h4>
            </div>

            <div className="rating-input">
              <label>評分</label>
              {renderStars(rating, true, setRating)}
            </div>

            <div className="comment-input">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="分享您的用餐體驗...（最多200字）"
                rows={4}
                maxLength={200}
              />
              <div className="char-count">{comment.length}/200</div>
            </div>

            <button
              type="submit"
              className="submit-btn"
              disabled={submitting || !comment.trim()}
            >
              <IoSend />
              {submitting ? '送出中...' : '送出評論'}
            </button>
          </form>
        )
      )}

      {!user && (
        <div className="login-prompt">
          請先登入才能撰寫評論
        </div>
      )}

      {/* 評論列表 */}
      <div className="reviews-list">
        {loading ? (
          <div className="loading">載入評論中...</div>
        ) : reviews.length === 0 ? (
          <div className="no-reviews">尚無評論，成為第一個評論的人！</div>
        ) : (
          reviews.map((review) => (
            <div key={review.id} className="review-item">
              <div className="review-header">
                <div className="user-info">
                  {review.user_profiles?.avatar_url ? (
                    <img
                      src={review.user_profiles.avatar_url}
                      alt={review.user_profiles.name}
                      className="user-avatar"
                    />
                  ) : (
                    <div className="user-avatar-placeholder">
                      {review.user_profiles?.name?.[0] || '?'}
                    </div>
                  )}
                  <div className="user-details">
                    <div className="user-name">
                      {review.user_profiles?.name || '匿名用戶'}
                    </div>
                    <div className="review-date">
                      {formatDate(review.created_at)}
                    </div>
                  </div>
                </div>

                {/* 右側區塊：刪除按鈕 + 評分 */}
                <div className="review-right-section">
                  {user && user.id === review.user_id && (
                    <button
                      className="delete-btn"
                      onClick={() => handleDeleteClick(review.id)}
                      title="刪除評論"
                    >
                      <IoTrash />
                    </button>
                  )}
                  <div className="review-rating">
                    {renderStars(review.rating)}
                  </div>
                </div>
              </div>

              {review.comment && (
                <div className="review-content">
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
