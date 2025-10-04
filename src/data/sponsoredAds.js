// 贊助商廣告資料
export const sponsoredAds = [
  {
    id: 1,
    name: '快樂腳養生館',
    tagline: '疲憊一天？來場專業足體按摩，徹底放鬆！',
    image: '/ads/快樂腳養生館.png',
    category: '按摩養生'
  },
  {
    id: 2,
    name: '新和泰',
    tagline: '找新包包嗎？多款時尚配件等你挑！',
    image: '/ads/新和泰.png',
    category: '時尚配件'
  },
  {
    id: 3,
    name: '樂福日照中心',
    tagline: '擔心長輩日照照護？這裡給家人最貼心的安心服務。',
    image: '/ads/樂福日照中心.png',
    category: '長照服務'
  },
  {
    id: 4,
    name: '港都春天鐘錶',
    tagline: '喜歡名錶？經典設計與專業維修一站滿足！',
    image: '/ads/港都春天鐘錶.png',
    category: '鐘錶'
  },
  {
    id: 5,
    name: '健智美藥局',
    tagline: '想找可靠藥局？社區首選，健康生活好幫手。',
    image: '/ads/健智美藥局.png',
    category: '藥局'
  },
  {
    id: 6,
    name: 'LIKE 萊克青旅',
    tagline: '計畫旅行？舒適青旅結合 Lounge Bar，必住首選！',
    image: '/ads/LIKE 萊克青旅.png',
    category: '住宿'
  },
  {
    id: 7,
    name: '大銘高級腕錶',
    tagline: '追求時尚品味？高級腕錶專賣，格調盡現。',
    image: '/ads/大銘高級腕錶.png',
    category: '鐘錶'
  },
  {
    id: 8,
    name: '張啓華畫室',
    tagline: '想放鬆心靈？沉浸藝術世界，享受繪畫時光。',
    image: '/ads/張啓華畫室.png',
    category: '藝術'
  },
  {
    id: 9,
    name: 'YoKoSo日式按摩',
    tagline: '需要舒壓？正宗日式手法，專業放鬆再充電！',
    image: '/ads/YoKoSo日式按摩.png',
    category: '按摩養生'
  },
  {
    id: 10,
    name: '秝芯旅店駁二館',
    tagline: '要住哪裡？鄰近駁二特區，彩繪旅店超好拍！',
    image: '/ads/秝芯旅店駁二館.png',
    category: '住宿'
  },
  {
    id: 11,
    name: '翰品酒店',
    tagline: '想體驗頂級享受？繽紛夜景與舒適住宿一次擁有！',
    image: '/ads/翰品酒店.png',
    category: '住宿'
  },
  {
    id: 12,
    name: '鹽埕講古',
    tagline: '對在地故事有興趣？走進鹽埕，感受時光記憶！',
    image: '/ads/鹽埕講古.png',
    category: '文化'
  }
];

// 隨機選擇一個廣告
export const getRandomAd = () => {
  const randomIndex = Math.floor(Math.random() * sponsoredAds.length);
  return sponsoredAds[randomIndex];
};
