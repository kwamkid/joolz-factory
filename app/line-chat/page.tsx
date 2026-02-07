'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/layout/Layout';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import {
  MessageCircle,
  Search,
  Send,
  User,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Link as LinkIcon,
  X,
  Check,
  Phone,
  ShoppingCart,
  History,
  AlertCircle,
  RotateCcw,
  ImagePlus,
  Smile,
  ArrowDown,
  Filter,
  ChevronDown,
  UserCheck,
  UserX,
  Clock,
  Bell
} from 'lucide-react';
import Image from 'next/image';
import OrderForm from '@/components/orders/OrderForm';

interface LineContact {
  id: string;
  line_user_id: string;
  display_name: string;
  picture_url?: string;
  status: string;
  customer_id?: string;
  customer?: {
    id: string;
    name: string;
    customer_code: string;
  };
  unread_count: number;
  last_message_at?: string;
  last_message?: string; // Preview of last message
  last_order_date?: string; // Last order date for linked customers
}

interface LineMessage {
  id: string;
  line_contact_id: string;
  direction: 'incoming' | 'outgoing';
  message_type: string;
  content: string;
  sent_by?: string;
  sent_by_user?: {
    id: string;
    name: string;
  };
  // Sender info (for incoming messages)
  sender_user_id?: string;
  sender_name?: string;
  sender_picture_url?: string;
  raw_message?: {
    stickerId?: string;
    packageId?: string;
    stickerResourceType?: string;
    latitude?: number;
    longitude?: number;
    address?: string;
    lineMessageId?: string; // For LINE content proxy
    imageUrl?: string; // Direct URL or from storage
    contentProvider?: {
      originalContentUrl?: string;
      previewImageUrl?: string;
    };
  };
  created_at: string;
  // Local status for optimistic updates
  _status?: 'sending' | 'sent' | 'failed';
  _tempId?: string; // Temporary ID for optimistic messages
}

interface Customer {
  id: string;
  name: string;
  customer_code: string;
  phone?: string;
}

