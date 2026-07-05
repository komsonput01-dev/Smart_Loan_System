'use client';

import React from 'react';
import { ConfigProvider, theme } from 'antd';
import th_TH from 'antd/locale/th_TH';
import AntdRegistry from './AntdRegistry';
import dayjs from 'dayjs';
import 'dayjs/locale/th';

dayjs.locale('th');

const smartLoanTheme = {
  token: {
    // Brand
    colorPrimary: '#1a56db',
    colorPrimaryHover: '#1648c0',
    colorPrimaryActive: '#1340aa',

    // Typography
    fontFamily:
      "'Inter', 'Sarabun', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSize: 14,

    // Border
    borderRadius: 10,
    borderRadiusLG: 14,
    borderRadiusSM: 6,
    colorBorder: '#e5e7eb',
    colorBorderSecondary: '#f3f4f6',

    // Background
    colorBgBase: '#ffffff',
    colorBgContainer: '#ffffff',
    colorBgLayout: '#f5f7fa',
    colorBgElevated: '#ffffff',

    // Text
    colorText: '#111827',
    colorTextSecondary: '#6b7280',
    colorTextTertiary: '#9ca3af',
    colorTextPlaceholder: '#9ca3af',

    // Status
    colorSuccess: '#10b981',
    colorWarning: '#f59e0b',
    colorError: '#ef4444',
    colorInfo: '#3b82f6',

    // Misc
    boxShadow:
      '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
    boxShadowSecondary:
      '0 4px 6px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.04)',
    lineHeight: 1.6,

    // Motion
    motionDurationSlow: '0.3s',
    motionDurationMid: '0.2s',
    motionDurationFast: '0.15s',
  },
  components: {
    Button: {
      borderRadius: 10,
      fontWeight: 600,
      controlHeight: 38,
    },
    Input: {
      borderRadius: 10,
      controlHeight: 38,
    },
    Select: {
      borderRadius: 10,
      controlHeight: 38,
    },
    Table: {
      headerBg: '#f9fafb',
      headerColor: '#6b7280',
      headerSortActiveBg: '#f3f4f6',
      rowHoverBg: '#fafbff',
      borderColor: '#f3f4f6',
    },
    Card: {
      borderRadius: 14,
    },
    Menu: {
      itemBorderRadius: 10,
      itemSelectedBg: '#e8f0fe',
      itemSelectedColor: '#1a56db',
      itemHoverBg: '#f0f4ff',
    },
    Tag: {
      borderRadius: 9999,
    },
    Badge: {
      colorBgContainer: '#ffffff',
    },
    Tooltip: {
      borderRadius: 8,
    },
    Drawer: {
      borderRadius: 14,
    },
    Modal: {
      borderRadius: 16,
    },
    Form: {
      labelColor: '#374151',
      labelFontSize: 13,
    },
    Statistic: {
      titleFontSize: 13,
      contentFontSize: 24,
    },
    Layout: {
      siderBg: '#ffffff',
      headerBg: '#ffffff',
      bodyBg: '#f5f7fa',
    },
  },
};

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <AntdRegistry>
      <ConfigProvider
        theme={smartLoanTheme}
        locale={th_TH}
      >
        {children}
      </ConfigProvider>
    </AntdRegistry>
  );
}
