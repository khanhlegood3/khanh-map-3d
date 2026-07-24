export type Lang = 'en' | 'vi';
export type Language = Lang;

const translations: Record<Lang, Record<string, string>> = {
  en: {
    'download_pdf': 'Download PDF',
    'game_simulation': 'Body Organ Protection Simulation',
    'history_log': 'History Log',
    'health_score': 'Health Score',
    'simulation_duration': 'Simulation Duration',
    'referrals_overlay': 'Referrals Overlay',
    'pins': 'Pins',
    'heat_dots': 'Heat Dots',
    'cinematic_curved_fly': 'Cinematic Curved Fly',
    'auto_rotate_camera': 'Auto-Rotate Camera',
    'show_location_labels': 'Show Location Labels',
    'label_style': 'Label Style',
    'simple': 'Simple',
    'bubble': 'Bubble',
    'minimalist': 'Minimalist',
  },
  vi: {
    'download_pdf': 'Tải PDF',
    'game_simulation': 'Game Mô Phỏng Bảo Vệ Nội Tạng',
    'history_log': 'Nhật ký',
    'health_score': 'Điểm Sức khỏe',
    'simulation_duration': 'Thời gian mô phỏng',
    'referrals_overlay': 'Lớp phủ giới thiệu',
    'pins': 'Ghim',
    'heat_dots': 'Điểm nhiệt',
    'cinematic_curved_fly': 'Bay lượn điện ảnh',
    'auto_rotate_camera': 'Tự động xoay camera',
    'show_location_labels': 'Hiện nhãn vị trí',
    'label_style': 'Kiểu nhãn',
    'simple': 'Đơn giản',
    'bubble': 'Bong bóng',
    'minimalist': 'Tối giản',
  }
};

class I18n {
  private _lang: Lang = 'vi'; // Mặc định là Tiếng Việt
  private _listeners: (() => void)[] = [];

  get lang() { return this._lang; }
  set lang(l: Lang) {
    this._lang = l;
    this._listeners.forEach(l => l());
  }

  t(key: string): string {
    return translations[this._lang][key] || key;
  }

  subscribe(listener: () => void) {
    this._listeners.push(listener);
  }
}

export const i18n = new I18n();
export const t = (key: string) => i18n.t(key);
export const setLanguage = (l: Lang) => i18n.lang = l;
export const getLanguage = () => i18n.lang;
