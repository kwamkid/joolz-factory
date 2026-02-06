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
  Phone,
  ShoppingCart,
  AlertCircle,
  RotateCcw
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
  last_message?: string; // Preview of last message
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
      // Focus input when contact selected
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [selectedContact]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);


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
        (payload) => {
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
                            className={`rounded-2xl max-w-[min(70vw,400px)] ${msg.message_type === 'sticker' ? 'bg-transparent' : msg.direction === 'outgoing'
                              ? msg._status === 'failed'
                                ? 'bg-red-400 text-white rounded-br-sm px-4 py-2'
                                : msg._status === 'sending'
                                  ? 'bg-[#06C755]/70 text-white rounded-br-sm px-4 py-2'
                                  : 'bg-[#06C755] text-white rounded-br-sm px-4 py-2'
                              : 'bg-white text-gray-900 rounded-bl-sm shadow-sm px-4 py-2'
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

              {/* Message Input */}
              <div className="p-4 border-t border-gray-200 bg-white">
                <div className="flex items-center gap-2">
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
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-[#06C755]"
                  />
                  <button
                    onClick={() => { sendMessage(); }}
                    disabled={!newMessage.trim()}
                    className="p-2 bg-[#06C755] text-white rounded-full hover:bg-[#05b04c] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
