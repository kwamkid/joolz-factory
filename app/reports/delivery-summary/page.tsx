'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/layout/Layout';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import DateRangePicker from '@/components/ui/DateRangePicker';
import { DateValueType } from 'react-tailwindcss-datepicker';
import { getImageUrl } from '@/lib/utils/image';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Truck,
  MapPin,
  Phone,
  User,
  Package,
  Loader2,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Check,
  StickyNote,
  GripVertical,
} from 'lucide-react';

// Interfaces
interface DeliveryProduct {
  productName: string;
  productCode: string;
  bottleSize: string | null;
  quantity: number;
  image: string | null;
}

interface ShippingAddress {
  id: string;
  addressName: string;
  contactPerson: string | null;
  phone: string | null;
  addressLine1: string;
  district: string | null;
  amphoe: string | null;
  province: string;
  postalCode: string | null;
  googleMapsLink: string | null;
}

interface Customer {
  id: string;
  customerCode: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
}

interface Delivery {
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  paymentStatus: string;
  paymentMethod: string | null;
  totalAmount: number;
  orderNotes: string | null;
  internalNotes: string | null;
  customer: Customer;
  shippingAddress: ShippingAddress;
  deliveryNotes: string | null;
  products: DeliveryProduct[];
  totalBottles: number;
}

interface DateGroup {
  date: string;
  deliveries: Delivery[];
  dateTotals: {
    totalDeliveries: number;
    totalBottles: number;
  };
}

interface ProductSummary {
  productName: string;
  productCode: string;
  bottleSize: string | null;
  totalQuantity: number;
  image: string | null;
}

interface ReportData {
  startDate: string;
  endDate: string;
  byDate: DateGroup[];
  productSummary: ProductSummary[];
  totals: {
    totalDates: number;
    totalDeliveries: number;
    totalBottles: number;
  };
}

// Status badge components (same pattern as orders page)
function OrderStatusBadge({ status, clickable = false }: { status: string; clickable?: boolean }) {
  const statusConfig: Record<string, { label: string; color: string; hoverColor: string }> = {
    new: { label: 'ใหม่', color: 'bg-blue-100 text-blue-700', hoverColor: 'hover:bg-blue-200' },
    shipping: { label: 'กำลังส่ง', color: 'bg-yellow-100 text-yellow-700', hoverColor: 'hover:bg-yellow-200' },
    completed: { label: 'สำเร็จ', color: 'bg-green-100 text-green-700', hoverColor: '' },
    cancelled: { label: 'ยกเลิก', color: 'bg-red-100 text-red-700', hoverColor: '' },
  };
  const config = statusConfig[status] || statusConfig.new;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${config.color} ${clickable ? `${config.hoverColor} cursor-pointer transition-colors` : ''}`}>
      {config.label}
      {clickable && <ChevronRight className="w-3 h-3" />}
    </span>
  );
}

function PaymentStatusBadge({ status, clickable = false }: { status: string; clickable?: boolean }) {
  const statusConfig: Record<string, { label: string; color: string; hoverColor: string }> = {
    pending: { label: 'รอชำระ', color: 'bg-orange-100 text-orange-700', hoverColor: 'hover:bg-orange-200' },
    paid: { label: 'ชำระแล้ว', color: 'bg-green-100 text-green-700', hoverColor: '' },
  };
  const config = statusConfig[status] || statusConfig.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${config.color} ${clickable ? `${config.hoverColor} cursor-pointer transition-colors` : ''}`}>
      {config.label}
      {clickable && <ChevronRight className="w-3 h-3" />}
    </span>
  );
}

