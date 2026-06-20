import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as authApi from '../api/auth';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [organization, setOrganization] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user;

  useEffect(() => {
    const token = localStorage.getItem('loghive_token');
    if (!token) {
      setIsLoading(false);
      return;
    }
    authApi
      .getMe()
      .then((data) => {
        setUser(data);
        setOrganization(data.Organization);
      })
      .catch(() => {
        localStorage.removeItem('loghive_token');
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await authApi.login(email, password);
    localStorage.setItem('loghive_token', data.token);
    setUser(data.user);
    setOrganization(data.organization);
    return data;
  }, []);

  const registerUser = useCallback(async (formData) => {
    const data = await authApi.register(formData);
    return data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('loghive_token');
    setUser(null);
    setOrganization(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, organization, isAuthenticated, isLoading, login, register: registerUser, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}
