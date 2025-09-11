// 修復 RecommendationResult.jsx 的 backgroundImage 語法錯誤
const fs = require('fs');
const content = fs.readFileSync('src/components/RecommendationResult.jsx', 'utf8');
const fixed = content.replace(
  'backgroundImage: linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.7)), url(),',
  'backgroundImage: linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.7)), url(),'
);
fs.writeFileSync('src/components/RecommendationResult.jsx', fixed);
console.log(' 修復完成');
