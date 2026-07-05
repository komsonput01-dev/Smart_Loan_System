/**
 * Document Upload Component — Smart Loan Management System
 *
 * Integrates Ant Design's <Upload> component.
 * Features:
 *   1. Opens mobile camera directly using capture="environment".
 *   2. Client-side compression down to ~200-300KB before upload.
 *   3. Shows image preview before and after upload.
 *   4. Fetches secure, temporary Signed URLs (5-minute expiry) to render existing docs.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Upload, Button, Card, Image, Spin, message, Typography, Modal, Space } from 'antd';
import { CameraOutlined, FileImageOutlined, LoadingOutlined, EyeOutlined } from '@ant-design/icons';
import type { RcFile, UploadFile } from 'antd/es/upload/interface';
import { compressImage } from '@/lib/image-compression';

const { Text, Paragraph } = Typography;

interface DocumentUploadProps {
  loanId: string;
  docType: 'id_card' | 'title_deed' | 'contract';
  title: string;
  description?: string;
  onUploadSuccess?: (url: string) => void;
}

export default function DocumentUpload({
  loanId,
  docType,
  title,
  description,
  onUploadSuccess,
}: DocumentUploadProps) {
  const [loading, setLoading] = useState(false);
  const [fetchingUrl, setFetchingUrl] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  // ── 1. Fetch Existing File Status ─────────────────────────────────────────
  const fetchSignedUrl = async () => {
    setFetchingUrl(true);
    try {
      const res = await fetch(`/api/document?loanId=${loanId}&docType=${docType}`, { method: 'HEAD' });
      if (res.ok) {
        setPreviewUrl(`/api/document?loanId=${loanId}&docType=${docType}&t=${Date.now()}`);
      } else {
        setPreviewUrl('');
      }
    } catch (error) {
      console.error('[DocumentUpload] Error checking document existence:', error);
      setPreviewUrl('');
    } finally {
      setFetchingUrl(false);
    }
  };

  useEffect(() => {
    if (loanId && docType) {
      fetchSignedUrl();
    }
  }, [loanId, docType]);

  // ── 2. Before Upload: Compress Image Client-Side ──────────────────────────
  const handleBeforeUpload = async (file: RcFile): Promise<boolean> => {
    // Show spinner
    setLoading(true);

    try {
      const isImage = file.type.startsWith('image/');
      let fileToUpload: File = file;

      if (isImage) {
        // Compress image to 200-300 KB range
        fileToUpload = await compressImage(file, 1200, 1200, 0.75);
      }

      // Prepare multi-part request body
      const formData = new FormData();
      formData.append('file', fileToUpload);
      formData.append('loanId', loanId);
      formData.append('docType', docType);

      // Perform Cloud Upload via secure API Route
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error ?? 'การอัปโหลดไฟล์ล้มเหลว');
      }

      const data = await res.json();
      message.success(`อัปโหลด ${title} เรียบร้อยแล้ว`);
      
      // Update local preview and trigger parent success handler
      fetchSignedUrl();
      if (onUploadSuccess) {
        onUploadSuccess(data.url);
      }
    } catch (error: any) {
      console.error(error);
      message.error(error.message ?? 'เกิดข้อผิดพลาดในการอัปโหลด');
    } finally {
      setLoading(false);
    }

    // Return false to prevent AntD from auto-uploading via action prop
    return false;
  };

  return (
    <Card 
      size="small" 
      title={title} 
      style={{ 
        borderRadius: 'var(--radius-lg)', 
        border: '1px solid var(--color-border-subtle)',
        boxShadow: 'var(--shadow-sm)'
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        
        {/* Document Preview Box */}
        <div 
          style={{ 
            width: '100%', 
            height: 180, 
            borderRadius: 'var(--radius-md)', 
            border: '2px dashed var(--color-border)', 
            background: 'var(--color-bg-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            position: 'relative'
          }}
        >
          {fetchingUrl || loading ? (
            <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
          ) : previewUrl ? (
            <div style={{ width: '100%', height: '100%', position: 'relative' }}>
              <Image
                src={previewUrl}
                alt={title}
                width="100%"
                height="100%"
                style={{ objectFit: 'cover' }}
              />
              <div 
                style={{ 
                  position: 'absolute', 
                  bottom: 0, 
                  left: 0, 
                  right: 0, 
                  background: 'rgba(0,0,0,0.6)', 
                  padding: '4px 8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <Text style={{ color: '#fff', fontSize: 11 }}>เข้ารหัสความปลอดภัย (PDPA)</Text>
                <Button 
                  type="text" 
                  size="small" 
                  icon={<EyeOutlined style={{ color: '#fff' }} />} 
                  onClick={() => window.open(previewUrl, '_blank')}
                />
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 16 }}>
              <FileImageOutlined style={{ fontSize: 32, color: 'var(--color-text-muted)', marginBottom: 8 }} />
              <Paragraph style={{ margin: 0, fontSize: 12 }}>ยังไม่ได้อัปโหลดเอกสาร</Paragraph>
            </div>
          )}
        </div>

        {/* Info text */}
        {description && (
          <Text type="secondary" style={{ fontSize: 11, textAlign: 'center' }}>
            {description}
          </Text>
        )}

        {/* Upload Action Group */}
        <Upload
          fileList={fileList}
          beforeUpload={handleBeforeUpload}
          showUploadList={false}
          accept="image/*"
        >
          <Space>
            {/* Opens mobile camera immediately using capture attribute */}
            <Button
              type="primary"
              icon={<CameraOutlined />}
              loading={loading}
              style={{ borderRadius: 'var(--radius-md)', fontWeight: 600 }}
              htmlType="button"
              // HTML5 camera capture config
              onClick={() => {
                const input = document.querySelector('input[type="file"]') as HTMLInputElement;
                if (input) {
                  input.setAttribute('capture', 'environment');
                }
              }}
            >
              ถ่ายภาพจากกล้อง
            </Button>
            
            <Button
              icon={<FileImageOutlined />}
              loading={loading}
              style={{ borderRadius: 'var(--radius-md)' }}
            >
              เลือกไฟล์ภาพ
            </Button>
          </Space>
        </Upload>
      </div>
    </Card>
  );
}
