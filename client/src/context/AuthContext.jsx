import React, { createContext, useContext, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../lib/apiClient.js';
import { translations } from '../i18n/translations.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [lang, setLang] = useState('en');
  const [signedOut, setSignedOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => apiRequest('/api/auth/me'),
    retry: false,
    staleTime: Infinity,
  });

  const user = signedOut ? null : data?.user || null;

  async function login(email, password) {
    setLogoutError('');
    const res = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    setSignedOut(false);
    queryClient.setQueryData(['auth', 'me'], res);
    return res.user;
  }

  async function logout() {
    const logoutRequest = apiRequest('/api/auth/logout', { method: 'POST' });
    setSignedOut(true);
    queryClient.removeQueries({
      predicate: (query) => query.queryKey[0] !== 'auth',
    });
    queryClient.setQueryData(['auth', 'me'], { user: null });
    try {
      await logoutRequest;
      setLogoutError('');
    } catch (error) {
      setLogoutError(`Signed out on this device, but the server could not confirm logout: ${error.message}`);
    }
  }

  const t = translations[lang] || translations.en;

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, logoutError, lang, setLang, t }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
