'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Layout from '@/components/layout/Layout';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft,
  Loader2,
  Calendar,
  User,
  Package,
  DollarSign,
  MapPin,
  FileText,
  Truck,
  CheckCircle,
  Clock,
  XCircle,
  Edit,
  Printer,
  Save
} from 'lucide-react';

// Interfaces
interface Customer {
  id: string;
  customer_code: string;
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
}

interface OrderItemShipment {
  id: string;
  shipping_address_id: string;
  quantity: number;
  delivery_status: string;
  delivery_date?: string;
  received_date?: string;
  delivery_notes?: string;
  shipping_address: {
    id: string;
    address_name: string;
    contact_person?: string;
    phone?: string;
    address_line1: string;
    district?: string;
    amphoe?: string;
    province: string;
    postal_code?: string;
  };
}

interface OrderItem {
  id: string;
  variation_id: string;
  sellable_product_id: string;
  product_code: string;
  product_name: string;
  bottle_size?: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  discount_amount: number;
  subtotal: number;
  total: number;
  shipments: OrderItemShipment[];
}

interface PaymentRecord {
  id: string;
  order_id: string;
  payment_method: string;
  payment_date: string;
  amount: number;
  collected_by?: string;
  transfer_date?: string;
  transfer_time?: string;
  notes?: string;
}

interface Order {
  id: string;
  order_number: string;
  order_date: string;
  delivery_date?: string;
  total_amount: number;
  subtotal: number;
  payment_status: string;
  order_status: string;
  payment_method?: string;
  notes?: string;
  internal_notes?: string;
  vat_amount: number;
  discount_amount: number;
  shipping_fee: number;
  customer: Customer;
  items: OrderItem[];
}

