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
    colorPrimary: '#0f172a',
    colorPrimaryHover: '#1e293b',
    colorPrimaryActive: '#020617',

    // Typography
    fontFamily:
      "'Inter', 'Sarabun', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSize: 14,

    // Border
    borderRadius: 10,
    borderRadiusLG: 14,
    borderRadiusSM: 6,
    colorBorder: '#e2e8f0',
    colorBorderSecondary: '#f1f5f9',

    // Background
    colorBgBase: '#ffffff',
    colorBgContainer: '#ffffff',
    colorBgLayout: '#f8fafc',
    colorBgElevated: '#ffffff',

    // Text
    colorText: '#0f172a',
    colorTextSecondary: '#475569',
    colorTextTertiary: '#94a3b8',
    colorTextPlaceholder: '#94a3b8',

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
      headerBg: '#f8fafc',
      headerColor: '#475569',
      headerSortActiveBg: '#f1f5f9',
      rowHoverBg: 'rgba(241, 245, 249, 0.75)',
      borderColor: '#f1f5f9',
    },
    Card: {
      borderRadius: 14,
    },
    Menu: {
      itemBorderRadius: 10,
      itemSelectedBg: '#f1f5f9',
      itemSelectedColor: '#0f172a',
      itemHoverBg: '#f8fafc',
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
      labelColor: '#334155',
      labelFontSize: 13,
    },
    Statistic: {
      titleFontSize: 13,
      contentFontSize: 24,
    },
    Layout: {
      siderBg: '#ffffff',
      headerBg: '#ffffff',
      bodyBg: '#f8fafc',
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
