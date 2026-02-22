/**
 * React Query Hooks for Shared Infrastructure (Cloud-Version)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sharedApi } from '../lib/api';

// =====================================================
// Queries
// =====================================================

/**
 * Get shared infrastructure status (auto-refresh every 15s)
 */
export const useSharedStatus = () =>
  useQuery({
    queryKey: ['shared', 'status'],
    queryFn: sharedApi.getStatus,
    refetchInterval: 15000,
    retry: 1,
  });

/**
 * Get all project databases in the shared cluster
 */
export const useSharedDatabases = () =>
  useQuery({
    queryKey: ['shared', 'databases'],
    queryFn: sharedApi.getDatabases,
    refetchInterval: 30000,
  });

// =====================================================
// Mutations
// =====================================================

/**
 * Start shared infrastructure
 */
export const useStartSharedInfra = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: sharedApi.start,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared'] });
    },
  });
};

/**
 * Stop shared infrastructure
 */
export const useStopSharedInfra = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: sharedApi.stop,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared'] });
    },
  });
};

/**
 * Create a project database
 */
export const useCreateDatabase = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectName: string) => sharedApi.createDatabase(projectName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared', 'databases'] });
    },
  });
};

/**
 * Delete a project database
 */
export const useDeleteDatabase = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => sharedApi.deleteDatabase(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared', 'databases'] });
    },
  });
};
