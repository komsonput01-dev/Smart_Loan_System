'use client';

import React from 'react';
import { Card, Typography } from 'antd';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

const { Title } = Typography;

export interface ChartsData {
  loanStatus: { name: string; value: number; color: string }[];
  debtAging: { range: string; amount: number }[];
}

export default function DashboardCharts({ data }: { data?: ChartsData }) {
  if (!data) return null;

  // Format Y-Axis for currency (e.g. 1.2M, 500k)
  const formatYAxis = (tickItem: number) => {
    if (tickItem === 0) return '0';
    if (tickItem >= 1000000) return `${(tickItem / 1000000).toFixed(1)}M`;
    if (tickItem >= 1000) return `${(tickItem / 1000).toFixed(0)}k`;
    return `${tickItem}`;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(value);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ backgroundColor: '#fff', padding: '10px', border: '1px solid #f0f0f0', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
          <p style={{ margin: 0, fontWeight: 600 }}>{label}</p>
          <p style={{ margin: 0, color: payload[0].fill }}>{formatCurrency(payload[0].value)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px', marginBottom: '24px' }}>
      
      {/* Donut Chart */}
      <Card
        style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', border: '1px solid #f0f0f0' }}
        bodyStyle={{ padding: '20px 24px' }}
      >
        <Title level={5} style={{ marginTop: 0, color: '#1e293b', fontWeight: 600 }}>สัดส่วนสถานะลูกหนี้</Title>
        <div style={{ height: 300, width: '100%' }}>
          {data.loanStatus.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.loanStatus}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {data.loanStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any) => [`${value} รายการ`, 'จำนวน']}
                  contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
              ไม่มีข้อมูล
            </div>
          )}
        </div>
      </Card>

      {/* Bar Chart */}
      <Card
        style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', border: '1px solid #f0f0f0' }}
        bodyStyle={{ padding: '20px 24px' }}
      >
        <Title level={5} style={{ marginTop: 0, color: '#1e293b', fontWeight: 600 }}>อายุหนี้ค้างชำระ (Debt Aging)</Title>
        <div style={{ height: 300, width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data.debtAging}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              barSize={40}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="range" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 13 }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 13 }} tickFormatter={formatYAxis} width={60} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
              <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                {data.debtAging.map((entry, index) => {
                  // Color code bars based on severity
                  let color = '#3b82f6'; // 1-30 days (blue)
                  if (index === 1) color = '#f59e0b'; // 31-60 days (yellow)
                  else if (index === 2) color = '#f97316'; // 61-90 days (orange)
                  else if (index === 3) color = '#ef4444'; // >90 days (red)
                  return <Cell key={`cell-${index}`} fill={color} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      
    </div>
  );
}
