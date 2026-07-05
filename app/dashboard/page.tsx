'use client';

import React from 'react';
import AppLayout from '@/components/layout/AppLayout';
import KPICards from '@/components/dashboard/KPICards';
import DebtorTable from '@/components/dashboard/DebtorTable';
import { message } from 'antd';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const router = useRouter();
  const [messageApi, contextHolder] = message.useMessage();

  const handleView = (id: string) => {
    router.push(`/dashboard/loans/${id}`);
  };

  const handleNotify = (id: string) => {
    messageApi.success({
      content: 'ส่งแจ้งเตือน LINE เรียบร้อยแล้ว',
      icon: '🔔',
    });
  };

  const handlePayment = (id: string) => {
    router.push(`/dashboard/payments?loanId=${id}`);
  };

  return (
    <AppLayout pageTitle="ภาพรวมระบบ">
      {contextHolder}

      {/* Page heading */}
      <div className="page-header">
        <h1 className="page-header-title">ภาพรวมระบบสินเชื่อ</h1>
        <p className="page-header-subtitle">
          ข้อมูล ณ วันที่{' '}
          {new Date().toLocaleDateString('th-TH', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      {/* KPI Summary Cards */}
      <KPICards />

      {/* Traffic Light Debtor Table */}
      <DebtorTable
        onView={handleView}
        onNotify={handleNotify}
        onPayment={handlePayment}
      />
    </AppLayout>
  );
}
