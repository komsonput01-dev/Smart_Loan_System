'use client';

import React from 'react';
import { Card, Tooltip } from 'antd';
import { useUser } from '@clerk/nextjs';
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
  onCardClick?: (status: string) => void;
}

const formatCurrency = (value: number): string => {
  return `${value.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท`;
};

const formatFullCurrency = (value: number): string => {
  return `${value.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท`;
};

export default function KPICards({ data, loading = false, onCardClick }: KPICardsProps) {
  const { user } = useUser();
  const isAdmin = user?.publicMetadata?.role !== 'debtor';

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
      label: isAdmin ? 'เงินต้นรวมทั้งหมด' : 'ยอดเงินต้นคงเหลือของฉัน',
      value: formatCurrency(mockData.totalPrincipal),
      fullValue: formatFullCurrency(mockData.totalPrincipal),
      sub: isAdmin
        ? `${mockData.totalDebtors} สัญญา / ${mockData.activeCount} ใช้งาน`
        : `${mockData.totalDebtors} สัญญาเงินกู้`,
      trend: null,
      trendUp: null,
      icon: <BankOutlined />,
      iconBg: '#f8fafc',
      iconColor: '#64748b',
      accentColor: '#cbd5e1',
      bgOverride: '#f8fafc',
    },
    {
      key: 'interest',
      label: isAdmin ? 'ดอกเบี้ยที่เก็บได้แล้ว' : 'ดอกเบี้ยที่ชำระไปแล้ว',
      value: formatCurrency(mockData.collectedInterest),
      fullValue: formatFullCurrency(mockData.collectedInterest),
      sub: isAdmin ? 'ยอดรวมทั้งหมด' : 'ดอกเบี้ยรวม',
      trend: null,
      trendUp: null,
      icon: <RiseOutlined />,
      iconBg: '#ecfdf5',
      iconColor: '#10b981',
      accentColor: '#a7f3d0',
      bgOverride: '#ecfdf5',
    },
    {
      key: 'upcoming',
      label: isAdmin ? 'ใกล้ถึงกำหนดชำระ' : 'สัญญาใกล้ครบกำหนด',
      value: `${mockData.upcomingCount} รายการ`,
      fullValue: `${mockData.upcomingCount} สัญญา ใน 1-3 วัน`,
      sub: 'ภายใน 1–3 วัน',
      trend: null,
      trendUp: null,
      icon: <ClockCircleOutlined />,
      iconBg: '#fffbeb',
      iconColor: '#f59e0b',
      accentColor: '#fde68a',
      bgOverride: '#fffbeb',
    },
    {
      key: 'npl',
      label: isAdmin ? 'หนี้เสีย (NPL)' : 'หนี้เสีย NPL',
      value: `${mockData.nplCount} รายการ`,
      fullValue: `${mockData.nplCount} สัญญา เกินกำหนดชำระ`,
      sub: `เกินกำหนด ${mockData.overdueCount} รายการ`,
      trend: null,
      trendUp: null,
      icon: <WarningOutlined />,
      iconBg: '#fef2f2',
      iconColor: '#ef4444',
      accentColor: '#fecaca',
      bgOverride: '#fef2f2',
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
    <div className="kpi-grid" style={{ marginBottom: '16px' }}>
      {cards.map((card) => (
        <Tooltip key={card.key} title={card.fullValue} placement="top">
          <div 
            className="kpi-card" 
            style={{ 
              cursor: onCardClick ? 'pointer' : 'default',
              backgroundColor: card.bgOverride || '#fff',
              border: `1px solid ${card.accentColor}`,
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
              borderRadius: '12px'
            }}
            onClick={() => {
              if (onCardClick) {
                // If clicking upcoming, filter to 'upcoming'
                // If clicking npl, filter to 'overdue' (since that contains the overdue debtors list)
                // If clicking principal/interest, show 'all'
                const filterVal = card.key === 'upcoming' ? 'upcoming' : card.key === 'npl' ? 'overdue' : 'all';
                onCardClick(filterVal);
              }
            }}
          >
            <div className="kpi-card-inner" style={{ padding: '10px 16px', alignItems: 'center' }}>
              {/* Icon */}
              <div
                className="kpi-icon-wrap"
                style={{ background: card.iconBg, color: card.iconColor, width: 40, height: 40, fontSize: 20 }}
              >
                {card.icon}
              </div>

              {/* Content */}
              <div className="kpi-content" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div className="kpi-label" style={{ marginBottom: 0, fontSize: '12px' }}>{card.label}</div>
                <div className="kpi-value" style={{ 
                  color: card.iconColor === 'var(--color-primary)' ? 'var(--color-text-primary)' : 'var(--color-text-primary)',
                  fontSize: '18px',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  lineHeight: '1.2'
                }}>
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
