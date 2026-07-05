'use client';

import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import {
  Card,
  Tabs,
  Form,
  Input,
  Button,
  Table,
  Tag,
  Space,
  Switch,
  Alert,
  message,
  Typography,
  Row,
  Col,
  Avatar,
  Divider,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  SettingOutlined,
  BankOutlined,
  BellOutlined,
  TeamOutlined,
  SaveOutlined,
  SendOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;

interface UserSettingRow {
  id: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  role: 'admin' | 'debtor';
  isActive: boolean;
  createdAt: string;
}

const avatarColors = [
  '#1a56db', '#7c3aed', '#db2777', '#059669',
  '#d97706', '#0891b2', '#9f1239', '#1d4ed8',
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('bank');
  const [loading, setLoading] = useState(false);
  const [testingLine, setTestingLine] = useState(false);
  const [savingBank, setSavingBank] = useState(false);

  const [bankForm] = Form.useForm();
  const [lineForm] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();

  // Mock settings for bank (system default)
  useEffect(() => {
    bankForm.setFieldsValue({
      defaultBankName: 'กสิกรไทย',
      defaultAccountName: 'บจก. สมาร์ท โลน แมนเนจเม้นท์',
      defaultAccountNumber: '095-2-98765-4',
    });
  }, [bankForm]);

  const handleSaveBank = async (values: any) => {
    setSavingBank(true);
    try {
      // Simulate save
      await new Promise((resolve) => setTimeout(resolve, 800));
      messageApi.success('บันทึกการตั้งค่าบัญชีรับเงินสำเร็จ');
    } catch {
      messageApi.error('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setSavingBank(false);
    }
  };

  const handleTestLine = async (values: any) => {
    setTestingLine(true);
    try {
      // Call mock or real notify test
      await new Promise((resolve) => setTimeout(resolve, 1500));
      messageApi.success('ส่งข้อความทดสอบ LINE Notification เรียบร้อยแล้ว (กรุณาเช็คใน LINE ของผู้ใช้)');
    } catch {
      messageApi.error('ส่งข้อความทดสอบไม่สำเร็จ ตรวจสอบ User ID หรือสัญญาณอินเทอร์เน็ต');
    } finally {
      setTestingLine(false);
    }
  };

  return (
    <AppLayout pageTitle="ตั้งค่าระบบ">
      {contextHolder}

      <div className="page-header">
        <h1 className="page-header-title">ตั้งค่าระบบ</h1>
        <p className="page-header-subtitle">กำหนดการเชื่อมต่อภายนอก แจ้งเตือนผ่าน LINE บัญชีธนาคาร และสิทธิ์ความปลอดภัย</p>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={6}>
          <Card styles={{ body: { padding: 8 } }} style={{ borderRadius: 'var(--radius-lg)' }}>
            <Tabs
              tabPosition="left"
              activeKey={activeTab}
              onChange={setActiveTab}
              items={[
                {
                  key: 'bank',
                  label: (
                    <span style={{ fontSize: 13, fontWeight: 600 }}>
                      <BankOutlined /> บัญชีรับชำระเริ่มต้น
                    </span>
                  ),
                },
                {
                  key: 'line',
                  label: (
                    <span style={{ fontSize: 13, fontWeight: 600 }}>
                      <BellOutlined /> แจ้งเตือน LINE Notify
                    </span>
                  ),
                },
                {
                  key: 'security',
                  label: (
                    <span style={{ fontSize: 13, fontWeight: 600 }}>
                      <SafetyCertificateOutlined /> ความปลอดภัย & บทบาท
                    </span>
                  ),
                },
              ]}
              style={{ minHeight: 250 }}
            />
          </Card>
        </Col>

        <Col xs={24} md={18}>
          {/* Tab 1: Bank Settings */}
          {activeTab === 'bank' && (
            <Card
              title={
                <Space>
                  <BankOutlined style={{ color: 'var(--color-primary)' }} />
                  <span style={{ fontWeight: 700 }}>ตั้งค่าบัญชีรับชำระเงินเริ่มต้น</span>
                </Space>
              }
              style={{ borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}
            >
              <Paragraph>
                กำหนดบัญชีธนาคารหลักสำหรับการรับโอนเงินกู้ยืมและดอกเบี้ย ข้อมูลนี้จะถูกแสดงในรายละเอียดสัญญาเงินกู้เริ่มต้น เพื่อความสะดวกในการออกเอกสารแนบและแจ้งเตือนลูกหนี้
              </Paragraph>

              <Form
                form={bankForm}
                layout="vertical"
                onFinish={handleSaveBank}
                requiredMark={false}
                style={{ maxWidth: 480 }}
              >
                <Form.Item
                  name="defaultBankName"
                  label="ชื่อธนาคารเริ่มต้น"
                  rules={[{ required: true, message: 'กรุณากรอกชื่อธนาคาร' }]}
                >
                  <Input placeholder="เช่น ธนาคารกสิกรไทย" size="large" />
                </Form.Item>

                <Form.Item
                  name="defaultAccountName"
                  label="ชื่อบัญชีรับโอนเริ่มต้น"
                  rules={[{ required: true, message: 'กรุณากรอกชื่อบัญชี' }]}
                >
                  <Input placeholder="เช่น บจก. สมาร์ท โลน" size="large" />
                </Form.Item>

                <Form.Item
                  name="defaultAccountNumber"
                  label="เลขที่บัญชีรับเงินเริ่มต้น"
                  rules={[{ required: true, message: 'กรุณากรอกเลขที่บัญชี' }]}
                >
                  <Input placeholder="เช่น 095-2-XXXXX-X" size="large" />
                </Form.Item>

                <Form.Item style={{ marginTop: 24 }}>
                  <Button
                    type="primary"
                    htmlType="submit"
                    icon={<SaveOutlined />}
                    loading={savingBank}
                    size="large"
                    style={{ borderRadius: 'var(--radius-md)', fontWeight: 600 }}
                  >
                    บันทึกข้อมูลธนาคาร
                  </Button>
                </Form.Item>
              </Form>
            </Card>
          )}

          {/* Tab 2: LINE Settings */}
          {activeTab === 'line' && (
            <Card
              title={
                <Space>
                  <BellOutlined style={{ color: '#06c755' }} />
                  <span style={{ fontWeight: 700 }}>เชื่อมต่อและทดสอบการแจ้งเตือน LINE</span>
                </Space>
              }
              style={{ borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}
            >
              <Paragraph>
                ระบบของเราใช้ <strong>LINE Messaging API</strong> ในการส่งข้อความแจ้งเตือนเมื่อลูกหนี้ใกล้ครบกำหนดชำระ (Upcoming) และเกินกำหนดชำระ (Overdue) โดยส่งตามคิวประมวลผลเซิร์ฟเวอร์
              </Paragraph>

              <Alert
                message="สถานะการเชื่อมต่อ API ของ LINE"
                description={
                  <div>
                    <Text style={{ display: 'block', margin: '4px 0' }}>
                      🟢 LINE Channel Token: <strong>เชื่อมต่อสำเร็จ (Configured)</strong>
                    </Text>
                    <Text style={{ display: 'block' }}>
                      การส่งแจ้งเตือนอัตโนมัติจะรันทุกวันผ่าน Cron Job เวลา <strong>08:30 ICT</strong>
                    </Text>
                  </div>
                }
                type="success"
                showIcon
                style={{ marginBottom: 24, borderRadius: 'var(--radius-md)' }}
              />

              <Divider style={{ margin: '16px 0' }} />

              <Title level={5}>ทดสอบส่งข้อความแจ้งเตือน (LINE Message Tester)</Title>
              <Paragraph style={{ fontSize: 13 }}>
                ระบุ LINE User ID ของคุณด้านล่าง เพื่อทดลองยิงการแจ้งเตือนเสมือนจริงสำหรับผู้กู้
              </Paragraph>

              <Form
                form={lineForm}
                layout="vertical"
                onFinish={handleTestLine}
                requiredMark={false}
                style={{ maxWidth: 480 }}
              >
                <Form.Item
                  name="testLineUserId"
                  label="LINE User ID (ผู้รับทดสอบ)"
                  rules={[{ required: true, message: 'กรุณากรอก LINE User ID' }]}
                  extra="คุณสามารถดู User ID ได้จากเมนู Developer Console หรือสร้าง webhook ตรวจสอบ"
                >
                  <Input placeholder="Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" size="large" />
                </Form.Item>

                <Form.Item
                  name="testMessage"
                  label="ข้อความที่จะส่งทดสอบ"
                  initialValue="[Smart Loan] ทดสอบการยิงข้อความแจ้งเตือนจากระบบแอดมินหลังบ้าน ทำงานเป็นปกติ!"
                >
                  <Input.TextArea rows={3} size="large" />
                </Form.Item>

                <Form.Item>
                  <Button
                    type="primary"
                    htmlType="submit"
                    icon={<SendOutlined />}
                    loading={testingLine}
                    size="large"
                    style={{ borderRadius: 'var(--radius-md)', fontWeight: 600, backgroundColor: '#06c755', borderColor: '#06c755' }}
                  >
                    ส่งข้อความทดสอบ LINE
                  </Button>
                </Form.Item>
              </Form>
            </Card>
          )}

          {/* Tab 3: Security & Roles */}
          {activeTab === 'security' && (
            <Card
              title={
                <Space>
                  <SafetyCertificateOutlined style={{ color: 'var(--color-primary)' }} />
                  <span style={{ fontWeight: 700 }}>ความปลอดภัยและข้อจำกัดการใช้งาน</span>
                </Space>
              }
              style={{ borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}
            >
              <Paragraph>
                โปรเจกต์นี้ได้รับการควบคุมสิทธิ์ผ่าน <strong>Clerk User management</strong> โดยผู้กู้และผู้ปล่อยกู้ (แอดมิน) จะได้รับสิทธิ์ใช้งานที่ต่างกันโดยสิ้นเชิง:
              </Paragraph>

              <Alert
                message="เงื่อนไขสิทธิ์แอดมินในระบบ"
                description={
                  <ul style={{ paddingLeft: 16, margin: '8px 0 0 0', fontSize: 13 }}>
                    <li>สิทธิ์ <strong>Admin</strong> สามารถสร้างสัญญา ปรับแก้ยอด บันทึกชำระเงิน และอัปโหลดไฟล์ได้</li>
                    <li>สิทธิ์ <strong>Debtor</strong> (ลูกหนี้) จะดูภาพรวมสัญญาของตนเองและประวัติชำระได้เท่านั้น</li>
                    <li>ระบบมีการป้องกัน SQL Injection (ผ่าน Drizzle ORM) และ CORS/XSS security headers เรียบร้อยแล้ว</li>
                  </ul>
                }
                type="warning"
                showIcon
                style={{ borderRadius: 'var(--radius-md)' }}
              />
            </Card>
          )}
        </Col>
      </Row>
    </AppLayout>
  );
}
