'use client';

import React, { useState, useEffect, useCallback, Suspense, useMemo } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import DocumentUpload from '@/components/dashboard/DocumentUpload';
import Decimal from 'decimal.js';
import {
  Card,
  Descriptions,
  Table,
  Button,
  Tag,
  Modal,
  Form,
  Input,
  DatePicker,
  Space,
  Spin,
  message,
  Typography,
  Divider,
  Row,
  Col,
  Statistic,
  InputNumber,
  Badge,
  Select,
  Tabs,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ArrowLeftOutlined,
  DollarCircleOutlined,
  CalendarOutlined,
  BankOutlined,
  EditOutlined,
  FileProtectOutlined,
  HistoryOutlined,
  ReloadOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;

interface LoanDetail {
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
  lastInterestCalcDate: string | null;
  status: 'draft' | 'active' | 'upcoming' | 'overdue' | 'closed' | 'npl';
  note: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankName: string | null;
  createdAt: string;
  creatorName?: string | null;
  approverName?: string | null;
}

interface UserDetail {
  id: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  lineUserId: string | null;
  role: string;
}

interface PaymentRow {
  id: string;
  paymentDate: string;
  amountPaid: string;
  interestPortion: string;
  principalPortion: string;
  remainingPrincipal: string;
  note: string | null;
  createdAt: string;
}

interface DocumentRow {
  id: string;
  docType: 'id_card' | 'title_deed' | 'contract' | 'other';
  fileName: string;
  uploadedAt: string;
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
  { label: string; color: string; badge: 'success' | 'warning' | 'error' | 'default' | 'processing' }
> = {
  draft: { label: 'ร่างสัญญา', color: '#8c8c8c', badge: 'processing' },
  active: { label: 'ปกติ', color: 'var(--color-success)', badge: 'success' },
  upcoming: { label: 'ใกล้กำหนด', color: 'var(--color-warning)', badge: 'warning' },
  overdue: { label: 'เกินกำหนด', color: 'var(--color-danger)', badge: 'error' },
  closed: { label: 'ปิดสัญญาแล้ว', color: '#6b7280', badge: 'default' },
  npl: { label: 'หนี้เสีย (NPL)', color: '#7f1d1d', badge: 'error' },
};

function LoanDetailContent({ params }: { params: React.Usable<{ id: string }> }) {
  const { user: clerkUser } = useUser();
  const role = clerkUser?.publicMetadata?.role || 'debtor';
  const isAdmin = role === 'admin';
  const isStaff = role === 'staff';
  const isStaffOrAdmin = role === 'admin' || role === 'staff';

  const router = useRouter();
  const { id } = React.use(params);

  const [loading, setLoading] = useState(true);
  const [loan, setLoan] = useState<LoanDetail | null>(null);
  const [user, setUser] = useState<UserDetail | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [paymentForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();

  const searchParams = useSearchParams();
  const payParam = searchParams.get('pay');

  const [simInstallment, setSimInstallment] = useState<number>(10000);

  useEffect(() => {
    if (loan) {
      const suggested = Math.max(1000, Math.ceil(Number(loan.principal) * 0.10));
      setSimInstallment(suggested);
    }
  }, [loan]);

  const disabledPaymentDate = (current: any) => {
    if (!loan) return false;
    const isBeforeStart = current && current < dayjs(loan.startDate).startOf('day');
    if (isBeforeStart) return true;
    
    if (payments.length > 0) {
      const latestDate = dayjs(payments[0].paymentDate).startOf('day');
      return current && current < latestDate;
    }
    return false;
  };

  const amortizationData = useMemo(() => {
    if (!loan) return [];
    const rows = [];
    let currentPrincipal = new Decimal(loan.outstandingPrincipal);
    const originalPrincipal = new Decimal(loan.principal);
    const rate = new Decimal(loan.interestRate).div(100);
    const installment = new Decimal(simInstallment || 0);

    if (installment.isZero()) return [];

    let count = 0;
    while (currentPrincipal.greaterThan(0) && count < 120) {
      count++;
      let interest = new Decimal(0);
      
      if (loan.interestType.includes('flat')) {
        interest = originalPrincipal.mul(rate).div(12);
      } else {
        interest = currentPrincipal.mul(rate).div(12);
      }
      
      interest = interest.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      
      let principalPortion = installment.minus(interest);
      if (principalPortion.isNegative() || principalPortion.isZero()) {
        rows.push({
          key: count,
          index: count,
          beginningBalance: currentPrincipal.toNumber(),
          interest: interest.toNumber(),
          principalPortion: 0,
          endingBalance: currentPrincipal.toNumber(),
          error: 'ยอดผ่อนน้อยกว่าดอกเบี้ยในงวดนี้'
        });
        break;
      }
      
      if (currentPrincipal.lessThan(principalPortion)) {
        principalPortion = currentPrincipal;
      }
      
      const endingBalance = currentPrincipal.minus(principalPortion);
      
      rows.push({
        key: count,
        index: count,
        beginningBalance: currentPrincipal.toNumber(),
        interest: interest.toNumber(),
        principalPortion: principalPortion.toNumber(),
        endingBalance: endingBalance.toNumber(),
      });
      
      currentPrincipal = endingBalance;
    }
    return rows;
  }, [loan, simInstallment]);

  const amortizationColumns = [
    {
      title: 'งวดที่',
      dataIndex: 'index',
      key: 'index',
      width: 80,
      align: 'center' as const,
    },
    {
      title: 'ยอดต้นคงเหลือยกมา',
      dataIndex: 'beginningBalance',
      key: 'beginningBalance',
      align: 'right' as const,
      render: (v: number) => fmt(v),
    },
    {
      title: 'ดอกเบี้ยในงวด',
      dataIndex: 'interest',
      key: 'interest',
      align: 'right' as const,
      render: (v: number) => <span style={{ color: '#d97706' }}>{fmt(v)}</span>,
    },
    {
      title: 'หักเงินต้น',
      dataIndex: 'principalPortion',
      key: 'principalPortion',
      align: 'right' as const,
      render: (v: number, record: any) => 
        record.error ? <span style={{ color: 'var(--color-danger)', fontSize: 11 }}>{record.error}</span> : <span style={{ color: 'var(--color-primary)' }}>{fmt(v)}</span>,
    },
    {
      title: 'เงินต้นคงเหลือปลายงวด',
      dataIndex: 'endingBalance',
      key: 'endingBalance',
      align: 'right' as const,
      render: (v: number) => <span style={{ fontWeight: 600 }}>{fmt(v)}</span>,
    },
  ];

  const fetchLoanData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/loans/${id}`);
      if (!res.ok) throw new Error('ไม่สามารถโหลดข้อมูลสัญญานี้ได้');
      const data = await res.json();
      setLoan(data.loan);
      setUser(data.user);
      setPayments(data.payments ?? []);
      setDocuments(data.documents ?? []);
    } catch (err: unknown) {
      messageApi.error(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  }, [id, messageApi]);

  useEffect(() => {
    if (id) {
      fetchLoanData();
    }
  }, [id, fetchLoanData]);

  useEffect(() => {
    if (loan && payParam === 'true') {
      paymentForm.setFieldsValue({
        paymentDate: dayjs(),
        amountPaid: Number(loan.outstandingPrincipal),
      });
      setPaymentModalOpen(true);
    }
  }, [loan, payParam, paymentForm]);

  const handleRecordPayment = async (values: { paymentDate: any; amountPaid: number; note?: string }) => {
    setSubmitting(true);
    try {
      const payload = {
        loanId: id,
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
      setPaymentModalOpen(false);
      paymentForm.resetFields();
      fetchLoanData();
    } catch (err: unknown) {
      messageApi.error(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditLoan = async (values: any) => {
    setSubmitting(true);
    try {
      const payload: Record<string, any> = {
        dueDate: values.dueDate.format('YYYY-MM-DD'),
        bankName: values.bankName,
        bankAccountName: values.bankAccountName,
        bankAccountNumber: values.bankAccountNumber,
        note: values.note,
        status: values.status,
      };

      const res = await fetch(`/api/loans/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'แก้ไขข้อมูลสัญญาไม่สำเร็จ');

      messageApi.success('แก้ไขข้อมูลสัญญาเงินกู้เรียบร้อยแล้ว');
      setEditModalOpen(false);
      fetchLoanData();
    } catch (err: unknown) {
      messageApi.error(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveLoan = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/loans/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'อนุมัติสัญญาไม่สำเร็จ');
      messageApi.success('อนุมัติสัญญาเงินกู้เรียบร้อยแล้ว');
      fetchLoanData();
    } catch (err: unknown) {
      messageApi.error(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    } finally {
      setSubmitting(false);
    }
  };

  const paymentColumns: ColumnsType<PaymentRow> = [
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
      title: 'ยอดชำระ',
      dataIndex: 'amountPaid',
      key: 'amountPaid',
      align: 'right',
      width: 130,
      render: (v) => <Text style={{ color: 'var(--color-success)', fontWeight: 700 }}>{fmt(v)}</Text>,
    },
    {
      title: 'หักดอกเบี้ยปรับ',
      dataIndex: 'penaltyPortion',
      key: 'penaltyPortion',
      align: 'right',
      width: 125,
      render: (v) => <Text style={{ color: '#dc2626', fontSize: 13 }}>{v ? fmt(v) : '฿0.00'}</Text>,
    },
    {
      title: 'หักดอกเบี้ยปกติ',
      dataIndex: 'interestPortion',
      key: 'interestPortion',
      align: 'right',
      width: 120,
      render: (v) => <Text style={{ color: '#d97706', fontSize: 13 }}>{fmt(v)}</Text>,
    },
    {
      title: 'หักเงินต้น',
      dataIndex: 'principalPortion',
      key: 'principalPortion',
      align: 'right',
      width: 120,
      render: (v) => <Text style={{ color: 'var(--color-primary)', fontSize: 13 }}>{fmt(v)}</Text>,
    },
    {
      title: 'เงินต้นคงเหลือ',
      dataIndex: 'remainingPrincipal',
      key: 'remainingPrincipal',
      align: 'right',
      width: 140,
      render: (v) => <Text style={{ fontWeight: 600, fontSize: 13 }}>{fmt(v)}</Text>,
    },
    {
      title: 'หมายเหตุ',
      dataIndex: 'note',
      key: 'note',
      render: (text) => <Text type="secondary" style={{ fontSize: 12 }}>{text || '—'}</Text>,
    },
  ];

  if (loading && !loan) {
    return (
      <AppLayout pageTitle="สัญญาเงินกู้">
        <div style={{ textAlign: 'center', padding: '100px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: 12, color: 'var(--color-text-muted)' }}>กำลังโหลดรายละเอียดสัญญาเงินกู้...</div>
        </div>
      </AppLayout>
    );
  }

  if (!loan || !user) {
    return (
      <AppLayout pageTitle="สัญญาเงินกู้">
        <Card style={{ margin: '40px auto', maxWidth: 600, textAlign: 'center' }}>
          <Title level={4} type="danger">ไม่พบข้อมูลสัญญาเงินกู้</Title>
          <Paragraph>สัญญานี้ไม่มีอยู่ในระบบ หรือคุณไม่มีสิทธิ์เข้าถึง</Paragraph>
          <Button type="primary" icon={<ArrowLeftOutlined />} onClick={() => router.push('/dashboard')}>
            กลับไปหน้าภาพรวม
          </Button>
        </Card>
      </AppLayout>
    );
  }

  const status = statusConfig[loan.status] || statusConfig.active;

  return (
    <AppLayout pageTitle={`สัญญา ${loan.note || loan.id.substring(0, 8)}`}>
      {contextHolder}

      {/* Header */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <Space size={8}>
            <Button icon={<ArrowLeftOutlined />} onClick={() => router.back()} />
            <h1 className="page-header-title" style={{ margin: 0 }}>
              สัญญา {loan.note?.replace('รหัสสัญญา: ', '') || loan.id.substring(0, 8)}
            </h1>
            <Badge status={status.badge} text={status.label} style={{ marginLeft: 8 }} />
          </Space>
          <p className="page-header-subtitle" style={{ marginTop: 6 }}>
            จัดการและอัปเดตข้อมูลผู้กู้ สัญญา ดอกเบี้ย และเอกสารแนบทั้งหมด
          </p>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchLoanData} />
          <Button icon={<EditOutlined />} onClick={() => {
            editForm.setFieldsValue({
              dueDate: dayjs(loan.dueDate),
              bankName: loan.bankName,
              bankAccountName: loan.bankAccountName,
              bankAccountNumber: loan.bankAccountNumber,
              note: loan.note,
              status: loan.status,
            });
            setEditModalOpen(true);
          }}>
            แก้ไขสัญญา
          </Button>
          {loan.status === 'draft' && isAdmin && (
            <Button
              type="primary"
              icon={<FileProtectOutlined />}
              onClick={handleApproveLoan}
              loading={submitting}
              style={{ backgroundColor: 'var(--color-success)', borderColor: 'var(--color-success)' }}
            >
              อนุมัติสัญญาเงินกู้
            </Button>
          )}
          {loan.status !== 'closed' && loan.status !== 'draft' && isAdmin && (
            <Button type="primary" icon={<DollarCircleOutlined />} onClick={() => {
              paymentForm.setFieldsValue({
                paymentDate: dayjs(),
                amountPaid: Number(loan.outstandingPrincipal),
              });
              setPaymentModalOpen(true);
            }}>
              บันทึกชำระเงิน
            </Button>
          )}
        </Space>
      </div>

      {loan.status === 'draft' && (
        <div style={{
          background: '#fffbe6',
          border: '1px solid #ffe58f',
          padding: '12px 16px',
          borderRadius: 'var(--radius-md)',
          marginBottom: 16,
          color: '#d46b08',
          fontWeight: 500,
          fontSize: 13,
        }}>
          ⚠️ สัญญานี้อยู่ในสถานะ "ร่างสัญญา (Draft)" และยังไม่มีผลบังคับใช้
          {isStaff ? ' — รอผู้ดูแลระบบ (Admin) ตรวจสอบและอนุมัติสัญญา' : ' — กรุณาตรวจสอบรายละเอียดและกดปุ่ม "อนุมัติสัญญาเงินกู้" ด้านบน'}
        </div>
      )}

      <Row gutter={[16, 16]}>
        {/* Left Side: Client and Loan Overview */}
        <Col xs={24} lg={16}>
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            {/* Overview Stats */}
            <Card style={{ borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
              <Row gutter={16}>
                <Col span={6}>
                  <Statistic
                    title="เงินต้นเริ่มแรก"
                    value={Number(loan.principal)}
                    precision={2}
                    prefix="฿"
                    valueStyle={{ fontWeight: 700 }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="เงินต้นคงเหลือ"
                    value={Number(loan.outstandingPrincipal)}
                    precision={2}
                    prefix="฿"
                    valueStyle={{ fontWeight: 700, color: Number(loan.outstandingPrincipal) > 0 ? 'var(--color-text-primary)' : 'var(--color-success)' }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="ดอกเบี้ยค้างรับสะสม"
                    value={Number(loan.accruedInterest)}
                    precision={2}
                    prefix="฿"
                    valueStyle={{ color: '#d97706', fontWeight: 700 }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="เก็บดอกเบี้ยไปแล้ว"
                    value={Number(loan.totalInterestCollected)}
                    precision={2}
                    prefix="฿"
                    valueStyle={{ color: 'var(--color-success)', fontWeight: 700 }}
                  />
                </Col>
              </Row>
            </Card>

            {/* Loan details */}
            <Card
              title={<><CalendarOutlined /> รายละเอียดเงื่อนไขสัญญา</>}
              style={{ borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}
            >
              <Descriptions bordered column={{ xs: 1, sm: 2 }}>
                <Descriptions.Item label="ประเภทดอกเบี้ย">
                  <span style={{ fontWeight: 600 }}>{interestTypeLabel[loan.interestType]}</span>
                </Descriptions.Item>
                <Descriptions.Item label="อัตราดอกเบี้ย">
                  <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{loan.interestRate}%</span>
                </Descriptions.Item>
                <Descriptions.Item label="วันที่เริ่มสัญญา">
                  {new Date(loan.startDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}
                </Descriptions.Item>
                <Descriptions.Item label="วันครบกำหนดสัญญา">
                  <span style={{
                    fontWeight: loan.status === 'overdue' ? 700 : 400,
                    color: loan.status === 'overdue' ? 'var(--color-danger)' : 'inherit'
                  }}>
                    {new Date(loan.dueDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                </Descriptions.Item>
                <Descriptions.Item label="วันที่คิดดอกเบี้ยล่าสุด">
                  {loan.lastInterestCalcDate ? new Date(loan.lastInterestCalcDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
                </Descriptions.Item>
                <Descriptions.Item label="ผู้สร้างร่างสัญญา">
                  {loan.creatorName || '—'}
                </Descriptions.Item>
                <Descriptions.Item label="ผู้อนุมัติสัญญา">
                  {loan.approverName || (loan.status === 'draft' ? <Tag color="warning">รออนุมัติ</Tag> : '—')}
                </Descriptions.Item>
                <Descriptions.Item label="หมายเหตุ" span={2}>
                  {loan.note || '—'}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            {/* Payment history and Amortization Schedule Tabs */}
            <Card
              styles={{ body: { padding: '12px 16px' } }}
              style={{ borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}
            >
              <Tabs
                defaultActiveKey="history"
                items={[
                  {
                    key: 'history',
                    label: <span style={{ fontWeight: 600 }}><HistoryOutlined /> ประวัติการชำระเงินจริง</span>,
                    children: (
                      <Table<PaymentRow>
                        columns={paymentColumns}
                        dataSource={payments}
                        rowKey="id"
                        size="middle"
                        pagination={{ pageSize: 5 }}
                        locale={{ emptyText: 'ยังไม่มีประวัติการชำระเงิน' }}
                      />
                    )
                  },
                  {
                    key: 'simulator',
                    label: <span style={{ fontWeight: 600 }}><DollarCircleOutlined /> ตารางผ่อนชำระจำลอง (Amortization)</span>,
                    children: (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                            ระบุยอดที่ต้องการทดลองผ่อนต่อเดือน (บาท):
                          </span>
                          <InputNumber
                            min={1}
                            style={{ width: 180 }}
                            value={simInstallment}
                            onChange={(v) => setSimInstallment(v ?? 0)}
                            formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                            parser={(v) => Number(v?.replace(/\$\s?|(,*)/g, '') || 0)}
                          />
                          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                            *คำนวณจากยอดต้นคงเหลือ {fmt(loan.outstandingPrincipal)}
                          </span>
                        </div>
                        
                        <Table
                          columns={amortizationColumns}
                          dataSource={amortizationData}
                          size="middle"
                          pagination={{ pageSize: 10 }}
                          locale={{ emptyText: 'ระบุยอดผ่อนชำระเพื่อเริ่มคำนวณ' }}
                        />
                      </div>
                    )
                  }
                ]}
              />
            </Card>
          </Space>
        </Col>

        {/* Right Side: Debtor profile & documents */}
        <Col xs={24} lg={8}>
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            {/* Debtor info */}
            <Card
              title={<><UserOutlined /> ข้อมูลผู้กู้</>}
              style={{ borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}
            >
              <Descriptions column={1}>
                <Descriptions.Item label="ชื่อผู้กู้">
                  <span style={{ fontWeight: 600 }}>{user.fullName || 'ไม่ระบุชื่อ'}</span>
                </Descriptions.Item>
                <Descriptions.Item label="เบอร์โทรศัพท์">
                  {user.phone || '—'}
                </Descriptions.Item>
                <Descriptions.Item label="อีเมล">
                  {user.email || '—'}
                </Descriptions.Item>
                <Descriptions.Item label="LINE User ID">
                  {user.lineUserId ? <span style={{ color: '#06c755', fontWeight: 600 }}>{user.lineUserId}</span> : <span style={{ color: 'var(--color-text-muted)' }}>ไม่ได้ผูกไว้</span>}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            {/* Bank details */}
            <Card
              title={<><BankOutlined /> บัญชีรับชำระ</>}
              style={{ borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}
            >
              <Descriptions column={1}>
                <Descriptions.Item label="ธนาคาร">
                  {loan.bankName || '—'}
                </Descriptions.Item>
                <Descriptions.Item label="ชื่อบัญชี">
                  {loan.bankAccountName || '—'}
                </Descriptions.Item>
                <Descriptions.Item label="เลขบัญชี">
                  {loan.bankAccountNumber || '—'}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            {/* Documents */}
            <Card
              title={<><FileProtectOutlined /> เอกสารแนบสัญญา</>}
              styles={{ body: { padding: 8 } }}
              style={{ borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}
            >
              <Space direction="vertical" style={{ width: '100%' }} size={12}>
                <DocumentUpload
                  loanId={loan.id}
                  docType="id_card"
                  title="สำเนาบัตรประชาชน"
                  description="ภาพถ่ายบัตรประชาชนของผู้กู้เพื่อประกอบสัญญา"
                  onUploadSuccess={fetchLoanData}
                />
                <DocumentUpload
                  loanId={loan.id}
                  docType="title_deed"
                  title="โฉนดที่ดิน (ถ้ามี)"
                  description="ภาพถ่ายโฉนดค้ำประกันสัญญา"
                  onUploadSuccess={fetchLoanData}
                />
                <DocumentUpload
                  loanId={loan.id}
                  docType="contract"
                  title="สัญญาเงินกู้"
                  description="เอกสารแนบใบเซ็นชื่อประกอบสัญญา"
                  onUploadSuccess={fetchLoanData}
                />
              </Space>
            </Card>
          </Space>
        </Col>
      </Row>

      {/* Record Payment Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <DollarCircleOutlined style={{ color: 'var(--color-success)', fontSize: 22 }} />
            <span style={{ fontWeight: 700 }}>บันทึกการชำระเงิน</span>
          </div>
        }
        open={paymentModalOpen}
        onCancel={() => setPaymentModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setPaymentModalOpen(false)}>ยกเลิก</Button>,
          <Button key="submit" type="primary" loading={submitting} onClick={() => paymentForm.submit()}>บันทึกการชำระ</Button>
        ]}
      >
        <Form
          form={paymentForm}
          layout="vertical"
          onFinish={handleRecordPayment}
          requiredMark={false}
        >
          <Form.Item
            name="amountPaid"
            label="จำนวนเงินที่ชำระ (บาท)"
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

          <Form.Item
            name="paymentDate"
            label="วันที่ชำระเงิน"
            rules={[{ required: true, message: 'กรุณาเลือกวันที่' }]}
          >
            <DatePicker style={{ width: '100%' }} size="large" disabledDate={disabledPaymentDate} />
          </Form.Item>

          <Form.Item
            name="note"
            label="หมายเหตุเพิ่มเติม"
          >
            <Input.TextArea placeholder="เช่น ชำระผ่าน Mobile Banking, จ่ายสด" rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Loan Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <EditOutlined style={{ color: 'var(--color-primary)', fontSize: 22 }} />
            <span style={{ fontWeight: 700 }}>แก้ไขรายละเอียดสัญญา</span>
          </div>
        }
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setEditModalOpen(false)}>ยกเลิก</Button>,
          <Button key="submit" type="primary" loading={submitting} onClick={() => editForm.submit()}>บันทึกข้อมูล</Button>
        ]}
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={handleEditLoan}
          requiredMark={false}
        >
          <Form.Item
            name="dueDate"
            label="วันครบกำหนดชำระ"
            rules={[{ required: true, message: 'กรุณาเลือกวันที่ครบกำหนด' }]}
          >
            <DatePicker style={{ width: '100%' }} size="large" disabled={isStaff} />
          </Form.Item>

          <Form.Item
            name="status"
            label="สถานะสัญญา"
            rules={[{ required: true }]}
          >
            <Select style={{ width: '100%' }} size="large" disabled={isStaff} options={[
              { value: 'draft', label: '📝 ร่างสัญญา (Draft)' },
              { value: 'active', label: '🟢 ปกติ (Active)' },
              { value: 'upcoming', label: '🟡 ใกล้ครบกำหนด (Upcoming)' },
              { value: 'overdue', label: '🔴 เกินกำหนด (Overdue)' },
              { value: 'npl', label: '⚠️ หนี้เสีย (NPL)' },
              { value: 'closed', label: '⚫ ปิดสัญญา (Closed)' },
            ]} />
          </Form.Item>

          <Divider style={{ margin: '12px 0' }} />
          <Title level={5} style={{ margin: '0 0 12px 0' }}>ข้อมูลบัญชีธนาคารรับชำระ</Title>

          <Form.Item
            name="bankName"
            label="ชื่อธนาคาร"
          >
            <Input placeholder="เช่น กสิกรไทย, ไทยพาณิชย์" />
          </Form.Item>

          <Form.Item
            name="bankAccountName"
            label="ชื่อบัญชี"
          >
            <Input placeholder="เช่น นาย สมชาย ใจดี" />
          </Form.Item>

          <Form.Item
            name="bankAccountNumber"
            label="เลขที่บัญชี"
          >
            <Input placeholder="เช่น 123-4-56789-0" />
          </Form.Item>

          <Form.Item
            name="note"
            label="หมายเหตุของสัญญา"
          >
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </AppLayout>
  );
}

export default function LoanDetailPage({ params }: { params: React.Usable<{ id: string }> }) {
  return (
    <Suspense fallback={
      <AppLayout pageTitle="สัญญาเงินกู้">
        <div style={{ textAlign: 'center', padding: '100px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: 12, color: 'var(--color-text-muted)' }}>กำลังโหลดรายละเอียดสัญญาเงินกู้...</div>
        </div>
      </AppLayout>
    }>
      <LoanDetailContent params={params} />
    </Suspense>
  );
}