// Status badge components
function OrderStatusBadge({ status }: { status: string }) {
  const statusConfig = {
    new: { label: 'ใหม่', color: 'bg-blue-100 text-blue-700', icon: FileText },
    shipping: { label: 'กำลังส่ง', color: 'bg-yellow-100 text-yellow-700', icon: Truck },
    completed: { label: 'สำเร็จ', color: 'bg-green-100 text-green-700', icon: CheckCircle },
    cancelled: { label: 'ยกเลิก', color: 'bg-red-100 text-red-700', icon: XCircle }
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.new;
  const Icon = config.icon;

  return (
    <span className={`px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-1.5 ${config.color}`}>
      <Icon className="w-4 h-4" />
      {config.label}
    </span>
  );
}

function PaymentStatusBadge({ status }: { status: string }) {
  const statusConfig = {
    pending: { label: 'รอชำระ', color: 'bg-orange-100 text-orange-700' },
    paid: { label: 'ชำระแล้ว', color: 'bg-green-100 text-green-700' },
    cancelled: { label: 'ยกเลิก', color: 'bg-red-100 text-red-700' }
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;

  return (
    <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${config.color}`}>
      {config.label}
    </span>
  );
}

function DeliveryStatusBadge({ status }: { status: string }) {
  const statusConfig = {
    pending: { label: 'รอจัดส่ง', color: 'bg-gray-100 text-gray-700' },
    packed: { label: 'แพ็คแล้ว', color: 'bg-blue-100 text-blue-700' },
    shipped: { label: 'ส่งแล้ว', color: 'bg-yellow-100 text-yellow-700' },
    delivered: { label: 'ส่งถึงแล้ว', color: 'bg-green-100 text-green-700' }
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  );
}

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;
  const { userProfile, loading: authLoading } = useAuth();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);

  // Payment record state (for displaying existing payment details)
  const [paymentRecord, setPaymentRecord] = useState<PaymentRecord | null>(null);

  // Temporary state for status changes (before saving)
  const [tempOrderStatus, setTempOrderStatus] = useState('');
  const [tempPaymentStatus, setTempPaymentStatus] = useState('');

  // Payment details state (for when updating payment status to 'paid')
  const [paymentDetails, setPaymentDetails] = useState({
    paymentMethod: 'cash', // cash or transfer
    collectedBy: '', // for cash
    transferDate: '', // for transfer
    transferTime: '', // for transfer
    notes: ''
  });

  // Success/Error modal state
  const [showResultModal, setShowResultModal] = useState(false);
  const [resultMessage, setResultMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (!authLoading && userProfile && orderId) {
      fetchOrder();
    }
  }, [authLoading, userProfile, orderId]);

  const fetchOrder = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('No session');
      }

      const response = await fetch(`/api/orders?id=${orderId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch order');
      }

      const result = await response.json();
      setOrder(result.order);
      // Initialize temp status with current values
      setTempOrderStatus(result.order.order_status);
      setTempPaymentStatus(result.order.payment_status);

      // If order is paid, fetch payment record
      if (result.order.payment_status === 'paid') {
        await fetchPaymentRecord(session.access_token);
      }
    } catch (error) {
      console.error('Error fetching order:', error);
      setError('ไม่สามารถโหลดข้อมูลคำสั่งซื้อได้');
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentRecord = async (accessToken: string) => {
    try {
      console.log('Fetching payment record for order:', orderId);
      const response = await fetch(`/api/payment-records?order_id=${orderId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        console.error('Failed to fetch payment record, status:', response.status);
        return;
      }

      const result = await response.json();
      console.log('Payment records result:', result);
      if (result.payment_records && result.payment_records.length > 0) {
        // Get the most recent payment record
        console.log('Setting payment record:', result.payment_records[0]);
        setPaymentRecord(result.payment_records[0]);
      } else {
        console.log('No payment records found');
      }
    } catch (error) {
      console.error('Error fetching payment record:', error);
    }
  };

  const handleCancelOrder = async () => {
    if (!order) return;

    // Confirm cancellation
    if (!confirm('คุณต้องการยกเลิกคำสั่งซื้อนี้ใช่หรือไม่?')) {
      return;
    }

    try {
      setUpdating(true);
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('No session');
      }

      const response = await fetch('/api/orders', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: orderId,
          order_status: 'cancelled'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to cancel order');
      }

      // Update local state
      setOrder({
        ...order,
        order_status: 'cancelled',
        payment_status: 'cancelled'
      });
      setTempOrderStatus('cancelled');
      setTempPaymentStatus('cancelled');

      // Show success modal
      setIsSuccess(true);
      setResultMessage('ยกเลิกคำสั่งซื้อสำเร็จ');
      setShowResultModal(true);
    } catch (error) {
      console.error('Error cancelling order:', error);
      // Show error modal
      setIsSuccess(false);
      setResultMessage('ไม่สามารถยกเลิกคำสั่งซื้อได้ กรุณาลองใหม่อีกครั้ง');
      setShowResultModal(true);
    } finally {
      setUpdating(false);
    }
  };

  const handleSaveStatus = async () => {
    if (!order) return;

    // Check if anything changed
    if (tempOrderStatus === order.order_status && tempPaymentStatus === order.payment_status) {
      return; // Nothing to save
    }

    // If updating payment status to 'paid', validate payment details
    if (tempPaymentStatus === 'paid' && order.payment_status !== 'paid') {
      if (paymentDetails.paymentMethod === 'cash' && !paymentDetails.collectedBy.trim()) {
        alert('กรุณาระบุชื่อคนเก็บเงิน');
        return;
      }
      if (paymentDetails.paymentMethod === 'transfer' && (!paymentDetails.transferDate || !paymentDetails.transferTime)) {
        alert('กรุณาระบุวันที่และเวลาจากสลิป');
        return;
      }
    }

    try {
      setUpdating(true);
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('No session');
      }

      const updateData: any = { id: orderId };

      // Only update fields that changed
      if (tempOrderStatus !== order.order_status) {
        updateData.order_status = tempOrderStatus;
      }
      if (tempPaymentStatus !== order.payment_status) {
        updateData.payment_status = tempPaymentStatus;
      }

      const response = await fetch('/api/orders', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        throw new Error('Failed to update status');
      }

      // If updating payment status to 'paid', create payment record
      if (tempPaymentStatus === 'paid' && order.payment_status !== 'paid') {
        const paymentRecordData = {
          order_id: order.id,
          payment_method: paymentDetails.paymentMethod,
          amount: order.total_amount,
          collected_by: paymentDetails.paymentMethod === 'cash' ? paymentDetails.collectedBy : null,
          transfer_date: paymentDetails.paymentMethod === 'transfer' ? paymentDetails.transferDate : null,
          transfer_time: paymentDetails.paymentMethod === 'transfer' ? paymentDetails.transferTime : null,
          notes: paymentDetails.notes || null
        };

        const paymentResponse = await fetch('/api/payment-records', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(paymentRecordData)
        });

        if (!paymentResponse.ok) {
          const errorData = await paymentResponse.json();
          throw new Error(errorData.error || 'Failed to create payment record');
        }

        // Fetch the newly created payment record to display
        await fetchPaymentRecord(session.access_token);
      }

      // Update local state
      setOrder({
        ...order,
        order_status: tempOrderStatus,
        payment_status: tempPaymentStatus
      });

      // Reset payment details form
      setPaymentDetails({
        paymentMethod: 'cash',
        collectedBy: '',
        transferDate: '',
        transferTime: '',
        notes: ''
      });

      // Show success modal
      setIsSuccess(true);
      setResultMessage('บันทึกสถานะสำเร็จ');
      setShowResultModal(true);
    } catch (error) {
      console.error('Error updating status:', error);
      // Show error modal
      setIsSuccess(false);
      setResultMessage(error instanceof Error ? error.message : 'ไม่สามารถบันทึกสถานะได้ กรุณาลองใหม่อีกครั้ง');
      setShowResultModal(true);
    } finally {
      setUpdating(false);
    }
  };

  // Check if status has changed
  const hasStatusChanged = order && (
    tempOrderStatus !== order.order_status ||
    tempPaymentStatus !== order.payment_status
  );

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 text-[#E9B308] animate-spin" />
        </div>
      </Layout>
    );
  }

  if (error || !order) {
    return (
      <Layout>
        <div className="text-center py-12">
          <div className="text-red-600 mb-4">{error || 'ไม่พบข้อมูลคำสั่งซื้อ'}</div>
          <button
            onClick={() => router.push('/orders')}
            className="text-[#E9B308] hover:underline"
          >
            กลับไปหน้ารายการคำสั่งซื้อ
          </button>
        </div>
      </Layout>
    );
  }

  // Group items by branch (shipping address)
  interface BranchGroup {
    shipping_address_id: string;
    shipping_address: any;
    products: Array<{
      item: OrderItem;
      shipment: OrderItemShipment;
    }>;
  }

  const branchGroups: BranchGroup[] = [];
  order.items.forEach(item => {
    item.shipments.forEach(shipment => {
      let branchGroup = branchGroups.find(bg => bg.shipping_address_id === shipment.shipping_address_id);
      if (!branchGroup) {
        branchGroup = {
          shipping_address_id: shipment.shipping_address_id,
          shipping_address: shipment.shipping_address,
          products: []
        };
        branchGroups.push(branchGroup);
      }
      branchGroup.products.push({ item, shipment });
    });
  });

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/orders')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-gray-600" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{order.order_number}</h1>
              <p className="text-sm text-gray-500 mt-1">
                {new Date(order.order_date).toLocaleDateString('th-TH', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {/* Show Edit button only when order_status is 'new' */}
            {order.order_status === 'new' && (
              <button
                onClick={() => router.push(`/orders/${orderId}/edit`)}
                className="text-gray-600 hover:text-gray-900 px-3 py-2 text-sm flex items-center gap-1.5 transition-colors"
              >
                <Edit className="w-4 h-4" />
                แก้ไขคำสั่งซื้อ
              </button>
            )}

            {/* Show Cancel button when order can't be edited and not already cancelled */}
            {order.order_status !== 'new' && order.order_status !== 'cancelled' && (
              <button
                onClick={handleCancelOrder}
                disabled={updating}
                className="text-red-600 hover:text-red-700 px-3 py-2 text-sm flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" />
                ยกเลิกคำสั่งซื้อ
              </button>
            )}

            <button
              onClick={() => window.open(`/orders/${orderId}/shipping-labels`, '_blank')}
              className="bg-white border-2 border-[#E9B308] text-[#E9B308] px-4 py-2 rounded-lg hover:bg-[#E9B308] hover:text-[#00231F] transition-colors flex items-center gap-2"
            >
              <Printer className="w-5 h-5" />
              พิมพ์ใบปะหน้า
            </button>

            <button
              onClick={() => window.print()}
              className="bg-[#E9B308] text-[#00231F] px-4 py-2 rounded-lg hover:bg-[#d4a307] transition-colors flex items-center gap-2"
            >
              <Printer className="w-5 h-5" />
              พิมพ์
            </button>
          </div>
        </div>

        {/* Status Cards - Editable */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">สถานะ</h2>
            {hasStatusChanged && (
              <button
                onClick={handleSaveStatus}
                disabled={updating}
                className="bg-[#E9B308] text-[#00231F] px-4 py-2 rounded-lg hover:bg-[#d4a307] transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    กำลังบันทึก...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    บันทึก
                  </>
                )}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                สถานะคำสั่งซื้อ
              </label>
              <select
                value={tempOrderStatus}
                onChange={(e) => {
                  setTempOrderStatus(e.target.value);
                  if (e.target.value === 'cancelled') {
                    setTempPaymentStatus('cancelled');
                  }
                }}
                disabled={updating}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="new">ใหม่</option>
                <option value="shipping">กำลังส่ง</option>
                <option value="completed">สำเร็จ</option>
                <option value="cancelled">ยกเลิก</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                สถานะการชำระเงิน
              </label>
              <select
                value={tempPaymentStatus}
                onChange={(e) => setTempPaymentStatus(e.target.value)}
                disabled={updating || tempOrderStatus === 'cancelled'}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="pending">รอชำระ</option>
                <option value="paid">ชำระแล้ว</option>
                {tempOrderStatus === 'cancelled' && <option value="cancelled">ยกเลิก</option>}
              </select>

              {/* Display Payment Record Details (if already paid) */}
              {order.payment_status === 'paid' && paymentRecord && (
                <div className="mt-3 p-2.5 bg-green-50 rounded-lg border border-green-200">
                  <div className="text-sm text-gray-700">
                    {paymentRecord.payment_method === 'cash' && paymentRecord.collected_by && (
                      <span>เงินสด : {paymentRecord.collected_by}</span>
                    )}
                    {paymentRecord.payment_method === 'transfer' && paymentRecord.transfer_date && paymentRecord.transfer_time && (
                      <span>
                        โอนเงิน : {new Date(paymentRecord.transfer_date).toLocaleDateString('th-TH', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        })} {paymentRecord.transfer_time}
                      </span>
                    )}
                    {paymentRecord.payment_method === 'credit' && (
                      <span>เครดิต</span>
                    )}
                    {paymentRecord.payment_method === 'cheque' && (
                      <span>เช็ค</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Customer Information */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-[#E9B308]" />
            ข้อมูลลูกค้า
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-600">ชื่อลูกค้า</div>
              <div className="font-medium">{order.customer.name}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">รหัสลูกค้า</div>
              <div className="font-medium">{order.customer.customer_code}</div>
            </div>
            {order.customer.contact_person && (
              <div>
                <div className="text-sm text-gray-600">ผู้ติดต่อ</div>
                <div className="font-medium">{order.customer.contact_person}</div>
              </div>
            )}
            {order.customer.phone && (
              <div>
                <div className="text-sm text-gray-600">เบอร์โทร</div>
                <div className="font-medium">{order.customer.phone}</div>
              </div>
            )}
          </div>
        </div>

        {/* Order Items - Grouped by Branch */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Package className="w-5 h-5 text-[#E9B308]" />
            รายการสินค้าแยกตามสาขา
          </h2>
          <div className="space-y-6">
            {branchGroups.map((branchGroup, branchIndex) => (
              <div key={branchGroup.shipping_address_id} className="border-2 border-[#E9B308] rounded-lg overflow-hidden shadow-sm">
                {/* Branch Header */}
                <div className="bg-gradient-to-r from-[#E9B308] to-[#f5c842] p-4 border-b-2 border-[#d4a307]">
                  <div className="flex items-center gap-3">
                    <MapPin className="w-6 h-6 text-[#00231F] flex-shrink-0" />
                    <div className="flex-1">
                      <div className="font-bold text-xl text-[#00231F] mb-1">
                        {branchGroup.shipping_address.address_name}
                      </div>
                      <div className="text-sm text-[#00231F] opacity-90">
                        {branchGroup.shipping_address.address_line1}
                        {branchGroup.shipping_address.district && `, ${branchGroup.shipping_address.district}`}
                        {branchGroup.shipping_address.amphoe && `, ${branchGroup.shipping_address.amphoe}`}
                        {`, ${branchGroup.shipping_address.province}`}
                        {branchGroup.shipping_address.postal_code && ` ${branchGroup.shipping_address.postal_code}`}
                      </div>
                      {branchGroup.shipping_address.contact_person && (
                        <div className="text-sm text-[#00231F] opacity-90 mt-1">
                          ติดต่อ: {branchGroup.shipping_address.contact_person}
                          {branchGroup.shipping_address.phone && ` (${branchGroup.shipping_address.phone})`}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Products in this branch */}
                <div className="p-4 space-y-4">
                  {branchGroup.products.map(({ item, shipment }, productIndex) => {
                    // Calculate item total for this shipment
                    const itemTotal = (shipment.quantity / item.quantity) * item.total;
                    return (
                      <div key={`${item.id}-${shipment.id}`} className="border-b border-gray-100 pb-4 last:border-b-0 last:pb-0">
                        <div className="flex justify-between items-center gap-4">
                          {/* Product Info */}
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-lg">
                              {item.product_name}
                              {item.bottle_size && <span className="text-gray-600 font-normal"> ({item.bottle_size})</span>}
                            </div>
                            <div className="text-sm text-gray-500">{item.product_code}</div>
                            <div className="mt-1 flex gap-4 text-sm text-gray-600">
                              <div>
                                ฿{item.unit_price.toLocaleString()}/หน่วย
                              </div>
                              {item.discount_percent > 0 && (
                                <div className="text-red-600">
                                  ส่วนลด {item.discount_percent}%
                                </div>
                              )}
                            </div>
                            {shipment.delivery_notes && (
                              <div className="mt-2 text-sm text-gray-600 italic">
                                หมายเหตุ: {shipment.delivery_notes}
                              </div>
                            )}
                          </div>

                          {/* Price & Status */}
                          <div className="flex-shrink-0 text-right">
                            <div className="text-2xl font-bold text-gray-900 mb-2">
                              ฿{itemTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                            </div>
                            <DeliveryStatusBadge status={shipment.delivery_status} />
                            {shipment.delivery_date && (
                              <div className="text-xs text-gray-500 mt-1">
                                ส่ง: {new Date(shipment.delivery_date).toLocaleDateString('th-TH')}
                              </div>
                            )}
                            {shipment.received_date && (
                              <div className="text-xs text-gray-500">
                                รับ: {new Date(shipment.received_date).toLocaleDateString('th-TH')}
                              </div>
                            )}
                          </div>

                          {/* Quantity - Right Aligned */}
                          <div className="flex-shrink-0 text-center bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 min-w-[100px]">
                            <div className="text-3xl font-bold text-gray-900 leading-none">
                              {shipment.quantity}
                            </div>
                            <div className="text-xs font-semibold text-gray-600 mt-1">หน่วย</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Branch Total */}
                  <div className="mt-4 pt-4 border-t-2 border-[#E9B308] flex justify-between items-center">
                    <span className="font-semibold text-lg">ยอดรวมสาขานี้:</span>
                    <span className="text-2xl font-bold text-[#E9B308]">
                      ฿{branchGroup.products.reduce((sum, { item, shipment }) => {
                        return sum + ((shipment.quantity / item.quantity) * item.total);
                      }, 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Order Summary and Additional Information */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column (Desktop) / Second on Mobile - Additional Information & Notes */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 order-2 lg:order-1">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#E9B308]" />
              ข้อมูลเพิ่มเติม
            </h2>
            <div className="space-y-4">
              {/* Delivery and Payment Info */}
              <div className="space-y-3">
                {order.delivery_date && (
                  <div>
                    <div className="text-sm text-gray-600">วันที่ส่งของ</div>
                    <div className="font-medium">
                      {new Date(order.delivery_date).toLocaleDateString('th-TH', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </div>
                  </div>
                )}
                {order.payment_method && (
                  <div>
                    <div className="text-sm text-gray-600">วิธีชำระเงิน</div>
                    <div className="font-medium">
                      {order.payment_method === 'cash' && 'เงินสด'}
                      {order.payment_method === 'transfer' && 'โอนเงิน'}
                      {order.payment_method === 'credit' && 'เครดิต'}
                      {order.payment_method === 'cheque' && 'เช็ค'}
                    </div>
                  </div>
                )}
              </div>

              {/* Notes Section */}
              {(order.notes || order.internal_notes) && (
                <div className="pt-3 border-t space-y-3">
                  {order.notes && (
                    <div>
                      <div className="text-sm text-gray-600 flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5" />
                        หมายเหตุ
                      </div>
                      <div className="font-medium text-gray-900 mt-1">{order.notes}</div>
                    </div>
                  )}
                  {order.internal_notes && (
                    <div>
                      <div className="text-sm text-gray-600 flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5" />
                        หมายเหตุภายใน
                      </div>
                      <div className="font-medium text-gray-700 mt-1">{order.internal_notes}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column (Desktop) / First on Mobile - Order Summary */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 order-1 lg:order-2">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-[#E9B308]" />
              สรุปยอดเงิน
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm text-gray-600">
                <span>ยอดรวม (ก่อน VAT)</span>
                <span>
                  ฿{order.subtotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>VAT 7%</span>
                <span>฿{order.vat_amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
              </div>
              {order.shipping_fee > 0 && (
                <div className="flex justify-between text-sm text-gray-600">
                  <span>ค่าจัดส่ง</span>
                  <span>฿{order.shipping_fee.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              {order.discount_amount > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>ส่วนลดรวม</span>
                  <span>-฿{order.discount_amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex justify-between text-2xl font-bold pt-3 border-t">
                <span>ยอดรวมสุทธิ</span>
                <span className="text-[#E9B308]">
                  ฿{order.total_amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {/* Payment Record Details (if paid) */}
              {(() => {
                console.log('Payment status:', order.payment_status);
                console.log('Payment record:', paymentRecord);
                console.log('Should show payment details:', order.payment_status === 'paid' && paymentRecord);
                return null;
              })()}
              {order.payment_status === 'paid' && paymentRecord && (
                <div className="mt-6 pt-6 border-t space-y-3">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    รายละเอียดการชำระเงิน
                  </h3>

                  <div className="bg-green-50 rounded-lg p-4 space-y-2">
                    {/* Payment Method */}
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">วิธีการชำระ:</span>
                      <span className="font-medium text-gray-900">
                        {paymentRecord.payment_method === 'cash' ? 'เงินสด' :
                         paymentRecord.payment_method === 'transfer' ? 'โอนเงิน' :
                         paymentRecord.payment_method === 'credit' ? 'เครดิต' :
                         paymentRecord.payment_method === 'cheque' ? 'เช็ค' :
                         paymentRecord.payment_method}
                      </span>
                    </div>

                    {/* Cash: Collected By */}
                    {paymentRecord.payment_method === 'cash' && paymentRecord.collected_by && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">คนเก็บเงิน:</span>
                        <span className="font-medium text-gray-900">{paymentRecord.collected_by}</span>
                      </div>
                    )}

                    {/* Transfer: Date and Time */}
                    {paymentRecord.payment_method === 'transfer' && (
                      <>
                        {paymentRecord.transfer_date && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">วันที่จากสลิป:</span>
                            <span className="font-medium text-gray-900">
                              {new Date(paymentRecord.transfer_date).toLocaleDateString('th-TH', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </span>
                          </div>
                        )}
                        {paymentRecord.transfer_time && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">เวลาจากสลิป:</span>
                            <span className="font-medium text-gray-900">{paymentRecord.transfer_time}</span>
                          </div>
                        )}
                      </>
                    )}

                    {/* Payment Date */}
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">วันที่บันทึกการชำระ:</span>
                      <span className="font-medium text-gray-900">
                        {new Date(paymentRecord.payment_date).toLocaleDateString('th-TH', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>

                    {/* Notes */}
                    {paymentRecord.notes && (
                      <div className="pt-2 border-t border-green-200">
                        <span className="text-sm text-gray-600">หมายเหตุ:</span>
                        <p className="text-sm text-gray-900 mt-1">{paymentRecord.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Success/Error Result Modal */}
        {showResultModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowResultModal(false)}>
            <div className="bg-white rounded-lg p-6 max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
              <div className="text-center">
                {isSuccess ? (
                  <div className="mb-4">
                    <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                      <CheckCircle className="w-10 h-10 text-green-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">สำเร็จ!</h3>
                    <p className="text-gray-700">{resultMessage}</p>
                  </div>
                ) : (
                  <div className="mb-4">
                    <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                      <XCircle className="w-10 h-10 text-red-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">เกิดข้อผิดพลาด</h3>
                    <p className="text-gray-700">{resultMessage}</p>
                  </div>
                )}
                <button
                  onClick={() => setShowResultModal(false)}
                  className="px-6 py-2 bg-[#E9B308] text-[#00231F] rounded-lg hover:bg-[#d4a307] transition-colors font-medium"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}
