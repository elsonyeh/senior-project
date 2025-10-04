import React, { useState, useEffect } from 'react';
import { restaurantService } from '../../services/restaurantService';
import { funQuestionTagService } from '../../services/funQuestionTagService';
import { getFunQuestions } from '../../services/questionService';
import './RecommendationTester.css';

export default function RecommendationTester() {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scoredRestaurants, setScoredRestaurants] = useState([]);
  const [funQuestions, setFunQuestions] = useState([]);

  // 測試條件
  const [peopleCount, setPeopleCount] = useState('單人');
  const [priceRange, setPriceRange] = useState('平價美食');
  const [mealType, setMealType] = useState('吃');
  const [fullness, setFullness] = useState('吃飽'); // 預設為「吃飽」，當選擇「喝」時會自動清空
  const [spiciness, setSpiciness] = useState('不辣');
  const [funAnswers, setFunAnswers] = useState([]);

  const WEIGHT = {
    BASIC_MATCH: 10,
    FUN_MATCH: 5,
    RATING: 1.5,
    MIN_SCORE: 1
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // 載入餐廳
      const restaurantData = await restaurantService.getRestaurants();
      setRestaurants(restaurantData || []);

      // 載入趣味問題
      const funQuestionsData = await getFunQuestions();
      // 轉換為相容的格式
      const formattedQuestions = funQuestionsData.map(q => ({
        question: q.question || q.text,
        options: [q.leftOption, q.rightOption].filter(Boolean)
      }));
      setFunQuestions(formattedQuestions);
    } catch (error) {
      console.error('載入資料失敗:', error);
      setRestaurants([]);
      setFunQuestions([]);
    }
    setLoading(false);
  };

  const handleFunAnswerToggle = (answer) => {
    setFunAnswers(prev => {
      if (prev.includes(answer)) {
        // 取消選擇
        return prev.filter(a => a !== answer);
      } else {
        // 新增選擇（但限制最多3個）
        if (prev.length >= 3) {
          alert('最多只能選擇 3 個趣味問題');
          return prev;
        }
        return [...prev, answer];
      }
    });
  };

  const calculateScores = async () => {
    setLoading(true);

    // 如果選擇「喝」，不包含分量在基本條件中
    const basicAnswers = mealType === '喝'
      ? [peopleCount, priceRange, mealType, spiciness].filter(Boolean)
      : [peopleCount, priceRange, mealType, fullness, spiciness].filter(Boolean);

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
        const cleanTags = restaurantTags
          .filter(tag => tag !== null && tag !== undefined && tag !== '')
          .map(tag => String(tag || ''))
          .filter(tag => tag.length > 0);

        const funMatchScore = await funQuestionTagService.calculateBatchMatchScore(
          funAnswers,
          cleanTags
        );

        const funScore = funMatchScore * WEIGHT.FUN_MATCH;
        score += funScore;
        scoreBreakdown.fun = funScore;

        // Debug: 顯示趣味匹配詳情
        if (funMatchScore > 0) {
          console.log(`🎯 ${restaurant.name} 趣味匹配: ${funMatchScore.toFixed(3)} × ${WEIGHT.FUN_MATCH} = ${funScore.toFixed(2)}分`, {
            funAnswers,
            restaurantTags: cleanTags
          });
        }
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
          <select value={mealType} onChange={(e) => {
            setMealType(e.target.value);
            // 如果選擇「喝」，自動清空分量選擇
            if (e.target.value === '喝') {
              setFullness('');
            } else if (e.target.value === '吃' && !fullness) {
              // 如果選擇「吃」但沒有分量，預設選擇「吃飽」
              setFullness('吃飽');
            }
          }}>
            <option value="吃">吃</option>
            <option value="喝">喝</option>
          </select>
        </div>

        <div className="control-group">
          <label>分量</label>
          <select
            value={fullness}
            onChange={(e) => setFullness(e.target.value)}
            disabled={mealType === '喝'}
            style={{ opacity: mealType === '喝' ? 0.5 : 1 }}
          >
            <option value="">無（喝不需要分量）</option>
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
        <h3>趣味問題（最多選擇 3 個答案，已選 {funAnswers.length}/3）</h3>
        {loading && funQuestions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
            載入趣味問題中...
          </div>
        ) : funQuestions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
            無趣味問題資料
          </div>
        ) : (
          <div className="fun-questions-grid">
            {funQuestions.map((q, idx) => (
              <div key={idx} className="fun-question-group">
                <label>{q.question}</label>
                <div className="fun-options">
                  {q.options.map(option => (
                    <button
                      key={option}
                      className={`fun-option ${funAnswers.includes(option) ? 'selected' : ''}`}
                      onClick={() => handleFunAnswerToggle(option)}
                      disabled={!funAnswers.includes(option) && funAnswers.length >= 3}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
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
