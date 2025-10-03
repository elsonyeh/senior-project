import React from 'react';
import { 
  IoRestaurantOutline, 
  IoPeopleOutline, 
  IoFlashOutline, 
  IoHeartOutline,
  IoTrophyOutline,
  IoStarOutline,
  IoRocketOutline,
  IoShieldCheckmarkOutline
} from 'react-icons/io5';
import './AboutPage.css';

export default function AboutPage() {
  const features = [
    {
      icon: IoFlashOutline,
      title: '智能推薦',
      description: '運用先進AI算法，根據您的喜好提供精準餐廳推薦'
    },
    {
      icon: IoPeopleOutline,
      title: '多人協作',
      description: 'Buddies模式讓您與朋友一起找到大家都滿意的用餐選擇'
    },
    {
      icon: IoHeartOutline,
      title: '個人收藏',
      description: '建立專屬清單，收藏您喜愛的餐廳，隨時查看'
    },
    {
      icon: IoShieldCheckmarkOutline,
      title: '隱私安全',
      description: '嚴格保護用戶隱私，所有資料都經過加密處理'
    }
  ];

  const teamMembers = [
    {
      name: '李小姐',
      position: '行銷合作窗口',
      description: '跨域溝通社會觀察家，負責商業合作與行銷推廣'
    },
    {
      name: '葉技術長',
      position: 'CTO',
      description: '跨域全端開發者，網址的架設者'
    },
    {
      name: '林設計師',
      position: '首席設計師',
      description: 'UX/UI專家，打造精美的使用者介面'
    }
  ];

  return (
    <div className="about-content">
      <div className="about-intro">
        <h2 className="about-title">關於 TasteBuddies</h2>
        <p className="about-description">
          讓每一次用餐選擇都變得簡單而愉快
        </p>
      </div>

      {/* 品牌故事 */}
      <div className="story-section">
        <h3 className="section-title">我們的故事</h3>
        <div className="story-content">
          <p>
            TasteBuddies 誕生於一個簡單的想法：「為什麼選擇餐廳總是這麼困難？」
          </p>
          <p>
            創辦團隊在無數次「今天吃什麼？」的討論中，發現了一個普遍存在的問題 - 
            面對眾多餐廳選擇，人們往往感到迷茫和猶豫。特別是和朋友聚餐時，
            要找到大家都滿意的餐廳更是一大挑戰。
          </p>
          <p>
            於是，我們決定運用科技的力量來解決這個問題。透過智能推薦算法
            和創新的多人協作模式，TasteBuddies 讓用餐選擇變得輕鬆、快速且令人滿意。
          </p>
        </div>
      </div>

      {/* 核心功能 */}
      <div className="features-section">
        <h3 className="section-title">核心功能</h3>
        <div className="features-grid">
          {features.map((feature, index) => (
            <div key={index} className="feature-card">
              <div className="feature-icon">
                <feature.icon />
              </div>
              <h4 className="feature-title">{feature.title}</h4>
              <p className="feature-description">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 團隊介紹 */}
      <div className="team-section">
        <h3 className="section-title">核心團隊</h3>
        <div className="team-grid">
          {teamMembers.map((member, index) => (
            <div key={index} className="team-card">
              <div className="member-avatar">
                {member.name.charAt(0)}
              </div>
              <h4 className="member-name">{member.name}</h4>
              <p className="member-position">{member.position}</p>
              <p className="member-description">{member.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 使命願景 */}
      <div className="mission-section">
        <div className="mission-card">
          <div className="mission-icon">
            <IoRocketOutline />
          </div>
          <h3 className="mission-title">我們的使命</h3>
          <p className="mission-description">
            透過智能科技，讓每個人都能輕鬆找到心儀的美食，
            享受更美好的用餐體驗，創造更多美好回憶。
          </p>
        </div>
      </div>

      {/* 聯繫資訊 */}
      <div className="contact-cta">
        <h3 className="cta-title">加入 TasteBuddies 大家庭</h3>
        <p className="cta-description">
          如果您是餐廳業者，歡迎與我們合作；
          如果您有任何建議，歡迎隨時聯繫我們。
        </p>
        <p className="cta-email">
          商務合作：<a href="mailto:elson921121@gmail.com">elson921121@gmail.com</a>
        </p>
      </div>
    </div>
  );
}