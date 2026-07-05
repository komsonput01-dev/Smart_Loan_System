'use client';

import React, { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card, Button, Typography, Space, Row, Col, Alert, message, List, Divider, Empty } from 'antd';
import {
  FileExcelOutlined,
  DownloadOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
  TableOutlined,
  PieChartOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useUser } from '@clerk/nextjs';
import * as XLSX from 'xlsx';

const { Title, Paragraph, Text } = Typography;

export default function ExportPage() {
  const { user: clerkUser } = useUser();
  const isAdmin = clerkUser?.publicMetadata?.role !== 'debtor';

  const [loading, setLoading] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  if (!isAdmin) {
    return (
      <AppLayout pageTitle="ส่งออก Excel">
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

  const handleExportExcel = async () => {
    setLoading(true);
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
      setLoading(false);
    }
  };

  const reportFeatures = [
    {
      icon: <PieChartOutlined style={{ fontSize: 24, color: 'var(--color-primary)' }} />,
      title: 'แผ่นงาน Summary',
      description: 'สรุปดัชนีชี้วัดหลัก (KPI) ทางการเงินของระบบ เช่น วงเงินกู้รวมทั้งหมด ยอดหนี้คงเหลือ ดอกเบี้ยสะสมที่เก็บได้ อัตราส่วนหนี้เสีย (NPL Ratio) และอัตราส่วนหนี้ค้างชำระ',
    },
    {
      icon: <TableOutlined style={{ fontSize: 24, color: 'var(--color-success)' }} />,
      title: 'แผ่นงาน Raw Data',
      description: 'ข้อมูลรายสัญญาเงินกู้แบบละเอียด ประกอบด้วยข้อมูลผู้กู้ ยอดค้างชำระ ยอดชำระคืนรวม อัตราดอกเบี้ย สถานะสัญญา วันครบกำหนด และประวัติการโอนเงิน เหมาะสำหรับการทำ Pivot Table หรือสร้าง Dashboard ใน Excel',
    },
  ];

  return (
    <AppLayout pageTitle="ส่งออก Excel">
      {contextHolder}

      <div className="page-header">
        <h1 className="page-header-title">ส่งออกข้อมูล Excel</h1>
        <p className="page-header-subtitle">ดาวน์โหลดรายงานสรุปและโครงสร้างข้อมูลเงินกู้ทั้งหมดแบบเรียลไทม์</p>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={14}>
          <Card
            title={
              <Space>
                <FileExcelOutlined style={{ color: '#217346' }} />
                <span>รายงานภาพรวมและสถิติสัญญาเงินกู้</span>
              </Space>
            }
            style={{ borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}
          >
            <Paragraph>
              คุณสามารถส่งออกข้อมูลทั้งหมดในระบบออกมาเป็นไฟล์สเปรดชีต Excel (.xlsx) เพื่อนำไปวิเคราะห์ผลต่อ ทำบัญชี หรือพิมพ์เป็นเอกสารออฟไลน์ได้โดยตรง ไฟล์รายงานจะประกอบด้วยแผ่นงานย่อย 2 แผ่น:
            </Paragraph>

            <List
              itemLayout="horizontal"
              dataSource={reportFeatures}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={item.icon}
                    title={<span style={{ fontWeight: 600 }}>{item.title}</span>}
                    description={item.description}
                  />
                </List.Item>
              )}
            />

            <Divider style={{ margin: '20px 0' }} />

            <div style={{ display: 'flex', justifyContent: 'flex-start', gap: 12 }}>
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                loading={loading}
                onClick={handleExportExcel}
                size="large"
                style={{
                  borderRadius: 'var(--radius-md)',
                  fontWeight: 600,
                  backgroundColor: '#217346',
                  borderColor: '#217346',
                }}
              >
                ดาวน์โหลดรายงาน Excel (.xlsx)
              </Button>
            </div>
          </Card>
        </Col>

        <Col xs={24} md={10}>
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Alert
              message="มาตรฐานข้อมูลและความปลอดภัย"
              description="ข้อมูลที่ส่งออกจะถูกจำกัดเฉพาะข้อมูลการเงินทั่วไป หมายเลขโทรศัพท์ และบัญชีธนาคาร โดยไม่มีข้อมูลคีย์ลับสำหรับการเข้าถึงระบบ หรือข้อมูลยืนยันตัวตนเชิงลึกเพื่อความปลอดภัยด้านข้อมูล (PDPA)"
              type="info"
              showIcon
              icon={<InfoCircleOutlined />}
              style={{ borderRadius: 'var(--radius-md)' }}
            />

            <Card
              title="แนะนำสำหรับการนำไปวิเคราะห์ต่อ"
              size="small"
              style={{ borderRadius: 'var(--radius-lg)' }}
            >
              <Paragraph style={{ fontSize: 13 }}>
                ในแผ่นงาน <strong>Raw_Data</strong> คอลัมน์ทั้งหมดได้รับการจัดรูปแบบแบบแบน (Flat Structure) เพื่อให้คุณสามารถเลือกคอลัมน์ทั้งหมดแล้วกด <strong>Insert &gt; Pivot Table</strong> ใน Microsoft Excel หรือ Google Sheets เพื่อจัดหมวดหมู่ลูกหนี้ แยกสถิติตามประเภทเงื่อนไขดอกเบี้ย หรือกรองดูเฉพาะรายธนาคารรับชำระได้อย่างง่ายดาย
              </Paragraph>
            </Card>
          </Space>
        </Col>
      </Row>
    </AppLayout>
  );
}
