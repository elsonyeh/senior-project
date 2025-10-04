import React, { useState, useEffect } from 'react';
import { restaurantService } from '../../services/supabaseService';
import { funQuestionTagService } from '../../services/funQuestionTagService';
import './RecommendationTester.css';

export default function RecommendationTester() {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scoredRestaurants, setScoredRestaurants] = useState([]);

  // 測試條件
  const [peopleCount, setPeopleCount] = useState('單人');
  const [priceRange, setPriceRange] = useState('平價美食');
  const [mealType, setMealType] = useState('吃');
  const [fullness, setFullness] = useState('吃飽');
  const [spiciness, setSpiciness] = useState('不辣');
  const [funAnswers, setFunAnswers] = useState([]);

  // 趣味問題選項
  const funQuestions = [
    { question: '你的包包類型？', options: ['側背包', '後背包', '托特包', '手拿包'] },
    { question: '你是？', options: ['Ｉ人', 'Ｅ人'] },
    { question: '你是？', options: ['貓派', '狗派'] }
  ];

  const WEIGHT = {
    BASIC_MATCH: 10,
    FUN_MATCH: 5,
    RATING: 1.5,
    MIN_SCORE: 1
  };

  useEffect(() => {
    loadRestaurants();
  }, []);

  const loadRestaurants = async () => {
    setLoading(true);
    const result = await restaurantService.getAllRestaurants();
    if (result.success) {
      setRestaurants(result.data);
    }
    setLoading(false);
  };

  const handleFunAnswerToggle = (answer) => {
    setFunAnswers(prev =>
      prev.includes(answer)
        ? prev.filter(a => a !== answer)
        : [...prev, answer]
    );
  };

  const calculateScores = async () => {
    setLoading(true);

    const basicAnswers = [peopleCount, priceRange, mealType, fullness, spiciness].filter(Boolean);

    const scored = await Promise.all(restaurants.map(async (restaurant) => {
      let score = WEIGHT.MIN_SCORE;
      let basicMatchCount = 0;
      const restaurantTags = restaurant.tags || [];
      const normalizedTags = restaurantTags
        .filter(tag => tag !== null && tag !== undefined && tag !== '')
        .map(tag => String(tag || '').toLowerCase());

      let scoreBreakdown = {
        name: restaurant.name,
        basic: 0,
        fun: 0,
        rating: 0,
        bonus: 0,
        total: 0,
        details: []
      };

      // 基本條件匹配
      for (const answer of basicAnswers) {
        let matched = false;

        switch (answer) {
          case "平價美食":
            matched = restaurant.price_range === 1 || (restaurant.price_range === 2 && Math.random() < 0.7);
            break;
          case "奢華美食":
            matched = restaurant.price_range === 3 || (restaurant.price_range === 2 && Math.random() < 0.7);
            break;
          case "吃":
          case "喝":
            const safeAnswer = String(answer || '').toLowerCase();
            matched = safeAnswer.length > 0 && normalizedTags.some(tag =>
              tag && typeof tag === 'string' && tag.includes(safeAnswer)
            );
            if (matched) {
              if (answer === "吃") {
                score += WEIGHT.BASIC_MATCH;
                basicMatchCount++;
              } else if (answer === "喝") {
                score += WEIGHT.BASIC_MATCH;
                basicMatchCount++;
              }
            }
            break;
          case "辣":
            matched = restaurant.is_spicy === true || restaurant.is_spicy === 'true' || restaurant.is_spicy === 'both';
            break;
          case "不辣":
            matched = restaurant.is_spicy === false || restaurant.is_spicy === 'false' || restaurant.is_spicy === 'both';
            break;
          case "單人":
            matched = restaurant.suggested_people && restaurant.suggested_people.includes("1");
            break;
          case "多人":
            matched = restaurant.suggested_people && restaurant.suggested_people.includes("~");
            break;
          default:
            const safeAns = String(answer || '').toLowerCase();
            matched = safeAns.length > 0 && normalizedTags.some(tag =>
              tag && typeof tag === 'string' && tag.includes(safeAns)
            );
            break;
        }

        if (matched && !['吃', '喝'].includes(answer)) {
          score += WEIGHT.BASIC_MATCH;
          basicMatchCount++;
        } else if (matched && ['吃一點', '吃飽'].includes(answer)) {
          basicMatchCount++;
        }

        scoreBreakdown.details.push({
          condition: answer,
          matched,
          score: matched && !['吃', '喝', '吃一點', '吃飽'].includes(answer) ? WEIGHT.BASIC_MATCH : 0
        });
      }

      // 不符合所有基本條件則排除
      if (basicAnswers.length > 0 && basicMatchCount < basicAnswers.length) {
        scoreBreakdown.total = 0;
        scoreBreakdown.excluded = true;
        return scoreBreakdown;
      }

      scoreBreakdown.basic = basicMatchCount * WEIGHT.BASIC_MATCH;

      // 趣味問題匹配
      if (funAnswers.length > 0) {
        const funMatchScore = await funQuestionTagService.calculateBatchMatchScore(
          funAnswers,
          restaurantTags
            .filter(tag => tag !== null && tag !== undefined && tag !== '')
            .map(tag => String(tag || ''))
            .filter(tag => tag.length > 0)
        );

        const funScore = funMatchScore * WEIGHT.FUN_MATCH;
        score += funScore;
        scoreBreakdown.fun = funScore;
      }

      // 評分權重
      if (typeof restaurant.rating === 'number' && restaurant.rating > 0) {
        const ratingScore = Math.min(restaurant.rating / 5, 1) * WEIGHT.RATING;
        score += ratingScore;
        scoreBreakdown.rating = ratingScore;
      }

      // 完全匹配獎勵
      if (basicMatchCount === basicAnswers.length && basicAnswers.length > 0) {
        const bonusScore = WEIGHT.BASIC_MATCH * 0.5;
        score += bonusScore;
        scoreBreakdown.bonus = bonusScore;
      }

      scoreBreakdown.total = score;
      return scoreBreakdown;
    }));

    const filtered = scored
      .filter(r => !r.excluded && r.total >= WEIGHT.MIN_SCORE)
      .sort((a, b) => b.total - a.total);

    setScoredRestaurants(filtered);
    setLoading(false);
  };

  return (
    <div className="recommendation-tester">
      <h2>推薦系統測試工具</h2>

      <div className="test-controls">
        <div className="control-group">
          <label>人數</label>
          <select value={peopleCount} onChange={(e) => setPeopleCount(e.target.value)}>
            <option value="單人">單人</option>
            <option value="多人">多人</option>
          </select>
        </div>

        <div className="control-group">
          <label>價格</label>
          <select value={priceRange} onChange={(e) => setPriceRange(e.target.value)}>
            <option value="平價美食">平價美食</option>
            <option value="奢華美食">奢華美食</option>
          </select>
        </div>

        <div className="control-group">
          <label>類型</label>
          <select value={mealType} onChange={(e) => setMealType(e.target.value)}>
            <option value="吃">吃</option>
            <option value="喝">喝</option>
          </select>
        </div>

        <div className="control-group">
          <label>分量</label>
          <select value={fullness} onChange={(e) => setFullness(e.target.value)}>
            <option value="吃一點">吃一點</option>
            <option value="吃飽">吃飽</option>
          </select>
        </div>

        <div className="control-group">
          <label>辣度</label>
          <select value={spiciness} onChange={(e) => setSpiciness(e.target.value)}>
            <option value="辣">辣</option>
            <option value="不辣">不辣</option>
          </select>
        </div>
      </div>

      <div className="fun-questions-section">
        <h3>趣味問題</h3>
        {funQuestions.map((q, idx) => (
          <div key={idx} className="fun-question-group">
            <label>{q.question}</label>
            <div className="fun-options">
              {q.options.map(option => (
                <button
                  key={option}
                  className={`fun-option ${funAnswers.includes(option) ? 'selected' : ''}`}
                  onClick={() => handleFunAnswerToggle(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button
        className="calculate-btn"
        onClick={calculateScores}
        disabled={loading}
      >
        {loading ? '計算中...' : '計算分數'}
      </button>

      {scoredRestaurants.length > 0 && (
        <div className="results-section">
          <h3>推薦結果 (共 {scoredRestaurants.length} 家餐廳)</h3>
          <div className="results-table">
            <table>
              <thead>
                <tr>
                  <th>排名</th>
                  <th>餐廳名稱</th>
                  <th>基本分</th>
                  <th>趣味分</th>
                  <th>評分加成</th>
                  <th>獎勵分</th>
                  <th>總分</th>
                </tr>
              </thead>
              <tbody>
                {scoredRestaurants.map((r, idx) => (
                  <tr key={idx}>
                    <td>{idx + 1}</td>
                    <td>{r.name}</td>
                    <td>{r.basic.toFixed(2)}</td>
                    <td>{r.fun.toFixed(2)}</td>
                    <td>{r.rating.toFixed(2)}</td>
                    <td>{r.bonus.toFixed(2)}</td>
                    <td><strong>{r.total.toFixed(2)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="detailed-breakdown">
            <h4>詳細分數拆解</h4>
            {scoredRestaurants.slice(0, 20).map((r, idx) => (
              <div key={idx} className="restaurant-detail">
                <h5>#{idx + 1} {r.name} - {r.total.toFixed(2)}分</h5>
                <div className="score-components">
                  <div className="component">
                    <span className="label">基本匹配:</span>
                    <span className="value">{r.basic.toFixed(2)}分</span>
                  </div>
                  <div className="component">
                    <span className="label">趣味匹配:</span>
                    <span className="value">{r.fun.toFixed(2)}分</span>
                  </div>
                  <div className="component">
                    <span className="label">評分加成:</span>
                    <span className="value">{r.rating.toFixed(2)}分</span>
                  </div>
                  <div className="component">
                    <span className="label">完全匹配獎勵:</span>
                    <span className="value">{r.bonus.toFixed(2)}分</span>
                  </div>
                </div>
                {r.details && r.details.length > 0 && (
                  <div className="match-details">
                    <strong>匹配詳情:</strong>
                    {r.details.map((d, i) => (
                      <div key={i} className={`detail-item ${d.matched ? 'matched' : 'not-matched'}`}>
                        {d.condition}: {d.matched ? '✓' : '✗'}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
