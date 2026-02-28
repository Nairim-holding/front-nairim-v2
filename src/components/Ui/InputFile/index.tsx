/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Eye, FileText, Download, Image as ImageIcon, ChevronRight, ChevronLeft, AlertCircle } from 'lucide-react';
import Label from '../Label';
import Image from 'next/image';

interface DocumentItem {
  id?: string;
  file_name: string;
  file_url: string;
  type?: string;
  mime_type?: string;
  description?: string;
}

interface FilePreview {
  type: 'image' | 'video' | 'pdf' | 'other';
  name: string;
  url: string;
  file?: File;
  fileUrl?: string;
  id?: string;
  mimeType?: string;
  documentType?: string;
}

export interface InputFileProps {
  id: string;
  label: string;
  accept: string;
  textButton?: string;
  value?: DocumentItem[] | File[];
  onChange?: (files: File[]) => void;
  svg?: React.ReactNode;
  multiple?: boolean;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  maxFiles?: number;
  isViewMode?: boolean;
}

export default function InputFile({
  id,
  label,
  accept,
  textButton = "Selecionar Arquivos",
  value = [],
  onChange,
  svg,
  multiple = false,
  disabled = false,
  required = false,
  placeholder = "Nenhum arquivo selecionado",
  maxFiles = 30,
  isViewMode = false,
}: InputFileProps) {
  const [previews, setPreviews] = useState<FilePreview[]>([]);
  const [modalMedia, setModalMedia] = useState<{url: string, type: 'image' | 'video'} | null>(null);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEditMode = !isViewMode && !disabled;
  const currentCount = Array.isArray(value) ? value.length : 0;
  const isLimitReached = multiple && maxFiles ? currentCount >= maxFiles : false;
  const isUploadDisabled = disabled || isLimitReached;

  const mediaItems = previews.filter(p => p.type === 'image' || p.type === 'video');
  const documents = previews.filter(p => p.type !== 'image' && p.type !== 'video');
  
  const imageGridClass = isViewMode 
    ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3'
    : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3';
    
  const documentGridClass = isViewMode 
    ? 'grid-cols-1 sm:grid-cols-1 gap-4'
    : 'grid-cols-1 sm:grid-cols-1 gap-4';

  const getDocumentTypeName = (type?: string): string => {
    if (!type) return 'Documento';
    
    const typeMap: Record<string, string> = {
      'REGISTRATION': 'Matrícula',
      'PROPERTY_RECORD': 'Registro',
      'TITLE_DEED': 'Escritura',
      'IMAGE': 'Mídia',
      'OTHER': 'Outro Documento'
    };
    
    return typeMap[type] || type;
  };

  const getDisplayName = (preview: FilePreview): string => {
    return preview.name;
  };

  const isDocumentItem = (item: any): item is DocumentItem => {
    return item && 
      typeof item === 'object' && 
      'file_name' in item && 
      'file_url' in item &&
      !(item instanceof File);
  };

  const isFileInstance = (item: any): item is File => {
    return item instanceof File;
  };

  useEffect(() => {
    const generatePreviews = async () => {
      const newPreviews: FilePreview[] = [];
      
      const items = (value || []) as any[];
      for (const item of items) {
        if (item && isDocumentItem(item)) {
          const fileName = item.file_name || item.description || getDocumentTypeName(item.type);
          const fileUrl = item.file_url;
          const fileType = item.type || '';
          const mimeType = item.mime_type || '';
          
          let type: 'image' | 'video' | 'pdf' | 'other' = 'other';
          
          if (mimeType.startsWith('video/') || fileName.match(/\.(mp4|webm|ogg|mov)$/i)) {
            type = 'video';
          } else if (fileType === 'IMAGE' || mimeType.startsWith('image/') || 
              fileName.match(/\.(jpeg|jpg|gif|png|webp|bmp|svg)$/i)) {
            type = 'image';
          } else if (fileType === 'REGISTRATION' || fileType === 'PROPERTY_RECORD' || 
                    fileType === 'TITLE_DEED' || mimeType === 'application/pdf' ||
                    fileName.toLowerCase().endsWith('.pdf')) {
            type = 'pdf';
          }
          
          newPreviews.push({
            type,
            name: fileName,
            url: fileUrl,
            fileUrl: fileUrl,
            id: item.id,
            mimeType: mimeType,
            documentType: item.type,
          });
        } else if (item && isFileInstance(item)) {
          if (item.type.startsWith('image/')) {
            const url = URL.createObjectURL(item);
            newPreviews.push({
              type: 'image',
              name: item.name,
              url,
              file: item,
              mimeType: item.type,
            });
          } else if (item.type.startsWith('video/')) {
            const url = URL.createObjectURL(item);
            newPreviews.push({
              type: 'video',
              name: item.name,
              url,
              file: item,
              mimeType: item.type,
            });
          } else if (item.type === 'application/pdf') {
            newPreviews.push({
              type: 'pdf',
              name: item.name,
              url: URL.createObjectURL(item),
              file: item,
              mimeType: item.type,
            });
          } else {
            newPreviews.push({
              type: 'other',
              name: item.name,
              url: '#',
              file: item,
              mimeType: item.type,
            });
          }
        }
      }
      
      setPreviews(newPreviews);
    };

    if (value && (Array.isArray(value) ? value.length > 0 : true)) {
      generatePreviews();
    } else {
      setPreviews([]);
    }

    return () => {
      previews.forEach(preview => {
        if (preview.url.startsWith('blob:')) {
          URL.revokeObjectURL(preview.url);
        }
      });
    };
  }, [value, isEditMode, disabled]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || !onChange) return;

    const fileArray = Array.from(files);
    
    const newPreviews: FilePreview[] = fileArray.map(file => {
      if (file.type.startsWith('video/')) {
        const url = URL.createObjectURL(file);
        return {
          type: 'video',
          name: file.name,
          url,
          file,
          mimeType: file.type,
        };
      } else if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        return {
          type: 'image',
          name: file.name,
          url,
          file,
          mimeType: file.type,
        };
      } else if (file.type === 'application/pdf') {
        return {
          type: 'pdf',
          name: file.name,
          url: URL.createObjectURL(file),
          file,
          mimeType: file.type,
        };
      } else {
        return {
          type: 'other',
          name: file.name,
          url: '#',
          file,
          mimeType: file.type,
        };
      }
    });

    setPreviews(prev => [...prev, ...newPreviews]);

    if (multiple) {
      const currentItems = value as any[];
      const existingDocumentItems = currentItems.filter(isDocumentItem);
      const existingFiles = currentItems.filter(isFileInstance);
      const combinedFiles = [...existingDocumentItems, ...existingFiles, ...fileArray].slice(0, maxFiles) as any;
      onChange(combinedFiles);
    } else {
      onChange(fileArray.slice(0, 1));
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = (index: number) => {
    if (!onChange || !isEditMode) return;
    
    const itemToRemove = previews[index];
    setPreviews(prev => prev.filter((_, i) => i !== index));
    
    const currentItems = value as any[];
    
    const newItems = currentItems.filter((item) => {
      if (isDocumentItem(item) && item.id === itemToRemove.id) {
        return false;
      }
      if (isFileInstance(item) && itemToRemove.file && item === itemToRemove.file) {
        return false;
      }
      return true;
    });
    
    onChange(newItems);
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const openMediaModal = (url: string, type: 'image' | 'video', index: number) => {
    setModalMedia({url, type});
    setCurrentMediaIndex(index);
  };

  const closeModal = () => {
    setModalMedia(null);
    setCurrentMediaIndex(0);
  };

  const nextMedia = () => {
    if (mediaItems.length === 0) return;
    const nextIndex = (currentMediaIndex + 1) % mediaItems.length;
    setCurrentMediaIndex(nextIndex);
    const media = mediaItems[nextIndex];
    setModalMedia({url: media.fileUrl || media.url, type: media.type as 'image' | 'video'});
  };

  const prevMedia = () => {
    if (mediaItems.length === 0) return;
    const prevIndex = (currentMediaIndex - 1 + mediaItems.length) % mediaItems.length;
    setCurrentMediaIndex(prevIndex);
    const media = mediaItems[prevIndex];
    setModalMedia({url: media.fileUrl || media.url, type: media.type as 'image' | 'video'});
  };

  const handleDownload = async (preview: FilePreview) => {
    try {
      if (preview.fileUrl && preview.fileUrl !== '#') {
        const link = document.createElement('a');
        link.href = preview.fileUrl;
        link.download = preview.name;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else if (preview.file) {
        const url = URL.createObjectURL(preview.file);
        const link = document.createElement('a');
        link.href = url;
        link.download = preview.name;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      if (preview.fileUrl && preview.fileUrl !== '#') {
        window.open(preview.fileUrl, '_blank');
      }
    }
  };

  const handleOpenFile = (preview: FilePreview) => {
    if (preview.fileUrl && preview.fileUrl !== '#') {
      if (preview.type === 'image' || preview.type === 'video') {
        const index = mediaItems.findIndex(m => 
          (m.fileUrl || m.url) === (preview.fileUrl || preview.url)
        );
        openMediaModal(preview.fileUrl, preview.type as 'image' | 'video', index);
      } else {
        window.open(preview.fileUrl, '_blank');
      }
    } else if (preview.file) {
      if (preview.type === 'image' || preview.type === 'video') {
        const url = URL.createObjectURL(preview.file);
        openMediaModal(url, preview.type, 0);
      } else {
        const url = URL.createObjectURL(preview.file);
        window.open(url, '_blank');
      }
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const renderMediaGrid = () => {
    if (mediaItems.length === 0) return null;

    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-content-secondary whitespace-nowrap">
            Mídias ({mediaItems.length})
          </h4>
        </div>
        <div className={`grid ${imageGridClass}`}>
          {mediaItems.map((preview, index) => {
            const globalIndex = previews.findIndex(p => p === preview);
            
            return (
            <div
              key={preview.id || `media-${index}`}
              className="group relative border rounded-lg overflow-hidden bg-black hover:border-brand transition-all duration-200"
            >
              {isEditMode && (
                <button
                  type="button"
                  onClick={() => handleRemoveFile(globalIndex)}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 
                            opacity-0 group-hover:opacity-100 transition-opacity z-10"
                >
                  <X size={16} />
                </button>
              )}

              <div 
                className="relative w-full cursor-pointer bg-black flex justify-center items-center h-[100px]"
                onClick={() => openMediaModal(preview.fileUrl || preview.url, preview.type as 'image'|'video', index)}
              >
                {preview.type === 'video' ? (
                  <video 
                    src={preview.fileUrl || preview.url} 
                    className="object-cover max-w-[100px] min-w-[100px] max-h-[100px] min-h-[100px] opacity-80"
                  />
                ) : (
                  <Image
                    src={preview.fileUrl || preview.url}
                    alt={preview.name}
                    width={100}
                    height={100}
                    className="object-cover hover:scale-105 transition-transform duration-200 max-w-[100px] min-w-[100px] max-h-[100px] min-h-[100px]"
                    unoptimized
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = 'https://via.placeholder.com/300x300?text=Mídia';
                    }}
                  />
                )}
                <div className="absolute inset-0 flex items-center justify-center">
                  <Eye size={24} className="opacity-0 group-hover:opacity-100 text-white bg-black bg-opacity-40 p-1 rounded-full transition-opacity duration-200" />
                </div>
              </div>
              
              <div className="p-3 bg-surface">
                <p className="text-xs font-medium text-content truncate mb-1">
                  {getDisplayName(preview)}
                </p>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-content-muted">
                    {preview.file && formatFileSize(preview.file.size)}
                  </span>
                  {!isEditMode && (
                    <button
                      type="button"
                      onClick={() => handleDownload(preview)}
                      className="text-xs text-state-success hover:text-green-700 hover:underline flex items-center gap-1"
                    >
                      <Download size={12} />
                      Baixar
                    </button>
                  )}
                </div>
              </div>
            </div>
          )})}
        </div>
      </div>
    );
  };

  const renderDocuments = () => {
    if (documents.length === 0) return null;

    return (
      <div className="mt-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-content-secondary whitespace-nowrap">
            Documentos ({documents.length})
          </h4>
        </div>
        <div className={`grid ${documentGridClass}`}>
          {documents.map((preview, index) => {
            const globalIndex = previews.findIndex(p => p === preview);
            
            return (
              <div
                key={preview.id || `doc-${index}`}
                className="group relative border rounded-lg p-4 bg-surface hover:border-brand transition-all duration-200"
              >
                {isEditMode && (
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(globalIndex)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 
                               opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  >
                    <X size={16} />
                  </button>
                )}

                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    {preview.type === 'pdf' ? (
                      <div className="p-2 bg-red-50 rounded-lg">
                        <FileText size={24} className="text-red-500" />
                      </div>
                    ) : (
                      <div className="p-2 bg-surface-subtle rounded-lg">
                        <FileText size={24} className="text-content-muted" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-content truncate mb-1">
                      {getDisplayName(preview)}
                    </p>
                    {preview.file && (
                      <p className="text-xs text-content-muted mb-2">
                        {formatFileSize(preview.file.size)}
                      </p>
                    )}
                    
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => handleOpenFile(preview)}
                        className="text-xs text-brand hover:text-brand-hover hover:underline flex items-center gap-1"
                      >
                        <Eye size={12} />
                        Visualizar
                      </button>
                      {!isEditMode && (
                        <button
                          type="button"
                          onClick={() => handleDownload(preview)}
                          className="text-xs text-state-success hover:text-green-700 hover:underline flex items-center gap-1"
                        >
                          <Download size={12} />
                          Baixar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-full">
      {modalMedia && mediaItems.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-95 z-50 flex items-center justify-center p-4">
          <div className="relative max-w-6xl max-h-[90vh] w-full flex flex-col items-center">
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 bg-surface rounded-full p-2 shadow-lg hover:bg-surface-subtle z-10"
            >
              <X size={24} />
            </button>

            {mediaItems.length > 1 && (
              <button
                onClick={prevMedia}
                type="button"
                className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-surface rounded-full p-2 shadow-lg hover:bg-surface-subtle z-10"
              >
                <ChevronLeft size={24} />
              </button>
            )}

            <div className="relative w-full h-[70vh] flex items-center justify-center bg-black">
              {modalMedia.type === 'video' ? (
                <video 
                  src={modalMedia.url} 
                  controls 
                  className="max-w-full max-h-full rounded-lg"
                  autoPlay
                />
              ) : (
                <Image
                  src={modalMedia.url}
                  alt={`Mídia ${currentMediaIndex + 1} de ${mediaItems.length}`}
                  fill
                  className="object-contain rounded-lg"
                  unoptimized
                />
              )}
            </div>

            {mediaItems.length > 1 && (
              <button
                onClick={nextMedia}
                type="button"  
                className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-surface rounded-full p-2 shadow-lg hover:bg-surface-subtle z-10"
              >
                <ChevronRight size={24} />
              </button>
            )}

            {mediaItems.length > 1 && (
              <div className="mt-4 flex justify-center space-x-2 overflow-x-auto w-full max-w-2xl px-4 py-2">
                {mediaItems.map((img, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setCurrentMediaIndex(index);
                      setModalMedia({url: img.fileUrl || img.url, type: img.type as 'image'|'video'});
                    }}
                    type="button"
                    className={`relative w-12 h-12 flex-shrink-0 rounded overflow-hidden border-2 bg-black ${
                      index === currentMediaIndex 
                        ? 'border-brand' 
                        : 'border-transparent'
                    }`}
                  >
                    {img.type === 'video' ? (
                       <video src={img.fileUrl || img.url} className="object-cover w-full h-full opacity-60" />
                    ) : (
                      <Image
                        src={img.fileUrl || img.url}
                        alt=""
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    )}
                  </button>
                ))}
              </div>
            )}

            <div className="absolute bottom-20 right-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm whitespace-nowrap">
              {currentMediaIndex + 1} / {mediaItems.length}
            </div>
          </div>
        </div>
      )}

      <Label id={id} label={label} required={required} svg={svg} />

      <div className={`
        flex flex-col w-full p-5 border-2 ${isViewMode ? 'border-solid' : 'border-dashed'} rounded-lg
        ${disabled 
          ? 'bg-surface-muted border-ui-border' 
          : isLimitReached
            ? 'bg-red-50 border-red-500'
            : 'bg-surface border-ui-border hover:border-brand'}
        transition-colors duration-200 h-full
      `}>
        {isEditMode && (
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center mb-2">
            <button
              type="button"
              onClick={handleButtonClick}
              disabled={isUploadDisabled}
              className={`
                flex justify-center items-center px-6 py-2.5 rounded-lg
                text-[16px] font-medium transition-all duration-200
                whitespace-nowrap flex-shrink-0
                ${isUploadDisabled
                  ? 'bg-surface-muted text-content-muted cursor-not-allowed'
                  : 'bg-gradient-to-r from-brand to-brand-hover text-white hover:shadow-lg hover:shadow-purple-500/25'
                }
              `}
            >
              {textButton}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              id={id}
              accept={accept}
              onChange={handleFileChange}
              multiple={multiple}
              disabled={isUploadDisabled}
              required={required && currentCount === 0}
              className="hidden"
            />

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                <p className={`text-[14px] font-medium truncate ${isLimitReached ? 'text-red-600' : 'text-content-muted'}`}>
                  {currentCount > 0 
                    ? `${currentCount} arquivo(s) selecionado(s)` 
                    : placeholder
                  }
                </p>
                {multiple && maxFiles > 0 && (
                  <span className={`inline-block whitespace-nowrap min-w-max flex-shrink-0 text-[12px] px-2 py-0.5 rounded-full font-semibold ${isLimitReached ? 'bg-red-100 text-red-600' : 'bg-surface-subtle text-content-muted'}`}>
                    {currentCount}&nbsp;/&nbsp;{maxFiles}
                  </span>
                )}
              </div>
              {accept && (
                <p className="text-[12px] text-content-placeholder mt-1">
                  Formatos aceitos: {accept.replace(/,video\/(mp4|webm)/g, ' + vídeos')}
                </p>
              )}
              {isLimitReached && !disabled && (
                <div className="flex items-center gap-1 mt-1 text-red-600">
                  <AlertCircle size={14} className="flex-shrink-0" />
                  <p className="text-[12px] font-medium">
                    Limite máximo atingido. Remova arquivos para adicionar novos.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {previews.length > 0 ? (
          <div className={`${isViewMode ? 'mt-0' : 'mt-2'}`}>
            {renderMediaGrid()}
            {renderDocuments()}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="mb-4">
              <ImageIcon className={`mx-auto h-12 w-12 ${isLimitReached ? 'text-red-300' : 'text-content-placeholder'}`} />
            </div>
            <p className={`text-sm ${isLimitReached ? 'text-red-600 font-medium' : 'text-content-muted'}`}>
              {isViewMode ? 'Nenhum arquivo anexado' : placeholder}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}