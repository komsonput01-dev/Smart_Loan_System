'use client';

import React, { useState, useEffect, useCallback, Suspense, useRef } from 'react';
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
  Row,
  Col,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  DollarCircleOutlined,
  CalendarOutlined,
  FileTextOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import dayjs from 'dayjs';

const { Text, Title, Paragraph } = Typography;

interface PaymentHistoryRow {
  id: string;
  loanId: string;
  paymentDate: string;
  amountPaid: string;
  interestPortion: string;
  principalPortion: string;
  remainingPrincipal: string;
  accruedInterestBefore: string;
  accruedInterestAfter: string;
  note: string | null;
  createdAt: string;
  loanRef: string | null;
  debtorName: string | null;
}

interface LoanOption {
  id: string;
  note: string | null;
  userName: string | null;
  outstandingPrincipal: string;
}

const fmt = (v: string | number) =>
  `฿${Number(v).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function PaymentsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedLoanId = searchParams.get('loanId');

  const { user: clerkUser } = useUser();
  const isDebtor = clerkUser?.publicMetadata?.role === 'debtor';

  const [payments, setPayments] = useState<PaymentHistoryRow[]>([]);
  const [loans, setLoans] = useState<LoanOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const url = preselectedLoanId ? `/api/payments?loanId=${preselectedLoanId}` : '/api/payments';
      const res = await fetch(url);
      if (!res.ok) throw new Error('โหลดประวัติการชำระเงินไม่สำเร็จ');
      const data = await res.json();
      setPayments(data.payments ?? []);
    } catch (err: unknown) {
      messageApi.error(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  }, [preselectedLoanId, messageApi]);

  const fetchLoans = useCallback(async () => {
    try {
      const res = await fetch('/api/loans');
      if (!res.ok) throw new Error('โหลดข้อมูลสัญญาเงินกู้ไม่สำเร็จ');
      const data = await res.json();
      setLoans(data.loans ?? []);
    } catch (err: unknown) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const hasAutoOpened = useRef(false);

  useEffect(() => {
    // Auto open drawer if action=new in URL (and user is admin/staff)
    if (searchParams.get('action') === 'new' && !hasAutoOpened.current) {
      hasAutoOpened.current = true;
      if (!isDebtor) {
        setDrawerOpen(true);
      }
    }
  }, [searchParams, isDebtor]);

  useEffect(() => {
    if (drawerOpen) {
      fetchLoans();
      if (preselectedLoanId) {
        form.setFieldsValue({ loanId: preselectedLoanId });
      }
    }
  }, [drawerOpen, fetchLoans, preselectedLoanId, form]);

  const handleRecordPayment = async (values: any) => {
    setSaving(true);
    try {
      const payload = {
        loanId: values.loanId,
        paymentDate: values.paymentDate.format('YYYY-MM-DD'),
        amountPaid: String(values.amountPaid),
        note: values.note,
      };

      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'บันทึกชำระเงินไม่สำเร็จ');

      messageApi.success('บันทึกการชำระเงินและตัดยอดเรียบร้อยแล้ว');
      form.resetFields();
      setDrawerOpen(false);
      fetchPayments();
    } catch (err: unknown) {
      messageApi.error(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  };

  const filtered = payments.filter((p) => {
    const q = search.toLowerCase();
    return (
      (p.debtorName?.toLowerCase() || '').includes(q) ||
      (p.loanRef?.toLowerCase() || '').includes(q) ||
      (p.note?.toLowerCase() || '').includes(q)
    );
  });

  const columns: ColumnsType<PaymentHistoryRow> = [
    {
      title: 'วันที่ชำระ',
      dataIndex: 'paymentDate',
      key: 'paymentDate',
      width: 120,
      render: (text) => (
        <Text style={{ fontSize: 13, fontWeight: 600 }}>
          {new Date(text).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
        </Text>
      ),
    },
    {
      title: 'สัญญา / ผู้กู้',
      key: 'loan',
      width: 220,
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: 13 }}>
            {r.loanRef?.replace('รหัสสัญญา: ', '') || 'สัญญาเงินกู้'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
            ผู้กู้: {r.debtorName || 'ไม่ระบุชื่อ'}
          </div>
        </div>
      ),
    },
    {
      title: 'ยอดชำระ',
      dataIndex: 'amountPaid',
      key: 'amountPaid',
      align: 'right',
      width: 130,
      sorter: (a, b) => Number(a.amountPaid) - Number(b.amountPaid),
      render: (v) => <span className="font-tabular" style={{ color: 'var(--color-success)', fontWeight: 700 }}>{fmt(v)}</span>,
    },
    {
      title: 'ตัดชำระดอกเบี้ยปรับ',
      dataIndex: 'penaltyPortion',
      key: 'penaltyPortion',
      align: 'right',
      width: 140,
      render: (v) => <span className="font-tabular" style={{ color: '#dc2626', fontSize: 13 }}>{v && Number(v) > 0 ? fmt(v) : '฿0.00'}</span>,
    },
    {
      title: 'ตัดชำระดอกเบี้ยปกติ',
      dataIndex: 'interestPortion',
      key: 'interestPortion',
      align: 'right',
      width: 140,
      render: (v) => <span className="font-tabular" style={{ color: '#d97706', fontSize: 13 }}>{fmt(v)}</span>,
    },
    {
      title: 'ตัดชำระเงินต้น',
      dataIndex: 'principalPortion',
      key: 'principalPortion',
      align: 'right',
      width: 130,
      render: (v) => <span className="font-tabular" style={{ color: 'var(--color-primary)', fontSize: 13 }}>{fmt(v)}</span>,
    },
    {
      title: 'เงินต้นคงเหลือ',
      dataIndex: 'remainingPrincipal',
      key: 'remainingPrincipal',
      align: 'right',
      width: 140,
      render: (v) => (
        <span className="font-tabular" style={{ fontWeight: 600, color: Number(v) === 0 ? 'var(--color-success)' : 'inherit' }}>
          {Number(v) === 0 ? 'ชำระครบ ✓' : fmt(v)}
        </span>
      ),
    },
    {
      title: 'หมายเหตุ',
      dataIndex: 'note',
      key: 'note',
      render: (text) => <Text type="secondary" style={{ fontSize: 12 }}>{text || '—'}</Text>,
    },
  ];

  return (
    <AppLayout pageTitle="บันทึกการชำระเงิน">
      {contextHolder}

      {/* Page Header */}
      <div className="page-header">
        <div>
          <Title level={2} className="page-header-title" style={{ margin: 0 }}>
            บันทึกการชำระเงิน
          </Title>
          <Paragraph className="page-header-subtitle" style={{ margin: '6px 0 0 0' }}>
            ประวัติการชำระเงินและการปันส่วนหักชำระเงินต้นและดอกเบี้ยสะสม
          </Paragraph>
        </div>
        <Space>
          {preselectedLoanId && (
            <Button onClick={() => router.push('/dashboard/payments')}>
              แสดงทั้งหมด
            </Button>
          )}
          <Tooltip title="รีเฟรชข้อมูล">
            <Button icon={<ReloadOutlined />} onClick={fetchPayments} loading={loading} />
          </Tooltip>
          {!isDebtor ? (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setDrawerOpen(true)}
              style={{ fontWeight: 600 }}
            >
              + บันทึกชำระเงินใหม่
            </Button>
          ) : (
            <Button
              type="primary"
              icon={<DollarCircleOutlined />}
              onClick={() => window.open('https://lin.ee/u8zpIG6', '_blank')}
              style={{ fontWeight: 600, backgroundColor: '#06c755', borderColor: '#06c755' }}
            >
              แจ้งชำระเงินผ่าน LINE
            </Button>
          )}
        </Space>
      </div>

      {/* Search and Filters */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 12 }}>
        <Input
          prefix={<SearchOutlined style={{ color: 'var(--color-text-muted)' }} />}
          placeholder="ค้นหาชื่อผู้กู้ รหัสสัญญา หรือหมายเหตุ..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
          style={{ maxWidth: 360, borderRadius: 'var(--radius-md)' }}
        />
        <Text style={{ lineHeight: '38px', color: 'var(--color-text-muted)', fontSize: 13 }}>
          แสดง {filtered.length} จาก {payments.length} รายการ
        </Text>
      </div>

      {/* Table */}
      <div className="table-card">
        <Table<PaymentHistoryRow>
          columns={columns}
          dataSource={filtered}
          rowKey="id"
          loading={loading}
          size="middle"
          scroll={{ x: 900 }}
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
                image={<DollarCircleOutlined style={{ fontSize: 48, color: '#d1d5db' }} />}
                description={
                  <span style={{ color: 'var(--color-text-muted)' }}>
                    ยังไม่มีประวัติการชำระเงินในระบบ
                  </span>
                }
              >
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawerOpen(true)}>
                  บันทึกรายการชำระเงินแรก
                </Button>
              </Empty>
            ),
          }}
        />
      </div>

      {/* Record Payment Drawer */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <DollarCircleOutlined style={{ color: 'var(--color-success)', fontSize: 20 }} />
            <span style={{ fontWeight: 700 }}>บันทึกการชำระเงินใหม่</span>
          </div>
        }
        placement="right"
        width={500}
        onClose={() => {
          setDrawerOpen(false);
          form.resetFields();
        }}
        open={drawerOpen}
        extra={
          <Space>
            <Button onClick={() => { setDrawerOpen(false); form.resetFields(); }}>ยกเลิก</Button>
            {!isDebtor && (
              <Button type="primary" onClick={() => form.submit()} loading={saving} icon={<PlusOutlined />}>
                บันทึกการชำระ
              </Button>
            )}
          </Space>
        }
      >
        {!isDebtor ? (
          <Form
            form={form}
            layout="vertical"
            onFinish={handleRecordPayment}
            requiredMark={false}
            initialValues={{
              paymentDate: dayjs(),
            }}
          >
            <Form.Item
              name="loanId"
              label="เลือกสัญญาเงินกู้ที่ชำระ"
              rules={[{ required: true, message: 'กรุณาเลือกสัญญาเงินกู้' }]}
            >
              <Select
              showSearch
              placeholder="ค้นหาชื่อผู้กู้ หรือรหัสสัญญา..."
              optionFilterProp="children"
              disabled={!!preselectedLoanId}
              filterOption={(input, option) =>
                (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
              }
              options={loans
                .filter((l) => Number(l.outstandingPrincipal) > 0)
                .map((l) => ({
                  value: l.id,
                  label: `${l.userName || 'ผู้กู้'} - ${l.note?.replace('รหัสสัญญา: ', '') || l.id.substring(0, 8)} (ค้าง: ${fmt(l.outstandingPrincipal)})`,
                }))}
              size="large"
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="amountPaid"
                label="จำนวนเงินที่จ่าย (บาท)"
                rules={[
                  { required: true, message: 'กรุณากรอกจำนวนเงิน' },
                  { type: 'number', min: 0.01, message: 'จำนวนเงินต้องมากกว่า 0' }
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
                name="paymentDate"
                label="วันที่รับชำระ"
                rules={[{ required: true, message: 'กรุณาเลือกวันที่' }]}
              >
                <DatePicker style={{ width: '100%' }} size="large" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="note"
            label="หมายเหตุเพิ่มเติม"
          >
            <Input.TextArea placeholder="เช่น โอนเข้ากสิกรไทย, จ่ายสด" rows={4} />
          </Form.Item>

          <div
            style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: 10,
              padding: '12px 16px',
              fontSize: 13,
              color: '#166534',
            }}
          >
            💡 <strong>การปันส่วนยอดชำระ:</strong> ระบบจะนำยอดเงินไปหักล้างดอกเบี้ยค้างจ่ายสะสมก่อน จากนั้นเงินส่วนที่เหลือจะนำไปหักลดเงินต้นคงเหลือโดยอัตโนมัติ
          </div>
        </Form>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 16px' }}>
            <DollarCircleOutlined style={{ fontSize: 48, color: '#06c755', marginBottom: 16 }} />
            <Title level={4}>ต้องการแจ้งชำระเงิน?</Title>
            <Paragraph type="secondary">
              คุณสามารถส่งหลักฐานการโอนเงิน (สลิป) ให้กับผู้ดูแลระบบผ่านทาง LINE Official เพื่อให้ผู้ดูแลระบบบันทึกเข้าระบบให้คุณ
            </Paragraph>
            <Button
              type="primary"
              size="large"
              icon={<UserOutlined />}
              onClick={() => window.open('https://lin.ee/u8zpIG6', '_blank')}
              style={{ marginTop: 16, backgroundColor: '#06c755', borderColor: '#06c755', fontWeight: 600 }}
            >
              ติดต่อผู้ดูแลระบบผ่าน LINE
            </Button>
          </div>
        )}
      </Drawer>
    </AppLayout>
  );
}

export default function PaymentsPage() {
  return (
    <Suspense fallback={
      <AppLayout pageTitle="บันทึกการชำระเงิน">
        <div style={{ textAlign: 'center', padding: '100px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: 12, color: 'var(--color-text-muted)' }}>กำลังโหลด...</div>
        </div>
      </AppLayout>
    }>
      <PaymentsContent />
    </Suspense>
  );
}
