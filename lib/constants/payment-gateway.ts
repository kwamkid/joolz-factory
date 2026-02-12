export interface BeamChannel {
  code: string;
  name_th: string;
  name_en: string;
  category: 'card' | 'qr' | 'ewallet' | 'bank_app' | 'installment';
}

export const BEAM_CHANNELS: BeamChannel[] = [
  { code: 'CARD',              name_th: 'บัตรเครดิต/เดบิต',  name_en: 'Credit/Debit Card', category: 'card' },
  { code: 'QR_PROMPT_PAY',     name_th: 'QR PromptPay',      name_en: 'QR PromptPay',      category: 'qr' },
  { code: 'LINE_PAY',          name_th: 'LINE Pay',           name_en: 'LINE Pay',           category: 'ewallet' },
  { code: 'SHOPEE_PAY',        name_th: 'ShopeePay',          name_en: 'ShopeePay',          category: 'ewallet' },
  { code: 'TRUE_MONEY',        name_th: 'TrueMoney',          name_en: 'TrueMoney',          category: 'ewallet' },
  { code: 'WECHAT_PAY',        name_th: 'WeChat Pay',         name_en: 'WeChat Pay',         category: 'ewallet' },
  { code: 'ALIPAY',            name_th: 'Alipay',             name_en: 'Alipay',             category: 'ewallet' },
  { code: 'CARD_INSTALLMENTS', name_th: 'ผ่อนชำระ',          name_en: 'Card Installments',  category: 'installment' },
  { code: 'BANGKOK_BANK_APP',  name_th: 'Bangkok Bank App',   name_en: 'Bangkok Bank App',   category: 'bank_app' },
  { code: 'KPLUS',             name_th: 'K PLUS',             name_en: 'K PLUS',             category: 'bank_app' },
  { code: 'SCB_EASY',          name_th: 'SCB EASY',           name_en: 'SCB EASY',           category: 'bank_app' },
  { code: 'KRUNGSRI_APP',      name_th: 'Krungsri App',       name_en: 'Krungsri App',       category: 'bank_app' },
];

export const BEAM_CHANNEL_CATEGORIES: Record<string, string> = {
  card: 'บัตรเครดิต/เดบิต',
  qr: 'QR Code',
  ewallet: 'E-Wallet',
  bank_app: 'Mobile Banking',
  installment: 'ผ่อนชำระ',
};

export const CUSTOMER_TYPES = [
  { value: 'retail', label: 'ปลีก' },
  { value: 'wholesale', label: 'ส่ง' },
  { value: 'distributor', label: 'ตัวแทน' },
];

export const FEE_PAYERS = [
  { value: 'merchant', label: 'ร้านค้ารับผิดชอบ' },
  { value: 'customer', label: 'ลูกค้ารับผิดชอบ' },
];
