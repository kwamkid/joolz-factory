'use client';

import { useState, useEffect, useRef } from 'react';
import Layout from '@/components/layout/Layout';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { supabase } from '@/lib/supabase';
import { THAI_BANKS, getBankByCode } from '@/lib/constants/banks';
import { BEAM_CHANNELS, BEAM_CHANNEL_CATEGORIES, CUSTOMER_TYPES, FEE_PAYERS } from '@/lib/constants/payment-gateway';
import {
  CreditCard, Banknote, Building2, Globe, Loader2, Plus, Edit2, Trash2, Check, X,
  Eye, EyeOff, ChevronDown, ChevronUp, Save
} from 'lucide-react';

// Types
interface PaymentChannel {
  id: string;
  channel_group: string;
  type: string;
  name: string;
  is_active: boolean;
  sort_order: number;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface GatewayChannelConfig {
  enabled: boolean;
  min_amount: number;
  customer_types: string[];
  fee_payer: string;
}

// Toggle component
function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors ${
        checked ? 'bg-[#E9B308]' : 'bg-gray-300'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
        checked ? 'translate-x-5' : 'translate-x-0'
      }`} />
    </button>
  );
}

export default function PaymentChannelsPage() {
  const { userProfile } = useAuth();
  const { showToast } = useToast();

  // Data
  const [channels, setChannels] = useState<PaymentChannel[]>([]);
  const [loading, setLoading] = useState(true);

  // Derived
  const cashChannel = channels.find(c => c.type === 'cash');
  const bankAccounts = channels.filter(c => c.type === 'bank_transfer');
  const gatewayChannel = channels.find(c => c.type === 'payment_gateway');

  // Bank form state
  const [showBankForm, setShowBankForm] = useState(false);
  const [editingBankId, setEditingBankId] = useState<string | null>(null);
  const [bankForm, setBankForm] = useState({ bank_code: '', account_number: '', account_name: '' });
  const [savingBank, setSavingBank] = useState(false);
  const [bankDropdownOpen, setBankDropdownOpen] = useState(false);
  const bankDropdownRef = useRef<HTMLDivElement>(null);

  // Gateway form state
  const [gatewayForm, setGatewayForm] = useState({ merchant_id: '', api_key: '', environment: 'sandbox' as 'sandbox' | 'production' });
  const [showApiKey, setShowApiKey] = useState(false);
  const [savingGateway, setSavingGateway] = useState(false);
  const [gatewayChannels, setGatewayChannels] = useState<Record<string, GatewayChannelConfig>>({});
  const [savingGatewayChannels, setSavingGatewayChannels] = useState(false);
  const [expandedChannel, setExpandedChannel] = useState<string | null>(null);

  // Tab
  const [activeTab] = useState<'bill_online' | 'pos'>('bill_online');

  // Fetch data
  const fetchChannels = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`/api/settings/payment-channels?group=${activeTab}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });

      if (!response.ok) throw new Error('Failed to fetch');
      const result = await response.json();
      setChannels(result.data || []);

      // Populate gateway form if exists
      const gw = (result.data || []).find((c: PaymentChannel) => c.type === 'payment_gateway');
      if (gw) {
        const cfg = gw.config as Record<string, unknown>;
        setGatewayForm({
          merchant_id: (cfg.merchant_id as string) || '',
          api_key: (cfg.api_key as string) || '',
          environment: (cfg.environment as 'sandbox' | 'production') || 'sandbox',
        });
        setGatewayChannels((cfg.channels as Record<string, GatewayChannelConfig>) || {});
      }
    } catch (error) {
      console.error('Error fetching channels:', error);
      showToast('โหลดข้อมูลไม่สำเร็จ', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userProfile?.role === 'admin') {
      fetchChannels();
    }
  }, [userProfile]);

  // Close bank dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (bankDropdownRef.current && !bankDropdownRef.current.contains(e.target as Node)) {
        setBankDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Helper: API call
  const apiCall = async (method: string, body?: unknown, query?: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('No session');

    const url = `/api/settings/payment-channels${query || ''}`;
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Request failed');
    }
    return response.json();
  };

  // === CASH TOGGLE ===
  const handleCashToggle = async (active: boolean) => {
    if (!cashChannel) return;
    try {
      await apiCall('PUT', { id: cashChannel.id, is_active: active });
      setChannels(prev => prev.map(c => c.id === cashChannel.id ? { ...c, is_active: active } : c));
      showToast(active ? 'เปิดรับเงินสดแล้ว' : 'ปิดรับเงินสดแล้ว');
    } catch {
      showToast('บันทึกไม่สำเร็จ', 'error');
    }
  };

  // === BANK ACCOUNT CRUD ===
  const resetBankForm = () => {
    setBankForm({ bank_code: '', account_number: '', account_name: '' });
    setShowBankForm(false);
    setEditingBankId(null);
  };

  const handleSaveBank = async () => {
    if (!bankForm.bank_code || !bankForm.account_number.trim() || !bankForm.account_name.trim()) {
      showToast('กรุณากรอกข้อมูลให้ครบ', 'error');
      return;
    }
    setSavingBank(true);
    try {
      const bank = getBankByCode(bankForm.bank_code);
      if (editingBankId) {
        await apiCall('PUT', {
          id: editingBankId,
          name: bank?.name_th || bankForm.bank_code,
          config: bankForm,
        });
        showToast('แก้ไขบัญชีสำเร็จ');
      } else {
        await apiCall('POST', {
          type: 'bank_transfer',
          name: bank?.name_th || bankForm.bank_code,
          config: bankForm,
        });
        showToast('เพิ่มบัญชีสำเร็จ');
      }
      resetBankForm();
      fetchChannels();
    } catch (err) {
      showToast((err as Error).message || 'บันทึกไม่สำเร็จ', 'error');
    } finally {
      setSavingBank(false);
    }
  };

  const handleEditBank = (channel: PaymentChannel) => {
    const cfg = channel.config as Record<string, string>;
    setBankForm({
      bank_code: cfg.bank_code || '',
      account_number: cfg.account_number || '',
      account_name: cfg.account_name || '',
    });
    setEditingBankId(channel.id);
    setShowBankForm(true);
  };

  const handleDeleteBank = async (id: string, name: string) => {
    if (!confirm(`ลบบัญชี "${name}" หรือไม่?`)) return;
    try {
      await apiCall('DELETE', undefined, `?id=${id}`);
      showToast('ลบบัญชีสำเร็จ');
      fetchChannels();
    } catch {
      showToast('ลบไม่สำเร็จ', 'error');
    }
  };

  // === GATEWAY CONFIG ===
  const handleSaveGateway = async () => {
    if (!gatewayForm.merchant_id.trim() || !gatewayForm.api_key.trim()) {
      showToast('กรุณากรอก Merchant ID และ API Key', 'error');
      return;
    }
    setSavingGateway(true);
    try {
      const config = {
        merchant_id: gatewayForm.merchant_id.trim(),
        api_key: gatewayForm.api_key.trim(),
        environment: gatewayForm.environment,
        channels: gatewayChannels,
      };

      if (gatewayChannel) {
        await apiCall('PUT', { id: gatewayChannel.id, config });
      } else {
        await apiCall('POST', {
          type: 'payment_gateway',
          name: 'Beam Checkout',
          config,
        });
      }
      showToast('บันทึก API Config สำเร็จ');
      fetchChannels();
    } catch (err) {
      showToast((err as Error).message || 'บันทึกไม่สำเร็จ', 'error');
    } finally {
      setSavingGateway(false);
    }
  };

  const handleToggleBeamChannel = (code: string, enabled: boolean) => {
    setGatewayChannels(prev => ({
      ...prev,
      [code]: {
        ...(prev[code] || { min_amount: 0, customer_types: ['retail', 'wholesale', 'distributor'], fee_payer: 'merchant' }),
        enabled,
      },
    }));
  };

  const handleUpdateBeamChannel = (code: string, field: string, value: unknown) => {
    setGatewayChannels(prev => ({
      ...prev,
      [code]: { ...prev[code], [field]: value },
    }));
  };

  const handleSaveGatewayChannels = async () => {
    if (!gatewayChannel) {
      showToast('กรุณาบันทึก API Config ก่อน', 'error');
      return;
    }
    setSavingGatewayChannels(true);
    try {
      const config = {
        ...(gatewayChannel.config as Record<string, unknown>),
        channels: gatewayChannels,
      };
      await apiCall('PUT', { id: gatewayChannel.id, config });
      showToast('บันทึกช่องทางสำเร็จ');
      fetchChannels();
    } catch {
      showToast('บันทึกไม่สำเร็จ', 'error');
    } finally {
      setSavingGatewayChannels(false);
    }
  };

  // Admin guard
  if (userProfile && userProfile.role !== 'admin') {
    return (
      <Layout title="ช่องทางชำระเงิน">
        <div className="text-center py-16 text-gray-500">ไม่มีสิทธิ์เข้าถึงหน้านี้</div>
      </Layout>
    );
  }

  // Group beam channels by category
  const channelsByCategory = BEAM_CHANNELS.reduce((acc, ch) => {
    if (!acc[ch.category]) acc[ch.category] = [];
    acc[ch.category].push(ch);
    return acc;
  }, {} as Record<string, typeof BEAM_CHANNELS>);

  return (
    <Layout
      title="ช่องทางชำระเงิน"
      breadcrumbs={[
        { label: 'ตั้งค่าระบบ', href: '/settings' },
        { label: 'ช่องทางชำระเงิน' },
      ]}
    >
      <div className="max-w-4xl">
        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          <button
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'bill_online'
                ? 'border-[#E9B308] text-[#00231F]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Bill Online
          </button>
          <button
            disabled
            className="px-4 py-2.5 text-sm font-medium border-b-2 border-transparent text-gray-300 cursor-not-allowed"
          >
            POS (เร็วๆ นี้)
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-[#E9B308] animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* === Section 1: เงินสด === */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <Banknote className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">เงินสด</h3>
                    <p className="text-sm text-gray-500">รับเงินสดจากลูกค้า / จ่ายหน้าร้าน</p>
                  </div>
                </div>
                <Toggle
                  checked={cashChannel?.is_active || false}
                  onChange={handleCashToggle}
                />
              </div>
            </div>

            {/* === Section 2: โอนธนาคาร === */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">โอนธนาคาร</h3>
                    <p className="text-sm text-gray-500">บัญชีธนาคารสำหรับรับโอน</p>
                  </div>
                </div>
              </div>

              <div className="p-4 space-y-3">
                {/* Bank list */}
                {bankAccounts.map(account => {
                  const cfg = account.config as Record<string, string>;
                  const bank = getBankByCode(cfg.bank_code);
                  return (
                    <div key={account.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      {bank?.logo ? (
                        <img src={bank.logo} alt={bank.name_th} className="w-8 h-8 rounded-full flex-shrink-0 object-contain" />
                      ) : (
                        <span
                          className="w-8 h-8 rounded-full flex-shrink-0"
                          style={{ backgroundColor: bank?.color || '#999' }}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 text-sm">{bank?.name_th || cfg.bank_code}</div>
                        <div className="text-xs text-gray-500">
                          {cfg.account_number} • {cfg.account_name}
                        </div>
                      </div>
                      <button
                        onClick={() => handleEditBank(account)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteBank(account.id, bank?.name_th || cfg.bank_code)}
                        className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}

                {/* Bank form */}
                {showBankForm ? (
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
                    <div className="text-sm font-medium text-gray-700 mb-2">
                      {editingBankId ? 'แก้ไขบัญชี' : 'เพิ่มบัญชีใหม่'}
                    </div>

                    {/* Bank dropdown */}
                    <div ref={bankDropdownRef} className="relative">
                      <label className="block text-xs text-gray-500 mb-1">ธนาคาร</label>
                      <button
                        type="button"
                        onClick={() => setBankDropdownOpen(!bankDropdownOpen)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-left flex items-center gap-2 bg-white hover:border-gray-400 transition-colors"
                      >
                        {bankForm.bank_code ? (
                          <>
                            {getBankByCode(bankForm.bank_code)?.logo ? (
                              <img src={getBankByCode(bankForm.bank_code)!.logo} alt="" className="w-5 h-5 rounded-full flex-shrink-0 object-contain" />
                            ) : (
                              <span
                                className="w-5 h-5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: getBankByCode(bankForm.bank_code)?.color }}
                              />
                            )}
                            <span className="text-sm">{getBankByCode(bankForm.bank_code)?.name_th}</span>
                          </>
                        ) : (
                          <span className="text-sm text-gray-400">เลือกธนาคาร</span>
                        )}
                        <ChevronDown className="w-4 h-4 ml-auto text-gray-400" />
                      </button>
                      {bankDropdownOpen && (
                        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                          {THAI_BANKS.map(bank => (
                            <button
                              key={bank.code}
                              type="button"
                              onClick={() => {
                                setBankForm(prev => ({ ...prev, bank_code: bank.code }));
                                setBankDropdownOpen(false);
                              }}
                              className={`w-full px-3 py-2 flex items-center gap-2 hover:bg-gray-50 transition-colors text-left ${
                                bankForm.bank_code === bank.code ? 'bg-[#E9B308]/10' : ''
                              }`}
                            >
                              {bank.logo ? (
                                <img src={bank.logo} alt={bank.name_th} className="w-5 h-5 rounded-full flex-shrink-0 object-contain" />
                              ) : (
                                <span
                                  className="w-5 h-5 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: bank.color }}
                                />
                              )}
                              <span className="text-sm">{bank.name_th}</span>
                              <span className="text-xs text-gray-400 ml-auto">{bank.code}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Account number */}
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">เลขที่บัญชี</label>
                      <input
                        type="text"
                        value={bankForm.account_number}
                        onChange={e => setBankForm(prev => ({ ...prev, account_number: e.target.value }))}
                        placeholder="xxx-x-xxxxx-x"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#E9B308]/50 focus:border-[#E9B308]"
                      />
                    </div>

                    {/* Account name */}
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">ชื่อบัญชี</label>
                      <input
                        type="text"
                        value={bankForm.account_name}
                        onChange={e => setBankForm(prev => ({ ...prev, account_name: e.target.value }))}
                        placeholder="ชื่อ-สกุล หรือ ชื่อบริษัท"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#E9B308]/50 focus:border-[#E9B308]"
                      />
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={handleSaveBank}
                        disabled={savingBank}
                        className="px-4 py-2 bg-[#E9B308] hover:bg-[#D4A307] text-[#00231F] text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        {savingBank ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        บันทึก
                      </button>
                      <button
                        onClick={resetBankForm}
                        className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                      >
                        <X className="w-4 h-4" />
                        ยกเลิก
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => { resetBankForm(); setShowBankForm(true); }}
                    className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-[#E9B308] hover:text-[#E9B308] transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    เพิ่มบัญชีธนาคาร
                  </button>
                )}
              </div>
            </div>

            {/* === Section 3: Payment Gateway === */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Globe className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">Payment Gateway</h3>
                    <p className="text-sm text-gray-500">Beam Checkout — รับชำระผ่านช่องทางออนไลน์</p>
                  </div>
                </div>
              </div>

              <div className="p-4 space-y-4">
                {/* API Config */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-gray-700">API Configuration</h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Merchant ID</label>
                      <input
                        type="text"
                        value={gatewayForm.merchant_id}
                        onChange={e => setGatewayForm(prev => ({ ...prev, merchant_id: e.target.value }))}
                        placeholder="Merchant ID จาก Beam"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#E9B308]/50 focus:border-[#E9B308]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">API Key</label>
                      <div className="relative">
                        <input
                          type={showApiKey ? 'text' : 'password'}
                          value={gatewayForm.api_key}
                          onChange={e => setGatewayForm(prev => ({ ...prev, api_key: e.target.value }))}
                          placeholder="API Key จาก Beam"
                          className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#E9B308]/50 focus:border-[#E9B308]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                        >
                          {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Environment */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Environment</label>
                    <div className="flex gap-2">
                      {(['sandbox', 'production'] as const).map(env => (
                        <button
                          key={env}
                          type="button"
                          onClick={() => setGatewayForm(prev => ({ ...prev, environment: env }))}
                          className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                            gatewayForm.environment === env
                              ? 'border-[#E9B308] bg-[#E9B308]/10 text-[#00231F]'
                              : 'border-gray-200 text-gray-600 hover:border-gray-300'
                          }`}
                        >
                          {env === 'sandbox' ? 'Sandbox (ทดสอบ)' : 'Production (ใช้งานจริง)'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={handleSaveGateway}
                    disabled={savingGateway}
                    className="px-4 py-2 bg-[#E9B308] hover:bg-[#D4A307] text-[#00231F] text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {savingGateway ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    บันทึก API Config
                  </button>
                </div>

                {/* Payment Channels */}
                {(gatewayChannel || gatewayForm.merchant_id) && (
                  <>
                    <hr className="border-gray-200" />
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-gray-700">ช่องทางการชำระเงิน</h4>
                        <button
                          onClick={handleSaveGatewayChannels}
                          disabled={savingGatewayChannels}
                          className="px-3 py-1.5 bg-[#E9B308] hover:bg-[#D4A307] text-[#00231F] text-xs font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
                        >
                          {savingGatewayChannels ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                          บันทึกช่องทาง
                        </button>
                      </div>

                      {Object.entries(channelsByCategory).map(([category, beamChannels]) => (
                        <div key={category}>
                          <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                            {BEAM_CHANNEL_CATEGORIES[category]}
                          </div>
                          <div className="space-y-1">
                            {beamChannels.map(ch => {
                              const chConfig = gatewayChannels[ch.code];
                              const isEnabled = chConfig?.enabled || false;
                              const isExpanded = expandedChannel === ch.code;

                              return (
                                <div key={ch.code} className="border border-gray-100 rounded-lg">
                                  <div className="flex items-center gap-3 px-3 py-2.5">
                                    <Toggle
                                      checked={isEnabled}
                                      onChange={(v) => handleToggleBeamChannel(ch.code, v)}
                                    />
                                    <span className="text-sm text-gray-900 flex-1">{ch.name_th}</span>
                                    {isEnabled && (
                                      <button
                                        type="button"
                                        onClick={() => setExpandedChannel(isExpanded ? null : ch.code)}
                                        className="p-1 text-gray-400 hover:text-gray-600"
                                      >
                                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                      </button>
                                    )}
                                  </div>

                                  {/* Expanded config */}
                                  {isEnabled && isExpanded && (
                                    <div className="px-3 pb-3 pt-1 border-t border-gray-100 space-y-3">
                                      {/* Min amount */}
                                      <div>
                                        <label className="block text-xs text-gray-500 mb-1">ยอดสั่งซื้อขั้นต่ำ (บาท)</label>
                                        <input
                                          type="number"
                                          min="0"
                                          value={chConfig?.min_amount || 0}
                                          onChange={e => handleUpdateBeamChannel(ch.code, 'min_amount', Number(e.target.value))}
                                          className="w-40 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#E9B308]/50 focus:border-[#E9B308]"
                                        />
                                      </div>

                                      {/* Customer types */}
                                      <div>
                                        <label className="block text-xs text-gray-500 mb-1">ประเภทลูกค้าที่ใช้ได้</label>
                                        <div className="flex gap-3">
                                          {CUSTOMER_TYPES.map(ct => {
                                            const types = chConfig?.customer_types || ['retail', 'wholesale', 'distributor'];
                                            const checked = types.includes(ct.value);
                                            return (
                                              <label key={ct.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                                                <input
                                                  type="checkbox"
                                                  checked={checked}
                                                  onChange={() => {
                                                    const newTypes = checked
                                                      ? types.filter((t: string) => t !== ct.value)
                                                      : [...types, ct.value];
                                                    handleUpdateBeamChannel(ch.code, 'customer_types', newTypes);
                                                  }}
                                                  className="rounded border-gray-300 text-[#E9B308] focus:ring-[#E9B308]"
                                                />
                                                {ct.label}
                                              </label>
                                            );
                                          })}
                                        </div>
                                      </div>

                                      {/* Fee payer */}
                                      <div>
                                        <label className="block text-xs text-gray-500 mb-1">ผู้รับผิดชอบค่าธรรมเนียม</label>
                                        <div className="flex gap-3">
                                          {FEE_PAYERS.map(fp => (
                                            <label key={fp.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                                              <input
                                                type="radio"
                                                name={`fee_payer_${ch.code}`}
                                                checked={(chConfig?.fee_payer || 'merchant') === fp.value}
                                                onChange={() => handleUpdateBeamChannel(ch.code, 'fee_payer', fp.value)}
                                                className="border-gray-300 text-[#E9B308] focus:ring-[#E9B308]"
                                              />
                                              {fp.label}
                                            </label>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
