import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-zinc-950 py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 flex flex-col items-center">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            🏦 Smart Loan System
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-zinc-400">
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
