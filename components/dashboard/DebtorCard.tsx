'use client';

import React from 'react';
import { Button, Tag, Tooltip } from 'antd';
import {
  BellOutlined,
  EyeOutlined,
  DollarCircleOutlined,
  WarningFilled,
  CheckCircleFilled,
  ClockCircleFilled,
  PhoneOutlined,
} from '@ant-design/icons';

export type LoanStatus = 'active' | 'upcoming' | 'overdue' | 'closed' | 'npl';

export interface Debtor {
  id: string;
  name: string;
  loanId: string;
  principal: number;
  outstanding: number;
  interestRate: number;
  interestType: 'flat_daily' | 'flat_monthly' | 'effective_daily' | 'effective_monthly';
  dueDate: string;
  status: LoanStatus;
  overdueDays?: number;
  phone?: string;
  avatarColor?: string;
}

interface DebtorCardProps {
  debtor: Debtor;
  onView?: (id: string) => void;
  onNotify?: (id: string) => void;
  onPayment?: (id: string) => void;
}

const formatCurrency = (value: number): string =>
  `฿${value.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const interestTypeLabel: Record<string, string> = {
  flat_daily: 'คงที่/วัน',
  flat_monthly: 'คงที่/เดือน',
  effective_daily: 'ลดต้น/วัน',
  effective_monthly: 'ลดต้น/เดือน',
};

const statusConfig: Record<
  LoanStatus,
  { label: string; icon: React.ReactNode; className: string; dotClass: string }
> = {
  active: {
    label: 'ปกติ',
    icon: <CheckCircleFilled />,
    className: 'status-badge-active',
    dotClass: 'status-dot-active',
  },
  upcoming: {
    label: 'ใกล้กำหนด',
    icon: <ClockCircleFilled />,
    className: 'status-badge-upcoming',
    dotClass: 'status-dot-upcoming',
  },
  overdue: {
    label: 'เกินกำหนด',
    icon: <WarningFilled />,
    className: 'status-badge-overdue',
    dotClass: 'status-dot-overdue',
  },
  closed: {
    label: 'ปิดสัญญา',
    icon: <CheckCircleFilled />,
    className: 'status-badge-active',
    dotClass: 'status-dot-active',
  },
  npl: {
    label: 'หนี้เสีย',
    icon: <WarningFilled />,
    className: 'status-badge-overdue',
    dotClass: 'status-dot-overdue',
  },
};

const avatarColors = [
  '#1a56db', '#7c3aed', '#db2777', '#059669',
  '#d97706', '#0891b2', '#9f1239', '#1d4ed8',
];

const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return parts[0][0] + parts[1][0];
  return name.substring(0, 2);
};

export default function DebtorCard({
  debtor,
  onView,
  onNotify,
  onPayment,
}: DebtorCardProps) {
  const status = statusConfig[debtor.status] ?? statusConfig['active'];
  const color =
    debtor.avatarColor ??
    avatarColors[parseInt(debtor.id, 36) % avatarColors.length];

  const formatDueDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const progressPct = Math.max(
    0,
    Math.min(
      100,
      ((debtor.principal - debtor.outstanding) / debtor.principal) * 100
    )
  );

  return (
    <div className={`debtor-card status-${debtor.status}`}>
      {/* Header */}
      <div className="debtor-card-header">
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
          {/* Avatar */}
          <div
            className="avatar-circle"
            style={{ background: color, width: 44, height: 44, fontSize: 15 }}
          >
            {getInitials(debtor.name)}
          </div>
          <div>
            <div className="debtor-card-name">{debtor.name}</div>
            <div className="debtor-card-id">#{debtor.loanId}</div>
          </div>
        </div>

        {/* Status badge */}
        <div className={`status-badge ${status.className}`}>
          <span className={`status-dot ${status.dotClass}`} />
          {status.label}
          {debtor.status === 'overdue' && debtor.overdueDays && (
            <span style={{ marginLeft: 4 }}>+{debtor.overdueDays}ว.</span>
          )}
        </div>
      </div>

      {/* Fields grid */}
      <div className="debtor-card-fields">
        <div className="debtor-field">
          <span className="debtor-field-label">เงินต้น</span>
          <span className="debtor-field-value">{formatCurrency(debtor.principal)}</span>
        </div>
        <div className="debtor-field">
          <span className="debtor-field-label">คงเหลือ</span>
          <span
            className="debtor-field-value"
            style={{
              color:
                debtor.outstanding > 0
                  ? 'var(--color-text-primary)'
                  : 'var(--color-success)',
            }}
          >
            {formatCurrency(debtor.outstanding)}
          </span>
        </div>
        <div className="debtor-field">
          <span className="debtor-field-label">อัตราดอกเบี้ย</span>
          <span className="debtor-field-value">
            {debtor.interestRate}%{' '}
            <span
              style={{
                fontSize: 11,
                color: 'var(--color-text-muted)',
                fontWeight: 400,
              }}
            >
              ({interestTypeLabel[debtor.interestType]})
            </span>
          </span>
        </div>
        <div className="debtor-field">
          <span className="debtor-field-label">วันครบกำหนด</span>
          <span
            className="debtor-field-value"
            style={{
              color:
                debtor.status === 'overdue'
                  ? 'var(--color-danger)'
                  : debtor.status === 'upcoming'
                  ? '#b45309'
                  : 'var(--color-text-primary)',
            }}
          >
            {formatDueDate(debtor.dueDate)}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div
        style={{
          marginBottom: 'var(--space-4)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 4,
          }}
        >
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
            ชำระแล้ว
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)' }}>
            {progressPct.toFixed(1)}%
          </span>
        </div>
        <div
          style={{
            height: 6,
            background: 'var(--color-border-light)',
            borderRadius: 'var(--radius-full)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progressPct}%`,
              background:
                debtor.status === 'overdue'
                  ? 'var(--color-danger)'
                  : debtor.status === 'upcoming'
                  ? 'var(--color-warning)'
                  : 'var(--color-success)',
              borderRadius: 'var(--radius-full)',
              transition: 'width 0.6s ease',
            }}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="debtor-card-actions">
        <Button
          type="default"
          icon={<EyeOutlined />}
          size="middle"
          onClick={() => onView?.(debtor.id)}
          style={{ borderRadius: 'var(--radius-md)', fontWeight: 600, flex: 1 }}
        >
          รายละเอียด
        </Button>
        <Tooltip title="แจ้งเตือน LINE">
          <Button
            type="default"
            icon={<BellOutlined />}
            size="middle"
            onClick={() => onNotify?.(debtor.id)}
            style={{
              borderRadius: 'var(--radius-md)',
              color: '#06c755',
              borderColor: '#06c755',
            }}
          />
        </Tooltip>
        <Tooltip title="บันทึกการชำระ">
          <Button
            type="primary"
            icon={<DollarCircleOutlined />}
            size="middle"
            onClick={() => onPayment?.(debtor.id)}
            style={{ borderRadius: 'var(--radius-md)' }}
          />
        </Tooltip>
      </div>
    </div>
  );
}
