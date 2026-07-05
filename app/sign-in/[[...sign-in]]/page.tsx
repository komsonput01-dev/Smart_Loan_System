import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      width: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f9fafb',
      padding: '40px 16px',
      boxSizing: 'border-box',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '400px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '24px',
      }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 700, color: '#111827', margin: 0 }}>
            🏦 Smart Loan System
          </h2>
          <p style={{ fontSize: '14px', color: '#4b5563', marginTop: '8px', marginBottom: 0 }}>
            ระบบจัดการและติดตามหนี้อัจฉริยะ
          </p>
        </div>
        <SignIn appearance={{
          elements: {
            formButtonPrimary: 'bg-emerald-600 hover:bg-emerald-700 text-sm normal-case',
          }
        }} />
      </div>
    </div>
  );
}
