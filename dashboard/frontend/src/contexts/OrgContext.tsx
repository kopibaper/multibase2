import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface Organisation {
  id: string;
  name: string;
  slug: string;
  description?: string;
  createdAt: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  memberCount?: number;
  instanceCount?: number;
}

interface OrgContextType {
  orgs: Organisation[];
  activeOrg: Organisation | null;
  setActiveOrg: (org: Organisation) => void;
  loading: boolean;
  refreshOrgs: () => Promise<void>;
}

const OrgContext = createContext<OrgContextType | undefined>(undefined);

import { useQueryClient } from '@tanstack/react-query';

export function OrgProvider({ children }: { children: React.ReactNode }) {
  const { token, isAuthenticated } = useAuth();
  const [orgs, setOrgs] = useState<Organisation[]>([]);
  const [activeOrg, setActiveOrgState] = useState<Organisation | null>(null);
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const fetchOrgs = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/orgs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setOrgs(data);

      // Cache orgs for the API helper (so fetchApi can resolve slug → id)
      localStorage.setItem('cachedOrgs', JSON.stringify(data));

      const savedSlug = localStorage.getItem('activeOrgSlug');
      const saved = data.find((o: Organisation) => o.slug === savedSlug);
      const orgToSet = saved || data[0] || null;
      if (orgToSet) {
        setActiveOrg(orgToSet);
      } else {
        setActiveOrgState(null);
      }
    } catch (e) {
      console.error('Failed to fetch orgs', e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (isAuthenticated) fetchOrgs();
  }, [isAuthenticated, fetchOrgs]);

  const setActiveOrg = (org: Organisation) => {
    setActiveOrgState(org);
    localStorage.setItem('activeOrgSlug', org.slug);
    queryClient.invalidateQueries(); // Refresh all data for new org
  };

  return (
    <OrgContext.Provider value={{ orgs, activeOrg, setActiveOrg, loading, refreshOrgs: fetchOrgs }}>
      {children}
    </OrgContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useOrg() {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error('useOrg must be used within OrgProvider');
  return ctx;
}
