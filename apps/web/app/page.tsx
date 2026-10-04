import { getAppStatus } from '@/src/index';

export default function HomePage() {
  const appStatus = getAppStatus();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-white text-gray-900">
      <div className="max-w-2xl text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900">Unsheet</h1>
        <p className="text-lg text-gray-600">
          Deterministic spreadsheet intelligence and dashboard platform.
        </p>
        <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
          Status: {appStatus.status} (Engine: {appStatus.engine.name})
        </div>
      </div>
    </main>
  );
}
