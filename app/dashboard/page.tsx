'use client';

import React, { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import KPICards, { type KPIData } from '@/components/dashboard/KPICards';
import DebtorTable from '@/components/dashboard/DebtorTable';
import type { Debtor } from '@/components/dashboard/DebtorCard';
import { message, Spin } from 'antd';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';

export default function DashboardPage() {
  const { user: clerkUser } = useUser();
  const isAdmin = clerkUser?.publicMetadata?.role !== 'debtor';

  const router = useRouter();
  const [messageApi, contextHolder] = message.useMessage();

  const [kpi, setKpi] = useState<KPIData | undefined>(undefined);
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [loading, setLoading] = useState(true);

  // Map API response → Debtor interface (used by DebtorTable)
  const mapToDebtor = useCallback((row: Record<string, unknown>): Debtor => {
    return {
      id: String(row.loanId ?? row.userId ?? ''),
      name: String(row.name ?? 'ไม่ระบุชื่อ'),
      loanId: String(row.note ?? row.loanId ?? '').replace('รหัสสัญญา: ', '') || String(row.loanId ?? '').substring(0, 12),
      principal: Number(row.principal ?? 0),
      outstanding: Number(row.outstanding ?? 0),
      interestRate: Number(row.interestRate ?? 0),
      interestType: String(row.interestType ?? 'flat_monthly') as Debtor['interestType'],
      dueDate: String(row.dueDate ?? ''),
      status: String(row.status ?? 'active') as Debtor['status'],
      overdueDays: Number(row.overdueDays ?? 0),
      phone: String(row.phone ?? ''),
    };
  }, []);

  const [statusFilter, setStatusFilter] = useState<'active' | 'upcoming' | 'overdue' | 'closed' | 'npl' | 'all'>('all');

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dashboard');
      if (!res.ok) throw new Error('โหลดข้อมูลไม่สำเร็จ');
      const data = await res.json();

      // Map KPI
      setKpi({
        totalPrincipal: Number(data.kpi?.totalPrincipal ?? 0),
        collectedInterest: Number(data.kpi?.totalInterestCollected ?? 0),
        upcomingCount: Number(data.kpi?.upcomingCount ?? 0),
        nplCount: Number(data.kpi?.nplCount ?? 0),
        totalDebtors: Number(data.kpi?.totalLoans ?? 0),
        activeCount: Number(data.kpi?.activeCount ?? 0),
        overdueCount: Number(data.kpi?.overdueCount ?? 0),
      });

      // Map debtor rows
      const mapped: Debtor[] = (data.debtors ?? []).map(mapToDebtor);
      setDebtors(mapped);
    } catch (err: unknown) {
      messageApi.error(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  }, [messageApi, mapToDebtor]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleView = (id: string) => {
    router.push(`/dashboard/loans/${id}`);
  };

  const handleNotify = async (id: string) => {
    const key = 'notify-loading';
    messageApi.open({
      key,
      type: 'loading',
      content: 'กำลังส่งการแจ้งเตือนทาง LINE...',
      duration: 0,
    });
    try {
      const res = await fetch(`/api/loans/${id}/notify`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        messageApi.open({
          key,
          type: 'success',
          content: 'ส่งแจ้งเตือนทาง LINE เรียบร้อยแล้ว 🔔',
          duration: 3,
        });
      } else {
        messageApi.open({
          key,
          type: 'error',
          content: data.error ?? 'ส่งแจ้งเตือนไม่สำเร็จ',
          duration: 4,
        });
      }
    } catch {
      messageApi.open({
        key,
        type: 'error',
        content: 'เกิดข้อผิดพลาดในการเชื่อมต่อเครือข่าย',
        duration: 3,
      });
    }
  };

  const handlePayment = (id: string) => {
    router.push(`/dashboard/payments?loanId=${id}`);
  };

  const handleCardClick = (status: string) => {
    setStatusFilter(status as any);
    setTimeout(() => {
      document.getElementById('debtor-table-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  };

  return (
    <AppLayout pageTitle={isAdmin ? 'ภาพรวมระบบ' : 'ภาพรวมสัญญาของฉัน'}>
      {contextHolder}

      {/* Page heading */}
      <div className="page-header">
        <h1 className="page-header-title">
          {isAdmin ? 'ภาพรวมระบบสินเชื่อ' : 'ภาพรวมสัญญาเงินกู้ของฉัน'}
        </h1>
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

      {/* KPI Summary Cards — real data */}
      <KPICards data={kpi} loading={loading} onCardClick={handleCardClick} />

      {/* Traffic Light Debtor Table — real data */}
      {loading && debtors.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: 12, color: 'var(--color-text-muted)' }}>กำลังโหลดข้อมูล...</div>
        </div>
      ) : (
        <DebtorTable
          data={debtors}
          loading={loading}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter as any}
          onView={handleView}
          onNotify={handleNotify}
          onPayment={handlePayment}
        />
      )}
    </AppLayout>
  );
}
