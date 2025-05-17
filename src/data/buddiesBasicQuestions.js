// buddiesBasicQuestions.js - Buddies模式使用的基本問題集
// 與單人模式不同，移除了"今天是一個人還是有朋友？"問題

export const buddiesBasicQuestions = [
  {
    "question": "想吃奢華點還是平價？",
    "options": [
      "奢華美食",
      "平價美食"
    ]
  },
  {
    "question": "想吃正餐還是想喝飲料？",
    "options": [
      "吃",
      "喝"
    ]
  },
  {
    "question": "吃一點還是吃飽？",
    "options": [
      "吃一點",
      "吃飽"
    ],
    "dependsOn": {
      "question": "想吃正餐還是想喝飲料？",
      "answer": "吃"
    }
  },
  
  // 暫時停用距離相關問題
  /*
  {
    "question": "附近吃還是遠一點？",
    "options": [
      "附近吃",
      "遠一點"
    ]
  },
  */
  
  {
    "question": "想吃辣的還是不辣？",
    "options": [
      "辣",
      "不辣"
    ],
    "dependsOn": {
      "question": "想吃正餐還是想喝飲料？",
      "answer": "吃"
    }
  }
];