import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { storageApi } from '../lib/api';
import { Database, Folder, Home, Globe, Lock, Plus, Loader2, Trash2, Upload, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import CreateBucketModal from './CreateBucketModal';
import CreateFolderModal from './CreateFolderModal';
import FilePreviewModal from './FilePreviewModal';
import ConfirmationModal from './ConfirmationModal';
import FileItem from './FileItem';

interface StorageTabProps {
  instanceName: string;
}

export default function StorageTab({ instanceName }: StorageTabProps) {
  const [selectedBucket, setSelectedBucket] = useState<any | null>(null);
  const [currentPath, setCurrentPath] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ name: string; url: string | null } | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: 'bucket' | 'file'; id: string; name: string } | null>(null);

  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch Buckets
  const { data: bucketsData, isLoading: isLoadingBuckets } = useQuery({
    queryKey: ['storage-buckets', instanceName],
    queryFn: () => storageApi.listBuckets(instanceName),
  });

  // Fetch Files
  const {
    data: filesData,
    isLoading: isLoadingFiles,
    refetch: refetchFiles,
  } = useQuery({
    queryKey: ['storage-files', instanceName, selectedBucket?.id, currentPath],
    queryFn: () => storageApi.listFiles(instanceName, selectedBucket?.id, currentPath),
    enabled: !!selectedBucket,
  });

  const deleteBucketMutation = useMutation({
    mutationFn: (bucketId: string) => storageApi.deleteBucket(instanceName, bucketId),
    onSuccess: () => {
      toast.success('Bucket deleted');
      queryClient.invalidateQueries({ queryKey: ['storage-buckets', instanceName] });
      setSelectedBucket(null);
      setItemToDelete(null);
    },
    onError: (error: any) => toast.error('Failed to delete bucket', { description: error.message }),
  });

  const uploadMutation = useMutation({
    mutationFn: (variables: { file: File; path: string }) => {
      const fullPath = currentPath ? `${currentPath}/${variables.file.name}` : variables.file.name;
      return storageApi.uploadFile(instanceName, selectedBucket.id, fullPath, variables.file);
    },
    onSuccess: () => {
      toast.success('File uploaded');
      refetchFiles();
    },
    onError: (error: any) => toast.error('Upload failed', { description: error.message }),
  });

  const deleteFileMutation = useMutation({
    mutationFn: (fileName: string) => {
      const fullPath = currentPath ? `${currentPath}/${fileName}` : fileName;
      return storageApi.deleteFile(instanceName, selectedBucket.id, fullPath);
    },
    onSuccess: () => {
      toast.success('Item deleted');
      refetchFiles();
      setItemToDelete(null);
    },
    onError: (error: any) => toast.error('Delete failed', { description: error.message }),
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      uploadMutation.mutate({ file: e.target.files[0], path: currentPath });
      e.target.value = '';
    }
  };

  const handleFolderClick = (folderName: string) => {
    setCurrentPath((prev) => (prev ? `${prev}/${folderName}` : folderName));
  };

  const handleBreadcrumbClick = (index: number) => {
    if (index === -1) {
      setCurrentPath('');
      return;
    }
    const parts = currentPath.split('/');
    const newPath = parts.slice(0, index + 1).join('/');
    setCurrentPath(newPath);
  };

  const getFileUrl = async (fileName: string, isPrivate: boolean): Promise<string | null> => {
    try {
      const fullPath = currentPath ? `${currentPath}/${fileName}` : fileName;
      if (isPrivate) {
        const { signedUrl } = await storageApi.createSignedUrl(instanceName, selectedBucket.id, fullPath, 3600); // 1 hour
        return signedUrl;
      } else {
        const { publicUrl } = await storageApi.getPublicUrl(instanceName, selectedBucket.id, fullPath);
        return publicUrl;
      }
    } catch (e) {
      toast.error('Failed to get URL');
      return null;
    }
  };

  const handlePreview = async (fileName: string) => {
    if (!selectedBucket) return;
    const isPrivate = !selectedBucket.public;
    setIsLoadingPreview(true);
    setPreviewFile({ name: fileName, url: null });

    const url = await getFileUrl(fileName, isPrivate);
    setPreviewFile({ name: fileName, url });
    setIsLoadingPreview(false);
  };

  const handleDownload = async (fileName: string) => {
    if (!selectedBucket) return;
    const isPrivate = !selectedBucket.public;
    const url = await getFileUrl(fileName, isPrivate);
    if (url) {
      // Trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleDeleteClick = (type: 'bucket' | 'file', id: string, name: string) => {
    setItemToDelete({ type, id, name });
  };

  const buckets = bucketsData?.buckets || [];
  const files = filesData?.files || [];

  return (
    <div className='flex gap-6 h-[800px]'>
      {/* Sidebar: Buckets */}
      <div className='w-1/4 bg-card rounded-lg border border-border flex flex-col'>
        <div className='p-4 border-b border-border flex items-center justify-between'>
          <h3 className='font-semibold flex items-center gap-2'>
            <Database className='w-4 h-4 text-primary' />
            Buckets
          </h3>
          <button
            onClick={() => setShowCreateModal(true)}
            className='p-1.5 hover:bg-secondary rounded-md text-primary transition-colors'
            title='New Bucket'
          >
            <Plus className='w-4 h-4' />
          </button>
        </div>

        <div className='flex-1 overflow-y-auto p-2 space-y-1'>
          {isLoadingBuckets ? (
            <div className='flex justify-center p-4'>
              <Loader2 className='w-4 h-4 animate-spin text-muted-foreground' />
            </div>
          ) : buckets.length === 0 ? (
            <div className='text-center p-4 text-sm text-muted-foreground'>No buckets found</div>
          ) : (
            buckets.map((bucket: any) => (
              <div
                key={bucket.id}
                onClick={() => {
                  setSelectedBucket(bucket);
                  setCurrentPath('');
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors cursor-pointer border ${
                  selectedBucket?.id === bucket.id
                    ? 'bg-primary/5 border-primary/20'
                    : 'bg-card border-transparent hover:bg-secondary/50'
                }`}
              >
                <div className='flex items-center gap-2 truncate'>
                  {bucket.public ? (
                    <Globe className='w-3 h-3 text-green-500' />
                  ) : (
                    <Lock className='w-3 h-3 text-amber-500' />
                  )}
                  <span className='font-medium truncate'>{bucket.name}</span>
                </div>
                {selectedBucket?.id === bucket.id && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteClick('bucket', bucket.id, bucket.name);
                    }}
                    className='p-1 hover:bg-destructive/10 text-destructive rounded'
                  >
                    <Trash2 className='w-3 h-3' />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main: File Browser */}
      <div className='flex-1 bg-card rounded-lg border border-border flex flex-col'>
        {selectedBucket ? (
          <>
            {/* Toolbar */}
            <div className='p-4 border-b border-border flex items-center justify-between'>
              {/* Breadcrumbs */}
              <div className='flex items-center gap-1 text-sm text-muted-foreground overflow-hidden'>
                <button onClick={() => handleBreadcrumbClick(-1)} className='hover:text-foreground flex items-center'>
                  <Home className='w-4 h-4' />
                </button>
                {currentPath &&
                  currentPath.split('/').map((part, i) => (
                    <div key={i} className='flex items-center gap-1'>
                      <ChevronRight className='w-4 h-4 opacity-50' />
                      <button onClick={() => handleBreadcrumbClick(i)} className='hover:text-foreground font-medium'>
                        {part}
                      </button>
                    </div>
                  ))}
              </div>

              <div className='flex items-center gap-2'>
                <button
                  onClick={() => setShowCreateFolderModal(true)}
                  className='flex items-center gap-2 px-3 py-1.5 bg-secondary text-secondary-foreground text-sm rounded-md hover:bg-secondary/80 transition-colors'
                >
                  <Plus className='w-4 h-4' />
                  New Folder
                </button>
                <input type='file' ref={fileInputRef} onChange={handleFileUpload} className='hidden' />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadMutation.isPending}
                  className='flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground text-sm rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50'
                >
                  {uploadMutation.isPending ? (
                    <Loader2 className='w-4 h-4 animate-spin' />
                  ) : (
                    <Upload className='w-4 h-4' />
                  )}
                  Upload
                </button>
              </div>
            </div>

            {/* File List */}
            <div className='flex-1 overflow-y-auto p-4'>
              {isLoadingFiles ? (
                <div className='flex justify-center p-8'>
                  <Loader2 className='w-8 h-8 animate-spin text-muted-foreground' />
                </div>
              ) : files.length === 0 ? (
                <div className='text-center p-8 text-muted-foreground flex flex-col items-center'>
                  <Folder className='w-12 h-12 opacity-20 mb-2' />
                  <p>This folder is empty</p>
                  <p className='text-xs'>Upload a file to get started</p>
                </div>
              ) : (
                <div className='grid grid-cols-2md:grid-cols-4 lg:grid-cols-6 gap-4'>
                  {files.map((file: any) => {
                    const isFolder = !file.id; // Supabase list returns folders as placeholder objects often without ID or explicit type
                    // Actually supabase-js v2 returns placeholders for folders if using `fs` backend?
                    // Let's check typical response.
                    // Actually, typical `list` result has `id`, `name`, `metadata`.
                    // Folders often don't exist physically. They are just prefixes.
                    // BUT supabase `list` accepts path.
                    // If list returns items with `id` it's a file. If it returns just name, maybe folder?
                    // Supabase storage-js actually returns objects. If an object is a "folder", it usually has no metadata.
                    // Let's simplify:
                    // The API response from backend wraps `data`.
                    if (isFolder) {
                      return (
                        <div
                          key={file.name}
                          className='group relative flex flex-col items-center p-3 rounded-lg border border-transparent hover:border-border hover:bg-secondary/30 transition-all cursor-pointer'
                          onClick={() => handleFolderClick(file.name)}
                        >
                          <div className='w-24 h-24 mb-2 flex items-center justify-center bg-secondary/50 rounded-md text-primary'>
                            <Folder className='w-10 h-10' />
                          </div>
                          <span className='text-xs text-center truncate w-full px-1 max-w-[120px]'>{file.name}</span>
                          <span className='text-[10px] text-muted-foreground'>Folder</span>
                        </div>
                      );
                    }

                    return (
                      <FileItem
                        key={file.name}
                        file={file}
                        isPrivate={!selectedBucket.public}
                        onPreview={handlePreview}
                        onDownload={handleDownload}
                        onDelete={(name) => handleDeleteClick('file', name, name)}
                        getFileUrl={getFileUrl}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className='flex-1 flex flex-col items-center justify-center text-muted-foreground'>
            <div className='bg-secondary/20 p-6 rounded-full mb-4'>
              <Database className='w-12 h-12 opacity-50' />
            </div>
            <p className='text-lg font-medium'>Select a bucket</p>
            <p className='text-sm'>Manage your files and folders</p>
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateBucketModal
          instanceName={instanceName}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['storage-buckets', instanceName] })}
        />
      )}

      {showCreateFolderModal && selectedBucket && (
        <CreateFolderModal
          instanceName={instanceName}
          bucketId={selectedBucket.id}
          currentPath={currentPath}
          onClose={() => setShowCreateFolderModal(false)}
          onSuccess={() => refetchFiles()}
        />
      )}

      {previewFile && (
        <FilePreviewModal
          fileName={previewFile.name}
          url={previewFile.url}
          isLoading={isLoadingPreview}
          onClose={() => setPreviewFile(null)}
        />
      )}

      <ConfirmationModal
        isOpen={!!itemToDelete}
        title={itemToDelete?.type === 'bucket' ? 'Delete Bucket' : 'Delete File'}
        message={`Are you sure you want to delete ${itemToDelete?.name}? This action cannot be undone.`}
        confirmText='Delete'
        variant='danger'
        isLoading={deleteBucketMutation.isPending || deleteFileMutation.isPending}
        onClose={() => setItemToDelete(null)}
        onConfirm={() => {
          if (itemToDelete?.type === 'bucket') {
            deleteBucketMutation.mutate(itemToDelete.id);
          } else if (itemToDelete?.type === 'file') {
            deleteFileMutation.mutate(itemToDelete.id);
          }
        }}
      />
    </div>
  );
}