export default function LineChatPage() {
  const router = useRouter();
  const { userProfile, loading: authLoading } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Contacts list state
  const [contacts, setContacts] = useState<LineContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [totalUnread, setTotalUnread] = useState(0);

  // Selected contact state
  const [selectedContact, setSelectedContact] = useState<LineContact | null>(null);
  const [messages, setMessages] = useState<LineMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Message input
  const [newMessage, setNewMessage] = useState('');
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Link customer modal
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  // Image upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Sticker picker
  const [showStickerPicker, setShowStickerPicker] = useState(false);

  // Scroll to bottom button
  const [showScrollButton, setShowScrollButton] = useState(false);

  // Right panel (split view) - desktop only: 'order' | 'history' | 'profile' | null
  const [rightPanel, setRightPanel] = useState<'order' | 'history' | 'profile' | null>(null);

  // Mobile view mode: 'contacts' | 'chat' | 'order' | 'history' | 'profile'
  const [mobileView, setMobileView] = useState<'contacts' | 'chat' | 'order' | 'history' | 'profile'>('contacts');

  // Order history data
  const [orderHistory, setOrderHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Advanced filters
  const [showFilterPopover, setShowFilterPopover] = useState(false);
  const [filterLinked, setFilterLinked] = useState<'all' | 'linked' | 'unlinked'>('all');
  const [filterUnread, setFilterUnread] = useState(false);
  // Filter by order days range: { min: X, max: Y } means "no order between X and Y days ago"
  const [filterOrderDaysRange, setFilterOrderDaysRange] = useState<{ min: number; max: number | null } | null>(null);

  // Check if any filter is active
  const hasActiveFilter = filterLinked !== 'all' || filterUnread || filterOrderDaysRange !== null;

  // Fetch contacts
  useEffect(() => {
    if (!authLoading && userProfile) {
      fetchContacts();
    }
  }, [authLoading, userProfile, searchTerm, filterLinked, filterUnread, filterOrderDaysRange]);

  // Fetch messages when contact selected
  useEffect(() => {
    if (selectedContact) {
      fetchMessages(selectedContact.id);
      setMobileView('chat'); // Switch to chat view on mobile
      // Focus input when contact selected
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [selectedContact]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle scroll to detect if user scrolled up
  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    // Show button if scrolled more than 100px from bottom
    setShowScrollButton(distanceFromBottom > 100);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Close filter popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (showFilterPopover && !target.closest('[data-filter-popover]')) {
        setShowFilterPopover(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFilterPopover]);

  // Supabase Realtime subscription for new messages
  useEffect(() => {
    // Subscribe to new messages
    const messagesChannel = supabase
      .channel('line_messages_realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'line_messages'
        },
        async (payload) => {
          const newMsg = payload.new as LineMessage;

          // If this message is for the selected contact, add it to messages
          if (selectedContact && newMsg.line_contact_id === selectedContact.id) {
            setMessages(prev => {
              // Check if message already exists (by real id)
              const existsById = prev.some(m => m.id === newMsg.id);
              if (existsById) return prev;

              // For outgoing messages: skip if we already have it (handled by sendMessage)
              // Match by content to detect our own optimistic messages
              if (newMsg.direction === 'outgoing') {
                const alreadyHave = prev.some(m => m.content === newMsg.content && m.direction === 'outgoing');
                if (alreadyHave) return prev;
              }

              // New incoming message - just add it
              return [...prev, newMsg];
            });

            // If incoming message for selected contact, reset unread in database
            if (newMsg.direction === 'incoming') {
              const { data: { session } } = await supabase.auth.getSession();
              if (session) {
                // Mark as read by fetching messages (which resets unread_count)
                fetch(`/api/line/messages?contact_id=${selectedContact.id}&limit=1`, {
                  headers: { 'Authorization': `Bearer ${session.access_token}` }
                }).catch(() => {});
              }
            }
          }

          // Refresh contacts to update unread counts and last_message_at
          fetchContacts();
        }
      )
      .subscribe();

    // Subscribe to contact updates (unread count, last_message_at)
    const contactsChannel = supabase
      .channel('line_contacts_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'line_contacts'
        },
        () => {
          fetchContacts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(contactsChannel);
    };
  }, [selectedContact]);

  const fetchContacts = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) return;

      const params = new URLSearchParams();
      if (searchTerm) params.set('search', searchTerm);
      if (filterUnread) params.set('unread_only', 'true');
      if (filterLinked === 'linked') params.set('linked_only', 'true');
      if (filterLinked === 'unlinked') params.set('unlinked_only', 'true');
      if (filterOrderDaysRange) {
        params.set('order_days_min', filterOrderDaysRange.min.toString());
        if (filterOrderDaysRange.max !== null) {
          params.set('order_days_max', filterOrderDaysRange.max.toString());
        }
      }

      const response = await fetch(`/api/line/contacts?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch contacts');

      const result = await response.json();
      let contactsList = result.contacts || [];

      // If we have a selected contact open, set its unread to 0 (since user is viewing it)
      if (selectedContact) {
        contactsList = contactsList.map((c: LineContact) =>
          c.id === selectedContact.id ? { ...c, unread_count: 0 } : c
        );
      }

      setContacts(contactsList);

      // Calculate total unread, excluding selected contact
      const calculatedUnread = contactsList.reduce((sum: number, c: LineContact) => sum + c.unread_count, 0);
      setTotalUnread(calculatedUnread);
    } catch (error) {
      console.error('Error fetching contacts:', error);
    } finally {
      setLoadingContacts(false);
    }
  };

  const fetchMessages = async (contactId: string, loadMore = false) => {
    try {
      if (loadMore) {
        setLoadingMore(true);
      } else {
        setLoadingMessages(true);
      }
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) return;

      const offset = loadMore ? messages.length : 0;
      const limit = 50;
      const response = await fetch(`/api/line/messages?contact_id=${contactId}&limit=${limit}&offset=${offset}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch messages');

      const result = await response.json();
      const newMessages = result.messages || [];

      if (loadMore) {
        // Prepend older messages
        setMessages(prev => [...newMessages, ...prev]);
      } else {
        setMessages(newMessages);
      }

      // Check if there are more messages
      setHasMoreMessages(newMessages.length === limit);

      // Update contact's unread count locally
      if (!loadMore) {
        setContacts(prev => prev.map(c =>
          c.id === contactId ? { ...c, unread_count: 0 } : c
        ));
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoadingMessages(false);
      setLoadingMore(false);
    }
  };

  const sendMessage = (retryMessage?: LineMessage) => {
    const messageText = retryMessage?.content || newMessage.trim();
    if (!messageText || !selectedContact) return;

    // Generate temp ID for optimistic update
    const tempId = retryMessage?._tempId || `temp-${Date.now()}`;

    // Optimistic update - add message immediately with 'sending' status
    if (!retryMessage) {
      const optimisticMessage: LineMessage = {
        id: tempId,
        _tempId: tempId,
        line_contact_id: selectedContact.id,
        direction: 'outgoing',
        message_type: 'text',
        content: messageText,
        created_at: new Date().toISOString(),
        _status: 'sending'
      };
      setMessages(prev => [...prev, optimisticMessage]);
      setNewMessage('');
      inputRef.current?.focus();
    } else {
      // Update retry message status back to sending
      setMessages(prev => prev.map(m =>
        m._tempId === tempId ? { ...m, _status: 'sending' as const } : m
      ));
    }

    // Send async - don't await, let user continue typing
    const contactId = selectedContact.id;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) throw new Error('No session');

        const response = await fetch('/api/line/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            contact_id: contactId,
            message: messageText
          })
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to send message');
        }

        const result = await response.json();

        // Update optimistic message with real data
        if (result.message) {
          setMessages(prev => prev.map(m =>
            m._tempId === tempId
              ? { ...result.message, _status: 'sent' as const }
              : m
          ));
        }
      } catch (error) {
        console.error('Error sending message:', error);
        // Mark message as failed
        setMessages(prev => prev.map(m =>
          m._tempId === tempId ? { ...m, _status: 'failed' as const } : m
        ));
      }
    })();
  };

  // Handle image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedContact) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('กรุณาเลือกไฟล์รูปภาพ');
      return;
    }

    // Validate file size (max 10MB for LINE)
    if (file.size > 10 * 1024 * 1024) {
      alert('ไฟล์ใหญ่เกินไป (สูงสุด 10MB)');
      return;
    }

    const tempId = `temp-${Date.now()}`;
    const localUrl = URL.createObjectURL(file);

    // Optimistic update
    const optimisticMessage: LineMessage = {
      id: tempId,
      _tempId: tempId,
      line_contact_id: selectedContact.id,
      direction: 'outgoing',
      message_type: 'image',
      content: '[รูปภาพ]',
      raw_message: { imageUrl: localUrl },
      created_at: new Date().toISOString(),
      _status: 'sending'
    };
    setMessages(prev => [...prev, optimisticMessage]);
    setUploadingImage(true);

    const contactId = selectedContact.id;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      // Upload to Supabase Storage
      const fileName = `admin-images/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(fileName, file, { contentType: file.type });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('chat-media')
        .getPublicUrl(fileName);

      const imageUrl = urlData.publicUrl;

      // Send via LINE API
      const response = await fetch('/api/line/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          contact_id: contactId,
          type: 'image',
          imageUrl
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send image');
      }

      const result = await response.json();

      // Update optimistic message
      if (result.message) {
        setMessages(prev => prev.map(m =>
          m._tempId === tempId
            ? { ...result.message, _status: 'sent' as const }
            : m
        ));
      }

      URL.revokeObjectURL(localUrl);
    } catch (error) {
      console.error('Error uploading image:', error);
      setMessages(prev => prev.map(m =>
        m._tempId === tempId ? { ...m, _status: 'failed' as const } : m
      ));
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Send sticker
  const sendSticker = (packageId: string, stickerId: string) => {
    if (!selectedContact) return;

    const tempId = `temp-${Date.now()}`;

    // Optimistic update
    const optimisticMessage: LineMessage = {
      id: tempId,
      _tempId: tempId,
      line_contact_id: selectedContact.id,
      direction: 'outgoing',
      message_type: 'sticker',
      content: '[สติกเกอร์]',
      raw_message: { packageId, stickerId },
      created_at: new Date().toISOString(),
      _status: 'sending'
    };
    setMessages(prev => [...prev, optimisticMessage]);
    setShowStickerPicker(false);

    const contactId = selectedContact.id;

    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('No session');

        const response = await fetch('/api/line/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            contact_id: contactId,
            type: 'sticker',
            packageId,
            stickerId
          })
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to send sticker');
        }

        const result = await response.json();

        if (result.message) {
          setMessages(prev => prev.map(m =>
            m._tempId === tempId
              ? { ...result.message, _status: 'sent' as const }
              : m
          ));
        }
      } catch (error) {
        console.error('Error sending sticker:', error);
        setMessages(prev => prev.map(m =>
          m._tempId === tempId ? { ...m, _status: 'failed' as const } : m
        ));
      }
    })();
  };

  // LINE Official Stickers (free to use)
  const officialStickers = [
    // Brown & Cony
    { packageId: '11537', stickers: ['52002734', '52002735', '52002736', '52002737', '52002738', '52002739', '52002740', '52002741'] },
    // Moon
    { packageId: '11538', stickers: ['51626494', '51626495', '51626496', '51626497', '51626498', '51626499', '51626500', '51626501'] },
    // Boss
    { packageId: '11539', stickers: ['52114110', '52114111', '52114112', '52114113', '52114114', '52114115', '52114116', '52114117'] },
  ];

  const fetchCustomers = async (search: string) => {
    try {
      setLoadingCustomers(true);
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) return;

      const response = await fetch(`/api/customers?search=${encodeURIComponent(search)}&limit=10`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch customers');

      const result = await response.json();
      setCustomers(result.customers || result || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoadingCustomers(false);
    }
  };

  const linkCustomer = async (customerId: string | null) => {
    if (!selectedContact) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) return;

      const response = await fetch('/api/line/contacts', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          id: selectedContact.id,
          customer_id: customerId
        })
      });

      if (!response.ok) throw new Error('Failed to link customer');

      // Update local state
      const linkedCustomer = customers.find(c => c.id === customerId);
      setSelectedContact(prev => prev ? {
        ...prev,
        customer_id: customerId || undefined,
        customer: linkedCustomer ? {
          id: linkedCustomer.id,
          name: linkedCustomer.name,
          customer_code: linkedCustomer.customer_code
        } : undefined
      } : null);

      setContacts(prev => prev.map(c =>
        c.id === selectedContact.id ? {
          ...c,
          customer_id: customerId || undefined,
          customer: linkedCustomer ? {
            id: linkedCustomer.id,
            name: linkedCustomer.name,
            customer_code: linkedCustomer.customer_code
          } : undefined
        } : c
      ));

      setShowLinkModal(false);
    } catch (error) {
      console.error('Error linking customer:', error);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    }

    return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) +
      ' ' + date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  };

  const formatLastMessage = (dateString?: string) => {
    if (!dateString) return '';

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'เมื่อกี้';
    if (diffMins < 60) return `${diffMins} นาที`;
    if (diffHours < 24) return `${diffHours} ชม.`;
    if (diffDays < 7) return `${diffDays} วัน`;
    return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
  };

  // Fetch order history for customer
  const fetchOrderHistory = async (customerId: string) => {
    try {
      setLoadingHistory(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`/api/orders?customer_id=${customerId}&limit=20`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });

      if (!response.ok) throw new Error('Failed to fetch orders');

      const result = await response.json();
      setOrderHistory(result.orders || []);
    } catch (error) {
      console.error('Error fetching order history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Handle opening history panel
  const handleOpenHistory = () => {
    if (!selectedContact?.customer) return;

    if (window.innerWidth < 768) {
      setMobileView('history');
    } else {
      setRightPanel(rightPanel === 'history' ? null : 'history');
    }
    fetchOrderHistory(selectedContact.customer.id);
  };

  // Handle opening profile panel
  const handleOpenProfile = () => {
    if (!selectedContact?.customer) return;

    if (window.innerWidth < 768) {
      setMobileView('profile');
    } else {
      setRightPanel(rightPanel === 'profile' ? null : 'profile');
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

  return (
    <Layout>
      <div className="flex h-[calc(100vh-120px)] bg-white rounded-lg border border-gray-200 overflow-hidden">
        {/* Contacts Sidebar - hidden on mobile when chat or order is open */}
        <div className={`w-full md:w-80 border-r border-gray-200 flex flex-col ${mobileView !== 'contacts' ? 'hidden md:flex' : 'flex'}`}>
          {/* Header */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-[#06C755]" />
                LINE Chat
              </h2>
              {totalUnread > 0 && (
                <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {totalUnread}
                </span>
              )}
            </div>
            {/* Quick filter - Order days (most important) */}
            <div className="flex flex-wrap gap-1 mb-2">
              {[
                { range: null, label: 'ทั้งหมด', color: 'gray' },
                { range: { min: 2, max: 3 }, label: '2-3d', color: 'yellow' },
                { range: { min: 3, max: 5 }, label: '3-5d', color: 'amber' },
                { range: { min: 5, max: 7 }, label: '5-7d', color: 'orange' },
                { range: { min: 7, max: null }, label: '7d+', color: 'red' },
              ].map(({ range, label, color }) => {
                const isActive = range === null
                  ? filterOrderDaysRange === null && filterLinked !== 'linked'
                  : filterOrderDaysRange?.min === range?.min && filterOrderDaysRange?.max === range?.max;
                const colorClasses = {
                  gray: isActive ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                  yellow: isActive ? 'bg-yellow-500 text-white' : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100',
                  amber: isActive ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-700 hover:bg-amber-100',
                  orange: isActive ? 'bg-orange-500 text-white' : 'bg-orange-50 text-orange-700 hover:bg-orange-100',
                  red: isActive ? 'bg-red-500 text-white' : 'bg-red-50 text-red-700 hover:bg-red-100',
                };
                return (
                  <button
                    key={label}
                    onClick={() => {
                      if (range === null) {
                        setFilterOrderDaysRange(null);
                        setFilterLinked('all');
                      } else {
                        setFilterOrderDaysRange(range);
                        setFilterLinked('linked'); // Auto select linked when filtering by order days
                      }
                    }}
                    className={`px-2 py-1 text-xs rounded-lg transition-colors flex items-center gap-1 ${colorClasses[color as keyof typeof colorClasses]}`}
                  >
                    {range !== null && <Clock className="w-3 h-3" />}
                    {label}
                  </button>
                );
              })}
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="ค้นหาชื่อ..."
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#06C755]"
                />
              </div>
              {/* Filter button */}
              <div className="relative" data-filter-popover>
                <button
                  onClick={() => setShowFilterPopover(!showFilterPopover)}
                  className={`p-2 border rounded-lg transition-colors ${hasActiveFilter ? 'bg-[#06C755] border-[#06C755] text-white' : 'border-gray-300 text-gray-500 hover:bg-gray-50'}`}
                  title="กรองรายชื่อ"
                >
                  <Filter className="w-5 h-5" />
                </button>

                {/* Filter Popover */}
                {showFilterPopover && (
                  <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                    <div className="p-3 border-b border-gray-100 flex items-center justify-between">
                      <span className="font-medium text-gray-900">กรองรายชื่อ</span>
                      {hasActiveFilter && (
                        <button
                          onClick={() => {
                            setFilterLinked('all');
                            setFilterUnread(false);
                            setFilterOrderDaysRange(null);
                          }}
                          className="text-xs text-red-500 hover:text-red-600"
                        >
                          ล้างทั้งหมด
                        </button>
                      )}
                    </div>

                    <div className="p-3 space-y-4">
                      {/* Link status filter */}
                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-2 block">สถานะเชื่อมลูกค้า</label>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setFilterLinked('all')}
                            className={`flex-1 px-3 py-2 text-xs rounded-lg transition-colors flex items-center justify-center gap-1 ${filterLinked === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                            title="ทั้งหมด"
                          >
                            <User className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setFilterLinked('linked')}
                            className={`flex-1 px-3 py-2 text-xs rounded-lg transition-colors flex items-center justify-center gap-1 ${filterLinked === 'linked' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                            title="เชื่อมลูกค้าแล้ว"
                          >
                            <UserCheck className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setFilterLinked('unlinked');
                              setFilterOrderDaysRange(null);
                            }}
                            className={`flex-1 px-3 py-2 text-xs rounded-lg transition-colors flex items-center justify-center gap-1 ${filterLinked === 'unlinked' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                            title="ยังไม่เชื่อมลูกค้า"
                          >
                            <UserX className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Unread filter */}
                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-2 block">ข้อความใหม่</label>
                        <button
                          onClick={() => setFilterUnread(!filterUnread)}
                          className={`px-3 py-2 rounded-lg transition-colors flex items-center justify-center ${filterUnread ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                          title="เฉพาะข้อความที่ยังไม่อ่าน"
                        >
                          <Bell className="w-4 h-4" />
                        </button>
                      </div>

                    </div>

                    <div className="p-3 border-t border-gray-100">
                      <button
                        onClick={() => setShowFilterPopover(false)}
                        className="w-full px-3 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 transition-colors"
                      >
                        ปิด
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Active filters display */}
            {hasActiveFilter && (
              <div className="flex flex-wrap gap-1 mt-2">
                {filterLinked === 'linked' && !filterOrderDaysRange && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                    <UserCheck className="w-3 h-3" />
                    เชื่อมลูกค้าแล้ว
                    <button onClick={() => setFilterLinked('all')} className="ml-1 hover:text-blue-900">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {filterLinked === 'unlinked' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full">
                    <UserX className="w-3 h-3" />
                    ยังไม่เชื่อมลูกค้า
                    <button onClick={() => setFilterLinked('all')} className="ml-1 hover:text-orange-900">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {filterUnread && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                    <Bell className="w-3 h-3" />
                    ยังไม่อ่าน
                    <button onClick={() => setFilterUnread(false)} className="ml-1 hover:text-red-900">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {filterOrderDaysRange !== null && (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full ${
                    filterOrderDaysRange.min >= 7 ? 'bg-red-100 text-red-700' :
                    filterOrderDaysRange.min >= 5 ? 'bg-orange-100 text-orange-700' :
                    filterOrderDaysRange.min >= 3 ? 'bg-amber-100 text-amber-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    <Clock className="w-3 h-3" />
                    ไม่สั่ง {filterOrderDaysRange.max === null
                      ? `${filterOrderDaysRange.min}+ วัน`
                      : `${filterOrderDaysRange.min}-${filterOrderDaysRange.max} วัน`}
                    <button onClick={() => { setFilterOrderDaysRange(null); setFilterLinked('all'); }} className="ml-1 hover:opacity-70">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Contacts List */}
          <div className="flex-1 overflow-y-auto">
            {loadingContacts ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
              </div>
            ) : contacts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <MessageCircle className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>ยังไม่มีข้อความ</p>
              </div>
            ) : (
              contacts.map((contact) => (
                <button
                  key={contact.id}
                  onClick={() => setSelectedContact(contact)}
                  className={`w-full p-3 flex items-center gap-3 hover:bg-gray-50 transition-colors border-b border-gray-100 ${selectedContact?.id === contact.id ? 'bg-[#06C755]/10' : ''
                    }`}
                >
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    {contact.picture_url ? (
                      <Image
                        src={contact.picture_url}
                        alt={contact.display_name}
                        width={48}
                        height={48}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-[#06C755] rounded-full flex items-center justify-center">
                        <User className="w-6 h-6 text-white" />
                      </div>
                    )}
                    {contact.unread_count > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                        {contact.unread_count > 9 ? '9+' : contact.unread_count}
                      </span>
                    )}
                    {/* Linked customer indicator */}
                    {contact.customer && (
                      <span className="absolute -bottom-0.5 -right-0.5 bg-blue-500 text-white w-4 h-4 rounded-full flex items-center justify-center shadow-sm border border-white">
                        <LinkIcon className="w-2.5 h-2.5" />
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900 truncate">
                        {contact.display_name}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatLastMessage(contact.last_message_at)}
                      </span>
                    </div>
                    {/* Last message preview */}
                    {contact.last_message ? (
                      <div className="text-xs text-gray-500 truncate">
                        {contact.last_message}
                      </div>
                    ) : contact.customer ? (
                      <div className="text-xs text-[#06C755] truncate flex items-center gap-1">
                        <LinkIcon className="w-3 h-3" />
                        {contact.customer.customer_code} - {contact.customer.name}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400">ยังไม่มีข้อความ</div>
                    )}
                    {/* Show last order date when filtering by linked customers */}
                    {filterLinked === 'linked' && (
                      <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        {contact.last_order_date
                          ? `สั่งล่าสุด: ${new Date(contact.last_order_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}`
                          : 'ยังไม่เคยสั่ง'}
                      </div>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat Area - shrinks when right panel is open */}
        <div className={`flex-col relative ${mobileView === 'chat' ? 'flex' : 'hidden md:flex'} ${rightPanel ? 'w-full md:w-96 lg:w-[450px]' : 'flex-1'}`}>
          {selectedContact ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Back button - mobile only */}
                  <button
                    onClick={() => {
                      setSelectedContact(null);
                      setMobileView('contacts');
                    }}
                    className="md:hidden p-1 -ml-1 text-gray-500 hover:text-gray-700"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  {selectedContact.picture_url ? (
                    <Image
                      src={selectedContact.picture_url}
                      alt={selectedContact.display_name}
                      width={40}
                      height={40}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 bg-[#06C755] rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-white" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-medium text-gray-900">{selectedContact.display_name}</h3>
                    {selectedContact.customer ? (
                      <p className="text-xs text-[#06C755]">
                        {selectedContact.customer.customer_code} - {selectedContact.customer.name}
                      </p>
                    ) : (
                      <button
                        onClick={() => {
                          setShowLinkModal(true);
                          setCustomerSearch('');
                          setCustomers([]);
                        }}
                        className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <LinkIcon className="w-3 h-3" />
                        เชื่อมกับลูกค้าในระบบ
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 md:gap-2">
                  {selectedContact.customer && (
                    <>
                      {/* Order History Button */}
                      <button
                        onClick={handleOpenHistory}
                        className={`flex items-center gap-1.5 px-2 md:px-3 py-1.5 rounded-lg transition-colors text-sm font-medium ${
                          rightPanel === 'history'
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                        title="ดูประวัติออเดอร์"
                      >
                        <History className="w-4 h-4" />
                        <span className="hidden sm:inline">ประวัติ</span>
                      </button>
                      {/* Open Order Button */}
                      <button
                        onClick={() => {
                          if (window.innerWidth < 768) {
                            setMobileView('order');
                          } else {
                            setRightPanel(rightPanel === 'order' ? null : 'order');
                          }
                        }}
                        className={`flex items-center gap-1.5 px-2 md:px-3 py-1.5 rounded-lg transition-colors text-sm font-medium ${
                          rightPanel === 'order'
                            ? 'bg-gray-200 text-gray-700'
                            : 'bg-[#E9B308] text-[#00231F] hover:bg-[#d4a307]'
                        }`}
                        title={rightPanel === 'order' ? 'ปิดหน้าเปิดบิล' : 'เปิดบิล'}
                      >
                        <ShoppingCart className="w-4 h-4" />
                        <span className="hidden sm:inline">{rightPanel === 'order' ? 'ปิด' : 'เปิดบิล'}</span>
                      </button>
                      {/* Customer Profile Button */}
                      <button
                        onClick={handleOpenProfile}
                        className={`p-2 rounded-lg transition-colors ${
                          rightPanel === 'profile'
                            ? 'bg-blue-500 text-white'
                            : 'text-gray-400 hover:bg-gray-100'
                        }`}
                        title="ดูข้อมูลลูกค้า"
                      >
                        <User className="w-5 h-5" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div
                ref={messagesContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 relative"
              >
                {loadingMessages ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <MessageCircle className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p>ยังไม่มีข้อความ</p>
                  </div>
                ) : (
                  <>
                    {/* Load More Button */}
                    {hasMoreMessages && (
                      <div className="flex justify-center">
                        <button
                          onClick={() => fetchMessages(selectedContact!.id, true)}
                          disabled={loadingMore}
                          className="px-4 py-1.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
                        >
                          {loadingMore ? (
                            <span className="flex items-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              กำลังโหลด...
                            </span>
                          ) : (
                            'โหลดข้อความเก่า'
                          )}
                        </button>
                      </div>
                    )}
                    {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.direction === 'outgoing' ? 'justify-end' : 'justify-start'} gap-2`}
                    >
                      {/* Sender Avatar (for incoming messages) */}
                      {msg.direction === 'incoming' && (
                        <div className="flex-shrink-0 self-end">
                          {msg.sender_picture_url ? (
                            <Image
                              src={msg.sender_picture_url}
                              alt={msg.sender_name || 'User'}
                              width={32}
                              height={32}
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                              <User className="w-4 h-4 text-gray-500" />
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex flex-col">
                        {/* Sender name (for incoming messages) */}
                        {msg.direction === 'incoming' && msg.sender_name && (
                          <span className="text-xs text-gray-500 mb-0.5 ml-1">{msg.sender_name}</span>
                        )}

                        <div className="flex items-end gap-1.5">
                          {/* Status + Timestamp (before bubble for outgoing) */}
                          {msg.direction === 'outgoing' && (
                            <div className="flex flex-col items-end self-end mb-0.5 text-[10px] text-gray-400">
                              {msg.sent_by_user && <span>{msg.sent_by_user.name}</span>}
                              <div className="flex items-center gap-1">
                                {msg._status === 'failed' && (
                                  <button
                                    onClick={() => { sendMessage(msg); }}
                                    className="flex items-center gap-0.5 text-red-500 hover:text-red-600"
                                    title="ส่งไม่สำเร็จ กดเพื่อลองใหม่"
                                  >
                                    <AlertCircle className="w-3 h-3" />
                                    <RotateCcw className="w-2.5 h-2.5" />
                                  </button>
                                )}
                                {msg._status === 'sending' && (
                                  <Loader2 className="w-2.5 h-2.5 animate-spin text-gray-400" />
                                )}
                                {msg._status === 'sent' && (
                                  <Check className="w-2.5 h-2.5 text-[#06C755]" />
                                )}
                                <span>{formatTime(msg.created_at)}</span>
                              </div>
                            </div>
                          )}

                          <div
                            className={`rounded-2xl max-w-[75vw] md:max-w-[min(70vw,400px)] ${msg.message_type === 'sticker' ? 'bg-transparent' : msg.direction === 'outgoing'
                              ? msg._status === 'failed'
                                ? 'bg-red-400 text-white rounded-br-sm px-3 py-1.5 md:px-4 md:py-2'
                                : msg._status === 'sending'
                                  ? 'bg-[#06C755]/70 text-white rounded-br-sm px-3 py-1.5 md:px-4 md:py-2'
                                  : 'bg-[#06C755] text-white rounded-br-sm px-3 py-1.5 md:px-4 md:py-2'
                              : 'bg-white text-gray-900 rounded-bl-sm shadow-sm px-3 py-1.5 md:px-4 md:py-2'
                            }`}
                          >
                            {/* Sticker */}
                            {msg.message_type === 'sticker' && msg.raw_message?.stickerId ? (
                              <img
                                src={`https://stickershop.line-scdn.net/stickershop/v1/sticker/${msg.raw_message.stickerId}/iPhone/sticker.png`}
                                alt="sticker"
                                className="w-24 h-24 object-contain"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = `https://stickershop.line-scdn.net/stickershop/v1/sticker/${msg.raw_message?.stickerId}/iPhone/sticker@2x.png`;
                                }}
                              />
                            ) : msg.message_type === 'image' && msg.raw_message?.imageUrl ? (
                              /* Image from storage */
                              <img
                                src={msg.raw_message.imageUrl}
                                alt="image"
                                className="max-w-full max-h-64 rounded-lg cursor-pointer"
                                onClick={(e) => window.open((e.target as HTMLImageElement).src, '_blank')}
                                onLoad={() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
                              />
                            ) : msg.message_type === 'location' && msg.raw_message?.latitude && msg.raw_message?.longitude ? (
                              /* Location */
                              <a
                                href={`https://www.google.com/maps?q=${msg.raw_message.latitude},${msg.raw_message.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-xl">📍</span>
                                  <span className="underline">{msg.content}</span>
                                </div>
                                {msg.raw_message.address && (
                                  <p className="text-xs opacity-70 mt-1">{msg.raw_message.address}</p>
                                )}
                              </a>
                            ) : (
                              /* Text and other messages */
                              <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                            )}
                          </div>

                          {/* Timestamp (after bubble for incoming) */}
                          {msg.direction === 'incoming' && (
                            <span className="text-[10px] text-gray-400 self-end mb-0.5 whitespace-nowrap">
                              {formatTime(msg.created_at)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    ))}
                  </>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Scroll to bottom button - floating */}
              {showScrollButton && (
                <button
                  onClick={scrollToBottom}
                  className="absolute bottom-24 left-1/2 -translate-x-1/2 p-3 bg-white border border-gray-200 rounded-full shadow-xl hover:bg-gray-50 hover:shadow-2xl transition-all z-20 animate-bounce"
                  title="ไปที่ข้อความล่าสุด"
                >
                  <ArrowDown className="w-5 h-5 text-[#06C755]" />
                </button>
              )}

              {/* Message Input */}
              <div className="p-2 md:p-4 border-t border-gray-200 bg-white relative">
                {/* Sticker Picker */}
                {showStickerPicker && (
                  <div className="absolute bottom-full left-0 right-0 bg-white border border-gray-200 rounded-t-lg shadow-lg max-h-48 md:max-h-64 overflow-y-auto">
                    <div className="p-2 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
                      <span className="text-sm font-medium text-gray-700">เลือกสติกเกอร์</span>
                      <button
                        onClick={() => setShowStickerPicker(false)}
                        className="p-1 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="p-2">
                      {officialStickers.map((pack) => (
                        <div key={pack.packageId} className="mb-3">
                          <div className="grid grid-cols-4 gap-1 md:gap-2">
                            {pack.stickers.map((stickerId) => (
                              <button
                                key={stickerId}
                                onClick={() => sendSticker(pack.packageId, stickerId)}
                                className="p-1.5 md:p-2 hover:bg-gray-100 rounded-lg transition-colors"
                              >
                                <img
                                  src={`https://stickershop.line-scdn.net/stickershop/v1/sticker/${stickerId}/iPhone/sticker.png`}
                                  alt="sticker"
                                  className="w-10 h-10 md:w-12 md:h-12 object-contain"
                                />
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-1 md:gap-2">
                  {/* Hidden file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />

                  {/* Image upload button */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImage}
                    className="p-2 text-gray-500 hover:text-[#06C755] hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
                    title="ส่งรูปภาพ"
                  >
                    {uploadingImage ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <ImagePlus className="w-5 h-5" />
                    )}
                  </button>

                  {/* Sticker button */}
                  <button
                    onClick={() => setShowStickerPicker(!showStickerPicker)}
                    className={`p-2 rounded-full transition-colors ${showStickerPicker ? 'text-[#06C755] bg-[#06C755]/10' : 'text-gray-500 hover:text-[#06C755] hover:bg-gray-100'}`}
                    title="ส่งสติกเกอร์"
                  >
                    <Smile className="w-5 h-5" />
                  </button>

                  <input
                    ref={inputRef}
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="พิมพ์ข้อความ..."
                    className="flex-1 min-w-0 px-3 md:px-4 py-2 text-sm md:text-base border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-[#06C755]"
                  />
                  <button
                    onClick={() => { sendMessage(); }}
                    disabled={!newMessage.trim()}
                    className="p-2 bg-[#06C755] text-white rounded-full hover:bg-[#05b04c] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-gray-50">
              <div className="text-center text-gray-500">
                <MessageCircle className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">เลือกแชทเพื่อเริ่มสนทนา</p>
                <p className="text-sm">ข้อความจากลูกค้าจะแสดงที่นี่</p>
              </div>
            </div>
          )}
        </div>

        {/* Mobile Order View - Full screen on mobile */}
        {mobileView === 'order' && selectedContact?.customer && (
          <div className="flex md:hidden w-full flex-col bg-gray-50">
            {/* Panel Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setMobileView('chat')}
                  className="p-1 -ml-1 text-gray-500 hover:text-gray-700"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <ShoppingCart className="w-5 h-5 text-[#E9B308]" />
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">เปิดบิล</h2>
                  <p className="text-xs text-gray-500">
                    {selectedContact.customer.customer_code} - {selectedContact.customer.name}
                  </p>
                </div>
              </div>
            </div>

            {/* Order Form */}
            <div className="flex-1 overflow-y-auto p-4">
              <OrderForm
                preselectedCustomerId={selectedContact.customer.id}
                embedded={true}
                onSuccess={(orderId) => {
                  setMobileView('chat');
                  alert(`สร้างคำสั่งซื้อสำเร็จ!`);
                }}
                onCancel={() => setMobileView('chat')}
              />
            </div>
          </div>
        )}

        {/* Mobile History View - Full screen on mobile */}
        {mobileView === 'history' && selectedContact?.customer && (
          <div className="flex md:hidden w-full flex-col bg-gray-50">
            {/* Panel Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setMobileView('chat')}
                  className="p-1 -ml-1 text-gray-500 hover:text-gray-700"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <History className="w-5 h-5 text-blue-500" />
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">ประวัติออเดอร์</h2>
                  <p className="text-xs text-gray-500">
                    {selectedContact.customer.customer_code} - {selectedContact.customer.name}
                  </p>
                </div>
              </div>
            </div>

            {/* Order History List */}
            <div className="flex-1 overflow-y-auto p-4">
              {loadingHistory ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                </div>
              ) : orderHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <History className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>ยังไม่มีประวัติออเดอร์</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {orderHistory.map((order) => (
                    <div
                      key={order.id}
                      className="bg-white rounded-lg border border-gray-200 p-3 hover:border-blue-300 transition-colors cursor-pointer"
                      onClick={() => router.push(`/orders?id=${order.id}`)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-900">{order.order_number}</span>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          order.status === 'completed' ? 'bg-green-100 text-green-700' :
                          order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                          order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {order.status === 'completed' ? 'เสร็จสิ้น' :
                           order.status === 'pending' ? 'รอดำเนินการ' :
                           order.status === 'cancelled' ? 'ยกเลิก' :
                           order.status}
                        </span>
                      </div>
                      <div className="text-sm text-gray-500">
                        <div className="flex items-center justify-between">
                          <span>{new Date(order.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}</span>
                          <span className="font-medium text-gray-900">฿{order.total_amount?.toLocaleString('th-TH', { minimumFractionDigits: 2 }) || '0.00'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Mobile Profile View - Full screen on mobile */}
        {mobileView === 'profile' && selectedContact?.customer && (
          <div className="flex md:hidden w-full flex-col bg-gray-50">
            {/* Panel Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setMobileView('chat')}
                  className="p-1 -ml-1 text-gray-500 hover:text-gray-700"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <User className="w-5 h-5 text-blue-500" />
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">ข้อมูลลูกค้า</h2>
                  <p className="text-xs text-gray-500">{selectedContact.customer.customer_code}</p>
                </div>
              </div>
              <button
                onClick={() => router.push(`/customers/${selectedContact.customer!.id}`)}
                className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                ดูเพิ่มเติม
              </button>
            </div>

            {/* Customer Info */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
                <div className="text-center pb-4 border-b border-gray-100">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <User className="w-8 h-8 text-blue-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">{selectedContact.customer.name}</h3>
                  <p className="text-sm text-gray-500">{selectedContact.customer.customer_code}</p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-500">LINE</label>
                    <p className="text-sm font-medium text-gray-900">{selectedContact.display_name}</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <button
                    onClick={() => setMobileView('order')}
                    className="w-full py-2 bg-[#E9B308] text-[#00231F] rounded-lg font-medium hover:bg-[#d4a307] transition-colors flex items-center justify-center gap-2"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    เปิดบิล
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Order Panel - Right Side (Desktop only) */}
        {rightPanel === 'order' && selectedContact?.customer && (
          <div className="hidden md:flex flex-1 flex-col border-l border-gray-200 bg-gray-50">
            {/* Panel Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
              <div className="flex items-center gap-3">
                <ShoppingCart className="w-5 h-5 text-[#E9B308]" />
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">เปิดบิล</h2>
                  <p className="text-xs text-gray-500">
                    {selectedContact.customer.customer_code} - {selectedContact.customer.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRightPanel(null)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="ปิด"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Order Form */}
            <div className="flex-1 overflow-y-auto p-4">
              <OrderForm
                preselectedCustomerId={selectedContact.customer.id}
                embedded={true}
                onSuccess={(orderId) => {
                  setRightPanel(null);
                  alert(`สร้างคำสั่งซื้อสำเร็จ!`);
                }}
                onCancel={() => setRightPanel(null)}
              />
            </div>
          </div>
        )}

        {/* Order History Panel - Right Side (Desktop only) */}
        {rightPanel === 'history' && selectedContact?.customer && (
          <div className="hidden md:flex flex-1 flex-col border-l border-gray-200 bg-gray-50">
            {/* Panel Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
              <div className="flex items-center gap-3">
                <History className="w-5 h-5 text-blue-500" />
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">ประวัติออเดอร์</h2>
                  <p className="text-xs text-gray-500">
                    {selectedContact.customer.customer_code} - {selectedContact.customer.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRightPanel(null)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="ปิด"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Order History List */}
            <div className="flex-1 overflow-y-auto p-4">
              {loadingHistory ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                </div>
              ) : orderHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <History className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>ยังไม่มีประวัติออเดอร์</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {orderHistory.map((order) => (
                    <div
                      key={order.id}
                      className="bg-white rounded-lg border border-gray-200 p-3 hover:border-blue-300 transition-colors cursor-pointer"
                      onClick={() => router.push(`/orders?id=${order.id}`)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-900">{order.order_number}</span>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          order.status === 'completed' ? 'bg-green-100 text-green-700' :
                          order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                          order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {order.status === 'completed' ? 'เสร็จสิ้น' :
                           order.status === 'pending' ? 'รอดำเนินการ' :
                           order.status === 'cancelled' ? 'ยกเลิก' :
                           order.status}
                        </span>
                      </div>
                      <div className="text-sm text-gray-500">
                        <div className="flex items-center justify-between">
                          <span>{new Date(order.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}</span>
                          <span className="font-medium text-gray-900">฿{order.total_amount?.toLocaleString('th-TH', { minimumFractionDigits: 2 }) || '0.00'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Customer Profile Panel - Right Side (Desktop only) */}
        {rightPanel === 'profile' && selectedContact?.customer && (
          <div className="hidden md:flex flex-1 flex-col border-l border-gray-200 bg-gray-50">
            {/* Panel Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-blue-500" />
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">ข้อมูลลูกค้า</h2>
                  <p className="text-xs text-gray-500">
                    {selectedContact.customer.customer_code}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => router.push(`/customers/${selectedContact.customer!.id}`)}
                  className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  ดูเพิ่มเติม
                </button>
                <button
                  onClick={() => setRightPanel(null)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  title="ปิด"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Customer Info */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
                <div className="text-center pb-4 border-b border-gray-100">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <User className="w-8 h-8 text-blue-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">{selectedContact.customer.name}</h3>
                  <p className="text-sm text-gray-500">{selectedContact.customer.customer_code}</p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-500">LINE</label>
                    <p className="text-sm font-medium text-gray-900">{selectedContact.display_name}</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <button
                    onClick={() => {
                      setRightPanel('order');
                    }}
                    className="w-full py-2 bg-[#E9B308] text-[#00231F] rounded-lg font-medium hover:bg-[#d4a307] transition-colors flex items-center justify-center gap-2"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    เปิดบิล
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Link Customer Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md mx-4 shadow-xl">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">เชื่อมกับลูกค้าในระบบ</h3>
              <button
                onClick={() => setShowLinkModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value);
                    if (e.target.value.length >= 2) {
                      fetchCustomers(e.target.value);
                    }
                  }}
                  placeholder="ค้นหาชื่อหรือรหัสลูกค้า..."
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#E9B308]"
                />
              </div>

              <div className="max-h-64 overflow-y-auto">
                {loadingCustomers ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                  </div>
                ) : customers.length === 0 ? (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    {customerSearch.length >= 2 ? 'ไม่พบลูกค้า' : 'พิมพ์อย่างน้อย 2 ตัวอักษรเพื่อค้นหา'}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {customers.map((customer) => (
                      <button
                        key={customer.id}
                        onClick={() => linkCustomer(customer.id)}
                        className="w-full p-3 text-left hover:bg-gray-50 rounded-lg transition-colors flex items-center justify-between"
                      >
                        <div>
                          <div className="text-xs text-gray-400">{customer.customer_code}</div>
                          <div className="font-medium text-gray-900">{customer.name}</div>
                          {customer.phone && (
                            <div className="text-xs text-gray-500 flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {customer.phone}
                            </div>
                          )}
                        </div>
                        <Check className="w-5 h-5 text-[#06C755]" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedContact?.customer && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => linkCustomer(null)}
                    className="w-full p-2 text-red-600 hover:bg-red-50 rounded-lg text-sm transition-colors"
                  >
                    ยกเลิกการเชื่อมกับลูกค้า
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </Layout>
  );
}
