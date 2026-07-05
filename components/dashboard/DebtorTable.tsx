'use client';

import React, { useState, useMemo } from 'react';
import { Table, Button, Input, Select, Tag, Tooltip, Avatar, Space, message } from 'antd';
import * as XLSX from 'xlsx';
import type { ColumnsType } from 'antd/es/table';
import {
  SearchOutlined,
  BellOutlined,
  EyeOutlined,
  DollarCircleOutlined,
  FilterOutlined,
  DownloadOutlined,
  CheckCircleFilled,
  ClockCircleFilled,
  WarningFilled,
} from '@ant-design/icons';
import type { Debtor, LoanStatus } from './DebtorCard';
import DebtorCard from './DebtorCard';
import { useUser } from '@clerk/nextjs';

interface DebtorTableProps {
  data?: Debtor[];
  loading?: boolean;
  onView?: (id: string) => void;
  onNotify?: (id: string) => void;
  onPayment?: (id: string) => void;
  statusFilter?: LoanStatus | 'all';
  onStatusFilterChange?: (status: LoanStatus | 'all') => void;
}

// ─── Mock Data ─────────────────────────────────────────────
const MOCK_DEBTORS: Debtor[] = [
  {
    id: '1',
    name: 'สมชาย มั่นคง',
    loanId: 'LN-2024-001',
    principal: 500_000,
    outstanding: 420_000,
    interestRate: 3.0,
    interestType: 'effective_monthly',
    dueDate: '2026-07-07',
    status: 'upcoming',
    overdueDays: 0,
    phone: '081-234-5678',
    avatarColor: '#1a56db',
  },
  {
    id: '2',
    name: 'นาง วิไลวรรณ ทองดี',
    loanId: 'LN-2024-002',
    principal: 200_000,
    outstanding: 85_000,
    interestRate: 2.5,
    interestType: 'flat_monthly',
    dueDate: '2026-06-15',
    status: 'overdue',
    overdueDays: 19,
    phone: '082-345-6789',
    avatarColor: '#db2777',
  },
  {
    id: '3',
    name: 'นาย ประเสริฐ ศรีวิไล',
    loanId: 'LN-2024-003',
    principal: 1_000_000,
    outstanding: 780_000,
    interestRate: 4.0,
    interestType: 'effective_daily',
    dueDate: '2026-08-01',
    status: 'active',
    phone: '083-456-7890',
    avatarColor: '#059669',
  },
  {
    id: '4',
    name: 'นางสาว กัญญารัตน์ สุขใจ',
    loanId: 'LN-2024-004',
    principal: 150_000,
    outstanding: 60_000,
    interestRate: 3.5,
    interestType: 'flat_daily',
    dueDate: '2026-07-05',
    status: 'upcoming',
    overdueDays: 0,
    phone: '084-567-8901',
    avatarColor: '#7c3aed',
  },
  {
    id: '5',
    name: 'นาย อนุชา พรมมา',
    loanId: 'LN-2024-005',
    principal: 300_000,
    outstanding: 300_000,
    interestRate: 5.0,
    interestType: 'effective_monthly',
    dueDate: '2026-05-20',
    status: 'overdue',
    overdueDays: 45,
    phone: '085-678-9012',
    avatarColor: '#d97706',
  },
  {
    id: '6',
    name: 'นาง มาลัย รุ่งเรือง',
    loanId: 'LN-2024-006',
    principal: 800_000,
    outstanding: 520_000,
    interestRate: 2.75,
    interestType: 'effective_monthly',
    dueDate: '2026-09-15',
    status: 'active',
    phone: '086-789-0123',
    avatarColor: '#0891b2',
  },
  {
    id: '7',
    name: 'นาย สุรชัย ใจดี',
    loanId: 'LN-2024-007',
    principal: 450_000,
    outstanding: 380_000,
    interestRate: 3.25,
    interestType: 'flat_monthly',
    dueDate: '2026-07-06',
    status: 'upcoming',
    phone: '087-890-1234',
    avatarColor: '#9f1239',
  },
  {
    id: '8',
    name: 'นาง รัตนา สิงห์ทอง',
    loanId: 'LN-2024-008',
    principal: 600_000,
    outstanding: 0,
    interestRate: 2.0,
    interestType: 'flat_monthly',
    dueDate: '2026-03-01',
    status: 'active',
    phone: '088-901-2345',
    avatarColor: '#1d4ed8',
  },
];
// ─────────────────────────────────────────────────────────────

