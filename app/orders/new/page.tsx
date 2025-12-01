'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/layout/Layout';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Search,
  Loader2,
  Package,
  MapPin,
  X,
  Save
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
  id: string; // variation_id for variations, sellable_product_id for simple products
  sellable_product_id: string;
  code: string;
  name: string;
  image?: string;
  bottle_size?: string;
  bottle_capacity_ml?: number;
  product_type: 'simple' | 'variation';
  default_price: number;
  discount_price?: number;
  stock: number;
}

// Branch-First structure
interface BranchProduct {
  variation_id: string;
  sellable_product_id: string;
  product_code: string;
  product_name: string;
  bottle_size?: string;
  bottle_capacity_ml?: number;
  quantity: number;
  unit_price: number;
  discount_percent: number;
}

interface BranchOrder {
  shipping_address_id: string;
  address_name: string;
  delivery_notes: string;
  products: BranchProduct[];
}

export default function NewOrderPage() {
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

  // Customer pricing (last prices paid by customer for each product)
  const [customerPrices, setCustomerPrices] = useState<Record<string, { unit_price: number; discount_percent: number }>>({});

  // Branch Orders (Branch-First approach)
  const [branchOrders, setBranchOrders] = useState<BranchOrder[]>([]);
  const [activeBranchIndex, setActiveBranchIndex] = useState(0);

  // Order details
  const [deliveryDate, setDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [orderDiscount, setOrderDiscount] = useState(0);

  // Product search per branch
  const [productSearches, setProductSearches] = useState<string[]>([]);
  const [showProductDropdowns, setShowProductDropdowns] = useState<boolean[]>([]);

  // Refs for quantity inputs (to focus after adding product)
  const quantityInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  // Fetch customers
  useEffect(() => {
    if (!authLoading && userProfile) {
      fetchCustomers();
      fetchProducts();
    }
  }, [authLoading, userProfile]);

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, customer_code, name, contact_person, phone')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Fetch sellable products and bottle types in parallel using API routes
      const [productsResponse, bottleTypesResponse] = await Promise.all([
        fetch('/api/sellable-products', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        }),
        fetch('/api/bottle-types', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        })
      ]);

      if (!productsResponse.ok) throw new Error('Failed to fetch products');

      const result = await productsResponse.json();
      const sellableProducts = result.sellable_products || [];

      // Create bottle type lookup map from API response
      const bottleTypeMap = new Map<string, { size: string; capacity_ml: number }>();
      if (bottleTypesResponse.ok) {
        const bottleTypesResult = await bottleTypesResponse.json();
        (bottleTypesResult.bottle_types || []).forEach((bt: any) => {
          bottleTypeMap.set(bt.id, { size: bt.size, capacity_ml: bt.capacity_ml });
        });
      }

      // Flatten variations into individual products
      const flatProducts: Product[] = [];

      sellableProducts.forEach((sp: any) => {
        if (sp.product_type === 'simple') {
          // Simple products also have one variation row - get variation_id from variations[0]
          const variation_id = sp.variations && sp.variations.length > 0 ? sp.variations[0].variation_id : null;
          const bottleTypeId = sp.simple_bottle_type_id || (sp.variations && sp.variations[0]?.bottle_type_id);
          const bottleInfo = bottleTypeId ? bottleTypeMap.get(bottleTypeId) : null;
          flatProducts.push({
            id: variation_id || sp.sellable_product_id, // Use variation_id for foreign key
            sellable_product_id: sp.sellable_product_id,
            code: sp.code,
            name: sp.name,
            image: sp.image,
            bottle_size: sp.simple_bottle_size,
            bottle_capacity_ml: sp.simple_bottle_capacity_ml || bottleInfo?.capacity_ml,
            product_type: 'simple',
            default_price: sp.simple_default_price || 0,
            discount_price: sp.simple_discount_price || 0,
            stock: sp.simple_stock || 0
          });
        } else {
          (sp.variations || []).forEach((v: any) => {
            const bottleInfo = v.bottle_type_id ? bottleTypeMap.get(v.bottle_type_id) : null;
            flatProducts.push({
              id: v.variation_id,
              sellable_product_id: sp.sellable_product_id,
              code: `${sp.code}-${v.bottle_size}`,
              name: sp.name,
              image: sp.image,
              bottle_size: v.bottle_size,
              bottle_capacity_ml: v.bottle_capacity_ml || bottleInfo?.capacity_ml,
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
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        const addresses = result.addresses || [];
        setShippingAddresses(addresses);

        // Auto-initialize first branch if addresses exist
        if (addresses.length > 0 && forceInit) {
          const sortedAddresses = [...addresses].sort((a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );

          const firstBranch: BranchOrder = {
            shipping_address_id: sortedAddresses[0].id,
            address_name: sortedAddresses[0].address_name,
            delivery_notes: '',
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

  // Handle customer selection
  const handleSelectCustomer = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerSearch(customer.name);
    setShowCustomerDropdown(false);

    // Reset branch orders when selecting a new customer
    setBranchOrders([]);
    setProductSearches([]);
    setShowProductDropdowns([]);
    setShippingAddresses([]);

    fetchShippingAddresses(customer.id);

    // Fetch customer's last prices
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch(`/api/customer-prices?customer_id=${customer.id}`, {
        headers: {
          'Authorization': `Bearer ${sessionData?.session?.access_token || ''}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        setCustomerPrices(result.prices || {});
      }
    } catch (error) {
      console.error('Error fetching customer prices:', error);
    }
  };

  // Branch management
  const handleAddBranch = () => {
    if (shippingAddresses.length === 0) {
      setError('ลูกค้านี้ยังไม่มีที่อยู่จัดส่ง');
      return;
    }

    // Find first available address not used yet
    const usedAddressIds = branchOrders.map(b => b.shipping_address_id);
    const availableAddress = shippingAddresses.find(a => !usedAddressIds.includes(a.id)) || shippingAddresses[0];

    const newBranch: BranchOrder = {
      shipping_address_id: availableAddress.id,
      address_name: availableAddress.address_name,
      delivery_notes: '',
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

  const handleUpdateBranchNotes = (index: number, notes: string) => {
    const newBranchOrders = [...branchOrders];
    newBranchOrders[index].delivery_notes = notes;
    setBranchOrders(newBranchOrders);
  };

  // Product management per branch
  const handleAddProductToBranch = (branchIndex: number, product: Product) => {
    const existingProduct = branchOrders[branchIndex].products.find(
      p => p.variation_id === product.id
    );

    if (existingProduct) {
      setError('สินค้านี้มีอยู่ในสาขานี้แล้ว');
      setTimeout(() => setError(''), 3000);
      return;
    }

    // Determine price
    let unit_price = 0;
    let discount_percent = 0;

    const customerLastPrice = customerPrices[product.id];
    if (customerLastPrice) {
      unit_price = customerLastPrice.unit_price;
      discount_percent = customerLastPrice.discount_percent;
    } else if (product.discount_price && product.discount_price > 0) {
      unit_price = product.discount_price;
    } else {
      unit_price = product.default_price;
    }

    const newProduct: BranchProduct = {
      variation_id: product.id,
      sellable_product_id: product.sellable_product_id,
      product_code: product.code,
      product_name: product.name,
      bottle_size: product.bottle_size,
      bottle_capacity_ml: product.bottle_capacity_ml,
      quantity: 1,
      unit_price,
      discount_percent
    };

    const newBranchOrders = [...branchOrders];
    newBranchOrders[branchIndex].products.push(newProduct);
    setBranchOrders(newBranchOrders);

    // Clear search
    const newSearches = [...productSearches];
    newSearches[branchIndex] = '';
    setProductSearches(newSearches);

    const newDropdowns = [...showProductDropdowns];
    newDropdowns[branchIndex] = false;
    setShowProductDropdowns(newDropdowns);

    // Focus on quantity input after adding product
    setTimeout(() => {
      const productIndex = newBranchOrders[branchIndex].products.length - 1;
      const inputKey = `${branchIndex}-${productIndex}`;
      const inputElement = quantityInputRefs.current[inputKey];
      if (inputElement) {
        inputElement.focus();
        inputElement.select(); // Highlight all text
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

  const handleUpdateProductDiscount = (branchIndex: number, productIndex: number, discount: number) => {
    const newBranchOrders = [...branchOrders];
    newBranchOrders[branchIndex].products[productIndex].discount_percent = Math.max(0, Math.min(100, discount));
    setBranchOrders(newBranchOrders);
  };

  // Calculate totals
  const calculateProductSubtotal = (product: BranchProduct) => {
    return product.quantity * product.unit_price;
  };

  const calculateProductDiscount = (product: BranchProduct) => {
    return calculateProductSubtotal(product) * (product.discount_percent / 100);
  };

  const calculateProductTotal = (product: BranchProduct) => {
    return calculateProductSubtotal(product) - calculateProductDiscount(product);
  };

  const calculateBranchTotal = (branch: BranchOrder) => {
    return branch.products.reduce((sum, p) => sum + calculateProductTotal(p), 0);
  };

  // Prices already include VAT, so we need to calculate backwards
  const itemsTotal = branchOrders.reduce((sum, branch) => sum + calculateBranchTotal(branch), 0);
  const totalWithVAT = itemsTotal - orderDiscount; // This is the final total (already includes VAT)
  const subtotal = Math.round((totalWithVAT / 1.07) * 100) / 100; // Calculate subtotal (before VAT)
  const vat = totalWithVAT - subtotal; // VAT amount
  const total = totalWithVAT; // Final total (same as totalWithVAT)

  // Validate and submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCustomer) {
      setError('กรุณาเลือกลูกค้า');
      return;
    }

    if (branchOrders.length === 0) {
      setError('กรุณาเพิ่มอย่างน้อย 1 สาขา');
      return;
    }

    // Check if all branches have products
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
      if (!session) {
        throw new Error('No session');
      }

      // Convert branch-first structure to flat order items
      // Each product in each branch becomes a separate order_item with exactly one shipment
      const items = branchOrders.flatMap(branch =>
        branch.products.map(product => ({
          variation_id: product.variation_id,
          sellable_product_id: product.sellable_product_id,
          product_code: product.product_code,
          product_name: product.product_name,
          bottle_size: product.bottle_size,
          quantity: product.quantity,
          unit_price: product.unit_price,
          discount_percent: product.discount_percent,
          shipments: [{
            shipping_address_id: branch.shipping_address_id,
            quantity: product.quantity,
            delivery_notes: branch.delivery_notes || undefined
          }]
        }))
      );

      const orderData = {
        customer_id: selectedCustomer.id,
        delivery_date: deliveryDate || undefined,
        discount_amount: orderDiscount,
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

      if (!response.ok) {
        throw new Error(result.error || 'เกิดข้อผิดพลาด');
      }

      setSuccess('สร้างคำสั่งซื้อสำเร็จ');
      setTimeout(() => {
        router.push('/orders');
      }, 1500);
    } catch (error) {
      console.error('Error creating order:', error);
      setError(error instanceof Error ? error.message : 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
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

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.customer_code.toLowerCase().includes(customerSearch.toLowerCase())
  );

  return (
    <Layout>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </button>
          <h1 className="text-3xl font-bold text-gray-900">สร้างคำสั่งซื้อใหม่</h1>
        </div>

        {/* Messages */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
            {success}
          </div>
        )}

        {/* Customer Selection */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">ข้อมูลลูกค้า</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                เลือกลูกค้า <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value);
                    setShowCustomerDropdown(true);
                  }}
                  onFocus={() => setShowCustomerDropdown(true)}
                  placeholder="ค้นหาชื่อลูกค้าหรือรหัส..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308]"
                  required
                />
              </div>
              {showCustomerDropdown && customerSearch && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
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
                        <div className="font-medium">{customer.name}</div>
                        <div className="text-sm text-gray-500">{customer.customer_code}</div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {selectedCustomer && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">ผู้ติดต่อ</div>
                <div className="font-medium">{selectedCustomer.contact_person || '-'}</div>
                <div className="text-sm text-gray-600">{selectedCustomer.phone || '-'}</div>
              </div>
            )}
          </div>

          {selectedCustomer && shippingAddresses.length > 0 && (
            <div className="mt-4">
              <div className="text-sm text-gray-600 mb-2">ที่อยู่จัดส่ง ({shippingAddresses.length} แห่ง)</div>
              <div className="flex flex-wrap gap-2">
                {shippingAddresses.map(addr => (
                  <div key={addr.id} className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {addr.address_name}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* No Shipping Addresses Warning */}
        {selectedCustomer && shippingAddresses.length === 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <MapPin className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-yellow-800">ลูกค้านี้ยังไม่มีที่อยู่จัดส่ง</h3>
                <p className="text-yellow-700 text-sm mt-1">กรุณาเพิ่มที่อยู่จัดส่งก่อนสร้างคำสั่งซื้อ</p>
                <button
                  type="button"
                  onClick={() => router.push(`/customers/${selectedCustomer.id}?tab=addresses`)}
                  className="mt-3 bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 transition-colors text-sm font-medium"
                >
                  ไปเพิ่มที่อยู่จัดส่ง
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Branch Orders */}
        {selectedCustomer && branchOrders.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 overflow-visible">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">รายการสินค้าแยกตามสาขา</h2>
              <button
                type="button"
                onClick={handleAddBranch}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                เพิ่มสาขา
              </button>
            </div>

            {/* Branch Tabs (only show if more than one branch) */}
            {branchOrders.length > 1 && (
              <div className="flex gap-2 mb-4 border-b overflow-x-auto">
                {branchOrders.map((branch, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setActiveBranchIndex(index)}
                    className={`px-4 py-2 font-medium whitespace-nowrap border-b-2 transition-colors ${
                      activeBranchIndex === index
                        ? 'border-[#E9B308] text-[#E9B308]'
                        : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {branch.address_name}
                    {branch.products.length > 0 && (
                      <span className="ml-2 text-xs bg-gray-200 px-2 py-0.5 rounded-full">
                        {branch.products.length}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Active Branch */}
            {branchOrders.map((branch, branchIndex) => (
              <div
                key={branchIndex}
                className={branchIndex === activeBranchIndex ? 'block' : 'hidden'}
              >
                {/* Branch Details */}
                <div className="bg-gray-50 p-4 rounded-lg mb-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        สาขา <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={branch.shipping_address_id}
                        onChange={(e) => handleUpdateBranchAddress(branchIndex, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308]"
                      >
                        {shippingAddresses.map(addr => (
                          <option key={addr.id} value={addr.id}>
                            {addr.address_name} - {addr.address_line1}, {addr.district}, {addr.amphoe}, {addr.province}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        หมายเหตุการจัดส่ง
                      </label>
                      <input
                        type="text"
                        value={branch.delivery_notes}
                        onChange={(e) => handleUpdateBranchNotes(branchIndex, e.target.value)}
                        placeholder="หมายเหตุสำหรับสาขานี้..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308]"
                      />
                    </div>
                  </div>
                  {branchOrders.length > 1 && (
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleRemoveBranch(branchIndex)}
                        className="text-red-600 hover:text-red-700 text-sm flex items-center gap-1"
                      >
                        <Trash2 className="w-4 h-4" />
                        ลบสาขานี้
                      </button>
                    </div>
                  )}
                </div>

                {/* Products Table */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">สินค้า</th>
                        <th className="px-4 py-2 text-center text-sm font-medium text-gray-700 w-24">จำนวน</th>
                        <th className="px-4 py-2 text-right text-sm font-medium text-gray-700 w-32">ราคา/หน่วย</th>
                        <th className="px-4 py-2 text-center text-sm font-medium text-gray-700 w-24">ส่วนลด%</th>
                        <th className="px-4 py-2 text-right text-sm font-medium text-gray-700 w-32">รวม</th>
                        <th className="px-4 py-2 text-center text-sm font-medium text-gray-700 w-16">ลบ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {branch.products.map((product, productIndex) => {
                        // Format capacity for display
                        const capacityDisplay = product.bottle_capacity_ml
                          ? product.bottle_capacity_ml >= 1000
                            ? `${product.bottle_capacity_ml / 1000}L`
                            : `${product.bottle_capacity_ml}ml`
                          : '';
                        return (
                        <tr key={product.variation_id}>
                          <td className="px-4 py-3">
                            <div className="font-medium">
                              {product.product_name}
                              {capacityDisplay && <span className="text-gray-500 font-normal ml-1">ขวด {capacityDisplay}</span>}
                            </div>
                            <div className="text-xs text-gray-400">{product.product_code}</div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <input
                              ref={(el) => {
                                const key = `${branchIndex}-${productIndex}`;
                                quantityInputRefs.current[key] = el;
                              }}
                              type="number"
                              min="1"
                              value={product.quantity}
                              onChange={(e) => handleUpdateProductQuantity(branchIndex, productIndex, parseInt(e.target.value) || 1)}
                              className="w-20 px-2 py-1 border border-gray-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-[#E9B308]"
                            />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={product.unit_price}
                              onChange={(e) => handleUpdateProductPrice(branchIndex, productIndex, parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-right focus:outline-none focus:ring-2 focus:ring-[#E9B308]"
                            />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={product.discount_percent}
                              onChange={(e) => handleUpdateProductDiscount(branchIndex, productIndex, parseFloat(e.target.value) || 0)}
                              className="w-20 px-2 py-1 border border-gray-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-[#E9B308]"
                            />
                          </td>
                          <td className="px-4 py-3 text-right font-medium">
                            ฿{calculateProductTotal(product).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveProductFromBranch(branchIndex, productIndex)}
                              className="text-red-600 hover:text-red-700 p-1"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Add Product Search - Below table, aligned with product column */}
                <div className="mt-4">
                  <div className="relative w-full max-w-lg">
                    <div className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-[#E9B308] transition-colors bg-white">
                      <Plus className="w-5 h-5 text-gray-400 flex-shrink-0" />
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
                          // Delay to allow click on dropdown items
                          setTimeout(() => {
                            const newDropdowns = [...showProductDropdowns];
                            newDropdowns[branchIndex] = false;
                            setShowProductDropdowns(newDropdowns);
                          }, 200);
                        }}
                        placeholder="ค้นหาชื่อหรือรหัสสินค้า..."
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
                              // Format capacity: 1000ml -> 1L, otherwise show as ml
                              const capacityDisplay = product.bottle_capacity_ml
                                ? product.bottle_capacity_ml >= 1000
                                  ? `${product.bottle_capacity_ml / 1000}L`
                                  : `${product.bottle_capacity_ml}ml`
                                : '';
                              return (
                                <button
                                  key={product.id}
                                  type="button"
                                  onClick={() => handleAddProductToBranch(branchIndex, product)}
                                  className="w-full px-3 py-2 text-left hover:bg-gray-50 transition-colors flex items-center gap-3"
                                >
                                  {product.image ? (
                                    <img
                                      src={product.image}
                                      alt={product.name}
                                      className="w-10 h-10 object-cover rounded-lg flex-shrink-0"
                                    />
                                  ) : (
                                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                      <Package className="w-5 h-5 text-gray-400" />
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium truncate">
                                      {product.name} {capacityDisplay && <span className="text-gray-500 font-normal">ขวด {capacityDisplay}</span>}
                                    </div>
                                    <div className="text-xs text-gray-400">{product.code}</div>
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
                  <div className="text-center py-12 text-gray-500">
                    <Package className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                    <p>ยังไม่มีสินค้าในสาขานี้</p>
                    <p className="text-sm">ค้นหาและเพิ่มสินค้าด้านบน</p>
                  </div>
                )}

                {/* Branch Total */}
                {branch.products.length > 0 && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg flex justify-between items-center">
                    <span className="font-medium">ยอดรวมสาขานี้:</span>
                    <span className="text-lg font-bold text-[#E9B308]">
                      ฿{calculateBranchTotal(branch).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Order Summary and Details */}
        {branchOrders.length > 0 && branchOrders.some(b => b.products.length > 0) && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column (Desktop) / Second on Mobile - Delivery & Payment Info */}
              <div className="order-2 md:order-1 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    วันที่ส่งของ <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    หมายเหตุ
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308]"
                    placeholder="หมายเหตุสำหรับลูกค้า..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    หมายเหตุภายใน
                  </label>
                  <textarea
                    value={internalNotes}
                    onChange={(e) => setInternalNotes(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308]"
                    placeholder="หมายเหตุภายใน (ไม่แสดงให้ลูกค้า)..."
                  />
                </div>
              </div>

              {/* Right Column (Desktop) / First on Mobile - Order Summary */}
              <div className="order-1 md:order-2">
                <h2 className="text-lg font-semibold mb-4">สรุปคำสั่งซื้อ</h2>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>ยอดรวม (รวม VAT)</span>
                    <span>฿{itemsTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>ส่วนลดรวม</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={orderDiscount}
                      onChange={(e) => setOrderDiscount(parseFloat(e.target.value) || 0)}
                      className="w-32 px-3 py-1 border border-gray-300 rounded text-right focus:outline-none focus:ring-2 focus:ring-[#E9B308]"
                    />
                  </div>
                  <div className="flex justify-between text-sm text-gray-600 pt-2 border-t">
                    <span>ยอดก่อน VAT</span>
                    <span>฿{subtotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>VAT 7%</span>
                    <span>฿{vat.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-xl font-bold pt-3 border-t">
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
              onClick={() => router.back()}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <X className="w-5 h-5" />
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={saving}
              className="bg-[#E9B308] text-[#00231F] px-6 py-2 rounded-lg hover:bg-[#d4a307] transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  กำลังบันทึก...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  บันทึกคำสั่งซื้อ
                </>
              )}
            </button>
          </div>
        )}
      </form>
    </Layout>
  );
}
