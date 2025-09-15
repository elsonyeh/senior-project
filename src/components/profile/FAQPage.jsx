import React, { useState } from 'react';
import { IoChevronDownOutline, IoChevronUpOutline } from 'react-icons/io5';
import './FAQPage.css';

export default function FAQPage() {
  const [expandedItems, setExpandedItems] = useState(new Set());

  const faqData = [
    {
      id: 1,
      question: '什麼是 TasteBuddies？',
      answer: 'TasteBuddies 是一個智能美食推薦平台，透過您的喜好和位置，快速為您推薦最適合的餐廳。我們致力於讓您的用餐選擇更加輕鬆愉快。'
    },
    {
      id: 2,
      question: '如何開始使用 TasteBuddies？',
      answer: '非常簡單！只需要註冊一個帳號，然後允許位置權限，我們就會根據您的位置推薦附近的優質餐廳。您也可以設定飲食偏好來獲得更精準的推薦。'
    },
    {
      id: 3,
      question: '推薦算法是如何運作的？',
      answer: 'TasteBuddies 使用先進的機器學習算法，結合您的歷史偏好、位置資訊、餐廳評分、以及其他用戶的反饋來生成個人化推薦。我們持續優化算法以提供更準確的建議。'
    },
    {
      id: 4,
      question: '可以和朋友一起使用嗎？',
      answer: '當然可以！我們提供 Buddies 模式，您可以創建房間邀請朋友加入，一起回答偏好問題，系統會根據所有使用者的喜好找出大家都滿意的餐廳選擇。'
    },
    {
      id: 5,
      question: '我的個人資料安全嗎？',
      answer: '我們非常重視您的隱私安全。所有個人資料都會加密儲存，我們不會將您的資料分享給第三方。您可以隨時查看、修改或刪除您的個人資料。'
    },
    {
      id: 6,
      question: '如何收藏喜愛的餐廳？',
      answer: '登入後，您可以在餐廳詳情頁面點擊愛心圖示來收藏餐廳。收藏的餐廳會保存在「我的清單」中，方便您日後查看和管理。'
    },
    {
      id: 7,
      question: '推薦結果不滿意怎麼辦？',
      answer: '您可以透過反饋機制告訴我們推薦結果的問題，這會幫助我們改善算法。同時，您也可以調整個人偏好設定，或重新進行推薦來獲得不同的結果。'
    },
    {
      id: 8,
      question: '是否需要付費使用？',
      answer: 'TasteBuddies 的基本功能完全免費！包括餐廳推薦、收藏清單、多人模式等。我們致力於為所有用戶提供優質的美食探索體驗。'
    }
  ];

  const toggleExpand = (itemId) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  return (
    <div className="faq-content">
      <div className="faq-intro">
        <h2 className="faq-title">常見問題</h2>
        <p className="faq-description">
          以下是用戶最常詢問的問題，希望能幫助您更好地使用 TasteBuddies
        </p>
      </div>

      <div className="faq-list">
        {faqData.map((item) => (
          <div key={item.id} className="faq-item">
            <button
              className="faq-question"
              onClick={() => toggleExpand(item.id)}
            >
              <span className="faq-question-text">{item.question}</span>
              <span className="expand-icon">
                {expandedItems.has(item.id) ? (
                  <IoChevronUpOutline />
                ) : (
                  <IoChevronDownOutline />
                )}
              </span>
            </button>
            
            {expandedItems.has(item.id) && (
              <div className="faq-answer">
                <p>{item.answer}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="faq-footer">
        <p>找不到您需要的答案？</p>
        <p>歡迎透過「聯絡客服」與我們聯繫，我們很樂意為您解答！</p>
      </div>
    </div>
  );
}