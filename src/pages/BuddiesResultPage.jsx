import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import BuddiesRecommendationResult from '../components/Buddies/BuddiesRecommendationResult';

export default function BuddiesResultPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const recommendations = location.state?.recommendations || [];

  return (
    <BuddiesRecommendationResult
      saved={recommendations}
      onRetry={() => navigate('/buddies')}
    />
  );
}