// Sortable Delivery Card component
function SortableDeliveryCard({
  id,
  delivery,
  index,
  getUniqueNotes,
  getMapLink,
  formatAddress,
  getNextOrderStatus,
  getNextPaymentStatus,
  getOrderStatusLabel,
  getPaymentStatusLabel,
  handleOrderStatusClick,
  handlePaymentStatusClick,
}: {
  id: string;
  delivery: Delivery;
  index: number;
  getUniqueNotes: (d: Delivery) => { text: string; type: 'delivery' | 'order' | 'internal' }[];
  getMapLink: (addr: ShippingAddress, customerName?: string) => string | null;
  formatAddress: (addr: ShippingAddress) => string;
  getNextOrderStatus: (s: string) => string | null;
  getNextPaymentStatus: (s: string) => string | null;
  getOrderStatusLabel: (s: string) => string;
  getPaymentStatusLabel: (s: string) => string;
  handleOrderStatusClick: (d: Delivery) => void;
  handlePaymentStatusClick: (d: Delivery) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.8 : 1,
  };

  const uniqueNotes = getUniqueNotes(delivery);
  const mapLink = getMapLink(delivery.shippingAddress, delivery.customer.name);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white rounded-lg border overflow-hidden mb-3 ${isDragging ? 'border-[#E9B308] shadow-lg' : 'border-gray-200'}`}
    >
      {/* Card Header */}
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          {/* Drag Handle */}
          <button
            {...attributes}
            {...listeners}
            className="touch-none text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing p-1 -ml-1"
            title="ลากเพื่อเรียงลำดับ"
          >
            <GripVertical className="w-5 h-5" />
          </button>
          {/* Large index number */}
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[#E9B308] text-[#00231F] text-base font-bold flex-shrink-0">
            {index + 1}
          </span>
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900">{delivery.customer.name}</span>
            <span className="text-xs text-gray-500">({delivery.orderNumber})</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Order Status Badge */}
          {getNextOrderStatus(delivery.orderStatus) ? (
            <button
              onClick={() => handleOrderStatusClick(delivery)}
              title={`คลิกเพื่อเปลี่ยนเป็น "${getOrderStatusLabel(getNextOrderStatus(delivery.orderStatus) || '')}"`}
            >
              <OrderStatusBadge status={delivery.orderStatus} clickable />
            </button>
          ) : (
            <OrderStatusBadge status={delivery.orderStatus} />
          )}

          {/* Payment Status Badge */}
          {delivery.orderStatus !== 'cancelled' && (
            getNextPaymentStatus(delivery.paymentStatus) ? (
              <button
                onClick={() => handlePaymentStatusClick(delivery)}
                title={`คลิกเพื่อเปลี่ยนเป็น "${getPaymentStatusLabel(getNextPaymentStatus(delivery.paymentStatus) || '')}"`}
              >
                <PaymentStatusBadge status={delivery.paymentStatus} clickable />
              </button>
            ) : (
              <PaymentStatusBadge status={delivery.paymentStatus} />
            )
          )}
        </div>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left Column: Address, Contact, Notes */}
          <div className="space-y-3">
            {/* Address - clickable to Google Maps */}
            <a
              href={mapLink || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-start gap-2 group ${mapLink ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <MapPin className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <div className={`font-medium text-sm text-gray-900 ${mapLink ? 'group-hover:text-blue-600' : ''}`}>
                  {delivery.shippingAddress.addressName}
                </div>
                <div className={`text-sm text-gray-600 ${mapLink ? 'group-hover:text-blue-500' : ''}`}>
                  {formatAddress(delivery.shippingAddress)}
                </div>
              </div>
            </a>

            {/* Contact & Phone */}
            <div className="flex flex-wrap gap-4 text-sm">
              {(delivery.shippingAddress.contactPerson || delivery.customer.contactPerson) && (
                <div className="flex items-center gap-1.5 text-gray-600">
                  <User className="w-3.5 h-3.5" />
                  {delivery.shippingAddress.contactPerson || delivery.customer.contactPerson}
                </div>
              )}
              {(delivery.shippingAddress.phone || delivery.customer.phone) && (
                <a
                  href={`tel:${delivery.shippingAddress.phone || delivery.customer.phone}`}
                  className="flex items-center gap-1.5 text-gray-600 hover:text-blue-600"
                >
                  <Phone className="w-3.5 h-3.5" />
                  {delivery.shippingAddress.phone || delivery.customer.phone}
                </a>
              )}
            </div>

            {/* Notes - deduplicated */}
            {uniqueNotes.length > 0 && (
              <div className="space-y-1">
                {uniqueNotes.map((note, nIndex) => (
                  <div key={nIndex} className="flex items-start gap-1.5 text-sm">
                    <StickyNote className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${
                      note.type === 'delivery' ? 'text-amber-500' :
                      note.type === 'internal' ? 'text-purple-400' : 'text-gray-400'
                    }`} />
                    <span className={
                      note.type === 'delivery' ? 'text-amber-700' :
                      note.type === 'internal' ? 'text-purple-600' : 'text-gray-600'
                    }>
                      {note.text}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Products */}
          <div className="md:border-l md:border-gray-100 md:pl-4">
            <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase mb-2">
              <Package className="w-3.5 h-3.5" />
              สินค้า
            </div>
            <div className="space-y-1.5">
              {delivery.products.map((product, pIndex) => (
                <div key={pIndex} className="flex items-center gap-2 text-sm">
                  {product.image ? (
                    <img
                      src={getImageUrl(product.image)}
                      alt={product.productName}
                      className="w-8 h-8 rounded object-cover flex-shrink-0"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <Package className="w-4 h-4 text-gray-400" />
                    </div>
                  )}
                  <span className="text-gray-700 flex-1">
                    {product.productName}
                    {product.bottleSize && <span className="text-gray-400 ml-1">{product.bottleSize}</span>}
                  </span>
                  <span className="font-medium text-gray-900">x {product.quantity}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-2 pt-2 border-t border-gray-100">
              <span className="text-sm font-medium text-gray-700">รวม: {delivery.totalBottles} ขวด</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DeliverySummaryPage() {
  const router = useRouter();
  const { session, userProfile, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [showProductSummary, setShowProductSummary] = useState(false);

  // Status update modal
  const [statusUpdateModal, setStatusUpdateModal] = useState<{
    show: boolean;
    delivery: Delivery | null;
    nextStatus: string;
    statusType: 'order' | 'payment';
  }>({ show: false, delivery: null, nextStatus: '', statusType: 'order' });
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Payment details state
  const [paymentDetails, setPaymentDetails] = useState({
    paymentMethod: 'cash',
    collectedBy: '',
    transferDate: '',
    transferTime: '',
    notes: '',
  });

  // Custom delivery ordering per date (for drag-to-reorder)
  // Map<date, deliveryKey[]> where deliveryKey = `${orderId}-${addressId}`
  const [deliveryOrder, setDeliveryOrder] = useState<Map<string, string[]>>(new Map());

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Single date - default to today
  const getDefaultDate = (): DateValueType => {
    const today = new Date();
    return { startDate: today, endDate: today };
  };

  const [selectedDate, setSelectedDate] = useState<DateValueType>(getDefaultDate);

  const toDateString = (val: unknown): string => {
    if (!val) return '';
    if (val instanceof Date) {
      const y = val.getFullYear();
      const m = String(val.getMonth() + 1).padStart(2, '0');
      const d = String(val.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    const s = String(val);
    const match = s.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) {
      const y = parsed.getFullYear();
      const m = String(parsed.getMonth() + 1).padStart(2, '0');
      const d = String(parsed.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    return '';
  };

  const deliveryDate = toDateString(selectedDate?.startDate);

  // Auth check
  useEffect(() => {
    if (authLoading) return;
    if (!userProfile) {
      router.push('/login');
    }
  }, [userProfile, authLoading, router]);

  // Fetch report
  const fetchReport = async () => {
    if (!session?.access_token || !deliveryDate) return;

    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ start_date: deliveryDate, end_date: deliveryDate });
      const response = await fetch(`/api/reports/delivery-summary?${params}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'ไม่สามารถโหลดข้อมูลได้');
      setReportData(result.report);
    } catch (err) {
      console.error('Error fetching report:', err);
      setError(err instanceof Error ? err.message : 'ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session?.access_token && deliveryDate) {
      fetchReport();
    }
  }, [deliveryDate, session?.access_token]);

  // Initialize delivery order when reportData changes
  useEffect(() => {
    if (!reportData) return;
    const newOrder = new Map<string, string[]>();
    reportData.byDate.forEach(dateGroup => {
      const keys = dateGroup.deliveries.map(d => `${d.orderId}-${d.shippingAddress.id}`);
      newOrder.set(dateGroup.date, keys);
    });
    setDeliveryOrder(newOrder);
  }, [reportData]);

  // Get deliveries in custom order for a date group
  const getOrderedDeliveries = useCallback((dateGroup: DateGroup): Delivery[] => {
    const order = deliveryOrder.get(dateGroup.date);
    if (!order) return dateGroup.deliveries;

    const deliveryMap = new Map(
      dateGroup.deliveries.map(d => [`${d.orderId}-${d.shippingAddress.id}`, d])
    );
    return order
      .map(key => deliveryMap.get(key))
      .filter((d): d is Delivery => !!d);
  }, [deliveryOrder]);

  // Handle drag end for reordering
  const handleDragEnd = useCallback((date: string) => (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setDeliveryOrder(prev => {
      const newMap = new Map(prev);
      const order = newMap.get(date);
      if (!order) return prev;

      const oldIndex = order.indexOf(active.id as string);
      const newIndex = order.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return prev;

      newMap.set(date, arrayMove(order, oldIndex, newIndex));
      return newMap;
    });
  }, []);

  // Status flow helpers
  const getNextOrderStatus = (status: string): string | null => {
    const flow: Record<string, string> = { new: 'shipping', shipping: 'completed' };
    return flow[status] || null;
  };

  const getNextPaymentStatus = (status: string): string | null => {
    return status === 'pending' ? 'paid' : null;
  };

  const getOrderStatusLabel = (status: string): string => {
    const labels: Record<string, string> = { new: 'ใหม่', shipping: 'กำลังส่ง', completed: 'สำเร็จ', cancelled: 'ยกเลิก' };
    return labels[status] || status;
  };

  const getPaymentStatusLabel = (status: string): string => {
    const labels: Record<string, string> = { pending: 'รอชำระ', paid: 'ชำระแล้ว' };
    return labels[status] || status;
  };

  // Handle status clicks
  const handleOrderStatusClick = (delivery: Delivery) => {
    const nextStatus = getNextOrderStatus(delivery.orderStatus);
    if (!nextStatus) return;
    setStatusUpdateModal({ show: true, delivery, nextStatus, statusType: 'order' });
  };

  const handlePaymentStatusClick = (delivery: Delivery) => {
    const nextStatus = getNextPaymentStatus(delivery.paymentStatus);
    if (!nextStatus) return;
    setPaymentDetails({
      paymentMethod: delivery.paymentMethod || 'cash',
      collectedBy: '', transferDate: '', transferTime: '', notes: '',
    });
    setStatusUpdateModal({ show: true, delivery, nextStatus, statusType: 'payment' });
  };

  // Confirm status update
  const confirmStatusUpdate = async () => {
    const delivery = statusUpdateModal.delivery;
    if (!delivery) return;

    if (statusUpdateModal.statusType === 'payment' && statusUpdateModal.nextStatus === 'paid') {
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
      setUpdatingStatus(true);
      const { data: { session: sess } } = await supabase.auth.getSession();
      if (!sess) throw new Error('No session');

      const updateData: Record<string, unknown> = { id: delivery.orderId };
      if (statusUpdateModal.statusType === 'order') {
        updateData.order_status = statusUpdateModal.nextStatus;
      } else {
        updateData.payment_status = statusUpdateModal.nextStatus;
      }

      const response = await fetch('/api/orders', {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${sess.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) throw new Error('Failed to update status');

      // Create payment record if marking as paid
      if (statusUpdateModal.statusType === 'payment' && statusUpdateModal.nextStatus === 'paid') {
        await fetch('/api/payment-records', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${sess.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order_id: delivery.orderId,
            payment_method: paymentDetails.paymentMethod,
            amount: delivery.totalAmount,
            collected_by: paymentDetails.paymentMethod === 'cash' ? paymentDetails.collectedBy : null,
            transfer_date: paymentDetails.paymentMethod === 'transfer' ? paymentDetails.transferDate : null,
            transfer_time: paymentDetails.paymentMethod === 'transfer' ? paymentDetails.transferTime : null,
            notes: paymentDetails.notes || null,
          }),
        });
      }

      await fetchReport();
      setStatusUpdateModal({ show: false, delivery: null, nextStatus: '', statusType: 'order' });
    } catch (err) {
      console.error('Error updating status:', err);
      alert(err instanceof Error ? err.message : 'ไม่สามารถอัพเดทสถานะได้');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Generate text for export (uses custom order)
  const generateDeliveryText = (): string => {
    if (!reportData || reportData.byDate.length === 0) return '';
    let text = '';

    reportData.byDate.forEach(dateGroup => {
      const dateStr = new Date(dateGroup.date).toLocaleDateString('th-TH', {
        weekday: 'long', day: 'numeric', month: 'short', year: 'numeric',
      });
      text += `📦 สรุปการจัดส่ง - ${dateStr}\n${'─'.repeat(30)}\n\n`;

      const orderedDeliveries = getOrderedDeliveries(dateGroup);
      orderedDeliveries.forEach((delivery, index) => {
        text += `${index + 1}. ${delivery.customer.name} (${delivery.orderNumber})\n`;

        const addr = delivery.shippingAddress;
        text += `   📍 ${addr.addressName}`;
        if (addr.addressLine1) text += ` - ${addr.addressLine1}`;
        if (addr.amphoe) text += `, ${addr.amphoe}`;
        if (addr.province) text += `, ${addr.province}`;
        if (addr.postalCode) text += ` ${addr.postalCode}`;
        text += '\n';

        const contact = addr.contactPerson || delivery.customer.contactPerson;
        const phone = addr.phone || delivery.customer.phone;
        if (contact || phone) {
          text += `   👤 ${contact || ''}${contact && phone ? ' ' : ''}${phone ? `📞 ${phone}` : ''}\n`;
        }

        if (addr.googleMapsLink) text += `   🗺️ ${addr.googleMapsLink}\n`;

        // Deduplicated notes for text export too
        const notes = getUniqueNotes(delivery);
        notes.forEach(n => { text += `   📝 ${n.text}\n`; });

        text += '   สินค้า:\n';
        delivery.products.forEach(product => {
          const bottleInfo = product.bottleSize ? ` ${product.bottleSize}` : '';
          text += `   - ${product.productName}${bottleInfo} x ${product.quantity}\n`;
        });
        text += '\n';
      });

      text += `📊 รวม: ${dateGroup.dateTotals.totalDeliveries} จุดส่ง, ${dateGroup.dateTotals.totalBottles} ขวด\n\n`;
    });

    if (reportData.productSummary.length > 0) {
      text += `${'═'.repeat(30)}\n📋 สรุปสินค้าทั้งหมด:\n`;
      reportData.productSummary.forEach(product => {
        const bottleInfo = product.bottleSize ? ` ${product.bottleSize}` : '';
        text += `   - ${product.productName}${bottleInfo}: ${product.totalQuantity} ขวด\n`;
      });
    }

    return text;
  };

  // Get unique notes (deduplicate)
  const getUniqueNotes = (delivery: Delivery): { text: string; type: 'delivery' | 'order' | 'internal' }[] => {
    const notes: { text: string; type: 'delivery' | 'order' | 'internal' }[] = [];
    const seen = new Set<string>();

    if (delivery.deliveryNotes) {
      seen.add(delivery.deliveryNotes.trim());
      notes.push({ text: delivery.deliveryNotes, type: 'delivery' });
    }
    if (delivery.orderNotes && !seen.has(delivery.orderNotes.trim())) {
      seen.add(delivery.orderNotes.trim());
      notes.push({ text: delivery.orderNotes, type: 'order' });
    }
    if (delivery.internalNotes && !seen.has(delivery.internalNotes.trim())) {
      notes.push({ text: delivery.internalNotes, type: 'internal' });
    }

    return notes;
  };

  const handleCopyText = async () => {
    const text = generateDeliveryText();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const handleDownloadText = () => {
    const text = generateDeliveryText();
    if (!text) return;
    const blob = new Blob(['\ufeff' + text], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `delivery-summary-${deliveryDate}.txt`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const formatAddress = (addr: ShippingAddress): string => {
    return [addr.addressLine1, addr.district, addr.amphoe, addr.province, addr.postalCode].filter(Boolean).join(', ');
  };

  const getMapLink = (addr: ShippingAddress, customerName?: string): string | null => {
    if (addr.googleMapsLink) return addr.googleMapsLink;
    // Fallback: customer name + branch name (addressName)
    const parts: string[] = [];
    if (customerName) parts.push(customerName);
    if (addr.addressName && addr.addressName !== 'ไม่ระบุ' && addr.addressName !== customerName) {
      parts.push(addr.addressName);
    }
    const query = parts.join(' ') || formatAddress(addr);
    return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : null;
  };

  if (authLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 text-[#E9B308] animate-spin" />
        </div>
      </Layout>
    );
  }

  if (!userProfile) return null;

  return (
    <Layout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <Truck className="w-8 h-8 text-[#E9B308]" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">การจัดส่ง</h1>
              <p className="text-sm text-gray-600">สรุปรายการจัดส่งสินค้าตามวันที่</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyText}
              disabled={!reportData || reportData.byDate.length === 0}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {copySuccess ? (
                <><Check className="w-4 h-4 text-green-500" /><span className="text-green-600">คัดลอกแล้ว!</span></>
              ) : (
                <><Copy className="w-4 h-4" />คัดลอกข้อความ</>
              )}
            </button>
            <button
              onClick={handleDownloadText}
              disabled={!reportData || reportData.byDate.length === 0}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-[#E9B308] text-[#00231F] hover:bg-[#d4a307] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              ดาวน์โหลด .txt
            </button>
          </div>
        </div>

        {/* Filter */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="max-w-xs">
            <DateRangePicker
              value={selectedDate}
              onChange={(val) => setSelectedDate(val)}
              asSingle={true}
              useRange={false}
              showShortcuts={false}
              showFooter={false}
              placeholder="เลือกวันที่ส่ง"
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#E9B308] animate-spin" />
          </div>
        )}

        {!loading && reportData && (
          <>
            {/* Summary Cards */}
            {reportData.totals.totalDeliveries > 0 && (
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
                  <div className="text-2xl font-bold text-gray-900">{reportData.totals.totalDeliveries}</div>
                  <div className="text-xs text-gray-500 mt-1">จุดส่ง</div>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
                  <div className="text-2xl font-bold text-gray-900">{reportData.totals.totalBottles.toLocaleString()}</div>
                  <div className="text-xs text-gray-500 mt-1">ขวดทั้งหมด</div>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
                  <div className="text-2xl font-bold text-gray-900">{reportData.productSummary.length}</div>
                  <div className="text-xs text-gray-500 mt-1">ชนิดสินค้า</div>
                </div>
              </div>
            )}

            {/* Delivery List by Date */}
            {reportData.byDate.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                <Truck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">ไม่มีรายการจัดส่งในช่วงวันที่เลือก</p>
              </div>
            ) : (
              reportData.byDate.map(dateGroup => {
                const orderedDeliveries = getOrderedDeliveries(dateGroup);
                const sortableIds = orderedDeliveries.map(d => `${d.orderId}-${d.shippingAddress.id}`);

                return (
                  <div key={dateGroup.date} className="space-y-3">
                    {/* Date Header */}
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-semibold text-gray-900">
                        {new Date(dateGroup.date).toLocaleDateString('th-TH', {
                          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                        })}
                      </h2>
                      <span className="text-sm text-gray-500">
                        {dateGroup.dateTotals.totalDeliveries} จุดส่ง / {dateGroup.dateTotals.totalBottles} ขวด
                      </span>
                    </div>

                    {/* Sortable Delivery Cards */}
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd(dateGroup.date)}
                    >
                      <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                        {orderedDeliveries.map((delivery, index) => (
                          <SortableDeliveryCard
                            key={`${delivery.orderId}-${delivery.shippingAddress.id}`}
                            id={`${delivery.orderId}-${delivery.shippingAddress.id}`}
                            delivery={delivery}
                            index={index}
                            getUniqueNotes={getUniqueNotes}
                            getMapLink={getMapLink}
                            formatAddress={formatAddress}
                            getNextOrderStatus={getNextOrderStatus}
                            getNextPaymentStatus={getNextPaymentStatus}
                            getOrderStatusLabel={getOrderStatusLabel}
                            getPaymentStatusLabel={getPaymentStatusLabel}
                            handleOrderStatusClick={handleOrderStatusClick}
                            handlePaymentStatusClick={handlePaymentStatusClick}
                          />
                        ))}
                      </SortableContext>
                    </DndContext>
                  </div>
                );
              })
            )}

            {/* Product Summary - Collapsible */}
            {reportData.productSummary.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200">
                <button
                  onClick={() => setShowProductSummary(!showProductSummary)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-[#E9B308]" />
                    <span className="font-medium text-gray-900">สรุปสินค้าทั้งหมด</span>
                    <span className="text-sm text-gray-500">({reportData.productSummary.length} รายการ)</span>
                  </div>
                  {showProductSummary ? (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  )}
                </button>
                {showProductSummary && (
                  <div className="px-4 pb-4 border-t border-gray-100">
                    <div className="space-y-2 mt-3">
                      {reportData.productSummary.map((product, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm">
                          {product.image ? (
                            <img
                              src={getImageUrl(product.image)}
                              alt={product.productName}
                              className="w-8 h-8 rounded object-cover flex-shrink-0"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          ) : (
                            <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                              <Package className="w-4 h-4 text-gray-400" />
                            </div>
                          )}
                          <span className="text-gray-900 flex-1">
                            {product.productName}
                            {product.bottleSize && <span className="text-gray-400 ml-1">{product.bottleSize}</span>}
                          </span>
                          <span className="font-medium text-gray-900">{product.totalQuantity}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-end mt-3 pt-2 border-t border-gray-200">
                      <span className="text-sm font-medium text-gray-700">
                        รวมทั้งหมด: {reportData.totals.totalBottles.toLocaleString()} ขวด
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Status Update Confirmation Modal */}
        {statusUpdateModal.show && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setStatusUpdateModal({ show: false, delivery: null, nextStatus: '', statusType: 'order' })}
          >
            <div className="bg-white rounded-lg p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold mb-4 text-gray-900">
                ยืนยันการเปลี่ยน{statusUpdateModal.statusType === 'order' ? 'สถานะคำสั่งซื้อ' : 'สถานะการชำระเงิน'}
              </h3>

              <div className="mb-6 space-y-3">
                <p className="text-gray-700">
                  คำสั่งซื้อ: <span className="font-medium">{statusUpdateModal.delivery?.orderNumber}</span>
                </p>
                <p className="text-gray-700">
                  ลูกค้า: <span className="font-medium">{statusUpdateModal.delivery?.customer.name}</span>
                </p>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-600">เปลี่ยนจาก:</span>
                  {statusUpdateModal.statusType === 'order' ? (
                    <>
                      <OrderStatusBadge status={statusUpdateModal.delivery?.orderStatus || ''} />
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                      <OrderStatusBadge status={statusUpdateModal.nextStatus} />
                    </>
                  ) : (
                    <>
                      <PaymentStatusBadge status={statusUpdateModal.delivery?.paymentStatus || ''} />
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                      <PaymentStatusBadge status={statusUpdateModal.nextStatus} />
                    </>
                  )}
                </div>

                {/* Payment Details Form */}
                {statusUpdateModal.statusType === 'payment' && statusUpdateModal.nextStatus === 'paid' && (
                  <div className="mt-6 pt-6 border-t space-y-4">
                    <h4 className="font-medium text-gray-900">รายละเอียดการชำระเงิน</h4>
                    <p className="text-sm text-gray-600">
                      ยอดชำระ: <span className="font-semibold text-[#E9B308]">
                        ฿{statusUpdateModal.delivery?.totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </span>
                    </p>

                    {/* Payment Method */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        วิธีการชำระเงิน <span className="text-red-500">*</span>
                      </label>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => setPaymentDetails({ ...paymentDetails, paymentMethod: 'cash' })}
                          className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                            paymentDetails.paymentMethod === 'cash'
                              ? 'border-[#E9B308] bg-[#E9B308] bg-opacity-10 text-[#00231F] font-medium'
                              : 'border-gray-300 text-gray-700 hover:border-gray-400'
                          }`}
                        >
                          เงินสด
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentDetails({ ...paymentDetails, paymentMethod: 'transfer' })}
                          className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                            paymentDetails.paymentMethod === 'transfer'
                              ? 'border-[#E9B308] bg-[#E9B308] bg-opacity-10 text-[#00231F] font-medium'
                              : 'border-gray-300 text-gray-700 hover:border-gray-400'
                          }`}
                        >
                          โอนเงิน
                        </button>
                      </div>
                    </div>

                    {paymentDetails.paymentMethod === 'cash' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          ชื่อคนเก็บเงิน <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={paymentDetails.collectedBy}
                          onChange={(e) => setPaymentDetails({ ...paymentDetails, collectedBy: e.target.value })}
                          placeholder="ระบุชื่อคนเก็บเงิน"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308]"
                        />
                      </div>
                    )}

                    {paymentDetails.paymentMethod === 'transfer' && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            วันที่จากสลิป <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="date"
                            value={paymentDetails.transferDate}
                            onChange={(e) => setPaymentDetails({ ...paymentDetails, transferDate: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308]"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            เวลาจากสลิป <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="time"
                            value={paymentDetails.transferTime}
                            onChange={(e) => setPaymentDetails({ ...paymentDetails, transferTime: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308]"
                          />
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">หมายเหตุ</label>
                      <textarea
                        value={paymentDetails.notes}
                        onChange={(e) => setPaymentDetails({ ...paymentDetails, notes: e.target.value })}
                        placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)"
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308]"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setStatusUpdateModal({ show: false, delivery: null, nextStatus: '', statusType: 'order' })}
                  disabled={updatingStatus}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={confirmStatusUpdate}
                  disabled={updatingStatus}
                  className="px-4 py-2 bg-[#E9B308] text-[#00231F] rounded-lg hover:bg-[#d4a307] transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {updatingStatus ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /><span>กำลังบันทึก...</span></>
                  ) : (
                    <span>ยืนยัน</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
