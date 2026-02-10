'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import DateRangePicker from '@/components/ui/DateRangePicker';
import { DateValueType } from 'react-tailwindcss-datepicker';
import {
  Plus,
  Trash2,
  Search,
  Loader2,
  Package,
  MapPin,
  X,
  Save,
  Copy
} from 'lucide-react';

// Interfaces
interface Customer {
  id: string;
  customer_code: string;
  name: string;
  contact_person?: string;
  phone?: string;
}

interface ShippingAddress {
  id: string;
  address_name: string;
  contact_person?: string;
  phone?: string;
  address_line1: string;
  district?: string;
  amphoe?: string;
  province: string;
  postal_code?: string;
  is_default: boolean;
  created_at: string;
}

interface Product {
  id: string;
  product_id: string;
  code: string;
  name: string;
  image?: string;
  bottle_size?: string;
  product_type: 'simple' | 'variation';
  default_price: number;
  discount_price?: number;
  stock: number;
}

interface BranchProduct {
  variation_id: string;
  product_id: string;
  product_code: string;
  product_name: string;
  bottle_size?: string;
  quantity: number;
  unit_price: number;
  discount_value: number;
  discount_type: 'percent' | 'amount';
}

interface BranchOrder {
  shipping_address_id: string;
  address_name: string;
  delivery_notes: string;
  shipping_fee: number;
  products: BranchProduct[];
}

interface InitialOrderData {
  customer_id: string;
  delivery_date?: string;
  notes?: string;
  internal_notes?: string;
  discount_amount?: number;
  branches: BranchOrder[];
}

interface OrderFormProps {
  // Pre-selected customer (e.g., from LINE Chat)
  preselectedCustomerId?: string;
  // Initial order data for copying from previous order
  initialOrderData?: InitialOrderData;
  // Callback when order is created successfully
  onSuccess?: (orderId: string) => void;
  // Callback when cancelled
  onCancel?: () => void;
  // Embedded mode (no back button, different styling)
  embedded?: boolean;
}

