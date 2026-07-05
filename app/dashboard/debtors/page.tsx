'use client';

import React, { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import {
  Table,
  Button,
  Drawer,
  Form,
  Input,
  Avatar,
  Tag,
  Space,
  Tooltip,
  message,
  Popconfirm,
  Empty,
  Spin,
  Badge,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined,
  UserOutlined,
  PhoneOutlined,
  MailOutlined,
  SearchOutlined,
  EditOutlined,
  EyeOutlined,
  ReloadOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

interface DebtorRow {
  id: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  lineUserId: string | null;
  isActive: boolean;
  createdAt: string;
  totalLoans: number;
  totalPrincipal: string;
  totalOutstanding: string;
  hasOverdue: boolean;
  hasUpcoming: boolean;
}

const fmt = (v: string | number) =>
  `฿${Number(v).toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;

const getInitials = (name: string | null) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return parts[0][0] + parts[1][0];
  return name.substring(0, 2);
};

const avatarColors = [
  '#1a56db', '#7c3aed', '#db2777', '#059669',
  '#d97706', '#0891b2', '#9f1239', '#1d4ed8',
];

export default function DebtorsPage() {
  const [debtors, setDebtors] = useState<DebtorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();

  const fetchDebtors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/debtors');
      if (!res.ok) throw new Error('โหลดข้อมูลไม่สำเร็จ');
      const data = await res.json();
      setDebtors(data.debtors ?? []);
    } catch (err: unknown) {
      messageApi.error(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  }, [messageApi]);

  useEffect(() => {
    fetchDebtors();
  }, [fetchDebtors]);

  const handleAddDebtor = async (values: Record<string, string>) => {
    setSaving(true);
    try {
      const res = await fetch('/api/debtors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? 'บันทึกไม่สำเร็จ');
      }
      messageApi.success(`เพิ่มลูกหนี้ "${values.fullName}" เรียบร้อยแล้ว`);
      form.resetFields();
      setDrawerOpen(false);
      fetchDebtors();
    } catch (err: unknown) {
      messageApi.error(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  };

  const filtered = debtors.filter((d) => {
    const q = search.toLowerCase();
    return (
      d.fullName?.toLowerCase().includes(q) ||
      d.email?.toLowerCase().includes(q) ||
      d.phone?.includes(q)
    );
  });

  const columns: ColumnsType<DebtorRow> = [
    {
      title: 'ลูกหนี้',
      key: 'name',
      width: 240,
      fixed: 'left',
      render: (_, r, idx) => {
        const color = avatarColors[idx % avatarColors.length];
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar size={38} style={{ background: color, fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
              {getInitials(r.fullName)}
            </Avatar>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: 13, lineHeight: 1.4 }}>
                {r.fullName ?? '—'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                {r.email ?? 'ไม่ระบุอีเมล'}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      title: 'เบอร์โทร',
      key: 'phone',
      width: 140,
      render: (_, r) => (
        <Text style={{ fontSize: 13 }}>{r.phone ?? <span style={{ color: 'var(--color-text-muted)' }}>—</span>}</Text>
      ),
    },
    {
      title: 'สถานะ',
      key: 'status',
      width: 130,
      render: (_, r) => {
        if (r.hasOverdue) return <Tag color="error">🔴 เกินกำหนด</Tag>;
        if (r.hasUpcoming) return <Tag color="warning">🟡 ใกล้กำหนด</Tag>;
        if (Number(r.totalLoans) > 0) return <Tag color="success">🟢 ปกติ</Tag>;
        return <Tag>ยังไม่มีสัญญา</Tag>;
      },
    },
    {
      title: 'จำนวนสัญญา',
      key: 'loans',
      width: 110,
      align: 'center',
      render: (_, r) => (
        <Badge
          count={Number(r.totalLoans)}
          showZero
          style={{ backgroundColor: Number(r.totalLoans) > 0 ? 'var(--color-primary)' : '#d1d5db' }}
        />
      ),
    },
    {
      title: 'เงินต้นรวม',
      key: 'principal',
      width: 150,
      align: 'right',
      sorter: (a, b) => Number(a.totalPrincipal) - Number(b.totalPrincipal),
      render: (_, r) => (
        <span className="font-tabular" style={{ fontWeight: 600, fontSize: 13 }}>
          {fmt(r.totalPrincipal)}
        </span>
      ),
    },
    {
      title: 'ยอดคงเหลือ',
      key: 'outstanding',
      width: 150,
      align: 'right',
      sorter: (a, b) => Number(a.totalOutstanding) - Number(b.totalOutstanding),
      render: (_, r) => {
        const val = Number(r.totalOutstanding);
        return (
          <span
            className="font-tabular"
            style={{
              fontWeight: 600,
              fontSize: 13,
              color: val === 0 ? 'var(--color-success)' : r.hasOverdue ? 'var(--color-danger)' : 'var(--color-text-primary)',
            }}
          >
            {val === 0 && Number(r.totalLoans) > 0 ? 'ชำระครบ ✓' : fmt(val)}
          </span>
        );
      },
    },
    {
      title: 'วันที่เพิ่ม',
      key: 'createdAt',
      width: 130,
      render: (_, r) => (
        <Text style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
          {new Date(r.createdAt).toLocaleDateString('th-TH', {
            year: 'numeric', month: 'short', day: 'numeric',
          })}
        </Text>
      ),
    },
    {
      title: 'การดำเนินการ',
      key: 'actions',
      width: 120,
      fixed: 'right',
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="ดูรายละเอียด">
            <Button
              type="text"
              icon={<EyeOutlined />}
              size="small"
              style={{ color: 'var(--color-primary)' }}
              onClick={() => messageApi.info(`ดูรายละเอียด: ${r.fullName}`)}
            />
          </Tooltip>
          <Tooltip title="แก้ไขข้อมูล">
            <Button
              type="text"
              icon={<EditOutlined />}
              size="small"
              style={{ color: 'var(--color-text-secondary)' }}
              onClick={() => messageApi.info(`แก้ไขข้อมูล: ${r.fullName}`)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <AppLayout pageTitle="จัดการลูกหนี้">
      {contextHolder}

      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-header-title">จัดการลูกหนี้</h1>
          <p className="page-header-subtitle">เพิ่ม แก้ไข และดูข้อมูลลูกหนี้ทั้งหมด</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Tooltip title="รีเฟรชข้อมูล">
            <Button icon={<ReloadOutlined />} onClick={fetchDebtors} loading={loading} />
          </Tooltip>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setDrawerOpen(true)}
            style={{ fontWeight: 600 }}
          >
            + เพิ่มลูกหนี้ใหม่
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <Input
          prefix={<SearchOutlined style={{ color: 'var(--color-text-muted)' }} />}
          placeholder="ค้นหาชื่อ, อีเมล, หรือเบอร์โทร..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
          style={{ maxWidth: 380, borderRadius: 'var(--radius-md)' }}
        />
        <Text style={{ lineHeight: '38px', color: 'var(--color-text-muted)', fontSize: 13 }}>
          แสดง {filtered.length} จาก {debtors.length} รายการ
        </Text>
      </div>

      {/* Table */}
      <div className="table-card">
        <Table<DebtorRow>
          columns={columns}
          dataSource={filtered}
          rowKey="id"
          loading={loading}
          size="middle"
          scroll={{ x: 1000 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} จาก ${total} รายการ`,
            pageSizeOptions: ['10', '20', '50'],
          }}
          locale={{
            emptyText: (
              <Empty
                image={<UserOutlined style={{ fontSize: 48, color: '#d1d5db' }} />}
                description={
                  <span style={{ color: 'var(--color-text-muted)' }}>
                    {search ? 'ไม่พบลูกหนี้ที่ตรงกับการค้นหา' : 'ยังไม่มีข้อมูลลูกหนี้'}
                  </span>
                }
              >
                {!search && (
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawerOpen(true)}>
                    เพิ่มลูกหนี้แรก
                  </Button>
                )}
              </Empty>
            ),
          }}
          rowClassName={(r) =>
            r.hasOverdue ? 'overdue-row' : ''
          }
        />
      </div>

      {/* Add Debtor Drawer */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar icon={<UserOutlined />} style={{ background: 'var(--color-primary)' }} />
            <span style={{ fontWeight: 700 }}>เพิ่มลูกหนี้ใหม่</span>
          </div>
        }
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); form.resetFields(); }}
        width={480}
        footer={
          <div style={{ textAlign: 'right', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={() => { setDrawerOpen(false); form.resetFields(); }}>
              ยกเลิก
            </Button>
            <Button
              type="primary"
              loading={saving}
              icon={<PlusOutlined />}
              onClick={() => form.submit()}
            >
              บันทึกลูกหนี้
            </Button>
          </div>
        }
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleAddDebtor}
          requiredMark={false}
        >
          <Form.Item
            name="fullName"
            label="ชื่อ-นามสกุล"
            rules={[{ required: true, message: 'กรุณาระบุชื่อ-นามสกุล' }]}
          >
            <Input
              prefix={<UserOutlined style={{ color: 'var(--color-text-muted)' }} />}
              placeholder="เช่น นาย สมชาย ใจดี"
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="phone"
            label="เบอร์โทรศัพท์"
            rules={[
              {
                pattern: /^[0-9\-\+\s]{9,15}$/,
                message: 'รูปแบบเบอร์โทรไม่ถูกต้อง',
              },
            ]}
          >
            <Input
              prefix={<PhoneOutlined style={{ color: 'var(--color-text-muted)' }} />}
              placeholder="เช่น 081-234-5678"
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="email"
            label="อีเมล (ถ้ามี)"
            rules={[
              {
                type: 'email',
                message: 'รูปแบบอีเมลไม่ถูกต้อง',
              },
            ]}
          >
            <Input
              prefix={<MailOutlined style={{ color: 'var(--color-text-muted)' }} />}
              placeholder="example@email.com"
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="lineUserId"
            label="LINE User ID (สำหรับส่งแจ้งเตือน)"
            extra="ใช้สำหรับส่ง LINE Notification อัตโนมัติ"
          >
            <Input
              prefix={<span style={{ color: '#06c755', fontWeight: 700, fontSize: 13 }}>LINE</span>}
              placeholder="U1234567890abcdef..."
              size="large"
            />
          </Form.Item>

          <div
            style={{
              background: '#f0f7ff',
              border: '1px solid #bfdbfe',
              borderRadius: 10,
              padding: '12px 16px',
              fontSize: 13,
              color: '#1e40af',
            }}
          >
            💡 <strong>หมายเหตุ:</strong> ลูกหนี้จะถูกบันทึกในระบบทันที สามารถเพิ่มสัญญาเงินกู้ได้ในภายหลัง
          </div>
        </Form>
      </Drawer>
    </AppLayout>
  );
}
