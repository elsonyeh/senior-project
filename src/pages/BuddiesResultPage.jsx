import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import RecommendationResult from '../components/RecommendationResult';

export default function BuddiesResultPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const recommendations = location.state?.recommendations || [];

  return (
    <RecommendationResult
      saved={recommendations}
      onRetry={() => navigate('/buddies')}
    />
  );
}
