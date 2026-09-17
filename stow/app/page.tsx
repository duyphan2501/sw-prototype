import Chat from "@/components/Chat";

export default function Home() {
  return (
    <main className="flex flex-col h-screen max-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200/80 px-4 py-3 sm:py-4 shadow-xs shrink-0">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm tracking-wider shadow-xs">
              MS
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight leading-tight">
                MyStorage Assistant
              </h1>
              <p className="text-xs text-slate-500">Storage estimation prototype</p>
            </div>
          </div>
        </div>
      </header>

      {/* Chat Workspace */}
      <section className="flex-1 overflow-hidden p-0 sm:p-4 md:p-6 flex flex-col">
        <Chat />
      </section>
    </main>
  );
}
