import React, { useState } from 'react';
import { 
  IoMailOutline, 
  IoCallOutline, 
  IoLocationOutline, 
  IoTimeOutline,
  IoLogoFacebook,
  IoLogoInstagram,
  IoLogoTwitter,
  IoSendOutline
} from 'react-icons/io5';
import './ContactPage.css';

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      // 準備郵件內容
      const emailBody = `
姓名: ${formData.name}
電子郵件: ${formData.email}
主題: ${formData.subject}

訊息內容:
${formData.message}

---
此訊息來自 TasteBuddies 聯絡表單
時間: ${new Date().toLocaleString('zh-TW')}
      `.trim();

      // 使用 mailto 鏈接直接打開用戶的郵件客戶端
      const mailtoLink = `mailto:elson921121@gmail.com?subject=${encodeURIComponent(`[TasteBuddies聯絡] ${formData.subject}`)}&body=${encodeURIComponent(emailBody)}`;

      // 打開郵件客戶端
      window.location.href = mailtoLink;

      // 顯示成功訊息
      setIsSubmitting(false);
      setSubmitStatus('success');
      setFormData({
        name: '',
        email: '',
        subject: '',
        message: ''
      });

      // 清除成功訊息
      setTimeout(() => {
        setSubmitStatus(null);
      }, 5000);

    } catch (error) {
      console.error('發送郵件失敗:', error);
      setIsSubmitting(false);
      setSubmitStatus('error');

      setTimeout(() => {
        setSubmitStatus(null);
      }, 3000);
    }
  };

  const contactInfo = [
    {
      icon: IoMailOutline,
      title: '電子郵件',
      content: 'elson921121@gmail.com',
      description: '我們會在24小時內回覆您'
    },
    {
      icon: IoCallOutline,
      title: '客服專線',
      content: '0988111203',
      description: '週一至週五 09:00-18:00'
    },
    {
      icon: IoLocationOutline,
      title: '公司地址',
      content: '804高雄市鼓山區蓮海路70號',
      description: '國立中山大學'
    },
    {
      icon: IoTimeOutline,
      title: '營業時間',
      content: '週一至週五 09:00-18:00',
      description: '週末及國定假日休息'
    }
  ];

  const socialLinks = [
    { icon: IoLogoFacebook, name: 'Facebook', url: '#' },
    { icon: IoLogoInstagram, name: 'Instagram', url: 'https://www.instagram.com/tttastebuddies?igsh=ZWFrNjU3bjlrMnh1&utm_source=qr' },
    { icon: IoLogoTwitter, name: 'Twitter', url: '#' }
  ];

  return (
    <div className="contact-content">
      <div className="contact-intro">
        <h2 className="contact-title">聯絡我們</h2>
        <p className="contact-description">
          有任何問題或建議？我們很樂意聽取您的意見
        </p>
      </div>

      {/* 聯絡資訊 */}
      <div className="contact-info-grid">
        {contactInfo.map((info, index) => (
          <div key={index} className="contact-info-card">
            <div className="contact-info-icon">
              <info.icon />
            </div>
            <div className="contact-info-content">
              <h3 className="contact-info-title">{info.title}</h3>
              <p className="contact-info-main">{info.content}</p>
              <p className="contact-info-desc">{info.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* 聯絡表單 */}
      <div className="contact-form-section">
        <h3 className="form-section-title">發送訊息</h3>
        <form onSubmit={handleSubmit} className="contact-form">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">姓名 *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="請輸入您的姓名"
                className="form-input"
                required
                disabled={isSubmitting}
              />
            </div>
            <div className="form-group">
              <label className="form-label">電子郵件 *</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="請輸入您的電子郵件"
                className="form-input"
                required
                disabled={isSubmitting}
              />
            </div>
          </div>
          
          <div className="form-group">
            <label className="form-label">主題 *</label>
            <input
              type="text"
              name="subject"
              value={formData.subject}
              onChange={handleInputChange}
              placeholder="請簡述您的問題或建議"
              className="form-input"
              required
              disabled={isSubmitting}
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">訊息內容 *</label>
            <textarea
              name="message"
              value={formData.message}
              onChange={handleInputChange}
              placeholder="請詳細描述您的問題或建議..."
              className="form-textarea"
              rows="5"
              required
              disabled={isSubmitting}
            />
          </div>

          {submitStatus === 'success' && (
            <div className="submit-success">
              <p>✅ 已為您打開郵件應用程式！請確認發送郵件給我們。</p>
            </div>
          )}

          {submitStatus === 'error' && (
            <div className="submit-error">
              <p>❌ 郵件發送失敗，請直接聯絡 elson921121@gmail.com</p>
            </div>
          )}

          <button
            type="submit"
            className={`submit-button ${isSubmitting ? 'submitting' : ''}`}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <div className="loading-spinner"></div>
                發送中...
              </>
            ) : (
              <>
                <IoSendOutline />
                發送訊息
              </>
            )}
          </button>
        </form>
      </div>

      {/* 社群媒體 */}
      <div className="social-section">
        <h3 className="social-title">追蹤我們</h3>
        <div className="social-links">
          {socialLinks.map((social, index) => (
            <a
              key={index}
              href={social.url}
              className="social-link"
              title={social.name}
            >
              <social.icon />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}