'use client';

import React, { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import {
  Table,
  Button,
  Drawer,
  Form,
  Input,
  Select,
  Tag,
  Space,
  Tooltip,
  message,
  Empty,
  Spin,
  DatePicker,
  InputNumber,
  Typography,
  Divider,
  Row,
  Col,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined,
  SearchOutlined,
  EyeOutlined,
  ReloadOutlined,
  FileTextOutlined,
  DollarCircleOutlined,
  CalendarOutlined,
  BankOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import dayjs from 'dayjs';

const { Text, Title } = Typography;

interface LoanRow {
  id: string;
  userId: string;
  principal: string;
  outstandingPrincipal: string;
  accruedInterest: string;
  totalInterestCollected: string;
  interestRate: string;
  interestType: 'flat_daily' | 'flat_monthly' | 'effective_daily' | 'effective_monthly';
  startDate: string;
  dueDate: string;
  status: 'draft' | 'active' | 'upcoming' | 'overdue' | 'closed' | 'npl';
  note: string | null;
  userName: string | null;
  userPhone: string | null;
}

interface DebtorOption {
  id: string;
  fullName: string | null;
}

const fmt = (v: string | number) =>
  `฿${Number(v).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const interestTypeLabel: Record<string, string> = {
  flat_daily: 'คงที่/วัน',
  flat_monthly: 'คงที่/เดือน',
  effective_daily: 'ลดต้น/วัน',
  effective_monthly: 'ลดต้น/เดือน',
};

const statusConfig: Record<
  string,
  { label: string; color: string }
> = {
  draft: { label: 'ร่างสัญญา', color: 'default' },
  active: { label: 'ปกติ', color: 'success' },
  upcoming: { label: 'ใกล้กำหนด', color: 'warning' },
  overdue: { label: 'เกินกำหนด', color: 'error' },
  closed: { label: 'ปิดสัญญา', color: 'default' },
  npl: { label: 'หนี้เสีย (NPL)', color: 'error' },
};

export default function LoansPage() {
  const { user: clerkUser } = useUser();
  const role = clerkUser?.publicMetadata?.role || 'debtor';
  const isAdmin = role === 'admin';
  const isStaff = role === 'staff';
  const isStaffOrAdmin = role === 'admin' || role === 'staff';

  const router = useRouter();
  const [loans, setLoans] = useState<LoanRow[]>([]);
  const [debtors, setDebtors] = useState<DebtorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();

  const fetchLoans = useCallback(async () => {
    setLoading(true);
    try {
      const url = statusFilter !== 'all' ? `/api/loans?status=${statusFilter}` : '/api/loans';
      const res = await fetch(url);
      if (!res.ok) throw new Error('โหลดข้อมูลสัญญาเงินกู้ไม่สำเร็จ');
      const data = await res.json();
      setLoans(data.loans ?? []);
    } catch (err: unknown) {
      messageApi.error(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, messageApi]);

  const fetchDebtors = useCallback(async () => {
    try {
      const res = await fetch('/api/debtors');
      if (!res.ok) throw new Error('โหลดข้อมูลลูกหนี้ไม่สำเร็จ');
      const data = await res.json();
      setDebtors(data.debtors ?? []);
    } catch (err: unknown) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchLoans();
  }, [fetchLoans]);

  useEffect(() => {
    if (drawerOpen) {
      fetchDebtors();
    }
  }, [drawerOpen, fetchDebtors]);

  const handleAddLoan = async (values: any) => {
    setSaving(true);
    try {
      const payload = {
        userId: values.userId,
        principal: String(values.principal),
        interestRate: String(values.interestRate),
        interestType: values.interestType,
        startDate: values.startDate.format('YYYY-MM-DD'),
        dueDate: values.dueDate.format('YYYY-MM-DD'),
        note: values.note ? `รหัสสัญญา: ${values.note}` : undefined,
        bankName: values.bankName,
        bankAccountName: values.bankAccountName,
        bankAccountNumber: values.bankAccountNumber,
      };

      const res = await fetch('/api/loans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'สร้างสัญญาเงินกู้ไม่สำเร็จ');

      messageApi.success('สร้างสัญญาเงินกู้และกำหนดอัตราดอกเบี้ยเรียบร้อยแล้ว');
      form.resetFields();
      setDrawerOpen(false);
      fetchLoans();
    } catch (err: unknown) {
      messageApi.error(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  };

  const filtered = loans.filter((l) => {
    const q = search.toLowerCase();
    return (
      (l.userName?.toLowerCase() || '').includes(q) ||
      (l.note?.toLowerCase() || '').includes(q) ||
      l.id.toLowerCase().includes(q)
    );
  });

  const columns: ColumnsType<LoanRow> = [
    {
      title: 'เลขที่สัญญา / ผู้กู้',
      key: 'loan',
      width: 220,
      fixed: 'left',
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: 13 }}>
            {r.note?.replace('รหัสสัญญา: ', '') || r.id.substring(0, 8)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
            ผู้กู้: {r.userName || 'ไม่ระบุชื่อ'}
          </div>
        </div>
      ),
    },
    {
      title: 'สถานะ',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (val) => {
        const conf = statusConfig[val] ?? statusConfig.active;
        return <Tag color={conf.color}>{conf.label}</Tag>;
      },
    },
    {
      title: 'เงินต้นเริ่มแรก',
      dataIndex: 'principal',
      key: 'principal',
      align: 'right',
      width: 140,
      sorter: (a, b) => Number(a.principal) - Number(b.principal),
      render: (v) => <span className="font-tabular" style={{ fontWeight: 600 }}>{fmt(v)}</span>,
    },
    {
      title: 'เงินต้นคงเหลือ',
      dataIndex: 'outstandingPrincipal',
      key: 'outstandingPrincipal',
      align: 'right',
      width: 140,
      sorter: (a, b) => Number(a.outstandingPrincipal) - Number(b.outstandingPrincipal),
      render: (v, r) => (
        <span
          className="font-tabular"
          style={{
            fontWeight: 600,
            color: Number(v) === 0 ? 'var(--color-success)' : r.status === 'overdue' ? 'var(--color-danger)' : 'inherit'
          }}
        >
          {Number(v) === 0 ? 'ชำระครบ ✓' : fmt(v)}
        </span>
      ),
    },
    {
      title: 'อัตราดอกเบี้ย',
      key: 'rate',
      width: 140,
      align: 'center',
      render: (_, r) => (
        <div>
          <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{r.interestRate}%</span>
          <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
            {interestTypeLabel[r.interestType]}
          </div>
        </div>
      ),
    },
    {
      title: 'วันครบกำหนด',
      dataIndex: 'dueDate',
      key: 'dueDate',
      width: 130,
      sorter: (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
      render: (text, r) => (
        <span style={{
          color: r.status === 'overdue' ? 'var(--color-danger)' : 'inherit',
          fontWeight: r.status === 'overdue' ? 600 : 400
        }}>
          {new Date(text).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
      ),
    },
    {
      title: 'การดำเนินการ',
      key: 'actions',
      width: 130,
      fixed: 'right',
      render: (_, r) => (
        <Space size={6}>
          <Tooltip title="ดูรายละเอียดสัญญา">
            <Button
              type="text"
              icon={<EyeOutlined />}
              size="small"
              style={{ color: 'var(--color-primary)' }}
              onClick={() => router.push(`/dashboard/loans/${r.id}`)}
            />
          </Tooltip>
          {r.status !== 'closed' && r.status !== 'draft' && isAdmin && (
            <Tooltip title="บันทึกการชำระเงิน">
              <Button
                type="text"
                icon={<DollarCircleOutlined />}
                size="small"
                style={{ color: 'var(--color-success)' }}
                onClick={() => router.push(`/dashboard/loans/${r.id}?pay=true`)}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  if (!isStaffOrAdmin) {
    return (
      <AppLayout pageTitle="สัญญาเงินกู้">
        <div style={{ textAlign: 'center', padding: '80px 16px' }}>
          <Empty
            image={<UserOutlined style={{ fontSize: 64, color: 'var(--color-danger)' }} />}
            description={
              <span style={{ color: 'var(--color-danger)', fontWeight: 600, fontSize: 16 }}>
                403 - ขออภัย คุณไม่มีสิทธิ์เข้าถึงหน้านี้ (เฉพาะผู้ดูแลระบบเท่านั้น)
              </span>
            }
          />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout pageTitle="สัญญาเงินกู้">
      {contextHolder}

      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-header-title">สัญญาเงินกู้</h1>
          <p className="page-header-subtitle">แสดงข้อมูล ดอกเบี้ย และยอดค้างชำระของสัญญาทั้งหมด</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Tooltip title="รีเฟรชข้อมูล">
            <Button icon={<ReloadOutlined />} onClick={fetchLoans} loading={loading} />
          </Tooltip>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setDrawerOpen(true)}
            style={{ fontWeight: 600 }}
          >
            + เพิ่มสัญญาใหม่
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Input
          prefix={<SearchOutlined style={{ color: 'var(--color-text-muted)' }} />}
          placeholder="ค้นหาตามชื่อผู้กู้ หรือรหัสสัญญา..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
          style={{ maxWidth: 320, borderRadius: 'var(--radius-md)' }}
        />
        <Select
          value={statusFilter}
          onChange={setStatusFilter}
          style={{ minWidth: 150 }}
          options={[
            { value: 'all', label: 'สถานะทั้งหมด' },
            { value: 'draft', label: '📝 ร่างสัญญา (Draft)' },
            { value: 'active', label: '🟢 ปกติ (Active)' },
            { value: 'upcoming', label: '🟡 ใกล้กำหนด (Upcoming)' },
            { value: 'overdue', label: '🔴 เกินกำหนด (Overdue)' },
            { value: 'npl', label: '⚠️ หนี้เสีย (NPL)' },
            { value: 'closed', label: '⚫ ปิดสัญญา (Closed)' },
          ]}
        />
        <Text style={{ lineHeight: '38px', color: 'var(--color-text-muted)', fontSize: 13 }}>
          แสดง {filtered.length} จาก {loans.length} รายการ
        </Text>
      </div>

      {/* Table */}
      <div className="table-card">
        <Table<LoanRow>
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
                image={<FileTextOutlined style={{ fontSize: 48, color: '#d1d5db' }} />}
                description={
                  <span style={{ color: 'var(--color-text-muted)' }}>
                    {search ? 'ไม่พบข้อมูลสัญญาที่ค้นหา' : 'ยังไม่มีสัญญาในระบบ'}
                  </span>
                }
              >
                {!search && (
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawerOpen(true)}>
                    สร้างสัญญาเงินกู้แรก
                  </Button>
                )}
              </Empty>
            ),
          }}
        />
      </div>

      {/* Create Loan Drawer */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileTextOutlined style={{ color: 'var(--color-primary)', fontSize: 20 }} />
            <span style={{ fontWeight: 700 }}>สร้างสัญญาเงินกู้ใหม่</span>
          </div>
        }
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); form.resetFields(); }}
        width={520}
        footer={
          <div style={{ padding: '8px 4px' }}>
            {isStaff && (
              <div style={{ textAlign: 'left', marginBottom: 12, color: '#b45309', fontSize: 12, fontWeight: 500 }}>
                * หมายเหตุ: สัญญาจะถูกบันทึกในสถานะ "ร่างสัญญา (Draft)" เพื่อรอผู้ดูแลระบบอนุมัติ
              </div>
            )}
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
                {isStaff ? 'บันทึกร่างสัญญา' : 'สร้างสัญญาเงินกู้'}
              </Button>
            </div>
          </div>
        }
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleAddLoan}
          requiredMark={false}
          initialValues={{
            interestRate: 3.0,
            interestType: 'flat_monthly',
            startDate: dayjs(),
            dueDate: dayjs().add(1, 'year'),
          }}
        >
          <Form.Item
            name="userId"
            label="เลือกผู้กู้ (ลูกหนี้)"
            rules={[{ required: true, message: 'กรุณาเลือกผู้กู้' }]}
          >
            <Select
              placeholder="พิมพ์ค้นหาชื่อผู้กู้..."
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={debtors.map((d) => ({
                value: d.id,
                label: d.fullName || 'ไม่ระบุชื่อ',
              }))}
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="note"
            label="รหัสสัญญา / หมายเลขอ้างอิง"
            rules={[{ required: true, message: 'กรุณากรอกรหัสอ้างอิงสัญญา' }]}
          >
            <Input placeholder="เช่น LN-2026-001" size="large" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="principal"
                label="จำนวนเงินต้น (บาท)"
                rules={[
                  { required: true, message: 'กรุณากรอกเงินต้น' },
                  { type: 'number', min: 100, message: 'เงินต้นต้องไม่น้อยกว่า 100 บาท' }
                ]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  size="large"
                  placeholder="0.00"
                  formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(value) => value!.replace(/\$\s?|(,*)/g, '')}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="interestRate"
                label="อัตราดอกเบี้ยต่อคาด (%)"
                rules={[{ required: true, message: 'กรุณากรอกอัตราดอกเบี้ย' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  size="large"
                  min={0}
                  max={100}
                  step={0.1}
                  placeholder="เช่น 3.0"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="interestType"
            label="เงื่อนไขการคิดดอกเบี้ย"
            rules={[{ required: true }]}
          >
            <Select size="large" options={[
              { value: 'flat_monthly', label: 'คงที่ รายเดือน (Flat rate monthly)' },
              { value: 'flat_daily', label: 'คงที่ รายวัน (Flat rate daily)' },
              { value: 'effective_monthly', label: 'ลดต้นลดดอก รายเดือน (Effective rate monthly)' },
              { value: 'effective_daily', label: 'ลดต้นลดดอก รายวัน (Effective rate daily)' },
            ]} />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="startDate"
                label="วันที่ทำสัญญา"
                rules={[{ required: true, message: 'กรุณาเลือกวันทำสัญญา' }]}
              >
                <DatePicker style={{ width: '100%' }} size="large" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="dueDate"
                label="วันสิ้นสุดสัญญา"
                rules={[{ required: true, message: 'กรุณาเลือกวันสิ้นสุดสัญญา' }]}
              >
                <DatePicker style={{ width: '100%' }} size="large" />
              </Form.Item>
            </Col>
          </Row>

          <Divider style={{ margin: '16px 0' }} />
          <Title level={5} style={{ margin: '0 0 16px 0' }}><BankOutlined /> บัญชีธนาคารรับโอน / ชำระ</Title>

          <Form.Item
            name="bankName"
            label="ชื่อธนาคาร"
          >
            <Input placeholder="เช่น กสิกรไทย, ไทยพาณิชย์" size="large" />
          </Form.Item>

          <Form.Item
            name="bankAccountName"
            label="ชื่อเจ้าของบัญชี"
          >
            <Input placeholder="เช่น นาย สมชาย ใจดี" size="large" />
          </Form.Item>

          <Form.Item
            name="bankAccountNumber"
            label="หมายเลขบัญชีธนาคาร"
          >
            <Input placeholder="เช่น 123-4-56789-0" size="large" />
          </Form.Item>
        </Form>
      </Drawer>
    </AppLayout>
  );
}
