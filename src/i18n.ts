export type Language = 'en' | 'vi';

const translations = {
  en: {
    back: '← Back',
    continue: 'Continue',
    analysisTitle: 'Need Detailed Analysis on Specific',
    analysisSubtitle: 'This tool helps you understand your options. It never replaces professional medical advice.',
    question1: 'How would you describe the pain or discomfort?',
    options1: ['Sharp and sudden', 'Dull and constant', 'Throbbing or pulsing', 'Burning or tingling'],
    question2: 'How long has this been going on?',
    options2: ['Just started (today)', 'A few days', 'About a week', 'More than 2 weeks'],
    question3: 'How would you rate the severity?',
    options3: ['Mild — barely noticeable', 'Moderate — noticeable but manageable', 'Severe — hard to ignore', 'Very severe — interferes with daily life'],
    summary: 'Summary',
    pain: 'Pain',
    duration: 'Duration',
    severity: 'Severity',
    specialists: 'Possible specialists',
    startOver: 'Start over',
    selectArea: 'Select an area',
    continueDetail: 'Continue to Detailed Check',
    selectSection: 'Select a section',
    enterFullscreen: 'Enter Fullscreen',
    exitFullscreen: 'Exit Fullscreen',
    saveToSavedPlaces: 'Save to Saved Places',
    removeFromSavedPlaces: 'Remove from Saved Places',
    flyCameraHere: 'Fly camera here',
    remove: 'Remove',
    confirmReset: 'Are you sure you want to reset all referral history and re-generate your referral code?',
    emailAlertSent: 'Simulated email alert sent successfully to',
    orthopedist: 'Orthopedist',
    generalPractitioner: 'General Practitioner'
  },
  vi: {
    back: '← Quay lại',
    continue: 'Tiếp tục',
    analysisTitle: 'Cần Phân Tích Chi Tiết Cụ Thể',
    analysisSubtitle: 'Công cụ này giúp bạn hiểu các lựa chọn của mình. Nó không bao giờ thay thế lời khuyên y tế chuyên nghiệp.',
    question1: 'Bạn mô tả cơn đau hoặc sự khó chịu như thế nào?',
    options1: ['Đau nhói và đột ngột', 'Đau âm ỉ và liên tục', 'Đau nhức hoặc co thắt', 'Đau rát hoặc tê bì'],
    question2: 'Tình trạng này đã diễn ra bao lâu rồi?',
    options2: ['Mới bắt đầu (hôm nay)', 'Vài ngày', 'Khoảng một tuần', 'Hơn 2 tuần'],
    question3: 'Bạn đánh giá mức độ nghiêm trọng như thế nào?',
    options3: ['Nhẹ — hầu như không nhận thấy', 'Trung bình — có thể nhận thấy nhưng vẫn chịu được', 'Nặng — khó mà bỏ qua', 'Rất nặng — ảnh hưởng đến cuộc sống hàng ngày'],
    summary: 'Tóm tắt',
    pain: 'Cơn đau',
    duration: 'Thời gian',
    severity: 'Mức độ',
    specialists: 'Chuyên gia có thể',
    startOver: 'Bắt đầu lại',
    selectArea: 'Chọn một khu vực',
    continueDetail: 'Tiếp tục Kiểm tra Chi tiết',
    selectSection: 'Chọn một phần',
    enterFullscreen: 'Xem toàn màn hình',
    exitFullscreen: 'Thoát toàn màn hình',
    saveToSavedPlaces: 'Lưu vào Địa điểm đã lưu',
    removeFromSavedPlaces: 'Xóa khỏi Địa điểm đã lưu',
    flyCameraHere: 'Bay đến đây',
    remove: 'Xóa',
    confirmReset: 'Bạn có chắc chắn muốn đặt lại toàn bộ lịch sử giới thiệu và tạo lại mã giới thiệu không?',
    emailAlertSent: 'Thông báo email mô phỏng đã được gửi thành công đến',
    orthopedist: 'Bác sĩ chấn thương chỉnh hình',
    generalPractitioner: 'Bác sĩ đa khoa'
  }
};

let currentLang: Language = 'vi';

export function setLanguage(lang: Language) {
  currentLang = lang;
  window.dispatchEvent(new CustomEvent('language-changed', { detail: lang }));
}

export function getLanguage(): Language {
  return currentLang;
}

export function t(key: keyof typeof translations.en): any {
  return translations[currentLang][key];
}