export default function OrderForm({
  preselectedCustomerId,
  initialOrderData,
  onSuccess,
  onCancel,
  embedded = false
}: OrderFormProps) {
  const router = useRouter();
  const { userProfile, loading: authLoading } = useAuth();

  // State
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Customer selection
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // Shipping addresses
  const [shippingAddresses, setShippingAddresses] = useState<ShippingAddress[]>([]);

  // Products
  const [products, setProducts] = useState<Product[]>([]);

  // Customer pricing
  const [customerPrices, setCustomerPrices] = useState<Record<string, { unit_price: number; discount_percent: number }>>({});

  // Branch Orders
  const [branchOrders, setBranchOrders] = useState<BranchOrder[]>([]);
  const [activeBranchIndex, setActiveBranchIndex] = useState(0);

  // Order details
  const [deliveryDateValue, setDeliveryDateValue] = useState<DateValueType>({
    startDate: null,
    endDate: null,
  });
  const deliveryDate = deliveryDateValue?.startDate
    ? new Date(deliveryDateValue.startDate).toISOString().split('T')[0]
    : '';
  const [notes, setNotes] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [orderDiscount, setOrderDiscount] = useState(0);
  const [orderDiscountType, setOrderDiscountType] = useState<'percent' | 'amount'>('amount');

  // Product search per branch
  const [productSearches, setProductSearches] = useState<string[]>([]);
  const [showProductDropdowns, setShowProductDropdowns] = useState<boolean[]>([]);

  // Copy from latest order
  const [loadingLatestOrder, setLoadingLatestOrder] = useState(false);

  // Refs
  const quantityInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  // Fetch customers and products
  useEffect(() => {
    if (!authLoading && userProfile) {
      fetchCustomers();
      fetchProducts();
    }
  }, [authLoading, userProfile]);

  // Auto-select preselected customer
  useEffect(() => {
    if (preselectedCustomerId && customers.length > 0 && !selectedCustomer) {
      const customer = customers.find(c => c.id === preselectedCustomerId);
      if (customer) {
        handleSelectCustomer(customer);
      }
    }
  }, [preselectedCustomerId, customers]);

  // Initialize from copied order data
  useEffect(() => {
    if (initialOrderData && customers.length > 0 && products.length > 0 && !selectedCustomer) {
      const customer = customers.find(c => c.id === initialOrderData.customer_id);
      if (customer) {
        // Set customer without reinitializing branches
        setSelectedCustomer(customer);
        setCustomerSearch(customer.name);

        // Fetch shipping addresses without forcing init
        fetchShippingAddresses(customer.id, false);

        // Fetch customer prices
        (async () => {
          try {
            const { data: sessionData } = await supabase.auth.getSession();
            const response = await fetch(`/api/customer-prices?customer_id=${customer.id}`, {
              headers: { 'Authorization': `Bearer ${sessionData?.session?.access_token || ''}` }
            });
            if (response.ok) {
              const result = await response.json();
              setCustomerPrices(result.prices || {});
            }
          } catch (error) {
            console.error('Error fetching customer prices:', error);
          }
        })();

        // Set branch orders from initial data
        setBranchOrders(initialOrderData.branches);
        setProductSearches(initialOrderData.branches.map(() => ''));
        setShowProductDropdowns(initialOrderData.branches.map(() => false));

        // Set other fields
        if (initialOrderData.delivery_date) {
          setDeliveryDateValue({
            startDate: new Date(initialOrderData.delivery_date),
            endDate: new Date(initialOrderData.delivery_date)
          });
        }
        if (initialOrderData.notes) setNotes(initialOrderData.notes);
        if (initialOrderData.internal_notes) setInternalNotes(initialOrderData.internal_notes);
        if (initialOrderData.discount_amount) setOrderDiscount(initialOrderData.discount_amount);
      }
    }
  }, [initialOrderData, customers, products]);

  const fetchCustomers = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch('/api/customers?active=true', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${sessionData?.session?.access_token || ''}`
        }
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to fetch customers');

      const sortedCustomers = (result.customers || [])
        .filter((c: Customer & { is_active?: boolean }) => c.is_active !== false)
        .sort((a: Customer, b: Customer) => a.name.localeCompare(b.name));
      setCustomers(sortedCustomers);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const productsResponse = await fetch('/api/products', {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });

      if (!productsResponse.ok) throw new Error('Failed to fetch products');

      const result = await productsResponse.json();
      const fetchedProducts = result.products || [];

      const flatProducts: Product[] = [];
      fetchedProducts.forEach((sp: any) => {
        if (sp.product_type === 'simple') {
          const variation_id = sp.variations && sp.variations.length > 0 ? sp.variations[0].variation_id : null;
          flatProducts.push({
            id: variation_id || sp.product_id,
            product_id: sp.product_id,
            code: sp.code,
            name: sp.name,
            image: sp.main_image_url || sp.image,
            bottle_size: sp.simple_bottle_size,
            product_type: 'simple',
            default_price: sp.simple_default_price || 0,
            discount_price: sp.simple_discount_price || 0,
            stock: sp.simple_stock || 0
          });
        } else {
          (sp.variations || []).forEach((v: any) => {
            flatProducts.push({
              id: v.variation_id,
              product_id: sp.product_id,
              code: `${sp.code}-${v.bottle_size}`,
              name: sp.name,
              image: sp.main_image_url || sp.image,
              bottle_size: v.bottle_size,
              product_type: 'variation',
              default_price: v.default_price || 0,
              discount_price: v.discount_price || 0,
              stock: v.stock || 0
            });
          });
        }
      });
      setProducts(flatProducts);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const fetchShippingAddresses = async (customerId: string, forceInit: boolean = true) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`/api/shipping-addresses?customer_id=${customerId}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });

      if (response.ok) {
        const result = await response.json();
        const addresses = result.addresses || [];
        setShippingAddresses(addresses);

        if (addresses.length > 0 && forceInit) {
          const sortedAddresses = [...addresses].sort((a: ShippingAddress, b: ShippingAddress) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
          const firstBranch: BranchOrder = {
            shipping_address_id: sortedAddresses[0].id,
            address_name: sortedAddresses[0].address_name,
            delivery_notes: '',
            shipping_fee: 0,
            products: []
          };
          setBranchOrders([firstBranch]);
          setProductSearches(['']);
          setShowProductDropdowns([false]);
        }
      }
    } catch (error) {
      console.error('Error fetching shipping addresses:', error);
    }
  };

  const handleSelectCustomer = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerSearch(customer.name);
    setShowCustomerDropdown(false);
    setBranchOrders([]);
    setProductSearches([]);
    setShowProductDropdowns([]);
    setShippingAddresses([]);

    fetchShippingAddresses(customer.id);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch(`/api/customer-prices?customer_id=${customer.id}`, {
        headers: { 'Authorization': `Bearer ${sessionData?.session?.access_token || ''}` }
      });
      if (response.ok) {
        const result = await response.json();
        setCustomerPrices(result.prices || {});
      }
    } catch (error) {
      console.error('Error fetching customer prices:', error);
    }
  };

  // Copy from latest order
  const handleCopyLatestOrder = async () => {
    if (!selectedCustomer) return;

    try {
      setLoadingLatestOrder(true);
      setError('');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Fetch latest order for this customer
      const response = await fetch(`/api/orders?customer_id=${selectedCustomer.id}&limit=1`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });

      if (!response.ok) throw new Error('Failed to fetch orders');

      const result = await response.json();
      const orders = result.orders || [];

      if (orders.length === 0) {
        setError('ลูกค้านี้ยังไม่มีคำสั่งซื้อเก่า');
        setTimeout(() => setError(''), 3000);
        return;
      }

      const latestOrder = orders[0];

      // Fetch full order details
      const detailResponse = await fetch(`/api/orders?id=${latestOrder.id}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });

      if (!detailResponse.ok) throw new Error('Failed to fetch order details');

      const detailResult = await detailResponse.json();
      const order = detailResult.order;

      if (!order) throw new Error('Order not found');

      // Transform order data - group items by shipping address
      const branchMap = new Map<string, BranchOrder>();

      for (const item of order.items || []) {
        for (const shipment of item.shipments || []) {
          const addressId = shipment.shipping_address_id;
          const addressName = shipment.shipping_address?.address_name || 'ไม่ระบุ';

          if (!branchMap.has(addressId)) {
            branchMap.set(addressId, {
              shipping_address_id: addressId,
              address_name: addressName,
              delivery_notes: shipment.delivery_notes || '',
              shipping_fee: shipment.shipping_fee || 0,
              products: []
            });
          }

          const branch = branchMap.get(addressId)!;

          // Check if product already exists in this branch
          const existingProduct = branch.products.find(p => p.variation_id === item.variation_id);
          if (!existingProduct) {
            branch.products.push({
              variation_id: item.variation_id,
              product_id: item.product_id,
              product_code: item.product_code,
              product_name: item.product_name,
              bottle_size: item.bottle_size,
              quantity: shipment.quantity,
              unit_price: item.unit_price,
              discount_value: item.discount_type === 'amount' ? (item.discount_amount || 0) : (item.discount_percent || 0),
              discount_type: item.discount_type || 'percent'
            });
          }
        }
      }

      const branches = Array.from(branchMap.values());

      if (branches.length === 0) {
        setError('ไม่พบข้อมูลสินค้าใน Order เก่า');
        setTimeout(() => setError(''), 3000);
        return;
      }

      // Set branch orders
      setBranchOrders(branches);
      setProductSearches(branches.map(() => ''));
      setShowProductDropdowns(branches.map(() => false));
      setActiveBranchIndex(0);

      // Set other fields
      if (order.notes) setNotes(order.notes);
      if (order.internal_notes) setInternalNotes(order.internal_notes);
      if (order.discount_amount) setOrderDiscount(order.discount_amount);
      if (order.order_discount_type) setOrderDiscountType(order.order_discount_type);

      setSuccess(`คัดลอกจาก ${latestOrder.order_number} สำเร็จ`);
      setTimeout(() => setSuccess(''), 3000);

    } catch (error) {
      console.error('Error copying order:', error);
      setError('ไม่สามารถคัดลอกคำสั่งซื้อได้');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoadingLatestOrder(false);
    }
  };

  // Branch management
  const canAddBranch = shippingAddresses.length > 1 && branchOrders.length < shippingAddresses.length;

  const handleAddBranch = () => {
    if (!canAddBranch) return;

    const usedAddressIds = branchOrders.map(b => b.shipping_address_id);
    const availableAddress = shippingAddresses.find(a => !usedAddressIds.includes(a.id)) || shippingAddresses[0];

    const newBranch: BranchOrder = {
      shipping_address_id: availableAddress.id,
      address_name: availableAddress.address_name,
      delivery_notes: '',
      shipping_fee: 0,
      products: []
    };

    setBranchOrders([...branchOrders, newBranch]);
    setProductSearches([...productSearches, '']);
    setShowProductDropdowns([...showProductDropdowns, false]);
    setActiveBranchIndex(branchOrders.length);
  };

  const handleRemoveBranch = (index: number) => {
    if (branchOrders.length === 1) {
      setError('ต้องมีอย่างน้อย 1 สาขา');
      setTimeout(() => setError(''), 3000);
      return;
    }
    setBranchOrders(branchOrders.filter((_, i) => i !== index));
    setProductSearches(productSearches.filter((_, i) => i !== index));
    setShowProductDropdowns(showProductDropdowns.filter((_, i) => i !== index));
    if (activeBranchIndex >= branchOrders.length - 1) {
      setActiveBranchIndex(Math.max(0, branchOrders.length - 2));
    }
  };

  const handleUpdateBranchAddress = (index: number, addressId: string) => {
    const newBranchOrders = [...branchOrders];
    const address = shippingAddresses.find(a => a.id === addressId);
    if (address) {
      newBranchOrders[index].shipping_address_id = addressId;
      newBranchOrders[index].address_name = address.address_name;
      setBranchOrders(newBranchOrders);
    }
  };

  // Product management
  const handleAddProductToBranch = (branchIndex: number, product: Product) => {
    const existingProduct = branchOrders[branchIndex].products.find(
      p => p.variation_id === product.id
    );
    if (existingProduct) {
      setError('สินค้านี้มีอยู่ในสาขานี้แล้ว');
      setTimeout(() => setError(''), 3000);
      return;
    }

    let unit_price = 0;
    let discount_value = 0;
    const customerLastPrice = customerPrices[product.id];
    if (customerLastPrice) {
      unit_price = customerLastPrice.unit_price;
      discount_value = customerLastPrice.discount_percent;
    } else if (product.discount_price && product.discount_price > 0) {
      unit_price = product.discount_price;
    } else {
      unit_price = product.default_price;
    }

    const newProduct: BranchProduct = {
      variation_id: product.id,
      product_id: product.product_id,
      product_code: product.code,
      product_name: product.name,
      bottle_size: product.bottle_size,
      quantity: 1,
      unit_price,
      discount_value,
      discount_type: 'percent'
    };

    const newBranchOrders = [...branchOrders];
    newBranchOrders[branchIndex].products.push(newProduct);
    setBranchOrders(newBranchOrders);

    const newSearches = [...productSearches];
    newSearches[branchIndex] = '';
    setProductSearches(newSearches);
    const newDropdowns = [...showProductDropdowns];
    newDropdowns[branchIndex] = false;
    setShowProductDropdowns(newDropdowns);

    setTimeout(() => {
      const productIndex = newBranchOrders[branchIndex].products.length - 1;
      const inputKey = `${branchIndex}-${productIndex}`;
      const inputElement = quantityInputRefs.current[inputKey];
      if (inputElement) {
        inputElement.focus();
        inputElement.select();
      }
    }, 100);
  };

  const handleRemoveProductFromBranch = (branchIndex: number, productIndex: number) => {
    const newBranchOrders = [...branchOrders];
    newBranchOrders[branchIndex].products = newBranchOrders[branchIndex].products.filter(
      (_, i) => i !== productIndex
    );
    setBranchOrders(newBranchOrders);
  };

  const handleUpdateProductQuantity = (branchIndex: number, productIndex: number, quantity: number) => {
    const newBranchOrders = [...branchOrders];
    newBranchOrders[branchIndex].products[productIndex].quantity = Math.max(1, quantity);
    setBranchOrders(newBranchOrders);
  };

  const handleUpdateProductPrice = (branchIndex: number, productIndex: number, price: number) => {
    const newBranchOrders = [...branchOrders];
    newBranchOrders[branchIndex].products[productIndex].unit_price = Math.max(0, price);
    setBranchOrders(newBranchOrders);
  };

  const handleUpdateProductDiscount = (branchIndex: number, productIndex: number, value: number) => {
    const newBranchOrders = [...branchOrders];
    const product = newBranchOrders[branchIndex].products[productIndex];
    if (product.discount_type === 'percent') {
      product.discount_value = Math.max(0, Math.min(100, value));
    } else {
      product.discount_value = Math.max(0, value);
    }
    setBranchOrders(newBranchOrders);
  };

  const handleToggleProductDiscountType = (branchIndex: number, productIndex: number) => {
    const newBranchOrders = [...branchOrders];
    const product = newBranchOrders[branchIndex].products[productIndex];
    product.discount_type = product.discount_type === 'percent' ? 'amount' : 'percent';
    product.discount_value = 0;
    setBranchOrders(newBranchOrders);
  };

  const handleUpdateBranchShippingFee = (branchIndex: number, fee: number) => {
    const newBranchOrders = [...branchOrders];
    newBranchOrders[branchIndex].shipping_fee = Math.max(0, fee);
    setBranchOrders(newBranchOrders);
  };

  // Calculate totals
  const calculateProductSubtotal = (product: BranchProduct) => product.quantity * product.unit_price;
  const calculateProductDiscount = (product: BranchProduct) => {
    if (product.discount_type === 'percent') {
      return calculateProductSubtotal(product) * (product.discount_value / 100);
    }
    return product.discount_value;
  };
  const calculateProductTotal = (product: BranchProduct) => calculateProductSubtotal(product) - calculateProductDiscount(product);
  const calculateBranchTotal = (branch: BranchOrder) => branch.products.reduce((sum, p) => sum + calculateProductTotal(p), 0);

  const itemsTotal = branchOrders.reduce((sum, branch) => sum + calculateBranchTotal(branch), 0);
  const totalShippingFee = branchOrders.reduce((sum, branch) => sum + (branch.shipping_fee || 0), 0);
  const calculateOrderDiscount = () => {
    if (orderDiscountType === 'percent') {
      return itemsTotal * (orderDiscount / 100);
    }
    return orderDiscount;
  };
  const totalWithVAT = itemsTotal - calculateOrderDiscount() + totalShippingFee;
  const subtotal = Math.round((totalWithVAT / 1.07) * 100) / 100;
  const vat = totalWithVAT - subtotal;
  const total = totalWithVAT;

  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCustomer) { setError('กรุณาเลือกลูกค้า'); return; }
    if (!deliveryDate) { setError('กรุณาเลือกวันที่ส่งของ'); return; }
    if (branchOrders.length === 0) { setError('กรุณาเพิ่มอย่างน้อย 1 สาขา'); return; }
    for (let i = 0; i < branchOrders.length; i++) {
      if (branchOrders[i].products.length === 0) {
        setError(`กรุณาเพิ่มสินค้าสำหรับสาขา: ${branchOrders[i].address_name}`);
        return;
      }
    }

    try {
      setSaving(true);
      setError('');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const items = branchOrders.flatMap(branch =>
        branch.products.map(product => ({
          variation_id: product.variation_id,
          product_id: product.product_id,
          product_code: product.product_code,
          product_name: product.product_name,
          bottle_size: product.bottle_size,
          quantity: product.quantity,
          unit_price: product.unit_price,
          discount_value: product.discount_value,
          discount_type: product.discount_type,
          shipments: [{
            shipping_address_id: branch.shipping_address_id,
            quantity: product.quantity,
            shipping_fee: branch.shipping_fee || 0
          }]
        }))
      );

      const orderData = {
        customer_id: selectedCustomer.id,
        delivery_date: deliveryDate || undefined,
        discount_amount: calculateOrderDiscount(),
        order_discount_type: orderDiscountType,
        notes: notes || undefined,
        internal_notes: internalNotes || undefined,
        items
      };

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(orderData)
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'เกิดข้อผิดพลาด');

      setSuccess('สร้างคำสั่งซื้อสำเร็จ');

      if (onSuccess) {
        setTimeout(() => onSuccess(result.order?.id || result.id), 1000);
      } else {
        setTimeout(() => { router.push('/orders'); }, 1500);
      }
    } catch (error) {
      console.error('Error creating order:', error);
      setError(error instanceof Error ? error.message : 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      router.back();
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-[#E9B308] animate-spin" />
      </div>
    );
  }

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.customer_code.toLowerCase().includes(customerSearch.toLowerCase())
  );

  const getBottleSizeDisplay = (bottleSize?: string) => {
    return bottleSize || '';
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
          {success}
        </div>
      )}

      {/* Step 1: Customer + Delivery Date */}
      <div className={`bg-white rounded-lg ${embedded ? '' : 'border border-gray-200'} p-4`}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Customer Search */}
          <div className="relative md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ลูกค้า <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={customerSearch}
                onChange={(e) => {
                  setCustomerSearch(e.target.value);
                  setShowCustomerDropdown(true);
                }}
                onFocus={() => setShowCustomerDropdown(true)}
                placeholder="ค้นหาชื่อลูกค้าหรือรหัส..."
                className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308] text-sm"
                disabled={!!preselectedCustomerId && !!selectedCustomer}
              />
            </div>
            {showCustomerDropdown && customerSearch && !preselectedCustomerId && (
              <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                {filteredCustomers.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-gray-500">ไม่พบลูกค้า</div>
                ) : (
                  filteredCustomers.map(customer => (
                    <button
                      key={customer.id}
                      type="button"
                      onClick={() => handleSelectCustomer(customer)}
                      className="w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors"
                    >
                      <div className="text-sm font-medium">{customer.name}</div>
                      <div className="text-xs text-gray-500">{customer.customer_code}</div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Delivery Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              วันที่ส่งของ <span className="text-red-500">*</span>
            </label>
            <DateRangePicker
              value={deliveryDateValue}
              onChange={(val) => setDeliveryDateValue(val)}
              asSingle={true}
              useRange={false}
              showShortcuts={false}
              showFooter={false}
              placeholder="เลือกวันที่ส่ง"
            />
          </div>
        </div>

        {/* Selected customer info */}
        {selectedCustomer && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-gray-500">ผู้ติดต่อ: <span className="text-gray-900 font-medium">{selectedCustomer.contact_person || '-'}</span></span>
              <span className="text-gray-300">|</span>
              <span className="text-gray-500">โทร: <span className="text-gray-900">{selectedCustomer.phone || '-'}</span></span>
              {shippingAddresses.length > 0 && (
                <>
                  <span className="text-gray-300">|</span>
                  <span className="text-gray-500">
                    <MapPin className="w-3.5 h-3.5 inline mr-0.5" />
                    {shippingAddresses.length} สาขา
                  </span>
                </>
              )}
            </div>
            {/* Copy from latest order button */}
            <button
              type="button"
              onClick={handleCopyLatestOrder}
              disabled={loadingLatestOrder}
              className="p-2 text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
              title="คัดลอก Order ล่าสุด"
            >
              {loadingLatestOrder ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>
        )}
      </div>

      {/* No Shipping Addresses Warning */}
      {selectedCustomer && shippingAddresses.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <MapPin className="w-5 h-5 text-yellow-600 flex-shrink-0" />
            <div className="flex-1">
              <span className="font-medium text-yellow-800">ลูกค้านี้ยังไม่มีที่อยู่จัดส่ง</span>
              <span className="text-yellow-700 text-sm ml-2">กรุณาเพิ่มที่อยู่จัดส่งก่อน</span>
            </div>
            <button
              type="button"
              onClick={() => window.open(`/customers/${selectedCustomer.id}?tab=addresses`, '_blank')}
              className="bg-yellow-600 text-white px-3 py-1.5 rounded-lg hover:bg-yellow-700 transition-colors text-sm font-medium whitespace-nowrap"
            >
              เพิ่มที่อยู่
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Branch Orders - Product List */}
      {selectedCustomer && branchOrders.length > 0 && (
        <div className={`bg-white rounded-lg ${embedded ? '' : 'border border-gray-200'} overflow-visible`}>
          {/* Branch Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            {/* Branch Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto">
              {branchOrders.map((branch, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setActiveBranchIndex(index)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                    activeBranchIndex === index
                      ? 'bg-[#E9B308] text-[#00231F]'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5" />
                  {branch.address_name}
                  {branch.products.length > 0 && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      activeBranchIndex === index ? 'bg-[#00231F]/20' : 'bg-gray-200'
                    }`}>
                      {branch.products.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleAddBranch}
              disabled={!canAddBranch}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ml-2 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-blue-50"
              title={!canAddBranch ? (shippingAddresses.length <= 1 ? 'ลูกค้ามีสาขาเดียว' : 'เพิ่มครบทุกสาขาแล้ว') : 'เพิ่มสาขา'}
            >
              <Plus className="w-4 h-4" />
              เพิ่มสาขา
            </button>
          </div>

          {/* Active Branch Content */}
          {branchOrders.map((branch, branchIndex) => (
            <div
              key={branchIndex}
              className={branchIndex === activeBranchIndex ? 'block' : 'hidden'}
            >
              {/* Branch address selector */}
              <div className="px-4 py-3 bg-gray-50/50 border-b border-gray-100">
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex-1">
                    <select
                      value={branch.shipping_address_id}
                      onChange={(e) => handleUpdateBranchAddress(branchIndex, e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308] text-sm bg-white"
                    >
                      {shippingAddresses.map(addr => (
                        <option key={addr.id} value={addr.id}>
                          {addr.address_name} - {addr.address_line1}, {addr.district}, {addr.amphoe}, {addr.province}
                        </option>
                      ))}
                    </select>
                  </div>
                  {branchOrders.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveBranch(branchIndex)}
                      className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                      title="ลบสาขานี้"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Products Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b text-xs">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-gray-500 uppercase">สินค้า</th>
                      <th className="px-2 py-2 text-center font-medium text-gray-500 uppercase w-16">จำนวน</th>
                      <th className="px-2 py-2 text-right font-medium text-gray-500 uppercase w-24">ราคา</th>
                      <th className="px-2 py-2 text-center font-medium text-gray-500 uppercase w-24">ส่วนลด</th>
                      <th className="px-2 py-2 text-right font-medium text-gray-500 uppercase w-24">รวม</th>
                      <th className="px-1 py-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {branch.products.map((product, productIndex) => {
                      const capacityDisplay = getBottleSizeDisplay(product.bottle_size);
                      return (
                        <tr key={product.variation_id} className="hover:bg-gray-50/50">
                          <td className="px-4 py-2.5">
                            <div className="text-sm font-medium text-gray-900">
                              {product.product_name}
                              {capacityDisplay && <span className="text-gray-400 font-normal ml-1">({capacityDisplay})</span>}
                            </div>
                            <div className="text-xs text-gray-400">{product.product_code}</div>
                          </td>
                          <td className="px-2 py-2.5 text-center">
                            <input
                              ref={(el) => { quantityInputRefs.current[`${branchIndex}-${productIndex}`] = el; }}
                              type="number"
                              min="1"
                              value={product.quantity}
                              onChange={(e) => handleUpdateProductQuantity(branchIndex, productIndex, parseInt(e.target.value) || 1)}
                              className="w-14 px-1.5 py-1 border border-gray-300 rounded text-center text-sm focus:outline-none focus:ring-2 focus:ring-[#E9B308]"
                            />
                          </td>
                          <td className="px-2 py-2.5 text-right">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={product.unit_price}
                              onChange={(e) => handleUpdateProductPrice(branchIndex, productIndex, parseFloat(e.target.value) || 0)}
                              className="w-20 px-1.5 py-1 border border-gray-300 rounded text-right text-sm focus:outline-none focus:ring-2 focus:ring-[#E9B308]"
                            />
                          </td>
                          <td className="px-2 py-2.5">
                            <div className="flex items-stretch">
                              <input
                                type="number"
                                min="0"
                                max={product.discount_type === 'percent' ? 100 : undefined}
                                step="0.01"
                                value={product.discount_value}
                                onChange={(e) => handleUpdateProductDiscount(branchIndex, productIndex, parseFloat(e.target.value) || 0)}
                                className="w-14 px-1.5 py-1 border border-gray-300 rounded-l border-r-0 text-center text-sm focus:outline-none focus:ring-2 focus:ring-[#E9B308] focus:z-10"
                              />
                              <button
                                type="button"
                                onClick={() => handleToggleProductDiscountType(branchIndex, productIndex)}
                                className="px-2 text-xs font-medium border border-gray-300 rounded-r bg-gray-50 hover:bg-gray-100 transition-colors min-w-[28px] flex items-center justify-center"
                                title={product.discount_type === 'percent' ? 'เปลี่ยนเป็นจำนวนเงิน' : 'เปลี่ยนเป็นเปอร์เซ็นต์'}
                              >
                                {product.discount_type === 'percent' ? '%' : '฿'}
                              </button>
                            </div>
                          </td>
                          <td className="px-2 py-2.5 text-right text-sm font-medium text-gray-900">
                            {calculateProductTotal(product).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-1 py-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveProductFromBranch(branchIndex, productIndex)}
                              className="text-gray-400 hover:text-red-600 p-0.5 rounded transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Add Product Search */}
              <div className="px-4 py-3 border-t border-gray-100">
                <div className="relative">
                  <div className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg hover:border-[#E9B308] transition-colors bg-white">
                    <Plus className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <input
                      type="text"
                      value={productSearches[branchIndex] || ''}
                      onChange={(e) => {
                        const newSearches = [...productSearches];
                        newSearches[branchIndex] = e.target.value;
                        setProductSearches(newSearches);
                        const newDropdowns = [...showProductDropdowns];
                        newDropdowns[branchIndex] = true;
                        setShowProductDropdowns(newDropdowns);
                      }}
                      onFocus={() => {
                        const newDropdowns = [...showProductDropdowns];
                        newDropdowns[branchIndex] = true;
                        setShowProductDropdowns(newDropdowns);
                      }}
                      onBlur={() => {
                        setTimeout(() => {
                          const newDropdowns = [...showProductDropdowns];
                          newDropdowns[branchIndex] = false;
                          setShowProductDropdowns(newDropdowns);
                        }, 200);
                      }}
                      placeholder="เพิ่มสินค้า — พิมพ์ชื่อหรือรหัส..."
                      className="flex-1 outline-none bg-transparent text-sm"
                    />
                  </div>
                  {showProductDropdowns[branchIndex] && productSearches[branchIndex] && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-72 overflow-auto">
                      {products.filter(p =>
                        p.name.toLowerCase().includes(productSearches[branchIndex].toLowerCase()) ||
                        p.code.toLowerCase().includes(productSearches[branchIndex].toLowerCase())
                      ).length === 0 ? (
                        <div className="px-4 py-3 text-sm text-gray-500">ไม่พบสินค้า</div>
                      ) : (
                        products
                          .filter(p =>
                            p.name.toLowerCase().includes(productSearches[branchIndex].toLowerCase()) ||
                            p.code.toLowerCase().includes(productSearches[branchIndex].toLowerCase())
                          )
                          .map(product => {
                            const capacityDisplay = getBottleSizeDisplay(product.bottle_size);
                            return (
                              <button
                                key={product.id}
                                type="button"
                                onClick={() => handleAddProductToBranch(branchIndex, product)}
                                className="w-full px-3 py-2 text-left hover:bg-gray-50 transition-colors flex items-center gap-3"
                              >
                                {product.image ? (
                                  <img src={product.image} alt={product.name} className="w-8 h-8 object-cover rounded flex-shrink-0" />
                                ) : (
                                  <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center flex-shrink-0">
                                    <Package className="w-4 h-4 text-gray-400" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium truncate">
                                    {product.name} {capacityDisplay && <span className="text-gray-400 font-normal">({capacityDisplay})</span>}
                                  </div>
                                  <div className="text-xs text-gray-400">{product.code} · ฿{product.default_price}</div>
                                </div>
                              </button>
                            );
                          })
                      )}
                    </div>
                  )}
                </div>
              </div>

              {branch.products.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <Package className="w-10 h-10 mx-auto mb-2" />
                  <p className="text-sm">เพิ่มสินค้าโดยพิมพ์ค้นหาด้านบน</p>
                </div>
              )}

              {/* Branch Total */}
              {branch.products.length > 0 && (
                <div className="px-4 py-3 bg-gray-50 border-t">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-600">
                        ยอดรวมสาขา {branch.address_name}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm text-gray-500">ค่าส่ง:</span>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">฿</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={branch.shipping_fee || ''}
                            onChange={(e) => handleUpdateBranchShippingFee(branchIndex, parseFloat(e.target.value) || 0)}
                            placeholder="0"
                            className="w-24 pl-6 pr-2 py-1 border border-gray-300 rounded text-right text-sm focus:outline-none focus:ring-2 focus:ring-[#E9B308]"
                          />
                        </div>
                      </div>
                    </div>
                    <span className="text-lg font-bold text-[#E9B308]">
                      ฿{(calculateBranchTotal(branch) + (branch.shipping_fee || 0)).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Step 3: Summary */}
      {branchOrders.length > 0 && branchOrders.some(b => b.products.length > 0) && (
        <div className={`bg-white rounded-lg ${embedded ? '' : 'border border-gray-200'} p-4`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Notes */}
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  หมายเหตุ <span className="text-gray-400 font-normal">(แสดงในบิล / การจัดส่ง)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308] text-sm"
                  placeholder="หมายเหตุสำหรับลูกค้า, การจัดส่ง..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-orange-700 mb-1">
                  หมายเหตุภายใน <span className="text-orange-400 font-normal">(ไม่แสดงในบิล)</span>
                </label>
                <textarea
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2.5 border border-orange-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 text-sm bg-orange-50"
                  placeholder="หมายเหตุภายใน..."
                />
              </div>
            </div>

            {/* Order Summary */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">สรุปคำสั่งซื้อ</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>ยอดรวมสินค้า (รวม VAT)</span>
                  <span>฿{itemsTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                </div>
                {totalShippingFee > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>ค่าจัดส่ง</span>
                    <span>฿{totalShippingFee.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">ส่วนลดรวม</span>
                  <div className="flex items-stretch">
                    <input
                      type="number"
                      min="0"
                      max={orderDiscountType === 'percent' ? 100 : undefined}
                      step="0.01"
                      value={orderDiscount}
                      onChange={(e) => setOrderDiscount(parseFloat(e.target.value) || 0)}
                      className="w-20 px-2 py-1 border border-gray-300 rounded-l border-r-0 text-right text-sm focus:outline-none focus:ring-2 focus:ring-[#E9B308] focus:z-10"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setOrderDiscountType(orderDiscountType === 'percent' ? 'amount' : 'percent');
                        setOrderDiscount(0);
                      }}
                      className="px-2 text-xs font-medium border border-gray-300 rounded-r bg-gray-50 hover:bg-gray-100 transition-colors min-w-[28px] flex items-center justify-center"
                      title={orderDiscountType === 'percent' ? 'เปลี่ยนเป็นจำนวนเงิน' : 'เปลี่ยนเป็นเปอร์เซ็นต์'}
                    >
                      {orderDiscountType === 'percent' ? '%' : '฿'}
                    </button>
                  </div>
                </div>
                <div className="flex justify-between text-gray-500 pt-2 border-t border-gray-200">
                  <span>ยอดก่อน VAT</span>
                  <span>฿{subtotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>VAT 7%</span>
                  <span>฿{vat.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200">
                  <span>ยอดรวมสุทธิ</span>
                  <span className="text-[#E9B308]">฿{total.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {branchOrders.length > 0 && branchOrders.some(b => b.products.length > 0) && (
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={handleCancel}
            className="px-5 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            disabled={saving}
            className="bg-[#E9B308] text-[#00231F] px-5 py-2 rounded-lg hover:bg-[#d4a307] transition-colors flex items-center gap-2 disabled:opacity-50 text-sm font-medium"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                กำลังบันทึก...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                บันทึกคำสั่งซื้อ
              </>
            )}
          </button>
        </div>
      )}
    </form>
  );
}
