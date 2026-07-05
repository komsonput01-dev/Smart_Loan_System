'use client';

import React from 'react';
import { Card, Tooltip } from 'antd';
import {
  BankOutlined,
  RiseOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons';

export interface KPIData {
  totalPrincipal: number;
  collectedInterest: number;
  upcomingCount: number;
  nplCount: number;
  totalDebtors: number;
  activeCount: number;
  overdueCount: number;
}

interface KPICardsProps {
  data?: KPIData;
  loading?: boolean;
}

const formatCurrency = (value: number): string => {
  if (value >= 1_000_000) {
    return `฿${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `฿${(value / 1_000).toFixed(1)}K`;
  }
  return `฿${value.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatFullCurrency = (value: number): string => {
  return `฿${value.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function KPICards({ data, loading = false }: KPICardsProps) {
  const mockData: KPIData = data ?? {
    totalPrincipal: 4_850_000,
    collectedInterest: 186_240,
    upcomingCount: 7,
    nplCount: 2,
    totalDebtors: 34,
    activeCount: 25,
    overdueCount: 5,
  };

  const cards = [
    {
      key: 'principal',
      label: 'เงินต้นรวมทั้งหมด',
      value: formatCurrency(mockData.totalPrincipal),
      fullValue: formatFullCurrency(mockData.totalPrincipal),
      sub: `${mockData.totalDebtors} สัญญา / ${mockData.activeCount} ใช้งาน`,
      trend: '+12.5%',
      trendUp: true,
      icon: <BankOutlined />,
      iconBg: '#e8f0fe',
      iconColor: 'var(--color-primary)',
      accentColor: 'var(--color-primary)',
    },
    {
      key: 'interest',
      label: 'ดอกเบี้ยที่เก็บได้แล้ว',
      value: formatCurrency(mockData.collectedInterest),
      fullValue: formatFullCurrency(mockData.collectedInterest),
      sub: 'เดือนนี้',
      trend: '+8.2%',
      trendUp: true,
      icon: <RiseOutlined />,
      iconBg: '#ecfdf5',
      iconColor: 'var(--color-success)',
      accentColor: 'var(--color-success)',
    },
    {
      key: 'upcoming',
      label: 'ใกล้ถึงกำหนดชำระ',
      value: `${mockData.upcomingCount} ราย`,
      fullValue: `${mockData.upcomingCount} สัญญา ใน 1-3 วัน`,
      sub: 'ภายใน 1–3 วัน',
      trend: null,
      trendUp: null,
      icon: <ClockCircleOutlined />,
      iconBg: '#fffbeb',
      iconColor: 'var(--color-warning)',
      accentColor: 'var(--color-warning)',
    },
    {
      key: 'npl',
      label: 'หนี้เสีย (NPL)',
      value: `${mockData.nplCount} ราย`,
      fullValue: `${mockData.nplCount} สัญญา เกินกำหนดชำระ`,
      sub: `เกินกำหนด ${mockData.overdueCount} ราย รวม`,
      trend: '-1 ราย',
      trendUp: true,
      icon: <WarningOutlined />,
      iconBg: '#fef2f2',
      iconColor: 'var(--color-danger)',
      accentColor: 'var(--color-danger)',
    },
  ];

  if (loading) {
    return (
      <div className="kpi-grid">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              height: 140,
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border)',
              background: 'white',
              overflow: 'hidden',
            }}
          >
            <div className="kpi-card-inner">
              <div
                className="skeleton"
                style={{ width: 52, height: 52, borderRadius: 'var(--radius-md)' }}
              />
              <div style={{ flex: 1 }}>
                <div className="skeleton" style={{ width: '60%', height: 14, marginBottom: 8 }} />
                <div className="skeleton" style={{ width: '80%', height: 28, marginBottom: 8 }} />
                <div className="skeleton" style={{ width: '40%', height: 12 }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="kpi-grid">
      {cards.map((card) => (
        <Tooltip key={card.key} title={card.fullValue} placement="top">
          <div className="kpi-card" style={{ cursor: 'default' }}>
            <div className="kpi-card-inner">
              {/* Icon */}
              <div
                className="kpi-icon-wrap"
                style={{ background: card.iconBg, color: card.iconColor }}
              >
                {card.icon}
              </div>

              {/* Content */}
              <div className="kpi-content">
                <div className="kpi-label">{card.label}</div>
                <div className="kpi-value" style={{ color: card.iconColor === 'var(--color-primary)' ? 'var(--color-text-primary)' : 'var(--color-text-primary)' }}>
                  {card.value}
                </div>
                <div className="kpi-sub">
                  <span>{card.sub}</span>
                  {card.trend && (
                    <span className={card.trendUp ? 'kpi-trend-up' : 'kpi-trend-down'}>
                      {card.trendUp ? <ArrowUpOutlined style={{ fontSize: 10 }} /> : <ArrowDownOutlined style={{ fontSize: 10 }} />}
                      {card.trend}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Accent bar */}
            <div
              className="kpi-accent-bar"
              style={{ background: card.accentColor }}
            />
          </div>
        </Tooltip>
      ))}
    </div>
  );
}
