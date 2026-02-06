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
  Link as LinkIcon,
  X,
  Check,
  Clock,
  Phone,
  ShoppingCart
} from 'lucide-react';
import Image from 'next/image';

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
  created_at: string;
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
  const [sending, setSending] = useState(false);

  // Link customer modal
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  // Fetch contacts
  useEffect(() => {
    if (!authLoading && userProfile) {
      fetchContacts();
    }
  }, [authLoading, userProfile, searchTerm]);

  // Fetch messages when contact selected
  useEffect(() => {
    if (selectedContact) {
      fetchMessages(selectedContact.id);
    }
  }, [selectedContact]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Poll for new messages every 5 seconds
  useEffect(() => {
    if (!selectedContact) return;

    const interval = setInterval(() => {
      fetchMessages(selectedContact.id);
      fetchContacts(); // Also refresh contacts for unread counts
    }, 5000);

    return () => clearInterval(interval);
  }, [selectedContact]);

  const fetchContacts = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) return;

      const params = new URLSearchParams();
      if (searchTerm) params.set('search', searchTerm);

      const response = await fetch(`/api/line/contacts?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch contacts');

      const result = await response.json();
      setContacts(result.contacts || []);
      setTotalUnread(result.summary?.totalUnread || 0);
    } catch (error) {
      console.error('Error fetching contacts:', error);
    } finally {
      setLoadingContacts(false);
    }
  };

  const fetchMessages = async (contactId: string) => {
    try {
      setLoadingMessages(true);
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) return;

      const response = await fetch(`/api/line/messages?contact_id=${contactId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch messages');

      const result = await response.json();
      setMessages(result.messages || []);

      // Update contact's unread count locally
      setContacts(prev => prev.map(c =>
        c.id === contactId ? { ...c, unread_count: 0 } : c
      ));
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoadingMessages(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedContact || sending) return;

    try {
      setSending(true);
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) return;

      const response = await fetch('/api/line/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          contact_id: selectedContact.id,
          message: newMessage.trim()
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send message');
      }

      const result = await response.json();

      // Add message to list
      if (result.message) {
        setMessages(prev => [...prev, result.message]);
      }

      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      alert('ส่งข้อความไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setSending(false);
    }
  };

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
        {/* Contacts Sidebar */}
        <div className="w-80 border-r border-gray-200 flex flex-col">
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
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ค้นหาชื่อ..."
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#06C755]"
              />
            </div>
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
                    {contact.customer ? (
                      <div className="text-xs text-[#06C755] truncate flex items-center gap-1">
                        <LinkIcon className="w-3 h-3" />
                        {contact.customer.customer_code} - {contact.customer.name}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400">ยังไม่ได้เชื่อมลูกค้า</div>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {selectedContact ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
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

                <div className="flex items-center gap-2">
                  {selectedContact.customer && (
                    <>
                      <button
                        onClick={() => router.push(`/orders/new?customer=${selectedContact.customer!.id}`)}
                        className="p-2 text-[#E9B308] hover:bg-[#E9B308]/10 rounded-lg transition-colors"
                        title="สร้างออเดอร์"
                      >
                        <ShoppingCart className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => router.push(`/customers/${selectedContact.customer!.id}`)}
                        className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
                        title="ดูข้อมูลลูกค้า"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
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
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.direction === 'outgoing' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-2xl px-4 py-2 ${msg.direction === 'outgoing'
                            ? 'bg-[#06C755] text-white rounded-br-sm'
                            : 'bg-white text-gray-900 rounded-bl-sm shadow-sm'
                          }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                        <div className={`flex items-center gap-1 mt-1 text-xs ${msg.direction === 'outgoing' ? 'text-white/70 justify-end' : 'text-gray-400'
                          }`}>
                          <Clock className="w-3 h-3" />
                          {formatTime(msg.created_at)}
                          {msg.direction === 'outgoing' && msg.sent_by_user && (
                            <span className="ml-1">• {msg.sent_by_user.name}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="p-4 border-t border-gray-200 bg-white">
                <div className="flex items-center gap-2">
                  <input
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
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-[#06C755]"
                    disabled={sending}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!newMessage.trim() || sending}
                    className="p-2 bg-[#06C755] text-white rounded-full hover:bg-[#05b04c] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {sending ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
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
