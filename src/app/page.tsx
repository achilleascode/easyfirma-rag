import { ChatWindow } from "@/components/ChatWindow";

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
            EF
          </div>
          <div>
            <h1 className="text-sm font-semibold text-gray-900">
              EasyFirma Support
            </h1>
            <p className="text-xs text-gray-500">
              Rechnungsprogramm — Hilfe &amp; Anleitungen
            </p>
          </div>
        </div>
      </header>

      <ChatWindow />
    </div>
  );
}
