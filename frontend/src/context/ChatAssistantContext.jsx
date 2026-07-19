import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ChatAssistantContext = createContext(null);

export function ChatAssistantProvider({ children }) {
  const [open, setOpen] = useState(false);

  const toggle = useCallback(() => {
    setOpen((v) => !v);
  }, []);

  const close = useCallback(() => setOpen(false), []);
  const openChat = useCallback(() => setOpen(true), []);

  const value = useMemo(
    () => ({ open, setOpen, toggle, close, openChat }),
    [open, toggle, close, openChat],
  );

  return (
    <ChatAssistantContext.Provider value={value}>
      {children}
    </ChatAssistantContext.Provider>
  );
}

export function useChatAssistant() {
  const ctx = useContext(ChatAssistantContext);
  if (!ctx) {
    throw new Error('useChatAssistant must be used within ChatAssistantProvider');
  }
  return ctx;
}