const formatCurrency = (v: number) =>
  `฿${v.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;

const interestTypeLabel: Record<string, string> = {
  flat_daily: 'คงที่/วัน',
  flat_monthly: 'คงที่/เดือน',
  effective_daily: 'ลดต้น/วัน',
  effective_monthly: 'ลดต้น/เดือน',
};

const statusConfig: Record<
  LoanStatus,
  { label: string; icon: React.ReactNode; color: string; bg: string; dot: string }
> = {
  active: {
    label: 'ปกติ',
    icon: <CheckCircleFilled style={{ fontSize: 12 }} />,
    color: 'var(--color-success)',
    bg: 'var(--color-success-bg)',
    dot: 'status-dot-active',
  },
  upcoming: {
    label: 'ใกล้กำหนด',
    icon: <ClockCircleFilled style={{ fontSize: 12 }} />,
    color: '#b45309',
    bg: 'var(--color-warning-bg)',
    dot: 'status-dot-upcoming',
  },
  overdue: {
    label: 'เกินกำหนด',
    icon: <WarningFilled style={{ fontSize: 12 }} />,
    color: 'var(--color-danger)',
    bg: 'var(--color-danger-bg)',
    dot: 'status-dot-overdue',
  },
  closed: {
    label: 'ปิดสัญญา',
    icon: <CheckCircleFilled style={{ fontSize: 12 }} />,
    color: '#6b7280',
    bg: '#f3f4f6',
    dot: 'status-dot-active',
  },
  npl: {
    label: 'หนี้เสีย (NPL)',
    icon: <WarningFilled style={{ fontSize: 12 }} />,
    color: '#7f1d1d',
    bg: '#fef2f2',
    dot: 'status-dot-overdue',
  },
};

const avatarColors = [
  '#1a56db', '#7c3aed', '#db2777', '#059669',
  '#d97706', '#0891b2', '#9f1239', '#1d4ed8',
];
const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return parts[0][0] + parts[1][0];
  return name.substring(0, 2);
};

export default function DebtorTable({
  data = [],
  loading = false,
  onView,
  onNotify,
  onPayment,
  onAddLoan,
  statusFilter: propStatusFilter,
  onStatusFilterChange,
}: DebtorTableProps & { onAddLoan?: () => void }) {
  const [search, setSearch] = useState('');
  const [localStatusFilter, setLocalStatusFilter] = useState<LoanStatus | 'all'>('all');
  const statusFilter = propStatusFilter !== undefined ? propStatusFilter : localStatusFilter;
  const setStatusFilter = onStatusFilterChange !== undefined ? onStatusFilterChange : setLocalStatusFilter;
  const [messageApi, contextHolder] = message.useMessage();
  const [exportLoading, setExportLoading] = useState(false);
  const { user: clerkUser } = useUser();
  const isAdmin = clerkUser?.publicMetadata?.role !== 'debtor';

  const handleExportExcel = async () => {
    setExportLoading(true);
    try {
      const res = await fetch('/api/export');
      if (!res.ok) {
        throw new Error('ไม่สามารถดึงข้อมูลรายงานได้');
      }
      const result = await res.json();
      const { summary, rawRows } = result;

      // 1. Create Summary Sheet Data
      const summaryRows = [
        ['รายงานสรุปภาพรวมทางการเงิน (Smart Loan Management System)'],
        [`วันที่ส่งออกรายงาน: ${new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })} น.`],
        [],
        ['ดัชนีชี้วัดทางการเงิน (KPI)', 'มูลค่า / จำนวน'],
        ['จำนวนสัญญาเงินกู้ทั้งหมด', `${summary.totalLoans} สัญญา`],
        ['วงเงินต้นสัญญารวมทั้งหมด', Number(summary.totalPrincipal)],
        ['ยอดหนี้เงินต้นคงเหลือรวม', Number(summary.totalOutstanding)],
        ['ดอกเบี้ยสะสมที่เก็บได้รวม', Number(summary.totalInterestCollected)],
        ['ยอดหนี้เสีย (NPL) รวม', Number(summary.nplPrincipal)],
        ['อัตราส่วนหนี้เสีย (NPL Ratio)', `${summary.nplRatio}%`],
      ];

      const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
      
      // Set column widths for Summary
      wsSummary['!cols'] = [
        { wch: 35 }, // KPI Name
        { wch: 25 }, // Value
      ];

      // 2. Create Raw Data Sheet
      const wsRaw = XLSX.utils.json_to_sheet(rawRows);
      
      // Auto-fit column widths for Raw Data
      const maxColWidths = rawRows.reduce((acc: Record<string, number>, row: any) => {
        Object.keys(row).forEach((key) => {
          const val = String(row[key] ?? '');
          const len = val.length > 0 ? val.length * 1.5 : 10;
          acc[key] = Math.max(acc[key] || 10, len, key.length * 1.8);
        });
        return acc;
      }, {});
      
      wsRaw['!cols'] = Object.keys(maxColWidths).map((key) => ({
        wch: Math.min(50, Math.max(12, maxColWidths[key])),
      }));

      // 3. Create Workbook and Append Sheets
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');
      XLSX.utils.book_append_sheet(wb, wsRaw, 'Raw_Data');

      // 4. Save file
      XLSX.writeFile(wb, `SmartLoan_Report_${new Date().toISOString().slice(0,10).replace(/-/g,'')}.xlsx`);
      messageApi.success('ดาวน์โหลดรายงาน Excel เรียบร้อยแล้ว');
    } catch (err: any) {
      console.error(err);
      messageApi.error(err.message ?? 'เกิดข้อผิดพลาดในการดาวน์โหลด Excel');
    } finally {
      setExportLoading(false);
    }
  };

  const filtered = useMemo(() => {
    return data.filter((d) => {
      const matchSearch =
        d.name.toLowerCase().includes(search.toLowerCase()) ||
        d.loanId.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || d.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [data, search, statusFilter]);

  const handleNotify = (id: string) => {
    const debtor = data.find((d) => d.id === id);
    messageApi.success(`ส่งแจ้งเตือน LINE ให้ ${debtor?.name} แล้ว`);
    onNotify?.(id);
  };

  // Desktop Table Columns
  const columns: ColumnsType<Debtor> = [
    {
      title: 'ลูกหนี้',
      key: 'name',
      width: 220,
      fixed: 'left',
      render: (_, record) => {
        const color =
          record.avatarColor ??
          avatarColors[parseInt(record.id, 36) % avatarColors.length];
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar size={36} style={{ background: color, fontWeight: 700, fontSize: 13 }}>
              {getInitials(record.name)}
            </Avatar>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: 13 }}>
                {record.name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                #{record.loanId}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      title: 'สถานะ',
      key: 'status',
      width: 140,
      filters: [
        { text: 'ปกติ', value: 'active' },
        { text: 'ใกล้กำหนด', value: 'upcoming' },
        { text: 'เกินกำหนด', value: 'overdue' },
      ],
      onFilter: (value, record) => record.status === value,
      render: (_, record) => {
        const s = statusConfig[record.status];
        return (
          <div
            className="status-badge"
            style={{
              background: s.bg,
              color: s.color,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span className={`status-dot ${s.dot}`} />
            {s.label}
            {record.status === 'overdue' && record.overdueDays && (
              <span style={{ fontWeight: 700 }}>+{record.overdueDays}ว.</span>
            )}
          </div>
        );
      },
    },
    {
      title: 'เงินต้น',
      key: 'principal',
      width: 140,
      align: 'right',
      sorter: (a, b) => a.principal - b.principal,
      render: (_, record) => (
        <span className="font-tabular" style={{ fontWeight: 600 }}>
          {formatCurrency(record.principal)}
        </span>
      ),
    },
    {
      title: 'คงเหลือ',
      key: 'outstanding',
      width: 140,
      align: 'right',
      sorter: (a, b) => a.outstanding - b.outstanding,
      render: (_, record) => (
        <span
          className="font-tabular"
          style={{
            fontWeight: 600,
            color:
              record.outstanding === 0
                ? 'var(--color-success)'
                : record.status === 'overdue'
                ? 'var(--color-danger)'
                : 'var(--color-text-primary)',
          }}
        >
          {record.outstanding === 0 ? 'ชำระครบ ✓' : formatCurrency(record.outstanding)}
        </span>
      ),
    },
    {
      title: 'อัตราดอกเบี้ย',
      key: 'rate',
      width: 150,
      align: 'center',
      render: (_, record) => (
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
            {record.interestRate}%
          </span>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
            {interestTypeLabel[record.interestType]}
          </div>
        </div>
      ),
    },
    {
      title: 'วันครบกำหนด',
      key: 'dueDate',
      width: 130,
      sorter: (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
      render: (_, record) => {
        const date = new Date(record.dueDate);
        const dateStr = date.toLocaleDateString('th-TH', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
        return (
          <span
            style={{
              color:
                record.status === 'overdue'
                  ? 'var(--color-danger)'
                  : record.status === 'upcoming'
                  ? '#b45309'
                  : 'var(--color-text-secondary)',
              fontWeight: record.status !== 'active' ? 600 : 400,
              fontSize: 13,
            }}
          >
            {dateStr}
          </span>
        );
      },
    },
    {
      title: 'การดำเนินการ',
      key: 'actions',
      width: 160,
      fixed: 'right',
      render: (_, record) => (
        <Space size={6}>
          <Tooltip title="ดูรายละเอียด">
            <Button
              type="text"
              icon={<EyeOutlined />}
              size="small"
              onClick={() => onView?.(record.id)}
              style={{
                color: 'var(--color-primary)',
                borderRadius: 'var(--radius-md)',
              }}
            />
          </Tooltip>
          {isAdmin && (
            <>
              <Tooltip title="แจ้งเตือน LINE">
                <Button
                  type="text"
                  icon={<BellOutlined />}
                  size="small"
                  onClick={() => handleNotify(record.id)}
                  style={{
                    color: '#06c755',
                    borderRadius: 'var(--radius-md)',
                  }}
                />
              </Tooltip>
              <Tooltip title="บันทึกการชำระ">
                <Button
                  type="primary"
                  icon={<DollarCircleOutlined />}
                  size="small"
                  onClick={() => onPayment?.(record.id)}
                  style={{ borderRadius: 'var(--radius-md)' }}
                />
              </Tooltip>
            </>
          )}
        </Space>
      ),
    },
  ];

  const statusCounts = useMemo(
    () => ({
      all: data.length,
      active: data.filter((d) => d.status === 'active').length,
      upcoming: data.filter((d) => d.status === 'upcoming').length,
      overdue: data.filter((d) => d.status === 'overdue').length,
      closed: data.filter((d) => d.status === 'closed').length,
      npl: data.filter((d) => d.status === 'npl').length,
    }),
    [data]
  );

  return (
    <div id="debtor-table-section">
      {contextHolder}

      {/* Section Header */}
      <div className="section-header">
        <div>
          <h2 className="section-title">
            {isAdmin ? 'รายการลูกหนี้ทั้งหมด' : 'รายการสัญญาเงินกู้ของฉัน'}
          </h2>
          <p className="section-subtitle">
            แสดง {filtered.length} จาก {data.length} รายการ
          </p>
        </div>
        {isAdmin && (
          <div
            style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}
          >
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              loading={exportLoading}
              onClick={handleExportExcel}
              style={{ 
                borderRadius: 'var(--radius-md)', 
                fontWeight: 600,
                backgroundColor: '#217346',
                borderColor: '#217346'
              }}
            >
              <span className="hidden-mobile">ส่งออก Excel</span>
            </Button>
            <Button
              type="primary"
              icon={<DollarCircleOutlined />}
              style={{ borderRadius: 'var(--radius-md)', fontWeight: 600 }}
              onClick={onAddLoan ?? (() => window.location.assign('/dashboard/loans/new'))}
            >
              <span className="hidden-mobile">+ เพิ่มสัญญาใหม่</span>
            </Button>
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <Input
          prefix={<SearchOutlined style={{ color: 'var(--color-text-muted)' }} />}
          placeholder="ค้นหาชื่อหรือหมายเลขสัญญา..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
          style={{ borderRadius: 'var(--radius-md)' }}
        />
        <Select
          value={statusFilter}
          onChange={(val) => setStatusFilter(val as any)}
          style={{ minWidth: 170 }}
          options={[
            { value: 'all', label: `ทั้งหมด (${statusCounts.all})` },
            {
              value: 'active',
              label: (
                <span>
                  🟢 ปกติ ({statusCounts.active})
                </span>
              ),
            },
            {
              value: 'upcoming',
              label: (
                <span>
                  🟡 ใกล้กำหนด ({statusCounts.upcoming})
                </span>
              ),
            },
            {
              value: 'overdue',
              label: (
                <span>
                  🔴 เกินกำหนด ({statusCounts.overdue})
                </span>
              ),
            },
            {
              value: 'npl',
              label: (
                <span>
                  ⚠️ หนี้เสีย NPL ({statusCounts.npl})
                </span>
              ),
            },
            {
              value: 'closed',
              label: (
                <span>
                  ⚫ ปิดสัญญา ({statusCounts.closed})
                </span>
              ),
            },
          ]}
        />
      </div>

      {/* Desktop Table */}
      <div className="table-card hidden-mobile">
        <Table<Debtor>
          columns={columns}
          dataSource={filtered}
          loading={loading}
          rowKey="id"
          size="middle"
          scroll={{ x: 900 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} จาก ${total} รายการ`,
            pageSizeOptions: ['10', '20', '50'],
          }}
          style={{ borderRadius: 0 }}
          rowClassName={(record) =>
            record.status === 'overdue' ? 'overdue-row' : ''
          }
        />
      </div>

      {/* Mobile Card View */}
      <div className="debtor-card-grid show-mobile">
        {filtered.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: 'var(--space-12)',
              color: 'var(--color-text-muted)',
            }}
          >
            ไม่พบข้อมูลที่ตรงกัน
          </div>
        ) : (
          filtered.map((debtor) => (
            <DebtorCard
              key={debtor.id}
              debtor={debtor}
              onView={onView}
              onNotify={handleNotify}
              onPayment={onPayment}
            />
          ))
        )}
      </div>
    </div>
  );
}
