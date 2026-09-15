import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  X,
  Send,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Calendar,
  Zap,
  Droplet,
  Receipt,
  HelpCircle,
  RefreshCw,
  MessageSquare
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Lightweight helper to format basic Markdown (headers, bold, tables, lists, quotes)
 */
function MarkdownRenderer({ content }) {
  if (!content) return null;

  const lines = content.split('\n');
  const elements = [];
  let tableRows = [];
  let inTable = false;

  const flushTable = () => {
    if (tableRows.length > 0) {
      const headers = tableRows[0];
      const dataRows = tableRows.slice(2); // Skip separator row

      elements.push(
        <div key={`tbl-${elements.length}`} style={{ overflowX: 'auto', margin: '10px 0' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '12px',
            background: '#ffffff',
            borderRadius: '8px',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
          }}>
            <thead>
              <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                {headers.map((h, i) => (
                  <th key={i} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: '700', color: '#334155' }}>
                    {h.replace(/\*\*/g, '')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dataRows.map((row, rIdx) => (
                <tr key={rIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} style={{ padding: '8px 10px', color: '#1e293b' }}>
                      {cell.replace(/\*\*/g, '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
    }
    inTable = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Table line: starts and ends with '|'
    if (line.startsWith('|') && line.endsWith('|')) {
      inTable = true;
      const cells = line.split('|').map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
      tableRows.push(cells);
      continue;
    } else if (inTable) {
      flushTable();
    }

    if (!line) {
      elements.push(<div key={`sp-${i}`} style={{ height: '6px' }} />);
      continue;
    }

    // Headers
    if (line.startsWith('### ')) {
      elements.push(
        <div key={`h3-${i}`} style={{ fontSize: '15px', fontWeight: '800', color: '#1e293b', marginTop: '8px', marginBottom: '4px' }}>
          {line.replace('### ', '')}
        </div>
      );
    } else if (line.startsWith('#### ')) {
      elements.push(
        <div key={`h4-${i}`} style={{ fontSize: '13px', fontWeight: '700', color: '#334155', marginTop: '6px', marginBottom: '2px' }}>
          {line.replace('#### ', '')}
        </div>
      );
    } else if (line.startsWith('> ')) {
      elements.push(
        <div key={`q-${i}`} style={{
          padding: '8px 12px',
          background: '#eff6ff',
          borderLeft: '4px solid #3b82f6',
          borderRadius: '4px',
          fontSize: '13px',
          color: '#1e40af',
          margin: '6px 0',
          fontWeight: '500'
        }}>
          {line.replace('> ', '')}
        </div>
      );
    } else if (line.startsWith('- ')) {
      const text = line.replace('- ', '');
      // Format bold text
      const parts = text.split(/(\*\*.*?\*\*)/g);
      elements.push(
        <div key={`li-${i}`} style={{ display: 'flex', gap: '6px', fontSize: '13px', color: '#334155', marginBottom: '3px' }}>
          <span style={{ color: '#2563eb' }}>•</span>
          <div>
            {parts.map((part, pIdx) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={pIdx} style={{ color: '#0f172a' }}>{part.slice(2, -2)}</strong>;
              }
              return part;
            })}
          </div>
        </div>
      );
    } else {
      const parts = line.split(/(\*\*.*?\*\*)/g);
      elements.push(
        <div key={`p-${i}`} style={{ fontSize: '13px', color: '#334155', lineHeight: '1.5' }}>
          {parts.map((part, pIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={pIdx} style={{ color: '#0f172a' }}>{part.slice(2, -2)}</strong>;
            }
            return part;
          })}
        </div>
      );
    }
  }

  if (inTable) flushTable();

  return <div>{elements}</div>;
}

export default function AiChatbotWidget() {
  const { admin, tenant } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  // Generates contextual greeting based on logged-in user room
  const createInitialMessage = () => {
    if (tenant) {
      return {
        id: `init-tenant-${Date.now()}`,
        sender: 'ai',
        text: `Xin chào ${tenant.full_name || 'bạn'}! Tôi là **Trợ Lý AI Phòng ${tenant.room_number || ''}** 🤖.\n\nTôi đã **tự động nhận diện phòng của bạn (Phòng ${tenant.room_number || ''})**. Bạn có thể hỏi tôi về hóa đơn tháng này, số điện nước hoặc **dự đoán tháng tới tăng hay giảm** nhé!`,
        badges: [
          { label: `Phòng ${tenant.room_number || ''}`, color: '#16a34a' },
          { label: 'Đã nhận diện phòng', color: '#2563eb' }
        ],
        suggestions: [
          '⚡ Tháng này bao nhiêu tiền?',
          '🔮 Dự đoán tháng tới tăng hay giảm?',
          '📊 So sánh với tháng trước',
          '📅 Tổng kết năm 2026',
          '💡 Bảng giá điện nước'
        ]
      };
    }
    if (admin) {
      return {
        id: `init-admin-${Date.now()}`,
        sender: 'ai',
        text: `Xin chào Quản trị viên! Tôi là **Trợ Lý AI Quản Lý Nhà Trọ** 🤖.\n\nTôi có thể hỗ trợ tổng hợp doanh thu, phân tích số liệu toàn bộ nhà trọ hoặc từng phòng (ví dụ: gõ *"Phòng 1 tháng này bao nhiêu?"* hay *"Tổng kết năm 2026"*).`,
        badges: [{ label: 'Quản trị viên', color: '#7c3aed' }],
        suggestions: [
          '💰 Doanh thu tháng này bao nhiêu?',
          '📅 Tổng kết năm 2026',
          '🔮 Dự đoán tháng tới tăng hay giảm?',
          '🏠 Phòng 1 tháng này bao nhiêu tiền?'
        ]
      };
    }
    return {
      id: `init-public-${Date.now()}`,
      sender: 'ai',
      text: `Xin chào! Tôi là **Trợ Lý AI Nhà Trọ Thanh Tâm** 🤖.\n\nSau khi bạn đăng nhập theo phòng, tôi sẽ **tự động nhận diện phòng** để hỗ trợ tra cứu hóa đơn chi tiết. Bạn có thắc mắc gì về quy định, giá điện nước hay nội quy không?`,
      badges: [{ label: 'Hỗ trợ chung', color: '#2563eb' }],
      suggestions: [
        '💡 Bảng giá điện nước',
        '⏰ Giờ giấc đóng mở cổng',
        '📖 Hướng dẫn đọc công tơ điện'
      ]
    };
  };

  const [messages, setMessages] = useState([createInitialMessage()]);
  const [inputVal, setInputVal] = useState('');
  const [loading, setLoading] = useState(false);

  const messagesEndRef = useRef(null);

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  // Update initial message whenever user logs in or switches account
  useEffect(() => {
    setMessages([createInitialMessage()]);
  }, [tenant?.id, tenant?.room_id, admin?.id]);

  const handleSendMessage = async (textToSend = null) => {
    const queryText = (textToSend || inputVal).trim();
    if (!queryText || loading) return;

    const userMsg = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: queryText
    };

    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInputVal('');
    setLoading(true);

    try {
      const payload = {
        message: queryText,
        roomId: tenant ? tenant.room_id : undefined
      };

      const res = await api.post('/chatbot/message', payload);
      const aiData = res.data;

      const aiMsg = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: aiData.reply,
        intent: aiData.intent,
        type: aiData.type,
        data: aiData.data,
        badges: aiData.badges || [],
        suggestions: aiData.suggestions || []
      };

      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      console.error('[Chatbot Send Error]:', err);
      setMessages(prev => [
        ...prev,
        {
          id: `ai-err-${Date.now()}`,
          sender: 'ai',
          text: `Dạ xin lỗi bạn, hệ thống gặp gián đoạn tạm thời: "${err.message}". Vui lòng thử lại sau giây lát!`,
          badges: [{ label: 'Lỗi phản hồi', color: '#ef4444' }]
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <>
      {/* Floating Action Button - Modern Icon Only without Text */}
      {!isOpen && (
        <button
          type="button"
          className="ai-chatbot-launcher-btn"
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9999,
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            padding: 0,
            background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
            color: '#ffffff',
            border: 'none',
            boxShadow: '0 10px 25px -4px rgba(37, 99, 235, 0.5), 0 0 16px rgba(124, 58, 237, 0.35)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
            outline: 'none'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.1)';
            e.currentTarget.style.boxShadow = '0 12px 30px -2px rgba(37, 99, 235, 0.6), 0 0 20px rgba(124, 58, 237, 0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 10px 25px -4px rgba(37, 99, 235, 0.5), 0 0 16px rgba(124, 58, 237, 0.35)';
          }}
          title={tenant ? `Trợ lý AI • Phòng ${tenant.room_number}` : 'Trợ lý AI Thanh Tâm'}
          aria-label="Mở Trợ lý AI"
        >
          <Bot size={26} color="#ffffff" />
          <span style={{
            position: 'absolute',
            top: '3px',
            right: '3px',
            width: '12px',
            height: '12px',
            background: '#10b981',
            borderRadius: '50%',
            border: '2px solid #ffffff',
            boxShadow: '0 0 8px #10b981'
          }} />
        </button>
      )}

      {/* Chat Window Container */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: 10000,
            width: 'min(440px, calc(100vw - 32px))',
            height: 'min(640px, calc(100vh - 40px))',
            background: '#ffffff',
            borderRadius: '20px',
            boxShadow: '0 20px 48px -8px rgba(15, 23, 42, 0.3), 0 0 0 1px rgba(0,0,0,0.06)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            animation: 'chatbotPopIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          {/* Header */}
          <div style={{
            padding: '14px 18px',
            background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'rgba(255,255,255,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Bot size={22} color="#ffffff" />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '15px', fontWeight: '800' }}>
                    {tenant ? `Trợ Lý AI • Phòng ${tenant.room_number}` : (admin ? 'Trợ Lý AI Quản Trị' : 'Trợ Lý AI Thanh Tâm')}
                  </span>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: '700',
                    background: tenant ? '#10b981' : (admin ? '#7c3aed' : '#2563eb'),
                    color: '#ffffff',
                    padding: '2px 6px',
                    borderRadius: '8px'
                  }}>
                    {tenant ? 'Đã nhận diện phòng' : (admin ? 'Admin' : 'Online')}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: '#93c5fd' }}>
                  {tenant ? `${tenant.full_name || 'Khách thuê'} • Tự động gắn kết Phòng ${tenant.room_number}` : (admin ? 'Quản trị viên • Nhận diện mọi phòng' : 'Hỗ trợ chung')}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                type="button"
                onClick={() => setMessages([createInitialMessage()])}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#bfdbfe',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '6px'
                }}
                title="Làm mới cuộc trò chuyện"
              >
                <RefreshCw size={16} />
              </button>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#ffffff',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '6px'
                }}
                title="Đóng cửa sổ"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Messages Stream */}
          <div style={{
            flex: 1,
            padding: '16px',
            overflowY: 'auto',
            background: '#f8fafc',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            {messages.map((m) => {
              const isAi = m.sender === 'ai';
              return (
                <div
                  key={m.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isAi ? 'flex-start' : 'flex-end',
                    maxWidth: '100%'
                  }}
                >
                  <div
                    style={{
                      maxWidth: '88%',
                      padding: isAi ? '14px 16px' : '10px 16px',
                      background: isAi ? '#ffffff' : '#2563eb',
                      color: isAi ? '#0f172a' : '#ffffff',
                      borderRadius: isAi ? '4px 18px 18px 18px' : '18px 18px 4px 18px',
                      boxShadow: isAi ? '0 2px 8px rgba(0,0,0,0.05)' : '0 2px 8px rgba(37,99,235,0.25)',
                      border: isAi ? '1px solid #e2e8f0' : 'none',
                      fontSize: '13px',
                      lineHeight: '1.5'
                    }}
                  >
                    {/* Badges if any */}
                    {isAi && m.badges && m.badges.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                        {m.badges.map((b, bIdx) => (
                          <span
                            key={bIdx}
                            style={{
                              fontSize: '10px',
                              fontWeight: '700',
                              padding: '2px 8px',
                              borderRadius: '10px',
                              background: `${b.color}15`,
                              color: b.color,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            {b.label.includes('TĂNG') && <TrendingUp size={12} />}
                            {b.label.includes('GIẢM') && <TrendingDown size={12} />}
                            {b.label}
                          </span>
                        ))}
                      </div>
                    )}

                    {isAi ? <MarkdownRenderer content={m.text} /> : <div>{m.text}</div>}
                  </div>

                  {/* Suggestion Chips attached to message */}
                  {isAi && m.suggestions && m.suggestions.length > 0 && (
                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '6px',
                      marginTop: '8px',
                      maxWidth: '95%'
                    }}>
                      {m.suggestions.map((sug, sIdx) => (
                        <button
                          key={sIdx}
                          type="button"
                          onClick={() => handleSendMessage(sug)}
                          style={{
                            fontSize: '11px',
                            fontWeight: '600',
                            padding: '5px 10px',
                            borderRadius: '16px',
                            background: '#ffffff',
                            border: '1px solid #cbd5e1',
                            color: '#1e40af',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            transition: 'all 0.15s',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = '#2563eb';
                            e.currentTarget.style.background = '#eff6ff';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = '#cbd5e1';
                            e.currentTarget.style.background = '#ffffff';
                          }}
                        >
                          <span>{sug}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '12px' }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: '#eff6ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Bot size={16} color="#2563eb" />
                </div>
                <div style={{
                  background: '#ffffff',
                  padding: '8px 14px',
                  borderRadius: '12px',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <Sparkles size={14} color="#f59e0b" className="animate-spin" />
                  <span>AI đang phân tích dữ liệu...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <div style={{
            padding: '12px 14px',
            background: '#ffffff',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            gap: '8px',
            alignItems: 'center'
          }}>
            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Nhập câu hỏi... (VD: tháng này bao nhiêu?, dự đoán...)"
              disabled={loading}
              style={{
                flex: 1,
                padding: '10px 14px',
                fontSize: '13px',
                borderRadius: '24px',
                border: '1px solid #cbd5e1',
                outline: 'none',
                background: '#f8fafc',
                transition: 'border-color 0.15s'
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = '#2563eb'}
              onBlur={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
            />

            <button
              type="button"
              onClick={() => handleSendMessage()}
              disabled={!inputVal.trim() || loading}
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: inputVal.trim() && !loading ? '#2563eb' : '#94a3b8',
                color: '#ffffff',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: inputVal.trim() && !loading ? 'pointer' : 'default',
                transition: 'all 0.15s',
                boxShadow: inputVal.trim() && !loading ? '0 2px 8px rgba(37, 99, 235, 0.4)' : 'none'
              }}
              title="Gửi câu hỏi"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
